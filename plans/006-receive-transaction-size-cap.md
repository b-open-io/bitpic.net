# Plan 006: Cap the input size of the P2P receive-transaction endpoint

> **Executor instructions**: Follow step by step; run each verification command
> and confirm the expected result. Honor STOP conditions. Update this plan's row
> in `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat 40578f1..HEAD -- "app/api/paymail/[handle]/receive-transaction/route.ts"`
> If it changed, compare the excerpt below to live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `40578f1`, 2026-06-16

## Why this matters

The P2P receive-transaction route accepts a sender-supplied raw transaction hex
and parses it with `Transaction.fromHex(body.hex)` with **no upper bound**. A
malicious sender can post a pathologically huge hex string to exhaust server
memory/CPU before any validation runs. The fix is an **abuse ceiling**, not a
tight cap.

Critically: **BSV transactions can legitimately be several MB.** BSV supports
embedding images/files directly in transactions (inscriptions / ordinals), and
this endpoint exists precisely to relay such transfers (the recipient may be
receiving an ordinal whose content is multi-MB). So the bound must sit *well
above* realistic embedded-media transactions — large enough that no legitimate
transfer is rejected, low enough that a 100 MB+ junk payload is. Treat it as
defense against the absurd, with generous headroom, and make it tunable so the
operator can raise it without a code change.

Note on platform interaction: the body is read via `await request.json()`, so
the hosting platform's request-body limit may apply *before* this check (e.g.
Vercel serverless functions cap bodies unless configured). If legitimate
multi-MB receives are a requirement, the platform body limit must also be raised
— this in-code guard only bounds the additional cost of the `Transaction.fromHex`
parse once the body is already in memory. Flag this in the report (see
Maintenance notes).

## Current state

```ts
// app/api/paymail/[handle]/receive-transaction/route.ts:37
const body = (await request.json()) as ReceiveTransactionRequest;
if (!body.hex) {
  return NextResponse.json(
    { error: "Missing transaction hex" },
    { status: 400 },
  );
}

const data = await fetchPaymailData(handle);
// ...
let tx: Transaction;
try {
  tx = Transaction.fromHex(body.hex);   // <-- unbounded parse
} catch {
  return NextResponse.json({ error: "Invalid transaction hex" }, { status: 400 });
}
```

`ReceiveTransactionRequest` is defined at the top of the file:

```ts
// route.ts:14
interface ReceiveTransactionRequest {
  hex?: string;
  reference?: string;
  metadata?: unknown;
}
```

The route already validates that the tx pays the recipient and only then relays
to 1sat-stack. The only gap is the missing size bound before/at parse time.

**Convention**: the route returns `NextResponse.json({ error }, { status })` for
all client errors; match that. TypeScript, Biome-formatted.

## Commands you will need

| Purpose   | Command            | Expected            |
|-----------|--------------------|---------------------|
| Typecheck | `bun run typecheck`| exit 0 (after plan 002 adds the script; otherwise `bunx tsc --noEmit`) |
| Lint      | `bun run lint`     | exit 0              |
| Format    | `bun run format`   | exit 0              |

## Scope

**In scope**:
- `app/api/paymail/[handle]/receive-transaction/route.ts` (add a size guard only)

**Out of scope**:
- The pays-recipient verification, the 1sat-stack relay, error shapes.
- Other paymail routes (e.g. `p2p-payment-destination/route.ts`) — if you notice
  the same pattern there, note it in your report but do not change it in this
  plan.

## Git workflow

- Branch: `advisor/006-receive-tx-cap`
- Commit style: `Cap receive-transaction input size`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add a generous, env-tunable max-hex-length ceiling

Near the top of the file (next to `ONESAT_API_URL`), add an abuse ceiling that
defaults high enough to accept multi-MB embedded-media transactions and can be
raised via env without a code change:

```ts
// Abuse ceiling for the raw-tx hex on this public endpoint. BSV txs can
// legitimately be several MB (embedded images/files in inscriptions/ordinals),
// so this is deliberately generous — it only rejects pathological payloads, not
// real large transfers. Override with MAX_TX_HEX_BYTES if larger receives are
// needed (also raise the platform request-body limit to match — see route notes).
// Default: 50,000,000 hex chars ≈ 25 MB of raw transaction.
const MAX_TX_HEX_LENGTH = Number(process.env.MAX_TX_HEX_BYTES) || 50_000_000;
```

Do not pick a value near "a few MB" — that is inside the legitimate range. The
default leaves comfortable headroom over realistic embedded-media txs; the point
is only to stop a 100 MB+ junk string from reaching the parser.

### Step 2: Enforce it right after the `!body.hex` check

Add, immediately after the existing `if (!body.hex) { ... }` block and before
`fetchPaymailData`:

```ts
if (typeof body.hex !== "string" || body.hex.length > MAX_TX_HEX_LENGTH) {
  return NextResponse.json(
    { error: "Transaction too large" },
    { status: 413 },
  );
}
```

This bounds the string before it reaches `Transaction.fromHex`. (Optionally also
reject odd-length or non-hex strings, but `fromHex` already throws on those and
is cheap once length is bounded — the length cap is the load-bearing change.)

**Verify**: `bunx tsc --noEmit` → exit 0 (or `bun run typecheck` if plan 002 is
done).

### Step 3: Lint/format

Run `bun run format`, then `bun run lint` → exit 0.

## Test plan

- If plan 002's `bun test` harness exists, a light unit test is possible but this
  is a Next.js route handler (needs a `NextRequest` mock) — that is heavier than
  the change warrants. Acceptable to verify via typecheck/lint + manual reasoning
  and note no automated test was added.
- Manual check (optional, requires running backend): POSTing a >2,000,000-char
  `hex` returns HTTP 413.

## Done criteria

ALL must hold:

- [ ] `MAX_TX_HEX_LENGTH` exists as a generous, env-tunable ceiling
      (default ≈ 25 MB raw / 50,000,000 hex chars, overridable via
      `MAX_TX_HEX_BYTES`) and is enforced before `Transaction.fromHex`.
- [ ] The default is NOT set to a "few MB" value (that would reject legitimate
      embedded-media transactions).
- [ ] Oversized input returns status 413 with an error JSON.
- [ ] `bunx tsc --noEmit` (or `bun run typecheck`) exits 0.
- [ ] `bun run lint` exits 0.
- [ ] `git status` shows only the route file (plus `plans/README.md`).
- [ ] `plans/README.md` row for 006 updated.

## STOP conditions

Stop and report if:

- The excerpt doesn't match live code (drift).
- Typecheck fails after your change. The baseline was verified clean at
  `40578f1`, so the error stems from your edit — fix it (do not proceed with a
  red typecheck).

## Maintenance notes

- **BSV large-tx reality**: this endpoint relays transfers that may embed multi-MB
  files (inscriptions/ordinals). The ceiling is an anti-abuse bound, not a
  business limit — keep it generous. If real receives exceed the default, raise
  `MAX_TX_HEX_BYTES` rather than reverting to a tight cap.
- **Platform body limit**: because the body is parsed via `request.json()`, the
  host (e.g. Vercel) may reject large bodies before this code runs. If multi-MB
  receives are required, the deployment's request-body limit must be raised to
  match this ceiling — note this in the report so the operator configures both in
  tandem; an in-code ceiling alone will not admit a large tx the platform already
  refused.
- The same unbounded-parse pattern may exist in sibling routes
  (`p2p-payment-destination`); a follow-up could centralize a `readBoundedJson`
  helper. Deferred — flag in review.
