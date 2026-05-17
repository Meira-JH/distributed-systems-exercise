# Distributed Systems Practice Lab

This guide gives a local practice environment for distributed systems using:

- TypeScript
- Node.js
- Docker
- PostgreSQL
- TypeORM

The goal is to build a small system that is intentionally easy to break, observe, fix, and test. 

## Project Preview

This is the current planning snapshot for the local system bootstrap work.

### Story Status Model

- `not ready`
  The story is still blocked by missing dependencies, unresolved decisions, or earlier work that has not been completed yet.
- `ready-for-dev`
  The story is clear enough to implement now and does not have any remaining project-internal blockers.
- `ready-for-review`
  Development work is complete and the story is waiting for review, validation, or acceptance.
- `done`
  The story has been implemented, reviewed, and accepted as complete.

### Current Story Status

| Story | Status | Notes |
| --- | --- | --- |
| [1.1 Bootstrap The Workspace](/Users/jm/Documents/Github/Meira-JH/distributed-systems-exercise/docs/stories/1.1-bootstrap-workspace.md) | `ready-for-dev` | This is the first implementation story and establishes the repo, env management, and local PostgreSQL baseline. |
| [1.2 Bootstrap The API Service](/Users/jm/Documents/Github/Meira-JH/distributed-systems-exercise/docs/stories/1.2-bootstrap-api-service.md) | `not ready` | Depends on the workspace bootstrap and shared database baseline. |
| [1.3 Bootstrap The Worker](/Users/jm/Documents/Github/Meira-JH/distributed-systems-exercise/docs/stories/1.3-bootstrap-worker.md) | `not ready` | Depends on the workspace bootstrap and shared database baseline. |
| [1.4 Bootstrap The Payment Provider Mock](/Users/jm/Documents/Github/Meira-JH/distributed-systems-exercise/docs/stories/1.4-bootstrap-payment-provider-mock.md) | `not ready` | Depends on the workspace bootstrap story completing first. |
| [1.5 Add The Shared Database Layer](/Users/jm/Documents/Github/Meira-JH/distributed-systems-exercise/docs/stories/1.5-add-shared-database-layer.md) | `not ready` | Depends on the workspace, env, and PostgreSQL container baseline from Story 1.1. |
| [1.6 Add Seed Data](/Users/jm/Documents/Github/Meira-JH/distributed-systems-exercise/docs/stories/1.6-add-seed-data.md) | `not ready` | Depends on the shared TypeORM database layer and migration flow. |
| [1.7 Configure The NGINX Gateway](/Users/jm/Documents/Github/Meira-JH/distributed-systems-exercise/docs/stories/1.7-configure-nginx-gateway.md) | `not ready` | Depends on the API service existing and the local stack being wired. |
| [1.8 Add Local Smoke Verification](/Users/jm/Documents/Github/Meira-JH/distributed-systems-exercise/docs/stories/1.8-add-local-smoke-verification.md) | `not ready` | Depends on the stack components being runnable first. |

## What You Will Build

You will run six containers locally:

1. `gateway`
   An NGINX reverse proxy/load balancer. It sends traffic to multiple API replicas. You will use it to practice horizontal scaling, header forwarding, coarse edge rate limiting, and realistic request routing.
2. `api-1`
   The first replica of your main API service. It handles login, sessions, orders, payments, permissions, and protected endpoints.
3. `api-2`
   The second replica of the same API service. This exists mainly so you can reproduce multi-instance bugs.
4. `worker`
   A background worker that polls PostgreSQL for jobs, retries failures with exponential backoff and jitter, and moves exhausted jobs to a dead-letter table.
5. `payment-provider`
   A fake external service. You can make it return `200`, `503`, timeouts, or misleading success/failure behavior to simulate real third-party integrations.
6. `postgres`
   Shared state for all services.

## Recommended Repository Structure

Create the repo like this:

```text
distributed-systems-exercise/
  docs/
    README.md
  apps/
    api/
      package.json
      tsconfig.json
      src/
        server.ts
        app.ts
        config.ts
        routes/
          auth.ts
          payments.ts
          orders.ts
          admin.ts
          protected.ts
          debug.ts
        middleware/
          requestId.ts
          rateLimit.ts
          auth.ts
        services/
          idempotencyService.ts
          paymentService.ts
          sessionService.ts
          permissionService.ts
          orderService.ts
          queueService.ts
        repositories/
          idempotencyRepo.ts
          orderRepo.ts
          paymentRepo.ts
          sessionRepo.ts
          permissionRepo.ts
          jobRepo.ts
          outboxRepo.ts
    worker/
      package.json
      tsconfig.json
      src/
        worker.ts
        jobs/
          emailJob.ts
          reconciliationJob.ts
        services/
          queuePoller.ts
          retryPolicy.ts
          deadLetterService.ts
    payment-provider/
      package.json
      tsconfig.json
      src/
        server.ts
        modes.ts
  packages/
    shared/
      package.json
      tsconfig.json
      src/
        types.ts
        logger.ts
        hash.ts
        sleep.ts
        time.ts
    database/
      package.json
      tsconfig.json
      src/
        data-source.ts
        entities/
          User.ts
          Session.ts
          Order.ts
          Payment.ts
          IdempotencyKey.ts
          Job.ts
          DeadLetter.ts
          OutboxEvent.ts
          UserPermission.ts
          PermissionCache.ts
        migrations/
          0001-InitSchema.ts
  scripts/
    seed.ts
    smoke/
      idempotency.sh
      sessions.sh
      permissions.sh
    load/
      rate-limit.js
  docker/
    api.Dockerfile
    worker.Dockerfile
    payment-provider.Dockerfile
    nginx/
      default.conf
  .env.example
  package.json
  tsconfig.base.json
  docker-compose.yml
```

