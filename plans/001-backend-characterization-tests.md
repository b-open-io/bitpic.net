# Plan 001: Establish a Go test baseline for the BitPic verify + parse core

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40578f1..HEAD -- backend/bitpic/`
> If `backend/bitpic/verify.go` or `backend/bitpic/parser.go` changed since
> this plan was written, compare the "Current state" excerpts below against the
> live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `40578f1`, 2026-06-16

## Why this matters

The entire trust model of BitPic rests on two Go functions with **zero tests**:
`bitpic.VerifySignatureBytes` (decides whether an avatar's BSM signature is
valid) and `bitpic.ParseTransaction` (parses untrusted on-chain transactions
and the outpoint/URI references inside them). A regression here silently indexes
forged or malformed avatars, and there is currently no way to catch it. This
plan creates the backend test harness and characterization tests for that core
logic, so every later change (plans 007, 008, 009) has a safety net. There is no
`go test` baseline in the repo today; establishing one is the prerequisite for
all other backend work.

## Current state

The backend is a Go module rooted at `backend/` (module `github.com/b-open-io/bitpic`).
There are **no `*_test.go` files anywhere** in the repo. The two functions under
test:

`backend/bitpic/verify.go` — verifies a BSM signature over arbitrary message
bytes against a claimed public key. It recovers the pubkey from the signature
and compares addresses:

```go
// backend/bitpic/verify.go:21
func VerifySignatureBytes(messageBytes []byte, pubKeyHex, signatureBase64 string) error {
	sigBytes, err := base64.StdEncoding.DecodeString(signatureBase64)
	if err != nil {
		return fmt.Errorf("invalid signature base64: %w", err)
	}
	pubKeyBytes, err := hex.DecodeString(pubKeyHex)
	if err != nil {
		return fmt.Errorf("invalid public key hex: %w", err)
	}
	pubKey, err := ec.ParsePubKey(pubKeyBytes)
	// ...
	recoveredPubKey, wasCompressed, err := compat.PubKeyFromSignature(sigBytes, messageBytes)
	// ...
	// compares providedAddr.AddressString != recoveredAddr.AddressString
}
```

The imports it uses (reuse these exact import paths in tests):

```go
compat "github.com/bsv-blockchain/go-sdk/compat/bsm"
ec "github.com/bsv-blockchain/go-sdk/primitives/ec"
"github.com/bsv-blockchain/go-sdk/script"
```

`backend/bitpic/parser.go` — contains four **unexported** helpers in package
`bitpic` that encode the validation rules. Because tests live in the same
package, they can call these directly:

- `normalizeOutpoint(s string) string` — converts `txid.vout` → `txid_vout`
  (`parser.go:165`).
- `isValidOutpoint(s string) bool` — true only when `s` is `<64-hex>_<digits>`
  (`parser.go:173`).
- `parseUriListRef(data []byte) (uri, refOrigin string, ok bool)` — returns the
  first `ord://` or `b://` line and its normalized outpoint; skips comments,
  blanks, and other schemes (`parser.go:141`).
- `parseBitPicTape(scriptBytes []byte) (paymail, pubKey, sig string, ok bool)`
  — reads 3 pushdata chunks (`parser.go:130`).

Excerpt of the validation rules to characterize:

```go
// backend/bitpic/parser.go:173
func isValidOutpoint(outpoint string) bool {
	parts := strings.Split(outpoint, "_")
	if len(parts) != 2 || len(parts[0]) != 64 { return false }
	// parts[0] must be hex; parts[1] must be non-empty digits
}

// backend/bitpic/parser.go:141 — parseUriListRef
// "ord://<x>" and "b://<x>" are accepted; "#comment", "", "c://..", "https://.." skipped
```

**Repo conventions**: standard Go, table-driven tests with `t.Run` subtests,
package-internal tests (file declares `package bitpic`, not `bitpic_test`, so it
can reach unexported helpers). No third-party assertion library is in `go.mod` —
use the standard library (`if got != want { t.Errorf(...) }`).

## Commands you will need

