# Verification: Agent Skills and Bounded Core

**Date**: 2026-09-01  
**Scope**: User Story 8 / T159–T178, limited to `@craftkit/builder-ai`, the grouped Core door and
observer semantics it relies on, the Schema contribution contract, and the matching Spec Kit
artifacts.

This gate verifies the headless agent foundation. It does not claim that the later multi-page site
pipeline or the Assistant UI is complete.

## Invariants proved

- Skills are versioned, declarative data. They cannot add tools, commands, scripts, network,
  filesystem, renderer, or document-write authority.
- Skill discovery is metadata-only; bodies/references are disclosed explicitly and only active Skill
  payloads enter a request.
- Activation is request-local, deterministic, dependency/conflict/trust aware, and bounded by count,
  UTF-8 storage, and full active-payload token budgets.
- Command authority is the intersection of the live registry, host policy, and every active Skill,
  followed by deny rules. An explicit empty Skill restriction means deny all.
- Context collectors receive detached, deeply frozen state/selection and frozen data-only registry
  summaries. No live renderer, Zod schema, composition/widget payload, command implementation,
  subscription, event bus, or write door crosses the boundary.
- Request, history, complete assembled context, repair attempt, command count, remote response body,
  provider attempts, and terminal events are bounded.
- Skill audit pins use SHA-256 over canonical content; validated command arguments are detached,
  JSON-only, and deeply frozen before any telemetry callback or caller receives the plan.
- Cancellation and host-owned supersession are checked before and after asynchronous/cached work and
  immediately before live apply.
- A valid plan is rehearsed and applied through the same grouped kernel door with `author: 'ai'`;
  one application is one labelled transaction and one undo.
- Observer exceptions after commit cannot convert committed work into a false agent failure or stop
  later observers.

## Red-to-green and mutation evidence

Each mutation below was observed failing its named test before the production source was restored.

| Area               | Deliberate break / red observation                                                          | Restored proof                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Cache identity     | Omitted complete context from the key, returning a stale hit                                | Context/skill/history changes are misses; aborted hits never return                      |
| Skill graph        | Removed dependency expansion, conflict handling, and duplicate dependency suppression       | Deterministic dependency/conflict/property suites fail closed                            |
| Skill authority    | Replaced restriction intersection with permissive behavior; collapsed `[]` into omitted     | Deny-all and host/Skill intersection tests reject with zero writes                       |
| Skill safety       | Allowed prototype reference paths and oversized metadata/active payloads                    | Reserved paths, 4 KiB entry/64 KiB aggregate limits, and exact token accounting reject   |
| Run lifecycle      | Removed cancellation, supersession, stale-progress, and terminal guards                     | Late results/progress/writes are suppressed and exactly one terminal event remains       |
| Run bounds         | Allowed oversized request/history/repair context and inspected huge command arrays too late | Provider/preflight work is skipped once any bound is exceeded                            |
| Core provenance    | Accepted invalid/null runtime authors and unbounded derived labels                          | Invalid provenance is rejected before state change; labels are bounded                   |
| Atomic observers   | Let an event/store observer exception escape after commit                                   | Remaining observers run and the one committed transaction stays successful               |
| Context capability | Passed the live kernel/registry and caller-owned arrays to providers                        | Providers cannot mutate state/catalog/selection/provider order or weaken live slot rules |
| Provider transport | Returned late local/cache/repair responses and read unbounded JSON/SSE                      | Abort checks surround async work; responses are streamed under the byte cap              |
| Proposal integrity | Let telemetry mutate a shallow-frozen plan; accepted duplicate-result/LF-only SSE           | Plans are detached/deep-frozen; SSE accepts CRLF and rejects later/duplicate result data |
| Skill fingerprint  | Used a reproducibly colliding 32-bit checksum                                               | Standard-vector-tested SHA-256 separates the known collision pair                        |

## Final gate evidence

| Gate                                                                       | Result                                                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Focused context boundary                                                   | 2 files, 12 tests passed                                                   |
| Skills suites                                                              | 7 files, 76 tests passed                                                   |
| Provider suites                                                            | 4 files, 51 tests passed                                                   |
| `pnpm --filter @craftkit/builder-ai lint`                                  | passed, zero warnings                                                      |
| `pnpm --filter @craftkit/builder-ai typecheck`                             | passed                                                                     |
| `pnpm --filter @craftkit/builder-ai test`                                  | 28 files, 224 tests passed                                                 |
| `pnpm --filter @craftkit/builder-ai test:coverage`                         | passed; 95.47% statements, 88.50% branches, 95.59% functions, 95.97% lines |
| `pnpm --filter @craftkit/builder-core lint && ... typecheck && ... test`   | passed; 14 files, 123 tests                                                |
| `pnpm --filter @craftkit/builder-schema lint && ... typecheck && ... test` | passed; 18 files, 199 tests                                                |
| `pnpm check:workspace`                                                     | passed for 29 workspace members                                            |
| `pnpm check:boundaries`                                                    | passed for 1,310 files in 29 packages                                      |
| `git diff --check`                                                         | passed                                                                     |

## Review disposition

Independent adversarial review findings were fixed before this gate: complete wire-budget coverage,
run supersession, apply-mode validation, runtime author validation, fail-closed empty restrictions,
prototype-safe references, duplicate auto dependencies, observer isolation, pre-materialization
command caps, provider cancellation/response caps, metadata bounds, and least-authority context
collection. A final API review also found and closed mutable proposal events, duplicate/CRLF SSE,
32-bit fingerprint collisions, and missing root exports for metadata bounds. The final re-review
found no open Critical, High, or Medium finding in the delivered scope.

## Explicitly outside this checkpoint

- Phase 3 and later work that turns the current single-document planner into the complete multi-page
  site pipeline remains governed by the existing tasks after T178.
- Assistant panel visual redesign and block-library work are owned by the user's other active
  session and were not modified or browser-claimed here.
- No commit, push, dependency install, deploy, or external state mutation was performed.
