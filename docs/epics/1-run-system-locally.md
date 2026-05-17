# Epic 1: Run The System Locally

## Goal

Get the distributed systems practice lab running end to end on a local machine with:

- NGINX as the reverse proxy gateway
- two API replicas
- one worker
- one payment-provider mock
- one PostgreSQL instance
- TypeORM migrations and seed data

The purpose of this epic is not to finish all distributed systems features. The purpose is to create a stable local development baseline that the later exercises can build on.

## Problem Statement

Before we can practice idempotency, retries, payment reconciliation, horizontal scaling, rate limiting, cache invalidation, cold starts, and observability, we need a working local environment that boots consistently and is easy to verify.

Right now, the most important missing capability is a runnable baseline where:

1. all containers start successfully
2. the database schema is created through TypeORM migrations
3. seed data exists for local testing
4. the gateway can route traffic to both API replicas
5. the worker can connect to PostgreSQL
6. the whole stack can be sanity-checked with a few health endpoints

## Outcome

After this epic is complete, a developer should be able to clone the repository, run the local setup commands, and confirm that the system is alive without needing to manually wire infrastructure together.

## Scope

This epic includes:

1. repository bootstrap for the local workspace
2. minimal package setup for the Node services and shared packages
3. Dockerfiles for the Node services using `node:24-alpine`
4. `docker-compose.yml` for the full local stack
5. NGINX gateway configuration
6. shared TypeORM `DataSource`
7. initial TypeORM entities and first migration
8. seed script for local test data
9. basic service startup and health endpoints
10. a smoke-test path to verify local startup

This epic does not include full implementation of the later exercise scenarios such as idempotency logic, retry policy correctness, or payment reconciliation workflows beyond what is needed for bootstrapping.

## Deliverables

The epic is complete when the repository contains:

1. root `package.json` with workspace scripts
2. `tsconfig.base.json`
3. `docker-compose.yml`
4. `docker/nginx/default.conf`
5. `docker/api.Dockerfile`
6. `docker/worker.Dockerfile`
7. `docker/payment-provider.Dockerfile`
8. `apps/api` bootstrapped with a minimal server and `/health`
9. `apps/worker` bootstrapped with startup logging and database connection
10. `apps/payment-provider` bootstrapped with a minimal `/health` or `/mode`
11. `packages/database/src/data-source.ts`
12. initial entities and `0001-InitSchema.ts`
13. `scripts/seed.ts`
14. local setup instructions in the docs

## Success Criteria

This epic is successful when all of the following are true:

1. `docker compose up --build -d` starts all containers successfully
2. `npm run db:migrate` completes successfully against local PostgreSQL
3. `npm run db:seed` completes successfully
4. `curl http://localhost:8080/health` returns success through NGINX
5. `curl http://localhost:3001/health` returns success from `api-1`
6. `curl http://localhost:3002/health` returns success from `api-2`
7. `curl http://localhost:4000/mode` returns success from `payment-provider`
8. the worker starts, connects to PostgreSQL, and stays running
9. logs clearly show that each service booted successfully

## Stories

### Story 1: Bootstrap The Workspace

Create the minimal repository structure, root workspace configuration, basic local PostgreSQL container configuration, and repository-wide environment management baseline needed for local development.

Acceptance criteria:

1. root `package.json` uses npm workspaces
2. root scripts exist for build, local startup, migrations, and seeding
3. shared TypeScript config exists
4. the repository includes the basic local PostgreSQL Docker configuration
5. the repository includes a root `.gitignore`
6. the repository includes the `.env` templates and conventions needed for safe local configuration

### Story 2: Bootstrap The API Service

Create a minimal API service that starts, connects to the shared database layer, and exposes a health endpoint.

Acceptance criteria:

1. the service starts in Docker
2. TypeORM initializes successfully
3. `/health` returns success
4. the service can run as both `api-1` and `api-2`

### Story 3: Bootstrap The Worker

Create a minimal worker process that starts, initializes TypeORM, and remains connected to PostgreSQL.

Acceptance criteria:

1. the worker container starts successfully
2. the worker initializes the shared `DataSource`
3. logs confirm successful startup

### Story 4: Bootstrap The Payment Provider Mock

Create a minimal mock provider service that starts and exposes a basic readiness endpoint.

Acceptance criteria:

1. the service starts in Docker
2. `GET /mode` or `/health` responds successfully

### Story 5: Add The Shared Database Layer

Create the shared TypeORM package with the first migration and initial entities required to boot the system.

Acceptance criteria:

1. `packages/database` contains a shared `DataSource`
2. initial entities compile
3. `0001-InitSchema.ts` runs successfully
4. the migration creates the minimum required tables for startup

### Story 6: Add Seed Data

Create a local seed script for at least one admin user and one normal user.

Acceptance criteria:

1. `npm run db:seed` succeeds
2. seed data is safe to rerun or clearly documented if it is one-time only

### Story 7: Configure The NGINX Gateway

Create the local reverse proxy configuration so public requests can route to both API replicas.

Acceptance criteria:

1. NGINX listens on `8080`
2. requests proxy to `api-1` and `api-2`
3. health checks work through the gateway
4. forwarded headers are preserved

### Story 8: Add Local Smoke Verification

Create a minimal verification flow so a developer can confirm the stack is working.

Acceptance criteria:

1. the docs contain the exact startup commands
2. the docs contain the exact health-check commands
3. a developer can verify success without reading source code

## Technical Notes

The local baseline should follow these implementation rules:

1. use NGINX as the gateway, not a Node.js proxy
2. use PostgreSQL as the shared state store
3. use TypeORM with `synchronize: false`
4. use TypeORM migrations for schema creation
5. use `reflect-metadata` in services that initialize TypeORM
6. use Node.js `24.x` or later for local development
7. use `node:24-alpine` for the Node service Dockerfiles
8. keep startup paths as simple as possible

## Dependencies

This epic depends on:

1. Docker being available locally
2. Node.js `24.x` or later and npm being installed locally
3. the repository following the structure described in [repo-overview.md](/Users/jm/Documents/Github/Meira-JH/distributed-systems-exercise/docs/repo-overview.md)

## Risks

Known risks for this epic:

1. TypeORM configuration drift between `api` and `worker`
2. container startup ordering issues
3. database migration failures during first boot
4. environment variable mismatches between local shell and Docker Compose
5. NGINX routing misconfiguration across the two API replicas

## Out Of Scope

This epic does not require:

1. production-ready CI/CD
2. Kubernetes deployment
3. full exercise implementations for Q15 through Q22
4. advanced observability stack like Prometheus or Grafana
5. Redis, Kafka, RabbitMQ, or other optional infrastructure

## Definition Of Done

This epic is done when:

1. all deliverables exist in the repository
2. all success criteria pass locally
3. the local startup flow is documented
4. a new developer can boot the stack and verify it without tribal knowledge
