# Plan 010: Make the JungleBus subscriber reconnect with backoff after errors

> **Executor instructions**: Follow step by step; run each verification command
> and confirm the expected result. Honor STOP conditions. Update this plan's row
> in `plans/README.md` when done. This plan is library-API-dependent — read
> Step 1 fully before writing any code.
>
> **Drift check (run first)**:
> `git diff --stat 40578f1..HEAD -- backend/junglebus/subscriber.go`
> If it changed, compare the excerpts below to live code; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug (reliability)
- **Planned at**: commit `40578f1`, 2026-06-16

## Why this matters

The indexer's whole job is to stay subscribed to JungleBus and index BitPic
transactions. On a stream error, `onError` only flips `s.connected = false` and
logs — there is **no reconnection**. `Start` subscribes once and blocks forever
on `select{}`, so after a transient network blip the subscriber goes quiet and
indexing silently halts until someone restarts the process. The feed stops
updating with no alert. This plan adds a supervised reconnect loop with
exponential backoff so a transient failure self-heals.

## Current state

```go
// backend/junglebus/subscriber.go:60  (Start — abridged)
func (s *Subscriber) Start() error {
	client, err := junglebus.New(junglebus.WithHTTP(s.junglebusURL))
	// ... compute lastBlock (>= bitpicStartBlock) ...
	eventHandler := junglebus.EventHandler{
		OnTransaction: s.onTransaction,
		OnMempool:     s.onMempool,
		OnStatus:      s.onStatus,
		OnError:       s.onError,
	}
	subscription, err := client.Subscribe(context.Background(), s.subscriptionID, lastBlock, eventHandler)
	if err != nil { return err }
	s.subscription = subscription
	s.connected = true
	s.syncing = true
	go s.reconcileLoop()
	select {}                 // <-- blocks forever; no reconnect path
}

// backend/junglebus/subscriber.go:207
func (s *Subscriber) onError(err error) {
	log.Printf("JungleBus error: %v", err)
	s.connected = false       // <-- only flips a flag; nothing re-subscribes
}
```

The subscriber already persists progress: `onStatus` "block-done" calls
`s.redis.SetLastBlock(...)`, and `GetLastBlock()` is read on start. So a
re-subscribe can resume from the last processed block.

`time`, `log`, `context`, `sync` are already imported.

## Commands you will need

| Purpose                | Command (from `backend/`)                     | Expected |
|------------------------|-----------------------------------------------|----------|
| Inspect JungleBus API  | `go doc github.com/b-open-io/go-junglebus`     | prints exported API |
| Inspect Subscription   | `go doc github.com/b-open-io/go-junglebus.Subscription` | prints methods |
| Build                  | `go build ./...`                              | exit 0   |
| Vet                    | `go vet ./...`                                | exit 0   |
| Test                   | `go test ./...`                              | all pass |

## Scope

**In scope**:
- `backend/junglebus/subscriber.go` — `Start`, `onError`, and new private
  helper(s) for the reconnect loop.

**Out of scope**:
- `processTransaction`, `reconcilePending`/`reconcileLoop`, `onStatus`,
  `GetStatus`, the storage layer.
- Adding an external alerting integration (out of scope; a loud log is enough).
- Changing the JungleBus client library or `go.mod`.

## Git workflow

- Branch: `advisor/010-junglebus-reconnect`
- Commit style: `Reconnect JungleBus subscription with exponential backoff`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Understand the library's subscribe/unsubscribe semantics

Run `go doc github.com/b-open-io/go-junglebus` and
`go doc github.com/b-open-io/go-junglebus.Subscription`. Determine:
- Whether `Subscription` has an `Unsubscribe()`/`Close()` method (needed before
  re-subscribing to avoid leaking the old stream).
- Whether `client.Subscribe(...)` can be called again on the same client after an
  error, or whether a fresh `junglebus.New(...)` client is required.
- Whether errors are delivered only via the `OnError` callback (assume yes, given
  the current code).

Write down what you found. **If `Subscribe` cannot be re-invoked and there is no
unsubscribe/reconnect affordance, STOP and report** — do not fake a reconnect
that leaks goroutines or duplicate streams.

### Step 2: Add a reconnect signal

Add an unbuffered-or-size-1 channel to the `Subscriber` struct to signal that a
re-subscribe is needed, and have `onError` send to it non-blockingly:

