# Plan 005: Add a timeout to the ORDFS image fetch

> **Executor instructions**: Follow step by step; run each verification command
> and confirm the expected result. Honor STOP conditions. Update this plan's row
> in `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat 40578f1..HEAD -- backend/handlers/avatar.go`
> If it changed, compare the excerpt below to the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (reliability)
- **Planned at**: commit `40578f1`, 2026-06-16

## Why this matters

The avatar handler fetches image bytes from ORDFS with a bare `http.Get(url)`,
which uses Go's default client with **no timeout**. If ORDFS stalls (slow,
hung connection, or under attack), the request goroutine blocks indefinitely.
Under load these accumulate until the backend exhausts goroutines/connections
and becomes unresponsive to all routes. A bounded timeout converts an
indefinite hang into a clean error (and, when a default image is supplied,
a redirect to it).

## Current state

```go
// backend/handlers/avatar.go:124
} else {
	// Fetch from ORDFS
	url := fmt.Sprintf("%s/content/%s", h.ordfsURL, outpoint)
	resp, err := http.Get(url)            // <-- no timeout
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).SendString("Failed to fetch image from ORDFS")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.Status(fiber.StatusNotFound).SendString("Image not found on ORDFS")
	}
	// ... ContentLength check + io.LimitReader(resp.Body, maxImageBytes+1) ...
}
```

`net/http` is already imported. `time` is already imported (used for
`cacheTTL`). The size cap (`maxImageBytes`, `io.LimitReader`) is already in place
and must be preserved.

**Convention**: the handler returns simple status + string errors; keep that.

## Commands you will need

| Purpose | Command (from `backend/`) | Expected |
|---------|---------------------------|----------|
| Build   | `go build ./...`          | exit 0   |
| Vet     | `go vet ./...`            | exit 0   |
| Test    | `go test ./...`           | all pass |

## Scope

**In scope**:
- `backend/handlers/avatar.go` — the ORDFS fetch in `Handle` only.

**Out of scope**:
- The size-cap / `io.LimitReader` logic — keep as-is.
- Caching logic, resize logic, content-type detection.
- Introducing a shared package-level client is acceptable but keep it within
  `avatar.go`; do not refactor other handlers.

## Git workflow

- Branch: `advisor/005-ordfs-timeout`
- Commit style: `Add timeout to ORDFS image fetch`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Use a context-bound request with a timeout

Replace the bare `http.Get(url)` with a request that has a deadline. Use a
modest timeout (ORDFS is an image gateway; 15s is generous). Prefer a
context-based request so the read is also bounded:

```go
url := fmt.Sprintf("%s/content/%s", h.ordfsURL, outpoint)

ctx, cancel := context.WithTimeout(c.Context(), 15*time.Second)
defer cancel()
req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
if err != nil {
	return c.Status(fiber.StatusInternalServerError).SendString("Failed to build ORDFS request")
}
resp, err := http.DefaultClient.Do(req)
if err != nil {
	return c.Status(fiber.StatusBadGateway).SendString("Failed to fetch image from ORDFS")
}
defer resp.Body.Close()
```

Notes:
- Add `"context"` to the import block (alphabetical, top of file).
- `c.Context()` returns Fiber's request context (a `context.Context`); using it
  as parent means a client disconnect also cancels the upstream fetch. If
  `c.Context()` does not satisfy `context.Context` in the installed Fiber
  version, use `context.Background()` as the parent instead.
- Keep everything after `defer resp.Body.Close()` (the `StatusCode` check, the
  `ContentLength` cap, the `io.LimitReader` read) exactly as it is now.
- Changing the connection-error status from 500 to 502 (`StatusBadGateway`) is
  intentional and more accurate; keep the 404 for non-200 responses.

**Verify**: `go build ./...` → exit 0.

### Step 2: Full suite

**Verify**: `go build ./...` && `go vet ./...` && `go test ./...` → all exit 0.

## Test plan

- This is an I/O timeout; a hermetic unit test would need an HTTP server stub. A
  cheap, optional test: start an `httptest.NewServer` whose handler sleeps longer
  than a short injected timeout and assert the fetch returns an error. This
  requires the timeout to be injectable (e.g. a package var) — only do this if it
  does not force a wider refactor. Otherwise rely on build/vet and manual
  reasoning, and note the absence of an automated timeout test in your report.
- Verification: `go test ./...` exits 0.

## Done criteria

ALL must hold:

- [ ] `grep -n "http.Get(" backend/handlers/avatar.go` returns nothing.
- [ ] The fetch uses `http.NewRequestWithContext` with a `context.WithTimeout`.
- [ ] The size cap (`io.LimitReader(resp.Body, maxImageBytes+1)`) and the
      `ContentLength` check are still present and unchanged.
- [ ] `go build ./...`, `go vet ./...`, `go test ./...` all exit 0.
- [ ] `git status` shows only `avatar.go` (plus `plans/README.md`).
- [ ] `plans/README.md` row for 005 updated.

## STOP conditions

Stop and report if:

- The excerpt doesn't match live code (drift).
- `c.Context()` is not usable as a `context.Context` parent and you are unsure —
  use `context.Background()` and note it (do not block).
- Build fails twice after a reasonable fix.

## Maintenance notes

- If a shared `*http.Client` with `Timeout` is later introduced for all upstream
  calls (ORDFS, 1sat-stack), this per-request context can be simplified — but the
  per-request timeout is correct and sufficient now.
- Reviewer: confirm the body read remains capped (the DoS protection from the
  existing `maxImageBytes` cap must not be lost in the edit).
