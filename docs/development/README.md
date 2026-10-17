# Development Documentation

**Status:** Current workspace setup; product app workflows will be added by their owners.

## Guides

- [`workspace.md`](workspace.md) — Node/pnpm setup, root and filtered commands, member creation,
  dependency security, cache behavior, and troubleshooting.
- [`agent-collaboration.md`](agent-collaboration.md) — Claude/Codex task distribution, bridge
  preflight, least-privilege worker profiles, review separation, and failure handling.

This directory will own repeatable developer workflows shared across the monorepo:

- prerequisites and initial local setup;
- package-manager and workspace commands;
- environment-variable names and safe local defaults, never secret values;
- app/package creation and ownership conventions;
- code generation and migration workflows;
- local service dependencies;
- debugging and troubleshooting; and
- contribution and review workflow.

The package manager and workspace task runner are approved in
[`ADR 0001`](../architecture/decisions/0001-select-pnpm-turborepo.md). Each command added here must
be runnable from the path it documents and state the expected outcome.

Member-specific setup belongs in `apps/<app>/README.md` or `packages/<package>/README.md` and should
link back to shared workspace setup rather than copying it.