```go
// add to the Subscriber struct:
reconnect chan struct{}

// in NewSubscriber: s.reconnect = make(chan struct{}, 1)

// onError:
func (s *Subscriber) onError(err error) {
	log.Printf("JungleBus error: %v", err)
	s.connected = false
	select {
	case s.reconnect <- struct{}{}: // signal, but never block the callback
	default:
	}
}
```

### Step 3: Turn `Start` into a supervised (re)subscribe loop

Extract the subscribe sequence into a helper `subscribe() error` that creates the
client (or reuses it per Step 1 findings), reads the resume block from Redis
(`GetLastBlock()`, clamped to `bitpicStartBlock` exactly as today), calls
`client.Subscribe`, and sets `s.subscription`/`s.connected`/`s.syncing`. Then in
`Start`, replace the final `select {}` with a supervisor that waits for
reconnect signals and re-subscribes with exponential backoff:

```go
func (s *Subscriber) Start() error {
	if err := s.subscribe(); err != nil {
		return err // fail fast on the very first connect
	}
	go s.reconcileLoop()

	backoff := time.Second
	const maxBackoff = 60 * time.Second
	for range s.reconnect {
		log.Printf("JungleBus: reconnecting in %s", backoff)
		time.Sleep(backoff)
		if err := s.subscribe(); err != nil {
			log.Printf("JungleBus: resubscribe failed: %v", err)
			backoff *= 2
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
			// re-arm: trigger another attempt
			select {
			case s.reconnect <- struct{}{}:
			default:
			}
			continue
		}
		log.Printf("JungleBus: reconnected")
		backoff = time.Second // reset on success
	}
	return nil
}
```

If Step 1 found an `Unsubscribe()`/`Close()`, call it at the top of `subscribe()`
when `s.subscription != nil` before creating the new subscription, to avoid
leaking the previous stream.

Resuming from `GetLastBlock()` means at-least-once processing; that is safe
because `SetAvatar` is newest-wins and idempotent for the same tx (see
`storage/redis.go` SetAvatar comment).

**Verify**: `go build ./...` → exit 0; `go vet ./...` → exit 0.

### Step 4: Full suite

**Verify**: `go build ./...` && `go vet ./...` && `go test ./...` → all exit 0.

## Test plan

- This is networked, supervised behavior; a hermetic unit test would require
  faking the JungleBus client. Do not build that here. Verify via build/vet and
  by reasoning through the loop:
  - first connect failure → `Start` returns error (process exits, as today),
  - mid-run error → `onError` signals → supervisor sleeps `backoff`, re-subscribes
    from last block, resets backoff on success, doubles (capped 60s) on failure.
- Optional manual check (needs network): run the backend, observe normal sync,
  then simulate by pointing `JUNGLEBUS_URL` at an unreachable host and confirm the
  logs show increasing backoff rather than silence; restore and confirm
  "reconnected".

## Done criteria

ALL must hold:

- [ ] `onError` no longer just sets a flag — it signals a reconnect.
- [ ] `Start` re-subscribes after errors with exponential backoff capped at 60s,
      resetting on success, resuming from `GetLastBlock()`.
- [ ] If the library exposes unsubscribe/close, the old subscription is released
      before re-subscribing.
- [ ] `go build ./...`, `go vet ./...`, `go test ./...` all exit 0.
- [ ] `git status` shows only `subscriber.go` (plus `plans/README.md`).
- [ ] `plans/README.md` row for 010 updated.

## STOP conditions

Stop and report (do not improvise) if:

- The JungleBus library cannot be re-subscribed / has no reconnect affordance
  (Step 1) — report the API surface you found.
- The excerpts don't match live code (drift).
- Build/vet fails twice after a reasonable fix.
- Re-subscribing appears to double-process in a way that is NOT idempotent (it
  should be, per SetAvatar's newest-wins design — but if you find a
  non-idempotent path, stop and report).

## Maintenance notes

- A natural follow-up is to surface reconnect state on `/api/status` (the handler
  already has the subscriber) and wire real alerting; deferred here.
- `GetStatus` reports `connected`; consider exposing consecutive-failure count
  for observability later.
- Reviewer: confirm the backoff resets on success and that `onError`'s channel
  send is non-blocking (a blocking send inside the callback could stall the
  client).
