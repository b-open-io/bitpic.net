# Plan 011: Resolve the three dependency advisories (ws, @bsv/sdk transitive, postcss)

> **Executor instructions**: Follow step by step; run each verification command
> and confirm the expected result. Honor STOP conditions. Update this plan's row
> in `plans/README.md` when done. This plan changes dependency versions — verify
> the wallet flow still builds/typechecks after each bump and be ready to revert.
>
> **Drift check (run first)**:
> `git diff --stat 40578f1..HEAD -- package.json bun.lock*`
> Then run `bun audit` and compare against the "Current state" advisory list; if
> the set of advisories has materially changed, re-scope before proceeding.

## Status

- **Priority**: P3
- **Effort**: S–M
- **Risk**: MED (touches the wallet dependency chain)
- **Depends on**: plans/002-frontend-test-and-typecheck.md (uses `typecheck`/`test`), plans/003-ci-workflow.md (CI will re-audit) — soft; can run standalone
- **Category**: migration (dependencies)
- **Planned at**: commit `40578f1`, 2026-06-16

## Why this matters

`bun audit` reports three advisories. None is in first-party code, but two sit on
the wallet path and one in the build toolchain:

1. **ws (HIGH)** — memory-exhaustion DoS — transitive via
   `@1sat/client/actions/react → @bopen-io/wallet-toolbox → ws`.
2. **@bsv/sdk <2.0.0 (MODERATE)** — auth signature data-prep vuln — transitive
   copies pulled by `@1sat/*`. NOTE: the project's **direct** `@bsv/sdk` is
   `2.1.4` (already patched); only the older transitive copies inside `@1sat/*`
   are flagged. First-party signing/verification is unaffected.
3. **postcss <8.5.10 (MODERATE)** — XSS via CSS stringify output — transitive via
   `next → postcss` and `@tailwindcss/postcss → postcss`; build-time only, low
   real-world exposure for this app (static Tailwind classes).

Goal: clear what can be cleared with safe, semver-compatible updates, and clear
the rest (the `@1sat/*` transitive chain) only if the `@1sat/*` upgrade is
non-breaking — otherwise document and defer rather than risk the wallet flow.

## Current state

Relevant `package.json` deps:

```json
"@1sat/actions": "^0.0.166",
"@1sat/client": "^0.0.38",
"@1sat/react": "^0.0.67",
"@bsv/sdk": "2.1.4",
"next": "^16.2.9",
"@tailwindcss/postcss": "^4",
```

`bun audit` summary at planning time: `3 vulnerabilities (1 high, 2 moderate)`.

## Commands you will need

| Purpose             | Command                          | Expected |
|---------------------|----------------------------------|----------|
| Audit               | `bun audit`                      | lists advisories |
| Compatible updates  | `bun update`                     | updates within semver ranges |
| Update one pkg      | `bun update <pkg>`               | bumps that package |
| Typecheck           | `bun run typecheck`              | exit 0 |
| Lint                | `bun run lint`                   | exit 0 |
| Test                | `bun test`                       | all pass |
| Build               | `bun run build`                  | exit 0 |

(`typecheck`/`test` exist after plan 002; if not done yet, use `bunx tsc --noEmit`
and skip `bun test`.)

## Scope

**In scope**:
- `package.json`, `bun.lock*` (version bumps only).

**Out of scope**:
- First-party code changes. If a bump *requires* code changes to compile, that is
  a breaking upgrade — see STOP conditions (revert and report; do not refactor
  app code under this plan).
- Downgrading anything (project rule: never downgrade packages).

## Git workflow

- Branch: `advisor/011-deps`
- Commit style: one commit per cleanly-resolved advisory where practical, e.g.
  `Bump postcss to clear XSS advisory`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Baseline

Run `bun audit` and record the exact advisory list and counts. Run
`bun run build` (or current build) once to confirm a green starting point. The
baseline at `40578f1` was verified green (`tsc --noEmit`, `bun run lint`,
`bun run build`), so if your starting point is red *before* any dependency
change, the cause is drift since `40578f1` — STOP and report that drift rather
than bumping deps on top of it.

### Step 2: Compatible updates (postcss, and anything in-range)

