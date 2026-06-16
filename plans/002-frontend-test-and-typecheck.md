# Plan 002: Add a frontend test runner, typecheck script, and unit tests for paymail/outpoint utilities

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> "STOP condition" occurs, stop and report — do not improvise. When done, update
> this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40578f1..HEAD -- package.json lib/paymail.ts lib/transaction-builder.ts`
> If any changed, compare the "Current state" excerpts to the live files before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests / dx
- **Planned at**: commit `40578f1`, 2026-06-16

## Why this matters

The frontend has **no `typecheck` script and no tests**. Type errors are only
caught implicitly during `next build`, and pure utility functions that parse
untrusted strings (paymail handles, outpoint references) have no regression net.
This plan adds an explicit `typecheck` script and a `bun test` harness with unit
tests for the small, high-value pure functions in `lib/`. It is also a
prerequisite for the CI gate in plan 003. The repo uses **Bun** (per the lockfile
and project conventions) — Bun has a built-in Jest-compatible test runner, so no
new test dependency is required.

## Current state

`package.json` scripts today (note: no `typecheck`, no `test`):

```json
// package.json:5-11
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "biome check",
  "format": "biome format --write"
}
```

Stack: Next.js 16, React 19, TypeScript 5, Biome for lint/format, Bun as the
runtime/package manager. `tsconfig.json` exists at the repo root.

Target functions to test live in `lib/paymail.ts` (e.g. `extractHandle`,
`addressToP2PKHScript`) and `lib/transaction-builder.ts` (e.g. `isValidPaymail`,
`normalizeOutpoint`, `ordUri`). **Before writing tests, open these two files and
read the actual exported signatures** — do not assume; the test must import the
real exports. Example of the kind of pure function present (confirm exact name
and behavior in the file):

- `extractHandle(input)` in `lib/paymail.ts` — normalizes a paymail/handle.
- `isValidPaymail(s)` in `lib/transaction-builder.ts` — validates `local@domain`.
- `normalizeOutpoint(s)` in `lib/transaction-builder.ts` — `txid.vout` → `txid_vout`.

**Conventions**: TypeScript, ES modules, path alias `@/` maps to repo root (see
`tsconfig.json` `paths`). Biome enforces formatting — run `bun run format` after
writing files so the new test file matches house style.

## Commands you will need

| Purpose      | Command                          | Expected on success           |
|--------------|----------------------------------|-------------------------------|
| Install      | `bun install`                    | exit 0                        |
| Typecheck    | `bun run typecheck`              | exit 0, no errors (after Step 1)|
| Test         | `bun test`                       | all pass (after Step 2)       |
| Lint         | `bun run lint`                   | exit 0                        |
| Format       | `bun run format`                 | rewrites files, exit 0        |

## Scope

**In scope**:
- `package.json` (add `typecheck` and `test` scripts only — do not touch deps)
- `lib/paymail.test.ts` (create)
- `lib/transaction-builder.test.ts` (create)

**Out of scope** (do NOT modify):
- Any source under `lib/`, `app/`, `components/`, `hooks/` — tests only.
- `tsconfig.json`, `biome.json`, `next.config.*`.
- Do not add any npm/bun dependency. `bun test` is built in.

## Git workflow

- Branch: `advisor/002-frontend-tests`
- Commit style (match `git log`): `Add bun test harness and typecheck script`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add `typecheck` and `test` scripts

Edit `package.json` `scripts` to add (keep the existing entries):

```json
"typecheck": "tsc --noEmit",
"test": "bun test"
```

**Verify**: `bun run typecheck` → exit 0 with no type errors. The baseline at
commit `40578f1` was verified clean (`tsc --noEmit` passed with zero errors), so
any type error you see here was introduced by your change — fix it before
continuing; do not attribute it to prior state.

### Step 2: Write unit tests for `lib/paymail.ts`

First read `lib/paymail.ts` and note the exact exports and their behavior.
Create `lib/paymail.test.ts` using Bun's test API:

```ts
import { describe, expect, test } from "bun:test";
import { extractHandle /*, addressToP2PKHScript, ... */ } from "@/lib/paymail";
```

Cover, for each pure exported function you find:
- `extractHandle`: a bare handle, a full `local@bitpic.net`, mixed case, and an
  invalid/empty input → assert the documented return for each (match what the
  code actually does; if it lowercases or strips a domain, assert that).
- If `addressToP2PKHScript` is exported and pure (no network), assert it returns
  a hex string for a known valid address and throws/handles an invalid one.

Skip any export that performs network I/O (e.g. `fetchPaymailData`) — those are
integration-level and out of scope here.

**Verify**: `bun test lib/paymail.test.ts` → all pass.

### Step 3: Write unit tests for `lib/transaction-builder.ts`

Read `lib/transaction-builder.ts`; create `lib/transaction-builder.test.ts`.
Cover the pure helpers, e.g.:
- `isValidPaymail`: `"alice@bitpic.net"` → true; `"nope"` → false; `""` → false;
  `"a@b@c"` → false.
- `normalizeOutpoint`: `"<txid>.0"` → `"<txid>_0"`; `"<txid>_3"` unchanged.
- `ordUri` (if exported): assert it produces `ord://<txid>_<vout>` for given
  inputs (match actual output format in the code).

Only test exports that are pure and synchronous. If a function requires a wallet
context or `@bsv/sdk` async calls, leave it out and note it in your report.

**Verify**: `bun test lib/transaction-builder.test.ts` → all pass.

### Step 4: Format, lint, full check

Run `bun run format` then confirm:
- `bun run lint` → exit 0
- `bun test` → all pass
- `bun run typecheck` → exit 0

## Test plan

- New files: `lib/paymail.test.ts`, `lib/transaction-builder.test.ts`.
- Cases: enumerated in Steps 2–3 (valid + invalid inputs for each pure helper).
- Pattern: Bun's `bun:test` (`describe`/`test`/`expect`), Jest-compatible.
- Verification: `bun test` → all pass; `bun run typecheck` → exit 0.

## Done criteria

ALL must hold:

- [ ] `package.json` has `typecheck` and `test` scripts; existing scripts intact.
- [ ] `bun run typecheck` exits 0.
- [ ] `bun test` passes and includes the new tests (≥1 test file each for
      `paymail` and `transaction-builder`).
- [ ] `bun run lint` exits 0.
- [ ] `git status` shows only `package.json` + the two new test files (plus
      `plans/README.md`).
- [ ] `plans/README.md` row for 002 updated.

## STOP conditions

Stop and report if:

- `bun run typecheck` fails and you cannot resolve it after a reasonable attempt.
  The baseline was verified clean at `40578f1`, so the cause is your change or a
  dependency that drifted since then — report what you changed rather than
  editing unrelated source to silence it.
- The exports named in "Current state" don't exist in the live files (drift) —
  re-read and report the actual exports rather than guessing.
- `bun test` cannot discover `*.test.ts` files (Bun version too old). Report the
  Bun version (`bun --version`) instead of switching to another runner.
- A test would require importing something that triggers network calls or needs
  a wallet/browser context.

## Maintenance notes

- Keep tests to pure functions; wallet/context-bound logic belongs in
  integration tests, deferred.
- Plan 003 (CI) will run `bun run typecheck` and `bun test` as gates — keep both
  green.
- If `lib/paymail.ts` gains address-parsing via `@bsv/sdk`, prefer asserting
  observable output (hex script) over internal calls.