## High-Level Architecture

```mermaid
flowchart LR
    Client["Client / curl / Postman / test script"] --> Gateway["NGINX gateway :8080"]
    Gateway --> API1["api-1 :3000"]
    Gateway --> API2["api-2 :3000"]
    API1 --> DB["PostgreSQL :5432"]
    API2 --> DB
    API1 --> Provider["payment-provider :4000"]
    API2 --> Provider
    Worker["worker"] --> DB
    Worker --> Provider
```

## Queue Ownership

The queue in this system is split across three parts of the repo:

1. `packages/database`
   This is the queue backend. It owns the TypeORM entities and migrations for `Job`, `DeadLetter`, and `OutboxEvent`.
2. `apps/api`
   This is where jobs are produced. It owns enqueueing logic such as creating `send_email` jobs, creating `reconcile_payment` jobs, and writing outbox events after request-driven state changes.
3. `apps/worker`
   This is where jobs are consumed. It owns polling, claiming, retry logic, jitter, dead-letter handling, and the actual job processors.

That split keeps the responsibility clear:

1. schema and persistence model in `packages/database`
2. queue producers in `apps/api`
3. queue consumers in `apps/worker`

## Design Principles For This Lab

Keep these principles constant while building:

1. Every important state transition should be persisted in PostgreSQL.
2. Every external call should be traceable with a request ID.
3. Every retryable action should be safe to run more than once.
4. Every bug scenario should be reproducible on purpose before you fix it.
5. Every fix should have a manual test you can run locally.

## Step 1: Install Prerequisites

Install these locally:

1. Node.js `24.x` or later
2. `npm` `10.x` or later
3. Docker Desktop
4. `curl`
5. Optional but useful:
   `psql`, `httpie`, `jq`, `k6`, `autocannon`

Check versions:

```bash
node -v
npm -v
docker --version
docker compose version
```

## Step 2: Initialize The Root Workspace

From the repository root:

```bash
npm init -y
mkdir -p docs apps/api/src apps/worker/src apps/payment-provider/src packages/shared/src packages/database/src/entities packages/database/src/migrations scripts/smoke scripts/load docker/nginx
```

Edit the root `package.json` so it uses npm workspaces:

```json
{
  "name": "distributed-systems-exercise",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces",
    "dev:api": "npm run dev -w apps/api",
    "dev:worker": "npm run dev -w apps/worker",
    "dev:provider": "npm run dev -w apps/payment-provider",
    "db:migrate": "typeorm-ts-node-commonjs -d packages/database/src/data-source.ts migration:run",
    "db:revert": "typeorm-ts-node-commonjs -d packages/database/src/data-source.ts migration:revert",
    "db:generate": "typeorm-ts-node-commonjs -d packages/database/src/data-source.ts migration:generate packages/database/src/migrations/AutoMigration",
    "db:seed": "tsx scripts/seed.ts",
    "docker:up": "docker compose up --build",
    "docker:down": "docker compose down -v"
  }
}
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist"
  }
}
```

## Step 3: Choose A Minimal Node.js Stack

Use this dependency set for the Node services in the lab:

- `api`
- `worker`
- `payment-provider`

Dependencies:

- `express` for HTTP APIs
- `typeorm` for entities, repositories, migrations, and transactions
- `reflect-metadata` because TypeORM decorators depend on it
- `pg` as the PostgreSQL driver under TypeORM
- `tsx` for local TypeScript execution
- `ts-node` for the TypeORM CLI in TypeScript projects
- `typescript`
- `pino` for structured JSON logs
- `uuid` for request IDs and entity IDs
- `zod` for request validation

Keep it simple on purpose. This lab is about distributed systems behavior, not about framework complexity.

Use TypeORM in the `api` and `worker` services. The `payment-provider` can stay as plain Express because it does not need database access.

## Step 4: Create The Shared And Database Packages

Your `packages/shared` workspace should hold:

1. Shared TypeScript types
2. A request logger
3. Hash helpers for idempotency
4. Time and retry helpers
5. Small utility functions like `sleep(ms)`

This keeps core logic reusable between the Node services.

Add a separate `packages/database` workspace for all TypeORM concerns:

1. the shared `DataSource`
2. entity classes
3. migrations
4. database-specific helpers

This keeps your domain model in one place so `api` and `worker` use the same entity definitions instead of drifting apart.

For queueing specifically:

1. `packages/database` owns the queue entities
2. `apps/api` owns enqueueing code
3. `apps/worker` owns dequeueing and processing code

## Step 5: Define Environment Variables

Create `.env.example`:

