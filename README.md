# CraftKit Builder Frontend

A pnpm and Turborepo workspace prepared for multiple product applications and intentional reusable
packages. Product application framework and deployment choices are intentionally deferred to
app-scoped specifications.

Start with [workspace setup](docs/development/workspace.md), the
[documentation index](docs/README.md), and the active
[monorepo foundation specification](specs/workspace/001-monorepo-foundation/spec.md).

```bash
pnpm install
pnpm verify
```

The root verification command is the local and CI quality contract. No command in this repository
automatically creates a Git commit.