| Purpose        | Command (run from `backend/`)            | Expected on success            |
|----------------|------------------------------------------|--------------------------------|
| Inspect bsm API| `go doc github.com/bsv-blockchain/go-sdk/compat/bsm` | prints exported funcs |
| Inspect ec API | `go doc github.com/bsv-blockchain/go-sdk/primitives/ec` | prints exported funcs |
| Build          | `go build ./...`                         | exit 0, no output              |
| Vet            | `go vet ./...`                           | exit 0, no output              |
| Test (this pkg)| `go test ./bitpic/ -v`                   | all subtests PASS              |
| Test (all)     | `go test ./...`                          | all PASS (or `no test files`)  |

All `go` commands must be run with the working directory at
`/Users/satchmo/code/bitpic.net/backend` (that is where `go.mod` lives).

## Scope

**In scope** (create these files only):
- `backend/bitpic/verify_test.go` (create)
- `backend/bitpic/parser_test.go` (create)

**Out of scope** (do NOT modify):
- `backend/bitpic/verify.go`, `backend/bitpic/parser.go` — this plan only adds
  tests; it does not change behavior. (Plan 007 changes `isValidOutpoint`
  later — leave that to it.)
- `go.mod` / `go.sum` — do not add dependencies. Standard library only.
- Any other package.

## Git workflow

- Branch: `advisor/001-backend-tests`
- Commit message style (match `git log`, plain imperative): e.g.
  `Add characterization tests for bitpic verify and parser`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Discover the BSM signing API

You need to produce a *valid* signature inside the test. The verification side
uses `compat.PubKeyFromSignature(sigBytes, messageBytes)`. Find the matching
**signing** function and the private-key constructor.

Run `go doc github.com/bsv-blockchain/go-sdk/compat/bsm` and
`go doc github.com/bsv-blockchain/go-sdk/primitives/ec`. Identify:
- how to create a private key (likely `ec.NewPrivateKey()` returning
  `(*PrivateKey, error)`),
- how to BSM-sign a message returning a base64 signature (look for a `Sign`
  function in the `bsm` package; note its exact signature and return type —
  it may return raw bytes you base64-encode, or a base64 string directly),
- how to get the compressed pubkey hex from the private key (commonly
  `priv.PubKey().Compressed()` → `[]byte`, then `hex.EncodeToString`, or a
  `.ToDERHex()`/`.Compressed()` accessor — confirm via `go doc`).

**Verify**: you can state the exact function names and signatures you will call.
If no BSM `Sign` function exists in that package, **STOP and report** (see STOP
conditions) — do not hand-roll the magic-hash signing.

### Step 2: Write `verify_test.go`

Create `backend/bitpic/verify_test.go` with `package bitpic`. Implement a helper
that generates a keypair, signs a message via the API found in Step 1, and
returns `(messageBytes, pubKeyHex, sigBase64)`. Then table-driven tests:

- **valid signature passes**: sign `[]byte("ord://<64-hex>_0")` and a 32-byte
  hash; `VerifySignatureBytes` returns `nil` for each.
- **wrong pubkey fails**: sign with key A, verify against key B's pubkey hex →
  non-nil error.
- **tampered message fails**: sign message M, verify against M' (one byte
  changed) → non-nil error.
- **malformed signature base64**: `sig = "!!!not base64!!!"` → non-nil error.
- **malformed pubkey hex**: `pubKeyHex = "zzzz"` → non-nil error.
- **empty inputs**: `VerifySignatureBytes(nil, "", "")` → non-nil error (must
  not panic).

Use subtests (`t.Run`). Assert error presence/absence, not exact message text
(message wording is not the contract).

**Verify**: `go test ./bitpic/ -run TestVerify -v` → all subtests PASS.

### Step 3: Write `parser_test.go` — helper coverage

Create `backend/bitpic/parser_test.go` with `package bitpic`. Table-driven tests
for the unexported helpers (use a real 64-char hex txid constant, e.g.
`"a1"` repeated 32 times = 64 chars):

- `normalizeOutpoint`:
  - `"<txid>.0"` → `"<txid>_0"`
  - `"<txid>_5"` → unchanged `"<txid>_5"`
  - `"noseparator"` → unchanged
- `isValidOutpoint`:
  - `"<txid>_0"` → true
  - `"<txid>_123"` → true
  - `"<txid>"` (no `_`) → false
  - `"<63hex>_0"` (txid one char short) → false
  - `"<txid>_"` (empty vout) → false
  - `"<txid>_1a"` (non-digit vout) → false
  - `"<non-hex 64 chars>_0"` (e.g. 64 `"g"`) → false