```env
POSTGRES_USER=app
POSTGRES_PASSWORD=app
POSTGRES_DB=lab
DATABASE_URL=postgresql://app:app@postgres:5432/lab

API_PORT=3000
PROVIDER_PORT=4000
PUBLIC_PORT=8080

SESSION_TTL_MINUTES=60
IDEMPOTENCY_TTL_HOURS=24
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=10

PAYMENT_PROVIDER_URL=http://payment-provider:4000
PAYMENT_PROVIDER_MODE=success
EMAIL_PROVIDER_MODE=success
TYPEORM_LOGGING=false

ENABLE_IN_MEMORY_SESSIONS=true
ENABLE_PERMISSION_CACHE=true
PERMISSION_CACHE_TTL_SECONDS=1800
SIMULATE_COLD_START_MS=0
```

## Step 6: Create Dockerfiles And NGINX Config

The Node services should each have a simple Dockerfile based on `node:24-alpine`.

The pattern is:

1. Copy workspace `package.json` files
2. Run `npm install`
3. Copy source code
4. Run the app with `npm run dev` or a compiled `node dist/...`

For local learning, `tsx` is fine inside Docker. You do not need an optimized production build yet.

For the services that use TypeORM:

1. import `reflect-metadata` once at process startup
2. initialize the shared `DataSource` before serving requests or starting job loops
3. keep `synchronize: false`
4. rely on migrations, not automatic schema sync

For the gateway, use the official `nginx:alpine` image instead of building another Node service.

Create `docker/nginx/default.conf` and keep the gateway behavior there:

1. define an `upstream` with `api-1:3000` and `api-2:3000`
2. listen on port `8080`
3. proxy all requests to the upstream
4. forward `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Request-Id`
5. optionally enable `limit_req` for coarse IP-based rate limiting

## Step 7: Create `docker-compose.yml`

Use one PostgreSQL container, one payment-provider, one worker, one NGINX gateway, and two API replicas.

Example shape:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: lab
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d lab"]
      interval: 5s
      timeout: 5s
      retries: 10

  payment-provider:
    build:
      context: .
      dockerfile: docker/payment-provider.Dockerfile
    environment:
      PROVIDER_PORT: 4000
    ports:
      - "4000:4000"

  api-1:
    build:
      context: .
      dockerfile: docker/api.Dockerfile
    environment:
      DATABASE_URL: postgresql://app:app@postgres:5432/lab
      API_PORT: 3000
      INSTANCE_NAME: api-1
      PAYMENT_PROVIDER_URL: http://payment-provider:4000
      ENABLE_IN_MEMORY_SESSIONS: "true"
    depends_on:
      postgres:
        condition: service_healthy
      payment-provider:
        condition: service_started
    ports:
      - "3001:3000"

  api-2:
    build:
      context: .
      dockerfile: docker/api.Dockerfile
    environment:
      DATABASE_URL: postgresql://app:app@postgres:5432/lab
      API_PORT: 3000
      INSTANCE_NAME: api-2
      PAYMENT_PROVIDER_URL: http://payment-provider:4000
      ENABLE_IN_MEMORY_SESSIONS: "true"
    depends_on:
      postgres:
        condition: service_healthy
      payment-provider:
        condition: service_started
    ports:
      - "3002:3000"

  gateway:
    image: nginx:1.27-alpine
    depends_on:
      - api-1
      - api-2
    volumes:
      - ./docker/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "8080:8080"

  worker:
    build:
      context: .
      dockerfile: docker/worker.Dockerfile
    environment:
      DATABASE_URL: postgresql://app:app@postgres:5432/lab
      PAYMENT_PROVIDER_URL: http://payment-provider:4000
    depends_on:
      postgres:
        condition: service_healthy
      payment-provider:
        condition: service_started

volumes:
  postgres_data:
