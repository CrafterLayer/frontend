# Data Model: Workspace Foundation

This feature has no business-data persistence. Its model is the repository graph and the contracts
validated from manifests and component folders.

## Workspace Member

| Field          | Meaning                                                 | Validation                                                    |
| -------------- | ------------------------------------------------------- | ------------------------------------------------------------- |
| `path`         | Direct directory under `apps/` or `packages/`           | Must contain `package.json`; nested fixtures are not members  |
| `name`         | Package-manager identity                                | Required and unique across the workspace                      |
| `kind`         | `app` or `package` derived from the owning directory    | Apps are private; all foundation members are private          |
| `version`      | Optional private package version                        | If present, valid semantic version                            |
| `exports`      | Supported package public surface                        | Required for packages; targets must stay inside the member    |
| `scripts`      | Tasks exposed to Turbo                                  | Names must match the documented task contract when applicable |
| `dependencies` | Runtime, development, optional, and peer manifest edges | Internal runtime/dev/optional edges use `workspace:*`         |

## Dependency Edge

| Field       | Meaning                                          | Validation                                  |
| ----------- | ------------------------------------------------ | ------------------------------------------- |
| `from`      | Owning workspace member                          | Must exist                                  |
| `to`        | Referenced internal member                       | Must exist for a `workspace:` range         |
| `section`   | Manifest dependency section                      | Recorded in failures                        |
| `range`     | Declared dependency selector                     | Internal edges use `workspace:*`            |
| `direction` | Derived `app->package`, `package->package`, etc. | `app->app` and `package->app` are forbidden |

The internal graph must remain acyclic. A cycle failure reports the full discovered path.

## Task Contract

| Field          | Meaning                                | Validation                                            |
| -------------- | -------------------------------------- | ----------------------------------------------------- |
| `name`         | Root or member task name               | Stable documented command                             |
| `inputs`       | Files and environment affecting output | Preserve Turbo defaults when custom inputs exist      |
| `outputs`      | Cache-restorable artifacts             | Required for build and Storybook build outputs        |
| `persistent`   | Long-running process marker            | Persistent tasks are uncached                         |
| `dependencies` | Upstream task ordering                 | Only real build/consumption dependencies are declared |

Task state transitions are
`not-started -> executed -> cached/restored or completed -> passed/failed`. Persistent tasks remain
running and do not transition to cached completion.

## Component Contract

| Field            | Required artifact                                            |
| ---------------- | ------------------------------------------------------------ |
| `name`           | PascalCase component folder and matching implementation stem |
| `implementation` | `<Name>.tsx` containing the one production component         |
| `export`         | Local `index.ts` public export                               |
| `story`          | `<Name>.stories.tsx` typed CSF with autodocs                 |
| `documentation`  | `<Name>.docs.mdx` authored usage and accessibility guidance  |
| `test`           | `<Name>.test.tsx` behavior-oriented test                     |

The validator scans component roots under `packages/*/src/components` and
`apps/*/src/**/components`. A discovered component folder is either complete or invalid; there is no
partially complete state at delivery.

## Relationships

```text
Workspace Member 1 ── * Dependency Edge * ── 1 Workspace Member
Workspace Member 1 ── * Task Contract
UI Workspace Member 1 ── * Component Contract
```
