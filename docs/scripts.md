# Root Scripts

This document explains the repository-level helper scripts that currently exist under `scripts/` and the root npm commands that call them.

## Current Root Commands

The root `package.json` exposes these commands:

```bash
npm run build
npm run dev:api
npm run dev:worker
npm run dev:provider
npm run db:migrate
npm run db:revert
npm run db:generate
npm run db:seed
npm run infra:up
npm run infra:down
npm run infra:logs
```

At the Story 1.1 bootstrap stage, the `dev:*` and `db:*` commands are intentionally wrappers around workspace package scripts that will be added in later stories.

## Script Inventory

The committed files under `scripts/` are:

- `scripts/run-build.mjs`
- `scripts/run-package-script.mjs`
- `scripts/run-docker-compose.mjs`
- `scripts/load/`
- `scripts/smoke/`

The `load/` and `smoke/` directories currently exist as placeholders for later load-testing and smoke-test scripts.

## `run-build.mjs`

Path: [scripts/run-build.mjs](/Users/jm/Documents/Github/Meira-JH/distributed-systems-exercise/scripts/run-build.mjs)

Purpose:

- scans `packages/*` and `apps/*` for bootstrapped workspace packages
- exits successfully when no workspace packages exist yet
- fails if a bootstrapped workspace package is missing a `build` script
- runs each workspace `build` script sequentially

Why it exists:

- Story 1.1 requires a stable root `build` command before the repo is fully implemented
- it lets the bootstrap layer distinguish between “nothing exists yet” and “a real package is misconfigured”

Examples:

```bash
npm run build
node ./scripts/run-build.mjs
```

## `run-package-script.mjs`

Path: [scripts/run-package-script.mjs](/Users/jm/Documents/Github/Meira-JH/distributed-systems-exercise/scripts/run-package-script.mjs)

Purpose:

- runs a named npm script inside one workspace package
- fails with a clear message if that workspace is not bootstrapped yet
- fails with a clear message if the requested script is missing
- forwards extra CLI arguments after `--`

The root commands use it like this:

- `npm run dev:api`
  runs `dev` inside `apps/api`
- `npm run dev:worker`
  runs `dev` inside `apps/worker`
- `npm run dev:provider`
  runs `dev` inside `apps/payment-provider`
- `npm run db:migrate`
  runs `migrate` inside `packages/database`
- `npm run db:revert`
  runs `revert` inside `packages/database`
- `npm run db:generate`
  runs `generate` inside `packages/database`
- `npm run db:seed`
  runs `seed` inside `packages/database`

Examples:

```bash
node ./scripts/run-package-script.mjs apps/api dev
node ./scripts/run-package-script.mjs packages/database migrate
node ./scripts/run-package-script.mjs packages/database generate -- -n InitSchema
```

## `run-docker-compose.mjs`

Path: [scripts/run-docker-compose.mjs](/Users/jm/Documents/Github/Meira-JH/distributed-systems-exercise/scripts/run-docker-compose.mjs)

Purpose:

- runs `docker compose` from the repository root
- layers env values from `.env.example`, `.env`, `.env.docker.example`, and `.env.docker`
- lets Docker-specific hostnames override the local machine defaults without duplicating every variable

Load order:

1. `.env.example`
2. `.env`
3. `.env.docker.example`
4. `.env.docker`

Later files override earlier files.

The root commands use it like this:

- `npm run infra:up`
  runs `docker compose up -d postgres`
- `npm run infra:down`
  runs `docker compose down`
- `npm run infra:logs`
  runs `docker compose logs -f postgres`

Examples:

```bash
node ./scripts/run-docker-compose.mjs config
node ./scripts/run-docker-compose.mjs up -d postgres
node ./scripts/run-docker-compose.mjs logs -f postgres
```

## When To Update This Document

Update this file whenever:

- a new root npm command is added or removed
- a helper in `scripts/` changes behavior
- a real script is added under `scripts/load/` or `scripts/smoke/`
- the env-loading behavior for Docker changes