```

Important:

1. Expose `api-1` on `3001` and `api-2` on `3002` for direct debugging.
2. Expose the NGINX gateway on `8080` and treat that as your public entry point.
3. Start with `ENABLE_IN_MEMORY_SESSIONS=true` so you can reproduce Q18 before fixing it.
4. Run TypeORM migrations before using the app for the first time.

## Step 8: Create The Database Layer With TypeORM

Put the database model in `packages/database`.

Create `packages/database/src/data-source.ts` with one shared `DataSource` that both the `api` and `worker` can import.

The important settings are:

1. `type: "postgres"`
2. `url: process.env.DATABASE_URL`
3. `entities: [...]`
4. `migrations: [...]`
5. `synchronize: false`
6. `logging` controlled by `TYPEORM_LOGGING`

Do not use `synchronize: true` for this lab. You want repeatable migrations because they make state changes explicit, which is exactly what matters in distributed systems work.

### Core tables

You should create at least these tables:

1. `users`
2. `sessions`
3. `orders`
4. `payments`
5. `idempotency_keys`
6. `jobs`
7. `dead_letters`
8. `outbox_events`
9. `user_permissions`
10. `permission_cache`

Represent each of these as a TypeORM entity class, and create migrations from those entities instead of hand-maintaining the full schema in raw SQL files.

### Recommended TypeORM layout

Inside `packages/database/src`:

1. `data-source.ts`
2. `entities/`
3. `migrations/`

Inside each entity:

1. use `@Entity({ name: "..." })`
2. define columns explicitly
3. add indexes and unique constraints explicitly
4. model relations carefully, but avoid over-eager cascading on critical state transitions
5. use enums or constrained string columns for lifecycle states

### Suggested schema responsibilities

#### `users`

Store:

- `id`
- `email`
- `password_hash` or fake local password for the lab
- `permission_version`
- timestamps

#### `sessions`

Store:

- `id`
- `user_id`
- `session_token`
- `expires_at`
- timestamps

This table is the fix for the in-memory session bug in Q18.

#### `orders`

Store:

- `id`
- `user_id`
- `amount_cents`
- `status`
- `payment_id`
- `created_at`
- `updated_at`

Use states like:

- `pending_payment`
- `payment_processing`
- `paid`
- `payment_failed`
- `payment_unknown`

#### `payments`

Store:

- `id`
- `order_id`
- `idempotency_key`
- `request_hash`
- `status`
- `provider_reference`
- `provider_response_json`
- timestamps

Use statuses like:

- `started`
- `succeeded`
- `failed`
- `unknown`

#### `idempotency_keys`

Store:

- `id`
- `scope`
- `idempotency_key`
- `request_hash`
- `status`
- `response_code`
- `response_body_json`
- `resource_type`
- `resource_id`
- `locked_until`
- `expires_at`
- timestamps

Rules:

1. Add a unique constraint on `(scope, idempotency_key)`.
2. Persist the original request hash.
3. Persist the final response body and response code.
4. Add TTL cleanup via `expires_at`.

#### `jobs`

Store:

- `id`
- `type`
- `payload_json`
- `status`
- `attempt_count`
- `max_attempts`
- `next_run_at`
- `last_error`
- `dedupe_key`
- timestamps

Use statuses like:

- `pending`
- `processing`
- `retry_scheduled`
- `completed`
- `dead_lettered`

#### `dead_letters`

Store failed jobs after retry exhaustion:

- `id`
- `job_id`
- `payload_json`
- `failure_reason`
- `final_attempt_count`
- timestamps

#### `outbox_events`

Use this for reliable follow-up work after local DB transactions.

Store:

- `id`
- `aggregate_type`
- `aggregate_id`
- `event_type`
- `payload_json`
- `status`
- `processed_at`
- timestamps

This is very useful for Q17.

#### `user_permissions`

Store:

- `id`
- `user_id`
- `permission_name`
- `is_active`
- `version`
- timestamps

#### `permission_cache`

If you want to model the stale-cache bug explicitly in PostgreSQL, store:

- `user_id`
- `version`
- `permissions_json`
- `expires_at`

However, to reproduce the bug more naturally, start with an in-memory cache inside each API replica and only later move the cache validation logic into PostgreSQL-backed version checks.

### Migrations

Use TypeORM migrations for schema evolution:

1. create the entity classes
2. generate or write a migration
3. review the generated SQL carefully
4. run `npm run db:migrate`

Recommended rule:

1. use migrations for tables, indexes, constraints, and enum changes
2. never depend on `synchronize: true`
3. keep destructive changes explicit and reviewed

### Repository usage

In application code, do not scatter SQL strings everywhere. Use TypeORM repositories and `QueryRunner` where needed:

1. repositories for ordinary CRUD and filtered queries
2. `QueryRunner` for multi-step local transactions
3. query builder or targeted SQL for advanced cases like `FOR UPDATE SKIP LOCKED`

### Queue schema ownership

For the queue, `packages/database` should define:

1. `Job` for pending and retriable work
2. `DeadLetter` for permanently failed work
3. `OutboxEvent` for reliable follow-up work emitted from request flows

This means queue storage is developed in the shared database package, not inside the API or worker app folders.

## Step 9: Seed Initial Data

Add one admin user and one normal user.

Example seed intention:

1. `admin@example.com`
   Has `admin`, `pay`, and `read_reports`
2. `user@example.com`
   Has `pay` and `read_reports`

Create a simple `scripts/seed.ts` file that initializes the shared `DataSource`, inserts these users, inserts their permissions, and exits.

This will let you practice login, payment flow, and permission revocation.

## Step 10: Build The Payment Provider Mock

This service is one of the most important parts of the lab.

To keep the lab small, let the `payment-provider` container simulate both:

1. the external payment API
2. the external email provider

Implement these endpoints:

1. `POST /charges`
   Pretends to charge a card.
2. `POST /emails`
   Pretends to send an email.
3. `POST /mode`
   Changes provider behavior at runtime.
4. `GET /mode`
   Returns the current provider mode.

Support these modes:

1. `success`
   Always return `200` with a fake charge ID.
2. `flaky_503`
   Sometimes return `503`.
3. `always_503`
   Always return `503`.
4. `timeout_before_response`
   Sleep longer than the client timeout and then return nothing useful.
5. `success_then_timeout`
   Pretend the provider completed the charge but your client never saw the response. This is excellent for testing uncertain payment state.

Make the mode endpoint explicit. For example, accept a body like:

```json
{
  "target": "payments",
  "mode": "success"
}
```

or:

```json
{
  "target": "emails",
  "mode": "flaky_503"
}
```

Also add provider-side idempotency support:

1. payments should accept an idempotency key
2. emails should accept a dedupe key
3. repeated requests with the same safe key should return the original result

## Step 11: Build The API Service

Implement these routes first:

1. `POST /auth/login`
2. `GET /me`
3. `POST /orders`
4. `POST /payments`
5. `POST /orders/:id/pay`
6. `POST /admin/users/:id/revoke-access`
7. `GET /protected/report`
8. `GET /health`
9. `GET /debug/cold-start`

At API startup:

1. import `reflect-metadata`
2. initialize the shared TypeORM `DataSource`
3. build Express only after the DB connection is ready

### Queue producer responsibilities

The API is where queue-producing code belongs.

Good places for that code are:

1. `apps/api/src/services/queueService.ts`
2. `apps/api/src/repositories/jobRepo.ts`
3. `apps/api/src/repositories/outboxRepo.ts`

The API should enqueue work for things like:

1. `send_email`
2. `reconcile_payment`
3. outbox events triggered by order or payment state changes

### Internal service responsibilities

#### `sessionService`

Start with:

- in-memory Map keyed by session token

Then upgrade to:

- a TypeORM `Repository<Session>` backed by the PostgreSQL `sessions` table

This deliberate progression lets you reproduce Q18 first and then fix it.

#### `idempotencyService`

It should:

1. Read `Idempotency-Key`
2. Hash the normalized request payload
3. Attempt to create an idempotency record through a TypeORM repository
4. Detect duplicate key with same hash
5. Detect duplicate key with different hash
6. Detect in-progress requests
7. Persist final response when the operation finishes

#### `paymentService`

It should:

1. Create or load an order
2. Use an idempotency key when calling the external payment provider
3. Save payment attempt state
4. Update order and payment state carefully, using transactions where local consistency matters
5. Publish reconciliation or follow-up tasks when state is uncertain

#### `permissionService`

It should:

1. Load permissions from DB
2. Cache them for a TTL
3. Validate cache freshness using a version number

Start with the broken version first:

- long TTL
- no invalidation

Then fix it:

- shorter TTL
- version-based cache keys
- or a PostgreSQL `LISTEN/NOTIFY` invalidation channel

## Step 12: Build The Worker

The worker should poll the `jobs` table and process pending jobs.

Initialize the same shared TypeORM `DataSource` before starting the worker loop.

### Queue consumer responsibilities

The worker is where queue-consuming code belongs.

Good places for that code are:

1. `apps/worker/src/worker.ts` for process startup
2. `apps/worker/src/services/queuePoller.ts` for polling and claiming jobs
3. `apps/worker/src/jobs/emailJob.ts` for email processing
4. `apps/worker/src/jobs/reconciliationJob.ts` for payment reconciliation
5. `apps/worker/src/services/retryPolicy.ts` for backoff and jitter
6. `apps/worker/src/services/deadLetterService.ts` for exhausted retries

The worker should never be responsible for deciding business events that need background work. It should only consume jobs that the API or outbox flow already created.

### Polling pattern

Use a query like:

- select jobs that are `pending` or `retry_scheduled`
- only select rows where `next_run_at <= now()`
- claim them with `FOR UPDATE SKIP LOCKED`

This avoids two worker instances taking the same job.

In TypeORM, this is one of the places where using a query builder or a narrow raw SQL query is appropriate. Do not force everything through generic CRUD helpers when the locking behavior is the real point of the exercise.

### Jobs to implement

1. `send_email`
2. `reconcile_payment`

### Retry behavior

For transient failures:

1. Increment attempt count
2. Compute exponential backoff
3. Add jitter
4. Set `next_run_at`
5. Leave the job retriable

After `max_attempts`:

1. Mark job `dead_lettered`
2. Insert a record into `dead_letters`

## Step 13: Build The NGINX Gateway

The gateway should be an NGINX config, not a Node app.

Create `docker/nginx/default.conf` with:

1. an `upstream` block pointing at `api-1:3000` and `api-2:3000`
2. a `server` block listening on `8080`
3. `proxy_pass http://api_backend;`
4. `proxy_set_header` entries for `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, `Authorization`, and cookies
5. request ID forwarding so logs can be correlated across services
6. optional `limit_req` on selected routes

Example shape:

```nginx
upstream api_backend {
    server api-1:3000;
    server api-2:3000;
}