Run `bun update` (semver-compatible only). This should pull `postcss` to
`>=8.5.10` (it is a transitive dep of `next`/`tailwind` with a caret range) and
any other in-range fixes.

**Verify**:
- `bun run typecheck` → exit 0
- `bun test` → all pass (if present)
- `bun run build` → exit 0
- `bun audit` → confirm the postcss advisory is gone; record what remains.

If `bun run build` fails, **revert** (`git checkout -- package.json bun.lock*`)
and report — `bun update` should not break a caret-range bump; if it did, the
breakage detail is the finding.

### Step 3: Attempt the @1sat/* chain (ws + @bsv/sdk transitive)

The `ws` and transitive `@bsv/sdk` advisories live under `@1sat/*`. Try bumping
the three `@1sat/*` packages to their latest published versions:

```
bun update @1sat/actions @1sat/client @1sat/react
```

(If `bun update` does not move them because newer versions are outside the caret
range, check the latest with `bun pm view @1sat/actions version` style inspection
or `npm view @1sat/actions version`, and update the caret in `package.json` only
if you proceed.)

**Verify after the bump**:
- `bun install` → exit 0
- `bun run typecheck` → exit 0
- `bun run lint` → exit 0
- `bun run build` → exit 0
- `bun audit` → record whether ws / @bsv/sdk transitive advisories cleared.

The wallet flow (connect, upload, sign) is exercised by `lib/use-wallet.ts`,
`components/upload-dialog.tsx`, and the `@1sat/actions` calls. There is no
automated wallet test, so a **manual smoke test is strongly recommended** if a
wallet is available: connect wallet, open the upload dialog, confirm it renders
and a sign prompt appears. If no wallet is available, rely on typecheck+build and
say so in your report.

### Step 4: Decide and document

- If Step 3 is clean (builds, typechecks, advisories reduced): keep it.
- If Step 3 breaks the build/typecheck (the `@1sat/*` majors changed APIs):
  **revert just the @1sat bumps** (`git checkout -- package.json bun.lock*` or
  restore the @1sat lines), keep Step 2's postcss fix, and record in your report
  that the ws/@bsv-sdk transitive advisories remain pending an `@1sat/*` upgrade
  that requires code changes (a separate, larger task). Do not force it here.

## Test plan

- Automated: `bun run typecheck`, `bun test` (if present), `bun run build` after
  each bump.
- Manual (recommended for Step 3): wallet connect + open upload dialog smoke test.
- Final: `bun audit` output captured in the report (before vs after counts).

## Done criteria

ALL must hold:

- [ ] postcss advisory cleared via a compatible update (Step 2), or a recorded
      reason it could not be.
- [ ] `bun run typecheck`, `bun run build` exit 0 on the final state;
      `bun test` passes if present; `bun run lint` exits 0.
- [ ] The ws + @bsv/sdk transitive advisories are either cleared (Step 3 kept) or
      explicitly documented as deferred with the reason (Step 3 reverted), in both
      your report and the `plans/README.md` row.
- [ ] No first-party code was modified; no package was downgraded.
- [ ] `git status` shows only `package.json` + `bun.lock*` (plus `plans/README.md`).
- [ ] `plans/README.md` row for 011 updated (note final advisory count).

## STOP conditions

Stop and report (do not improvise) if:

- Any bump requires editing first-party code to compile (that is a breaking
  upgrade and a separate planned task) — revert that bump and report.
- A bump forces a downgrade of another package (violates project rules).
- `bun run build` fails after a compatible (`bun update`) bump and a single retry.
- The wallet smoke test shows the connect/upload flow broken after the `@1sat/*`
  bump — revert the @1sat bump.

## Maintenance notes

- The `@1sat/*` packages are pre-release `0.0.x` on the critical wallet path;
  expect frequent advisories from their transitive chain until they stabilize.
  Re-run `bun audit` periodically (plan 003's CI can add an `audit` step later).
- The direct `@bsv/sdk` (2.1.4) is fine; do not pin it down. The risk is only the
  older transitive copies inside `@1sat/*`, which resolve when `@1sat/*` upgrades
  its own `@bsv/sdk`.
- Reviewer: confirm no app code changed and the lockfile diff is consistent with
  the stated version bumps.
