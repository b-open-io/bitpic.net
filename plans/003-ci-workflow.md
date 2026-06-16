# Plan 003: Add a GitHub Actions CI gate (lint, typecheck, frontend tests, backend build/vet/test)

> **Executor instructions**: Follow step by step; run each verification command
> and confirm the expected result. Honor STOP conditions. Update this plan's row
> in `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat 40578f1..HEAD -- package.json backend/go.mod`
> Also confirm plans 001 and 002 are DONE in `plans/README.md` (this plan's test
> steps assume the `typecheck`/`test` scripts and the Go tests exist). If they
> are not DONE, see STOP conditions.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-backend-characterization-tests.md, plans/002-frontend-test-and-typecheck.md
- **Category**: dx
- **Planned at**: commit `40578f1`, 2026-06-16

## Why this matters

There is no `.github/workflows` directory — nothing verifies lint, types, tests,
or that the Go backend even builds before code is merged and auto-deployed
(Vercel for the frontend, Railway for the backend, both on push). A single CI
workflow turns the verification commands established in plans 001–002 into a
merge gate, so a broken build or failing test is caught before it ships. This is
pure addition: it changes no application code.

## Current state

- No `.github/` directory exists at the repo root.
- Frontend: Bun + Next.js. After plan 002, `package.json` has: `lint`
  (`biome check`), `typecheck` (`tsc --noEmit`), `test` (`bun test`), `build`
  (`next build`).
- Backend: Go module at `backend/` (`backend/go.mod` declares `go 1.25.0`).
  Verification commands (run from `backend/`): `go build ./...`, `go vet ./...`,
  `go test ./...`.
- Deployment is handled externally by Vercel/Railway; **this workflow must not
  deploy** — it only validates.

**Convention note**: the repo uses Bun, so the workflow uses `oven-sh/setup-bun`,
not `actions/setup-node`. Pin action versions to a major tag (e.g. `@v4`).

## Commands you will need

| Purpose                  | Command                                   | Expected            |
|--------------------------|-------------------------------------------|---------------------|
| Validate YAML locally    | `bunx --bun yaml-lint .github/workflows/ci.yml` (optional) | exit 0 |
| Confirm frontend gates   | `bun install && bun run lint && bun run typecheck && bun test && bun run build` | all exit 0 |
| Confirm backend gates    | `cd backend && go build ./... && go vet ./... && go test ./...` | all exit 0 |

(The local "confirm" commands mirror what CI will run — use them to prove the
workflow will pass before committing it.)

## Scope

**In scope**:
- `.github/workflows/ci.yml` (create)

**Out of scope**:
- Any application code, `package.json`, `go.mod`.
- Branch protection settings (cannot be set from a file; mention in report).
- Any deploy/publish step.

## Git workflow

- Branch: `advisor/003-ci`
- Commit style: `Add CI workflow for lint, typecheck, tests, and backend build`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Prove the gates pass locally

From the repo root run the "Confirm frontend gates" command, then the "Confirm
backend gates" command. All must exit 0. CI should not be added on top of a red
tree. The baseline at `40578f1` was verified green (`tsc --noEmit`,
`bun run lint`, `go build ./...`, `go vet ./...`), so if a gate fails, the cause
is one of: plans 001/002 are incomplete (their new test/typecheck script isn't
wired yet), or the tree drifted since `40578f1`. Identify which and **STOP and
report** — do not weaken a gate to make it pass.

### Step 2: Write `.github/workflows/ci.yml`

Create the workflow with two parallel jobs. Use this shape (adjust only if a
local gate in Step 1 required a different command):

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run lint
      - run: bun run typecheck
      - run: bun test
      - run: bun run build

  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.25'
          cache-dependency-path: backend/go.sum
      - run: go build ./...
      - run: go vet ./...
      - run: go test ./...
```

Notes:
- `bun install --frozen-lockfile` requires a committed `bun.lock`/`bun.lockb`.
  Confirm one exists (`ls bun.lock*`); if not, use `bun install` instead and
  note it in your report.
- The frontend `build` step may need env vars. If `next build` fails in Step 1
  only due to a missing `NEXT_PUBLIC_*` var, set a placeholder in the workflow
  `env:` block for the build step (e.g. `NEXT_PUBLIC_API_URL: https://api.bitpic.net`)
  rather than removing the build gate.

### Step 3: Validate

**Verify**:
- The file parses as YAML (open it; or run the optional yaml-lint command).
- `git status` shows only `.github/workflows/ci.yml` added.

(The workflow itself will run on GitHub once pushed — that is outside this local
plan. Do not push unless instructed.)

## Done criteria

ALL must hold:

- [ ] `.github/workflows/ci.yml` exists and is valid YAML with `frontend` and
      `backend` jobs.
- [ ] Each command in the workflow was confirmed to exit 0 locally in Step 1.
- [ ] `git status` shows only the new workflow file (plus `plans/README.md`).
- [ ] `plans/README.md` row for 003 updated, with a note that branch protection
      (requiring CI to pass before merge) must be enabled in GitHub repo settings
      by a human — it cannot be set from a file.

## STOP conditions

Stop and report if:

- Plans 001 or 002 are not DONE (the `typecheck`/`test` scripts or Go tests this
  workflow invokes do not exist yet).
- Any gate fails locally in Step 1 (report which; do not weaken the gate to make
  CI green).
- `next build` requires secrets that cannot be safely placeholdered (report what
  it needs rather than committing real secret values — never put secret values
  in the workflow).

## Maintenance notes

- When new packages/workspaces are added, extend the matching job.
- If the backend Go version in `backend/go.mod` is bumped, update `go-version`.
- Enabling "Require status checks to pass" branch protection in GitHub settings
  is the step that makes this gate actually block merges — flag it for the owner.
- Keep CI commands identical to the local scripts so "green locally" implies
  "green in CI".