map $http_x_request_id $forwarded_request_id {
    default $http_x_request_id;
    ""      $request_id;
}

limit_req_zone $binary_remote_addr zone=public_api:10m rate=10r/s;

server {
    listen 8080;

    location / {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Id $forwarded_request_id;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header Cookie $http_cookie;
        proxy_http_version 1.1;
    }

    location /protected/report {
        limit_req zone=public_api burst=20 nodelay;
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Id $forwarded_request_id;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header Cookie $http_cookie;
        proxy_http_version 1.1;
    }
}
```

NGINX uses round-robin by default when multiple upstream servers are listed, so you do not need custom proxy code for the base lab.

This gateway is what makes Q18 and Q19 feel real.

## Step 14: Bring Everything Up

When the files exist, start the system:

```bash
docker compose up --build -d
npm run db:migrate
npm run db:seed
```

Check health:

```bash
curl http://localhost:8080/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:4000/mode
```

You now have a real local lab.

## Exercise Labs

This section is the core of the document. For each question, first reproduce the failure, then implement the correct behavior, then test it again.

## Q15: Idempotency

### What should happen

If the client retries:

```http
POST /payments
Idempotency-Key: abc-123
```

the backend must not charge twice.

### What to build

In `POST /payments`:

1. Require `Idempotency-Key`
2. Normalize the request payload
3. Hash it
4. Insert an `idempotency_keys` row with status `in_progress`
5. If the key already exists:
   same key plus same payload should return the stored result
6. If the key already exists with a different payload:
   reject it
7. If the key exists but is still processing:
   return `409`, `202`, or wait, depending on your design
8. On success:
   store `response_code` and `response_body_json`
9. Add TTL cleanup

### Minimal state machine

Use idempotency statuses like:

- `in_progress`
- `completed`
- `failed`

### Good response behavior

1. Same key plus same payload:
   return original result
2. Same key plus different payload:
   return `409 Conflict` or `422 Unprocessable Entity`
3. Same key while original request is still running:
   return `409 Conflict`, `202 Accepted`, or block until completion

### How to test it

Start with provider mode `success`.

Create a payment:

```bash
curl -i -X POST http://localhost:8080/payments \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: abc-123' \
  -d '{"orderId":"order-1","amountCents":5000,"cardToken":"tok_visa"}'
