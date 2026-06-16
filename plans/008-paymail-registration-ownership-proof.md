# Plan 008: Require a signature proving identity-key control before registering a paymail

> **Executor instructions**: Follow step by step; run each verification command
> and confirm the expected result. Honor STOP conditions. Update this plan's row
> in `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat 40578f1..HEAD -- backend/handlers/paymail.go backend/storage/redis.go lib/api.ts lib/use-wallet.ts`
> If any changed, compare the excerpts below to live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M (touches backend + frontend)
- **Risk**: MED
- **Depends on**: plans/001-backend-characterization-tests.md (reuses + tests `VerifySignatureBytes`)
- **Category**: security
- **Planned at**: commit `40578f1`, 2026-06-16

## Why this matters

`POST /api/paymail/register` accepts a handle, an identity pubkey, and two
addresses with **no proof the caller controls that identity key** — the only
checks are non-empty fields and handle uniqueness. Anyone can claim any free
handle (e.g. a desirable name) and bind it to an arbitrary identity pubkey and
arbitrary payment/ordinal addresses. There is no Sybil resistance and no proof
of control. This plan requires the caller to sign a registration challenge with
the identity key (via the wallet's BSM signing) and verifies that signature
server-side using the existing `bitpic.VerifySignatureBytes`, so only the holder
of the private key for the claimed identity pubkey can register under it.

The signing primitive already exists on both sides:
- **Wallet (frontend)**: `signBsm.execute(ctx, { message })` from `@1sat/actions`
  returns `{ address, pubKey, sig, message }` — `pubKey` is the compressed
  signer pubkey (hex), `sig` is the base64 BSM signature. The SDK applies the
  Bitcoin-Signed-Message prefix automatically (pass the plain string).
- **Backend (Go)**: `bitpic.VerifySignatureBytes(messageBytes, pubKeyHex, sigBase64)`
  recovers the pubkey from the signature and checks it matches the claimed
  pubkey's address (it magic-hashes internally — pass the raw message bytes).
  These two are designed to interoperate (they already do for avatar uploads).

## Current state

### Backend — `backend/handlers/paymail.go:46`

```go
func (h *PaymailHandler) Register(c *fiber.Ctx) error {
	var req storage.PaymailData
	if err := c.BodyParser(&req); err != nil { /* 400 */ }
	if req.Handle == "" { /* 400 */ }
	if req.IdentityPubkey == "" { /* 400 */ }
	if req.PaymentAddress == "" { /* 400 */ }
	if req.OrdAddress == "" { /* 400 */ }
	existing, _ := h.redis.GetPaymail(req.Handle)
	if existing != nil { /* 409 Handle already taken */ }
	if err := h.redis.SetPaymail(&req); err != nil { /* 500 */ }
	return c.Status(fiber.StatusCreated).JSON(...)
}
```

`storage.PaymailData` (`backend/storage/redis.go:286`):

```go
type PaymailData struct {
	Handle         string `json:"handle"`
	IdentityPubkey string `json:"identityPubkey"`
	PaymentAddress string `json:"paymentAddress"`
	OrdAddress     string `json:"ordAddress"`
	CreatedAt      int64  `json:"createdAt"`
}
```

The `handlers` package already imports `github.com/b-open-io/bitpic/bitpic`
(see `backend/handlers/broadcast.go`), so `bitpic.VerifySignatureBytes` is
reachable with no import-cycle risk.

### Frontend

The register call lives in the API client and the paymail page/component. You
must **locate them** (do not assume the exact code):
- Run `grep -rn "paymail/register" lib/ app/ components/` to find the fetch.
- Likely in `lib/api.ts` (a `registerPaymail`-style function) called from
  `app/paymail/` or a component under `components/`.
- The wallet context (`ctx`) and identity info are exposed by
  `lib/use-wallet.ts` (it surfaces `ctx`, `pubKey`/`identityKey`, addresses).
  `signBsm` is imported from `@1sat/actions`.

## The challenge message (MUST be byte-identical on both sides)

```
BitPic paymail registration
handle:<handle>
pubkey:<identityPubkey>
ts:<unixSeconds>
```

Built in Go as:
```go
msg := fmt.Sprintf("BitPic paymail registration\nhandle:%s\npubkey:%s\nts:%d",
	req.Handle, req.IdentityPubkey, req.SignedAt)
```
Built in TS as:
```ts
const message = `BitPic paymail registration\nhandle:${handle}\npubkey:${identityPubkey}\nts:${signedAt}`;
```
`signedAt` is `Math.floor(Date.now() / 1000)`. The server accepts it only within
±300 seconds of its own clock (replay window bound).

## Commands you will need

| Purpose            | Command                                | Expected |
|--------------------|----------------------------------------|----------|
| Backend build/vet  | `cd backend && go build ./... && go vet ./...` | exit 0 |
| Backend test       | `cd backend && go test ./...`          | all pass |
| Frontend typecheck | `bun run typecheck`                    | exit 0   |
| Frontend lint      | `bun run lint`                         | exit 0   |
| Frontend build     | `bun run build`                        | exit 0   |

## Scope

**In scope**:
- `backend/handlers/paymail.go` — `Register` (add a request struct + verification)
- `backend/bitpic/verify_test.go` — add a registration round-trip test (optional,
  if plan 001 exists)
- The frontend register call site (located via grep) + its caller that triggers
  signing — typically `lib/api.ts` and one page/component under `app/paymail/`
  or `components/`.

**Out of scope**:
- `storage.PaymailData` schema and `SetPaymail` (keep storage shape; the proof is
  verified, not stored).
- Other paymail endpoints (`Get`, `CheckAvailable`, `GetByPubkey`).
- Avatar upload signing (already works — do not touch).

## Git workflow

- Branch: `advisor/008-registration-proof`
- Commit style: `Require identity-key signature to register a paymail`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Backend — add a request type with signature fields

In `backend/handlers/paymail.go`, define a request struct (instead of binding
`storage.PaymailData` directly) so the signature/timestamp are received without
changing the stored schema:

```go
type registerRequest struct {
	Handle         string `json:"handle"`
	IdentityPubkey string `json:"identityPubkey"`
	PaymentAddress string `json:"paymentAddress"`
	OrdAddress     string `json:"ordAddress"`
	Signature      string `json:"signature"`
	SignedAt       int64  `json:"signedAt"`
}
```

### Step 2: Backend — verify the proof in `Register`

Rewrite `Register` to: parse `registerRequest`; keep the four non-empty checks
plus require `Signature != ""` and `SignedAt != 0`; check freshness; rebuild the
challenge; verify; then map to `storage.PaymailData` and store. Shape:

```go
func (h *PaymailHandler) Register(c *fiber.Ctx) error {
	var req registerRequest
	if err := c.BodyParser(&req); err != nil { /* 400 Invalid request body */ }

	// non-empty checks for Handle, IdentityPubkey, PaymentAddress, OrdAddress
	// (keep existing messages); add:
	if req.Signature == "" || req.SignedAt == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Signature is required"})
	}

	// Freshness: signed within the last 5 minutes (and not in the far future).
	now := time.Now().Unix()
	if req.SignedAt > now+300 || req.SignedAt < now-300 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Signature expired"})
	}

	msg := fmt.Sprintf("BitPic paymail registration\nhandle:%s\npubkey:%s\nts:%d",
		req.Handle, req.IdentityPubkey, req.SignedAt)
	if err := bitpic.VerifySignatureBytes([]byte(msg), req.IdentityPubkey, req.Signature); err != nil {
		log.Printf("register: signature verification failed for %s: %v", req.Handle, err)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid signature"})
	}

	existing, _ := h.redis.GetPaymail(req.Handle)
	if existing != nil { /* 409 Handle already taken */ }

	data := &storage.PaymailData{
		Handle:         req.Handle,
		IdentityPubkey: req.IdentityPubkey,
		PaymentAddress: req.PaymentAddress,
		OrdAddress:     req.OrdAddress,
	}
	if err := h.redis.SetPaymail(data); err != nil { /* 500 */ }
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"paymail": req.Handle + "@bitpic.net",
	})
}
```

Add imports as needed: `fmt`, `log`, `time`, and
`github.com/b-open-io/bitpic/bitpic` and `github.com/b-open-io/bitpic/storage`
(storage is already imported). Verify the import path for the bitpic package by
copying it from `backend/handlers/broadcast.go`.

**Verify**: `cd backend && go build ./... && go vet ./...` → exit 0.

### Step 3: Backend — test the proof (if plan 001 done)

In `backend/bitpic/verify_test.go` (or a new `paymail_register_test.go` in
package `handlers` if you prefer handler-level), add a test that:
- builds the exact challenge string for a handle + a generated keypair's pubkey
  + a timestamp,
- signs it with the same BSM signing path used in plan 001's verify test,
- asserts `VerifySignatureBytes` returns nil,
- asserts a signature over a *different* handle's message fails.

This proves the message format round-trips. **Verify**:
`cd backend && go test ./... -run Register -v` → pass (or skip with a note if
plan 001's signing helper is unavailable).

### Step 4: Frontend — sign before registering

Locate the register fetch (Step "Current state" grep). Refactor so that, before
POSTing, the caller:

1. Computes `signedAt = Math.floor(Date.now() / 1000)`.
2. Builds the `message` (exact format above) using the handle and the identity
   pubkey to be registered.
3. Calls `const r = await signBsm.execute(ctx, { message });` and checks
   `if (r.error) throw new Error(r.error);`.
4. Uses `r.pubKey` as `identityPubkey` in the payload (this guarantees the
   registered pubkey matches the signer — do not source the pubkey from a
   different call), and sends `signature: r.sig` and `signedAt`.

The POST body becomes:
```ts
{ handle, identityPubkey: r.pubKey, paymentAddress, ordAddress, signature: r.sig, signedAt }
```

Note: because `identityPubkey` must equal the signer pubkey, build the `message`
in two phases if needed — but the message embeds `pubkey:<identityPubkey>`, and
you only know `r.pubKey` *after* signing. Resolve this by getting the identity
pubkey first from the wallet (it is available via `lib/use-wallet.ts` —
`pubKey`/`identityKey`, or `getProfile.execute(ctx, {})` → no pubkey there, so
use the wallet's identity key), building the message with it, signing, and then
asserting `r.pubKey === identityPubkey` before sending. If they differ, throw a
clear error ("wallet signed with a different key") — do not silently send
mismatched values.

`signBsm` import: `import { signBsm } from "@1sat/actions";` (match how other
`@1sat/actions` calls are imported in the file). `ctx` comes from the wallet hook.

**Verify**: `bun run typecheck` → exit 0; `bun run lint` → exit 0;
`bun run build` → exit 0.

### Step 5: Full verification

**Verify**:
- `cd backend && go build ./... && go vet ./... && go test ./...` → all exit 0.
- `bun run typecheck && bun run lint && bun run build` → all exit 0.

## Test plan

- Backend: round-trip signature test (Step 3) — valid passes, wrong-handle fails.
- Frontend: typecheck/lint/build (the signing flow needs a wallet, so an
  automated unit test is impractical; verify the message string is constructed
  identically to the Go side by eye).
- Manual end-to-end (optional, needs wallet + running backend): register a new
  handle succeeds; replaying the same POST after 6 minutes returns "Signature
  expired"; tampering with the handle in the body returns "Invalid signature".

## Done criteria

ALL must hold:

- [ ] `Register` rejects requests without a valid signature (401 "Invalid
      signature") and stale ones (400 "Signature expired").
- [ ] The challenge string is byte-identical in `paymail.go` and the frontend
      (same field order, `\n` separators, `ts:` last).
- [ ] `identityPubkey` sent by the frontend equals the `signBsm` result's
      `pubKey`.
- [ ] `cd backend && go build ./... && go vet ./... && go test ./...` exit 0.
- [ ] `bun run typecheck && bun run lint && bun run build` exit 0.
- [ ] `git status` shows only the in-scope files (plus `plans/README.md`).
- [ ] `plans/README.md` row for 008 updated.

## STOP conditions

Stop and report (do not improvise) if:

- The frontend register flow cannot supply a wallet `ctx` to `signBsm` at the
  call site (the architecture differs from the assumption) — report what you
  found and where the register call actually originates.
- `signBsm.execute` is not exported from `@1sat/actions` in the installed version
  (`grep -rn "signBsm" node_modules/@1sat/actions/dist` or check its types).
- The excerpts don't match live code (drift).
- Any verification fails twice after a reasonable fix.
- You find that the wallet's identity key returned to the frontend cannot match
  the `signBsm` pubKey (e.g. signing uses a derived key) — this breaks the proof
  model; stop and report rather than registering mismatched keys.

## Maintenance notes

- This binds proof to `{handle, pubkey, ts}` with a 5-minute window and relies on
  handle-uniqueness for anti-replay across registrations. A stricter design
  issues a server-side nonce (stored in Redis with a short TTL) and signs that;
  consider it if replay-within-window or multi-handle abuse becomes a concern.
- For full alignment, the identity key that signs registration should be the same
  key that signs the paymail's BitPic avatar uploads; if avatar uploads use a
  different key, document the relationship.
- Reviewer: confirm the two challenge strings match exactly (a single differing
  byte makes every registration fail) and that the freshness window is enforced
  on both bounds (past and future).
