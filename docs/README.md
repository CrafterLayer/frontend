# CraftKit Documentation

This directory is the human-facing documentation hub for the CraftKit frontend monorepo. Keep it
navigable from this file and keep each document close to the scope that owns it.

## Documentation Map

| Area         | Path                                      | Purpose                                                                           |
| ------------ | ----------------------------------------- | --------------------------------------------------------------------------------- |
| Architecture | [`architecture/`](architecture/README.md) | Current system shape, boundaries, diagrams, and accepted technical decisions      |
| Development  | [`development/`](development/README.md)   | Local setup, workspace commands, contribution workflows, and troubleshooting      |
| Testing      | [`testing/`](testing/README.md)           | Test strategy, quality gates, fixtures, accessibility, and Storybook verification |
| Runbooks     | [`runbooks/`](runbooks/README.md)         | Repeatable operational, release, recovery, and incident procedures                |

## Source-of-Truth Boundaries

- `.specify/memory/constitution.md` owns non-negotiable project policy.
- `specs/**/{spec,plan,tasks}.md` owns approved feature intent and delivery work.
- `docs/architecture/` describes the current or explicitly proposed system design.
- `docs/architecture/decisions/` records accepted architecture decisions and their consequences.
- App- or package-specific setup belongs in that member's `README.md` and may link back here.
- Component API documentation stays colocated as `ComponentName.docs.mdx` beside the component,
  story, and test. Do not duplicate it in this directory.

If sources disagree, follow the authority order in `AGENTS.md` and correct the stale document in the
same change.

## Start Here

- [Set up and operate the workspace](development/workspace.md).
- [Understand the pnpm/Turbo architecture](architecture/monorepo.md).
- [Read the testing and Storybook quality contract](testing/strategy.md).
- [Review the workspace tooling decision](architecture/decisions/0001-select-pnpm-turborepo.md).
- [Review the routing, query, and bundle decision](architecture/decisions/0002-select-routing-query-foundations.md).

## Document Standard

Every durable document should state:

1. its purpose and scope;
2. whether it describes current, proposed, deprecated, or historical behavior;
3. the owning app, package, or workspace concern;
4. related specs, decisions, code paths, or runbooks; and
5. what change would make the document stale.

Avoid copying generated output, chat transcripts, secrets, temporary TODO lists, or the same policy
into multiple files. Prefer links to the canonical source.

## Adding Documentation

- Cross-workspace architecture belongs under `architecture/`.
- A durable technical choice belongs in `architecture/decisions/` using the ADR template.
- Developer setup and common workflows belong under `development/`.
- Test policy and reusable testing techniques belong under `testing/`.
- A production or release procedure that must be followed step-by-step belongs under `runbooks/`.
- Feature requirements and implementation tasks belong under `specs/`, not here.