- `parseUriListRef`:
  - `"ord://<txid>_0\n"` → `ok==true`, `uri=="ord://<txid>_0"`, `refOrigin=="<txid>_0"`
  - `"# comment\nb://<txid>.2"` → `ok==true`, `refOrigin=="<txid>_2"`
    (note `.` is normalized to `_`)
  - `"https://example.com/x"` → `ok==false`
  - `"c://deadbeef"` → `ok==false`
  - `""` → `ok==false`
  - multi-line where first valid line wins: `"# c\nord://<txid>_0\nb://<txid>_1"`
    → `refOrigin=="<txid>_0"`

**Verify**: `go test ./bitpic/ -run TestParse -v` → all subtests PASS.

### Step 4: Round-trip `ParseTransaction` test (best-effort)

Attempt one end-to-end test that builds a transaction whose single output's
locking script is a BitPic `image/*` OP_RETURN and asserts `ParseTransaction`
returns `IsRef==false`, a non-empty `ImageHash`, and the expected `Paymail`.

Building the exact locking script requires the same `bitcom` encoding the parser
decodes (`github.com/bitcoin-sv/go-templates/template/bitcom`). Inspect it with
`go doc github.com/bitcoin-sv/go-templates/template/bitcom` for an encode/build
helper. If the package exposes a way to build the multi-protocol script (B +
BitPic) cleanly, write the test. **If it does not, or constructing a valid
signed script proves to need more than ~30 minutes, SKIP this step** and record
in your report that `ParseTransaction` has only indirect coverage via its
helpers — do not block the plan on it. The helper + verify coverage from Steps
2–3 is the required deliverable.

**Verify** (only if written): `go test ./bitpic/ -run TestParseTransaction -v` → PASS.

### Step 5: Full suite green

**Verify**:
- `go build ./...` → exit 0
- `go vet ./...` → exit 0
- `go test ./...` → all PASS (other packages may print `no test files` — that is fine)

## Test plan

- New files: `backend/bitpic/verify_test.go`, `backend/bitpic/parser_test.go`.
- Cases: enumerated in Steps 2–4 (valid path, forged/tampered/ malformed for
  verify; boundary cases for outpoint validation and URI-list parsing).
- Structural pattern: standard-library table-driven Go tests with `t.Run`
  subtests (no external assertion lib).
- Verification: `go test ./bitpic/ -v` → all subtests PASS; `go test ./...` exits 0.

## Done criteria

ALL must hold (run from `backend/`):

- [ ] `backend/bitpic/verify_test.go` and `backend/bitpic/parser_test.go` exist,
      both declaring `package bitpic`.
- [ ] `go test ./bitpic/ -v` shows the valid-signature, wrong-key,
      tampered-message, malformed-base64, malformed-hex cases for verify and the
      `isValidOutpoint` / `parseUriListRef` / `normalizeOutpoint` cases for the
      parser, all PASS.
- [ ] `go vet ./...` exits 0.
- [ ] `go test ./...` exits 0.
- [ ] `git status` shows only the two new test files changed (plus
      `plans/README.md`).
- [ ] `plans/README.md` status row for 001 updated to DONE.

## STOP conditions

Stop and report back (do not improvise) if:

- The `compat/bsm` package has no usable BSM signing function (you cannot
  produce a valid signature from a private key without hand-implementing the
  magic-hash — do not do that).
- The excerpts in "Current state" don't match the live `verify.go` / `parser.go`
  (codebase drifted).
- A verification command fails twice after a reasonable fix attempt.
- Writing any test would require modifying non-test source files or adding a
  dependency to `go.mod`.

## Maintenance notes

- When plan 007 tightens `isValidOutpoint` (uint32 vout bound), the
  `"<txid>_1a"` / overflow cases in `parser_test.go` must be extended — that
  plan owns adding the overflow case.
- If `VerifySignatureBytes` is ever reused for paymail registration (plan 008),
  these tests already lock its contract; keep them green.
- Reviewer should confirm the "valid signature passes" test actually signs with
  the real BSM path (not a stub) — that is the test that proves the harness is
  meaningful.