```

Send the exact same request again.

Expected result:

1. Same HTTP response code
2. Same payment result
3. No second charge row created

Now send the same key with a different amount:

```bash
curl -i -X POST http://localhost:8080/payments \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: abc-123' \
  -d '{"orderId":"order-1","amountCents":9000,"cardToken":"tok_visa"}'
```

Expected result:

1. Request rejected
2. Clear error explaining the key was already used with another payload

### Senior-level details to include in your explanation

1. Store the request hash
2. Store operation status
3. Store final response
4. Handle in-progress duplicates
5. Expire old keys with TTL

## Q16: Queue Retries

### What should happen

If the email provider returns `503`, the worker should retry with exponential backoff and jitter. If retries are exhausted, the job should move to a dead-letter queue or dead-letter table.

### What to build

Create a `send_email` job with fields:

1. recipient
2. subject
3. body
4. dedupe key
5. attempt count
6. max attempts

Worker policy:

1. Treat `503` as transient
2. Compute backoff like `baseDelayMs * 2^attempt`
3. Add jitter
4. Reschedule
5. Make the job idempotent so duplicate processing does not send duplicate email

### How to make the job idempotent

Add `dedupe_key` on the job, and in the simulated provider:

1. accept the dedupe key
2. return the original send result for repeated sends

### How to test it

Switch the provider to flaky mode:

```bash
curl -X POST http://localhost:4000/mode \
  -H 'Content-Type: application/json' \
  -d '{"target":"emails","mode":"flaky_503"}'
```

Create a job by hitting an API endpoint like `POST /debug/send-email`.

Expected result:

1. some attempts fail with `503`
2. worker retries later
3. eventually the job either completes or dead-letters

To test dead-letter behavior:

```bash
curl -X POST http://localhost:4000/mode \
  -H 'Content-Type: application/json' \
  -d '{"target":"emails","mode":"always_503"}'
