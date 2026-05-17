# Distributed Systems Practice Lab Docs

Use this folder as the starting point for the local bootstrap and the planned implementation stories.

## Start Here

- [Repository Overview](/Users/jm/Documents/Github/Meira-JH/distributed-systems-exercise/docs/repo-overview.md)
  High-level architecture, target repository shape, and the planned implementation path.
- [Environment And Local Ownership](/Users/jm/Documents/Github/Meira-JH/distributed-systems-exercise/docs/environment.md)
  The committed env templates, local-only files, and the shared variable naming convention established in Story 1.1.


## Current Local Commands

From the repository root:

```bash
npm run build
npm run infra:up
npm run infra:logs
npm run infra:down
```

The `dev:*` and `db:*` root commands already exist, but they are wrappers for workspace package scripts that will be added in later stories.
