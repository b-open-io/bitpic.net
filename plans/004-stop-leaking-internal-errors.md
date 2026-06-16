# Plan 004: Stop returning raw internal error strings to clients

> **Executor instructions**: Follow step by step; run each verification command
> and confirm the expected result. Honor STOP conditions. Update this plan's row
> in `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat 40578f1..HEAD -- backend/main.go backend/handlers/broadcast.go`
> If either changed, compare the excerpts below to the live code; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (soft: 001 if you add the broadcast test)
- **Category**: security
- **Planned at**: commit `40578f1`, 2026-06-16

## Why this matters

Two backend paths return raw Go error strings directly to unauthenticated
clients. The global error handler echoes `err.Error()` (which can include Redis
connection details), and `/api/broadcast` returns the BitPic parser's error
verbatim — including the signature-mismatch message that embeds Bitcoin
addresses: `"public key mismatch (expected <addr>, got <addr>)"`. That leaks
internal architecture and partial identity data and aids reconnaissance. The fix:
return a generic client message while logging the real error server-side.

## Current state

Global handler echoes the raw error:

```go
// backend/main.go:128
func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}
	log.Printf("Unhandled error: method=%s path=%s status=%d error=%v", c.Method(), c.Path(), code, err)
	return c.Status(code).JSON(fiber.Map{
		"error": err.Error(),   // <-- leaks internal detail
	})
}
```

`/api/broadcast` returns parser/extract errors verbatim:

```go
// backend/handlers/broadcast.go:64
txBytes, err := extractTxBytes(req.RawTx)
if err != nil {
	return c.Status(fiber.StatusBadRequest).JSON(BroadcastResponse{
		Success: false,
		Error:   err.Error(),   // <-- ok-ish (hex error) but make consistent
	})
}

data, err := bitpic.ParseTransaction(txBytes)
if err != nil {
	return c.Status(fiber.StatusBadRequest).JSON(BroadcastResponse{
		Success: false,
		Error:   err.Error(),   // <-- leaks "public key mismatch (expected <addr>...)"
	})
}
```

The parser error that leaks an address is built in
`backend/bitpic/verify.go:54`:
`"signature verification failed: public key mismatch (expected %s, got %s)"`.

**Convention**: the codebase already logs with `log.Printf` and already uses
generic client messages elsewhere (e.g. `broadcast.go:87` returns
`"failed to store avatar"` while logging the real error on line 84). Match that
pattern — log detail, return a short generic message.

## Commands you will need

| Purpose | Command (from `backend/`)  | Expected           |
|---------|----------------------------|--------------------|
| Build   | `go build ./...`           | exit 0             |
| Vet     | `go vet ./...`             | exit 0             |
| Test    | `go test ./...`            | all pass           |

## Scope

**In scope**:
- `backend/main.go` (the `errorHandler` function only)
- `backend/handlers/broadcast.go` (the two `Error: err.Error()` sites)

**Out of scope**:
- `backend/bitpic/verify.go` — keep the detailed message; it is correct for
  server logs. Do not change the error text there.
- Other handlers (`paymail.go`, `avatar.go`, etc.) already use generic messages;
  do not touch them.
- Do not change HTTP status codes.

## Git workflow

- Branch: `advisor/004-error-leak`
- Commit style: `Return generic client errors, log details server-side`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Harden the global error handler

In `backend/main.go`, keep the `log.Printf` line (it already records the real
error). Change the response so it does not echo `err.Error()` for server errors.
Preserve the client-facing message only when it is a deliberate `*fiber.Error`
(those are intentional, e.g. 404 text); for everything else return a generic
string. Target shape:

```go
func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	message := "Internal server error"
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		message = e.Message // fiber's own messages are safe/intentional
	}
	log.Printf("Unhandled error: method=%s path=%s status=%d error=%v", c.Method(), c.Path(), code, err)
	return c.Status(code).JSON(fiber.Map{"error": message})
}
```

**Verify**: `go build ./...` → exit 0.

### Step 2: Genericize broadcast error responses

In `backend/handlers/broadcast.go`, replace the two `Error: err.Error()` sites
with logged-detail + generic client text:

- For the `extractTxBytes` failure: log `err` with `log.Printf`, return
  `Error: "Invalid transaction format"`.
- For the `bitpic.ParseTransaction` failure: log `err` with `log.Printf`, return
  `Error: "Invalid BitPic transaction"`.

Keep the status codes (`fiber.StatusBadRequest`). Example for the parse site:

```go
data, err := bitpic.ParseTransaction(txBytes)
if err != nil {
	log.Printf("broadcast: parse failed: %v", err)
	return c.Status(fiber.StatusBadRequest).JSON(BroadcastResponse{
		Success: false,
		Error:   "Invalid BitPic transaction",
	})
}
```

`log` is already imported in `broadcast.go`.

**Verify**: `go build ./...` → exit 0; `go vet ./...` → exit 0.

### Step 3: (Optional, if plan 001 is DONE) lock the behavior with a test

If `backend/handlers` has no test infra this is best-effort. A handler test
needs a Fiber app + mock Redis, which may be heavyweight. If it exceeds ~20
minutes, skip and note it. Do **not** add a Redis dependency to tests.

### Step 4: Full suite

**Verify**: `go build ./...` && `go vet ./...` && `go test ./...` → all exit 0.

## Done criteria

ALL must hold:

- [ ] `grep -n "err.Error()" backend/main.go` returns nothing.
- [ ] `grep -n "Error:   err.Error()" backend/handlers/broadcast.go` returns
      nothing (both sites replaced).
- [ ] The real errors are still logged (`log.Printf` present at each changed site).
- [ ] `go build ./...`, `go vet ./...`, `go test ./...` all exit 0.
- [ ] `git status` shows only `main.go` + `broadcast.go` (plus `plans/README.md`).
- [ ] `plans/README.md` row for 004 updated.

## STOP conditions

Stop and report if:

- The excerpts don't match live code (drift).
- `e.Message` on `*fiber.Error` is not available in the installed Fiber version
  (check `go doc github.com/gofiber/fiber/v2.Error`) — report and fall back to a
  static `"Internal server error"` for all cases.
- A verification command fails twice after a reasonable fix.

## Maintenance notes

- Keep the detailed messages in `verify.go` — they are valuable in logs; only the
  *client-facing* surface is genericized.
- Any new handler should follow this same log-detail / return-generic pattern.
- Reviewer: confirm no remaining handler echoes `err.Error()` to the client
  (`grep -rn "err.Error()" backend/handlers/` — `avatar.go`/`paymail.go` already
  use generic strings; any new occurrence is a regression).