```

Then create another job.

Expected result:

1. retries happen up to max attempts
2. job moves to `dead_letters`
3. duplicate emails are not sent

### Senior-level details to include in your explanation

1. Retry only transient failures
2. Use exponential backoff
3. Add jitter to avoid retry storms
4. Make the job idempotent
5. Use dead-letter handling after max attempts

## Q17: External Payment Failure

### The broken flow

This is the classic bad flow:

```ts
await db.orders.create(order);
await paymentProvider.charge(card, amount);
await db.orders.update(order.id, { status: "paid" });
```

### Why it is broken

If the payment provider succeeds but the final DB update fails, the customer may be charged while your system still shows the order as unpaid or unknown.

### Better local design

Use this conceptual flow:

1. Create order as `pending_payment`
2. Start a payment record
3. Call provider with idempotency key
4. Save provider result
5. Mark order `paid` if local update succeeds
6. If local update fails after provider success:
   store `payment_unknown` or `payment_succeeded_but_finalize_failed`
7. Enqueue reconciliation job

### What to build

Add a debug path that simulates local DB failure after provider success.

For example:

- header: `X-Simulate-Finalize-Failure: true`
- or query param: `?simulateFinalizeFailure=true`

### How to test it

1. Set provider mode to `success`
2. Create an order
3. Pay with the debug failure enabled

Expected result:

1. provider records a successful charge
2. order is not fully finalized
3. local system marks the state as uncertain instead of lying
4. reconciliation job later resolves it

### Reconciliation strategy

Your worker should:

1. read uncertain payment records
2. call the provider to confirm final charge status
3. update local order state
4. record the reconciliation result

### Senior-level details to include in your explanation

1. Use a state machine, not one boolean
2. Use transactions for local DB changes
3. Use idempotency with the external provider
4. Reconcile uncertain states asynchronously
5. Consider the outbox pattern

## Q18: Horizontal Scaling

### What should happen

If sessions are stored in memory and you deploy multiple API replicas, users will get randomly logged out because each replica has different process memory.

### How to reproduce the bug

Start the system with:

- `api-1`
- `api-2`
- `gateway` running NGINX round-robin between them
- `ENABLE_IN_MEMORY_SESSIONS=true`

Login:

```bash
curl -i -X POST http://localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password"}'
```

Save the returned cookie.

Call `/me` several times through the gateway:

```bash
curl -i http://localhost:8080/me --cookie "sessionToken=YOUR_TOKEN"
curl -i http://localhost:8080/me --cookie "sessionToken=YOUR_TOKEN"
curl -i http://localhost:8080/me --cookie "sessionToken=YOUR_TOKEN"
```

Expected broken behavior:

1. one request works
2. another request hits the other replica
3. that replica does not know the session
4. the user appears logged out

### Fix

Move sessions into the `sessions` PostgreSQL table.

In practice for this project, that means moving from an in-memory `Map` to a TypeORM `Session` entity plus repository-backed lookup.

Then set:

```env
ENABLE_IN_MEMORY_SESSIONS=false
```

### Re-test

Repeat the login and `/me` calls.

Expected fixed behavior:

1. both replicas can load the same shared session
2. no random logout

### Senior-level details to include in your explanation

1. In-memory state is local to one instance
2. Requests hit different replicas
3. Use shared session storage
4. Stateless tokens can also work depending on requirements
5. Sticky sessions are weaker than shared or stateless design

## Q19: Rate Limiting

### What should happen

Protect a public endpoint from abuse using distributed, shared rate limiting.

### Where to implement it

Practice two variants:

1. At the NGINX gateway for coarse per-IP protection
2. Inside the API middleware for stronger shared enforcement

For interview answers, explicitly mention possible layers:

1. edge or CDN
2. API gateway
3. application middleware
4. distributed shared storage for counters

### Two-layer implementation

For this lab, use two layers:

1. NGINX `limit_req` for cheap first-line filtering at the edge
2. a PostgreSQL-backed limiter in the API for shared, multi-replica policy

The NGINX layer is great for coarse per-IP protection, but it is local to the gateway instance. The PostgreSQL-backed limiter is what lets you practice the distributed part of the question.

### PostgreSQL-backed application limiter

Implement a simple token bucket or fixed-window counter using a shared table.

Suggested table fields:

1. subject key, such as IP or user ID
2. window start
3. request count or token balance
4. updated at

### Flow

For each request:

1. identify the subject, such as IP, user ID, or API key
2. read or create the current window row
3. atomically increment usage
4. reject when the limit is exceeded

### How to test it

Use a simple load script or repeated curl calls against a public endpoint.

Example idea:

```bash
for i in {1..20}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/protected/report
done
```

Expected result:

1. early requests succeed
2. later requests return `429`
3. logs show which subject was limited

### Senior-level details to include in your explanation

1. limit by IP, user, API key, or a combination
2. validate requests before heavy work
3. add abuse detection and logging
4. consider exponential penalties for repeated abuse
5. mention edge, gateway, and app layers

## Q20: Cache Invalidation

### What should happen

If permissions are cached for 30 minutes and an admin removes access, the user may continue to access protected actions until the cache expires.

### How to reproduce the bug

Start with:

- `ENABLE_PERMISSION_CACHE=true`
- `PERMISSION_CACHE_TTL_SECONDS=1800`
- no invalidation logic

Flow:

1. login as normal user
2. access a protected endpoint so permissions are cached
3. revoke the permission as admin
4. immediately access the protected endpoint again

Expected broken behavior:

1. user still has access
2. cached permissions are stale

### Fix options

Practice at least one of these:

1. short TTL
2. versioned permissions
3. event-based invalidation
4. bypass cache for highly sensitive actions

### Strong fix for this lab

Use `permission_version`:

1. store a version on the user record
2. increment it on permission changes
3. include it in the cache key or validate it before using cache

Optional advanced fix:

Use PostgreSQL `LISTEN/NOTIFY` so each API replica clears its in-memory permission cache when admin changes happen.

### How to test it

1. login as user
2. hit protected route
3. revoke permission
4. hit protected route again

Expected fixed behavior:

1. user is denied quickly after revocation

### Senior-level details to include in your explanation

1. stale cache is the root issue
2. sensitive permissions need careful invalidation
3. TTL alone may be too weak
4. versioning and event-based invalidation are stronger
5. force fresh checks for high-risk operations

## Q21: Serverless Cold Starts

### What cold starts are

A cold start happens when a function or container is started fresh and must initialize before serving a request. That adds latency.

### How to simulate locally

You are not running true serverless here, but you can still reproduce the behavior:

1. add a startup delay or heavy lazy import
2. restart a container
3. measure the first request
4. measure the next few warm requests

### What to build

Add a debug endpoint like:

- `GET /debug/cold-start`

Implement a module-level flag:

1. if this is the first request in the process, sleep for `SIMULATE_COLD_START_MS`
2. then mark the process warm

Also log:

1. whether the request was cold or warm
2. the initialization duration

### How to test it

Set:

```env
SIMULATE_COLD_START_MS=3000
```

Restart one API container:

```bash
docker compose restart api-1
```

Then hit it directly:

```bash
time curl http://localhost:3001/debug/cold-start
time curl http://localhost:3001/debug/cold-start
```

Expected result:

1. first request is much slower
2. later requests are fast

### Senior-level details to include in your explanation

1. cold starts add latency
2. bundle size and heavy imports matter
3. runtime initialization matters
4. provisioned concurrency or warmers can help in real platforms
5. efficient startup reduces user-facing impact

## Q22: Observability

### Problem statement

A user says:

`The AI assistant sometimes takes 20 seconds.`

### What you should inspect

Your local system should let you answer questions like:

1. what was the end-to-end request latency
2. which service was slow
3. whether the slowdown came from DB calls, provider calls, queue backlog, retries, or startup delay

### What to build

Implement these observability basics:

1. structured JSON logs
2. correlation ID on every request
3. timings for each downstream call
4. queue depth logging
5. logs for retry attempts
6. request outcome logging

### Minimum fields to log

For every request:

1. `requestId`
2. `service`
3. `route`
4. `method`
5. `statusCode`
6. `durationMs`
7. `userId` when available
8. `downstreamTarget`
9. `downstreamDurationMs`
10. `errorCode` if any

### Minimum metrics to compute

Even if you do not add Prometheus yet, you should still track:

1. p50 latency
2. p95 latency
3. p99 latency
4. payment provider latency
5. DB query latency
6. worker queue depth
7. retry counts
8. failure counts
9. cold start count

### Recommended local approach

Start simple:

1. emit JSON logs to stdout
2. inspect with `docker compose logs`
3. optionally add a lightweight in-memory metrics endpoint per service

Then, if you want a more realistic lab, add:

1. Prometheus
2. Grafana
3. OpenTelemetry
4. Jaeger or Tempo

Those are optional upgrades. They are not required to practice the concepts in this document.

### How to test it

Simulate slow behavior:

1. set provider mode to `timeout_before_response`
2. create queue backlog
3. enable cold-start delay

Then trace a single request ID across logs and answer:

1. was the API slow
2. was the provider slow
3. was the DB slow
4. was the system retrying
5. was the worker behind

### Senior-level details to include in your explanation

1. check p95 and p99, not just averages
2. inspect model or downstream service latency
3. inspect DB query timing
4. inspect queue depth
5. inspect retries and cold starts
6. use correlation IDs and traces
7. check recent deployments or configuration changes

## Suggested Build Order

If you want the smoothest implementation path, build in this order:

1. shared TypeORM `DataSource`, entities, and first migration
2. payment-provider mock
3. API skeleton with health route
4. NGINX gateway with upstream load balancing
5. login and in-memory sessions
6. shared PostgreSQL-backed sessions through TypeORM
7. orders and payments tables
8. idempotency on `POST /payments`
9. worker and job polling
10. email retries and dead-letter handling
11. payment reconciliation job
12. permission cache and invalidation experiment
13. rate limiting
14. cold-start simulation
15. structured logging and timing

That order is deliberate:

1. it gets the system running quickly
2. it lets you reproduce Q18 early
3. it adds Q15 and Q17 after the core request path exists
4. it adds Q16 after the worker exists
5. it leaves observability for after the core flows are alive

## Suggested Manual Test Checklist

When your lab is ready, you should be able to prove all of these:

1. duplicate payment requests with the same idempotency key do not create two charges
2. duplicate key with different payload is rejected
3. transient email failures retry and eventually succeed or dead-letter
4. a successful external payment plus failed local finalize step creates an uncertain state, not silent inconsistency
5. in-memory sessions fail under two replicas
6. PostgreSQL-backed sessions through TypeORM fix the random logout issue
7. repeated public requests eventually hit `429`
8. revoked permissions stop working quickly after your invalidation fix
9. first request after restart is slower than warm requests
10. logs let you trace one request end to end

## Interview Practice Angle

As you build each feature, practice explaining three things:

1. the failure mode
2. the minimal safe design
3. the tradeoffs

Example:

- Q15 failure mode:
  a client retry can create duplicate charges
- Q15 safe design:
  persist idempotency state, request hash, and final result
- Q15 tradeoffs:
  storage cost, TTL design, and handling in-progress races

Do this for every scenario. It is one of the best ways to turn coding practice into interview fluency.

## Optional Upgrades After The Base Lab Works

If you want to make the lab more production-like later, add:

1. Redis for faster distributed sessions and rate limiting
2. Kafka or RabbitMQ for queue work instead of PostgreSQL polling
3. Prometheus and Grafana for metrics
4. OpenTelemetry and Jaeger for tracing
5. k6 load tests
6. a third API replica to create more realistic fan-out

These are upgrades, not prerequisites. The PostgreSQL plus TypeORM version is enough to learn the core concepts well.

## Final Recommendation

Do not try to perfect everything at once.

Build the smallest version that lets you reproduce each bug:

1. first make it fail
2. then make it safe
3. then make it observable

That rhythm is exactly what helps with distributed systems interviews, because the best answers are not just definitions. They show that you understand how systems break and how to contain the blast radius.
