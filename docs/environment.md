# Environment And Local Ownership

## Runtime Baseline

Use Node.js `24.x` or later with npm `10.x` or later for local development.

## Committed Templates

- `.env.example`
  Use this as the default template when running Node processes directly on your machine.
- `.env.docker.example`
  Use this as the Docker-only overlay when another service needs container hostnames such as `postgres` or `payment-provider`.

## Local-Only Files

- `.env`
  Your local working copy of `.env.example`. Keep secrets and machine-specific overrides here.
- `.env.docker`
  Optional local working copy of `.env.docker.example` for Docker-only overrides.

Both local files are ignored by git and should not be committed.

## Naming Convention

Keep the PostgreSQL variables aligned everywhere:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`

Docker Compose uses the credential variables directly today, and the Node services plus the future TypeORM `DataSource` should keep using the same names instead of inventing service-specific aliases.

For service-to-service configuration, keep the direction explicit:

- `PAYMENT_PROVIDER_BIND_HOST`
  The interface that the payment-provider process listens on.
- `PAYMENT_PROVIDER_BASE_URL`
  The URL that API and worker processes call.

Do not reuse one `*_HOST` variable for both bind addresses and outbound service discovery.

## Recommended Setup

1. Copy `.env.example` to `.env`.
2. If you later run Docker-networked services, copy `.env.docker.example` to `.env.docker` and keep only Docker-specific overrides there.
3. Start PostgreSQL with `npm run infra:up`.

The Docker wrapper composes env values from `.env.example`, `.env`, `.env.docker.example`, and `.env.docker` in that order, with later files overriding earlier ones.
