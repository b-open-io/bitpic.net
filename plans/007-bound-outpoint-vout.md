# Plan 007: Bound the outpoint vout to a valid uint32

> **Executor instructions**: Follow step by step; run each verification command
> and confirm the expected result. Honor STOP conditions. Update this plan's row
> in `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat 40578f1..HEAD -- backend/bitpic/parser.go`
> If it changed, compare the excerpt below to live code; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-backend-characterization-tests.md (extends its test)
- **Category**: bug (correctness)
- **Planned at**: commit `40578f1`, 2026-06-16

## Why this matters

`isValidOutpoint` validates the vout as "one or more digits" with no upper
bound. A Bitcoin output index is a 32-bit unsigned integer (max 4,294,967,295),
but the current check accepts e.g. `"<txid>_99999999999999999999"`. Such bogus
references pass validation and get indexed/stored, producing malformed ORDFS
URLs downstream and polluting the database with values that can never correspond
to a real output. Bounding vout to uint32 rejects them at the parse boundary.

## Current state

```go
// backend/bitpic/parser.go:172
// isValidOutpoint validates a txid_vout reference.
func isValidOutpoint(outpoint string) bool {
	parts := strings.Split(outpoint, "_")
	if len(parts) != 2 || len(parts[0]) != 64 {
		return false
	}
	for _, c := range parts[0] {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	if len(parts[1]) == 0 {
		return false
	}
	for _, c := range parts[1] {
		if c < '0' || c > '9' {   // digits only, but no magnitude bound
			return false
		}
	}
	return true
}
```

`strconv` is **not** currently imported in `parser.go` (current imports:
`crypto/sha256`, `encoding/hex`, `errors`, `fmt`, `strings`, plus the two
go-sdk/go-templates packages). You will add `strconv`.

This function is exercised by the tests created in plan 001
(`backend/bitpic/parser_test.go`).

## Commands you will need

| Purpose | Command (from `backend/`) | Expected |
|---------|---------------------------|----------|
| Build   | `go build ./...`          | exit 0   |
| Vet     | `go vet ./...`            | exit 0   |
| Test    | `go test ./bitpic/ -v`    | all pass |

## Scope

**In scope**:
- `backend/bitpic/parser.go` — `isValidOutpoint` and the import block only.
- `backend/bitpic/parser_test.go` — add overflow case (created by plan 001).

**Out of scope**:
- `normalizeOutpoint`, `parseUriListRef`, any other function.
- The leading-zero question (e.g. `"_007"`): leave digit parsing permissive
  beyond the magnitude bound; do not add stricter formatting rules.

## Git workflow

- Branch: `advisor/007-vout-bound`
- Commit style: `Bound outpoint vout to uint32 range`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Replace the digit loop with a bounded parse

In `isValidOutpoint`, replace the manual digit loop over `parts[1]` with a
`strconv.ParseUint` into 32 bits. Keep the txid hex/length checks unchanged:

```go
if len(parts[1]) == 0 {
	return false
}
if _, err := strconv.ParseUint(parts[1], 10, 32); err != nil {
	return false
}
return true
```

Add `"strconv"` to the import block (keep imports grouped/alphabetical within
the standard-library group). `ParseUint(s, 10, 32)` rejects non-digits, negative
signs, and anything above 4,294,967,295.

**Verify**: `go build ./...` → exit 0.

### Step 2: Add the overflow test case (plan 001's parser test)

In `backend/bitpic/parser_test.go`, add to the `isValidOutpoint` table:
- `"<txid>_4294967295"` → true (max valid uint32)
- `"<txid>_4294967296"` → false (one over → overflow)
- `"<txid>_99999999999999999999"` → false (far overflow)

(`<txid>` = a 64-char hex string constant, as already used in that test file.)

**Verify**: `go test ./bitpic/ -run TestParse -v` → all subtests PASS, including
the new overflow cases.

### Step 3: Full suite

**Verify**: `go build ./...` && `go vet ./...` && `go test ./...` → all exit 0.

## Test plan

- Extend the existing `isValidOutpoint` table in `parser_test.go` with the three
  boundary cases above (max valid, +1, far overflow).
- Verification: `go test ./bitpic/ -v` → all pass.

## Done criteria

ALL must hold:

- [ ] `isValidOutpoint` uses `strconv.ParseUint(parts[1], 10, 32)`; the manual
      per-rune digit loop over `parts[1]` is gone.
- [ ] `parser_test.go` includes the `4294967295` (true) and `4294967296` (false)
      cases and they pass.
- [ ] `go build ./...`, `go vet ./...`, `go test ./...` all exit 0.
- [ ] `git status` shows only `parser.go` + `parser_test.go` (plus `plans/README.md`).
- [ ] `plans/README.md` row for 007 updated.

## STOP conditions

Stop and report if:

- Plan 001 is not DONE (`parser_test.go` doesn't exist) — either do plan 001
  first, or add the minimal test file here and note the deviation.
- The excerpt doesn't match live code (drift).
- Build/test fails twice after a reasonable fix.

## Maintenance notes

- The frontend has analogous outpoint handling (`lib/transaction-builder.ts`
  `normalizeOutpoint` / validation). Keeping the vout-bound rule consistent there
  is a candidate follow-up but is out of scope here.
- Reviewer: confirm `0` and `4294967295` both remain valid (inclusive bounds).
