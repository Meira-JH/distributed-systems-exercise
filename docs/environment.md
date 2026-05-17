# Environment And Local Ownership

## Runtime Baseline

Use Node.js `24.x` or later with npm `10.x` or later for local development.

## Committed Templates

- `.env.example`
  Use this as the default template when running Node processes directly on your machine.
- `.env.docker.example`
  Use this as the container-oriented template when another service needs to resolve PostgreSQL through the Docker network as `postgres`.

## Local-Only Files

- `.env`
  Your local working copy of `.env.example`. Keep secrets and machine-specific overrides here.
- `.env.docker`
  Optional local working copy of `.env.docker.example` for container-oriented overrides.

Both local files are ignored by git and should not be committed.

## Naming Convention

Keep the PostgreSQL variables aligned everywhere:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`

Docker Compose uses the credential variables directly today, and the Node services plus the future TypeORM `DataSource` should keep using the same names instead of inventing service-specific aliases.

## Recommended Setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with `npm run infra:up`.
3. If you later run app containers that need Docker-network host resolution, copy `.env.docker.example` to `.env.docker` and use `POSTGRES_HOST=postgres` for those containers.
