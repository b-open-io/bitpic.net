# Plan 009: Replace the O(N) pubkey lookup with a Redis reverse index

> **Executor instructions**: Follow step by step; run each verification command
> and confirm the expected result. Honor STOP conditions. Update this plan's row
> in `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat 40578f1..HEAD -- backend/storage/redis.go`
> If it changed, compare the excerpts below to live code; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/001-backend-characterization-tests.md (test harness pattern)
- **Category**: perf
- **Planned at**: commit `40578f1`, 2026-06-16

## Why this matters

`GetPaymailByPubkey` lists **every** registered handle and fetches each one to
find a pubkey match — an O(N) scan with N Redis round-trips per lookup. It is
called on `/api/paymail/lookup/:pubkey` and on the upload path (to find a
wallet's existing paymail), so lookup latency grows linearly with total
registrations. A reverse index (`pubkey -> handle`) makes it O(1). Low impact at
today's volume, but it is a latent scaling cliff on a hot path and the fix is
contained to the storage layer.

## Current state

```go
// backend/storage/redis.go:337
func (r *RedisClient) GetPaymailByPubkey(pubkey string) (*PaymailData, error) {
	handles, err := r.client.SMembers(r.ctx, "paymail:index").Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get paymail index: %w", err)
	}
	for _, handle := range handles {           // O(N) scan, N GETs
		data, err := r.GetPaymail(handle)
		if err != nil { continue }
		if data != nil && strings.EqualFold(data.IdentityPubkey, pubkey) {
			return data, nil
		}
	}
	return nil, nil
}
```

`SetPaymail` currently writes the record + adds the handle to a set index:

```go
// backend/storage/redis.go:295
func (r *RedisClient) SetPaymail(data *PaymailData) error {
	if data.CreatedAt == 0 { data.CreatedAt = time.Now().Unix() }
	jsonData, err := json.Marshal(data)
	// ...
	key := fmt.Sprintf("paymail:%s", data.Handle)
	if err := r.client.Set(r.ctx, key, jsonData, 0).Err(); err != nil { /* ... */ }
	if err := r.client.SAdd(r.ctx, "paymail:index", data.Handle).Err(); err != nil { /* ... */ }
	return nil
}
```

The existing lookup is case-insensitive (`strings.EqualFold`), so the reverse
index must be keyed on a normalized (lowercased) pubkey to preserve that.

`strings` is already imported in this file.

## Commands you will need

| Purpose | Command (from `backend/`) | Expected |
|---------|---------------------------|----------|
| Build   | `go build ./...`          | exit 0   |
| Vet     | `go vet ./...`            | exit 0   |
| Test    | `go test ./...`           | all pass |

## Scope

**In scope**:
- `backend/storage/redis.go` — `SetPaymail` (write the index) and
  `GetPaymailByPubkey` (read the index, fallback to scan for legacy rows).

**Out of scope**:
- `PaymailData` schema, other storage functions, handlers.

## Git workflow

- Branch: `advisor/009-pubkey-index`
- Commit style: `Add pubkey reverse index for O(1) paymail lookup`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Write the reverse index in `SetPaymail`

After the successful `Set` of the record (and the `SAdd` to `paymail:index`), add
a reverse-index write keyed on the lowercased pubkey:

```go
if data.IdentityPubkey != "" {
	idxKey := fmt.Sprintf("paymail:pubkey:%s", strings.ToLower(data.IdentityPubkey))
	if err := r.client.Set(r.ctx, idxKey, data.Handle, 0).Err(); err != nil {
		return fmt.Errorf("failed to set pubkey index: %w", err)
	}
}
```

### Step 2: Read the index in `GetPaymailByPubkey` with a legacy fallback

Try the reverse index first; if missing (e.g. a paymail registered before this
change), fall back to the existing scan so old records still resolve:

```go
func (r *RedisClient) GetPaymailByPubkey(pubkey string) (*PaymailData, error) {
	idxKey := fmt.Sprintf("paymail:pubkey:%s", strings.ToLower(pubkey))
	handle, err := r.client.Get(r.ctx, idxKey).Result()
	if err == nil && handle != "" {
		return r.GetPaymail(handle)
	}
	if err != nil && err != redis.Nil {
		return nil, fmt.Errorf("failed to read pubkey index: %w", err)
	}

	// Legacy fallback: scan handles registered before the reverse index existed,
	// and backfill the index on a hit so the next lookup is O(1).
	handles, err := r.client.SMembers(r.ctx, "paymail:index").Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get paymail index: %w", err)
	}
	for _, h := range handles {
		data, err := r.GetPaymail(h)
		if err != nil || data == nil {
			continue
		}
		if strings.EqualFold(data.IdentityPubkey, pubkey) {
			backfill := fmt.Sprintf("paymail:pubkey:%s", strings.ToLower(data.IdentityPubkey))
			_ = r.client.Set(r.ctx, backfill, data.Handle, 0).Err()
			return data, nil
		}
	}
	return nil, nil
}
```

`redis.Nil` comes from the already-imported `github.com/redis/go-redis/v9`
package (used elsewhere in this file as `redis.Nil`).

**Verify**: `go build ./...` → exit 0; `go vet ./...` → exit 0.

### Step 3: Test (if plan 001's harness exists)

A storage test needs a Redis instance, which the test environment may not have.
If `go test ./...` currently runs without Redis, do **not** add a test that
requires a live Redis — note that the change is covered only by build/vet plus
the legacy-fallback safety. If a miniredis-style in-memory mock is already a
dependency (check `go.mod`), you may add a round-trip test (SetPaymail then
GetPaymailByPubkey by exact and differently-cased pubkey). Do not add a new
dependency for this.

### Step 4: Full suite

**Verify**: `go build ./...` && `go vet ./...` && `go test ./...` → all exit 0.

## Test plan

- If a Redis mock exists: SetPaymail a record, then GetPaymailByPubkey with the
  same pubkey (hit via index), an upper-cased version (case-insensitive hit), and
  an unknown pubkey (nil). Also simulate a legacy row (write record + add to
  `paymail:index` but skip the reverse key) and assert the fallback resolves it
  and backfills the index.
- Otherwise: build/vet only, with a note in the report.

## Done criteria

ALL must hold:

- [ ] `SetPaymail` writes `paymail:pubkey:<lowercased pubkey> -> handle`.
- [ ] `GetPaymailByPubkey` reads the reverse index first and only scans as a
      legacy fallback (and backfills on a fallback hit).
- [ ] Case-insensitive matching is preserved (lowercased key on both write/read).
- [ ] `go build ./...`, `go vet ./...`, `go test ./...` all exit 0.
- [ ] `git status` shows only `redis.go` (plus `plans/README.md`).
- [ ] `plans/README.md` row for 009 updated.

## STOP conditions

Stop and report if:

- The excerpts don't match live code (drift).
- Build/test fails twice after a reasonable fix.
- You discover a paymail's pubkey can change after registration (then a stale
  reverse-index entry could mislead — report so the index-update/delete semantics
  can be designed; current code never mutates `IdentityPubkey`, so this should
  not arise).

## Maintenance notes

- If paymail pubkey rotation is ever added, `SetPaymail` must delete the old
  reverse-index key before writing the new one.
- The legacy scan fallback can be removed once all rows have been looked up at
  least once (index fully backfilled) — or via a one-time migration; leave it for
  now, it is cheap insurance.
- This pairs naturally with plan 008 (registration), which sets `IdentityPubkey`
  from the verified signer pubkey — the index then keys on a proven pubkey.
