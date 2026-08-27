# Data Model: Adaptive Spec Router

All entities are deterministic in-memory view data. No entity is persisted, synchronized, or sent to
a provider in this release.

## Task Scenario

| Field                  | Meaning                                 | Rules                                                                                      |
| ---------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `brief`                | Human description of the requested work | Required, trimmed, minimum 12 visible characters to produce a route.                       |
| `workClass`            | Work category                           | One of `mechanical`, `implementation`, `architecture`, `security`, or `review`.            |
| `risk`                 | Expected blast radius                   | One of `low`, `standard`, or `critical`.                                                   |
| `orchestrationMode`    | Explicit provider entry boundary        | `codex-native` never starts Claude; `claude-adaptive` may coordinate Claude with Codex.    |
| `unavailableModel`     | Demonstrated unavailable preferred tier | `Luna`, `Terra`, `Sol`, `Sonnet`, `Opus`, or `null`; an allowed fallback must be explicit. |
| `providerAvailability` | Local demonstration availability        | Boolean capability flags for Codex and Claude lanes.                                       |

## Route Decision

| Field             | Meaning                              | Rules                                                                       |
| ----------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| `writer`          | Designated owner of edits            | Exactly one provider/model tier pair.                                       |
| `reviewer`        | Independent reviewer                 | Cross-provider in Claude-adaptive mode; fresh session in Codex-native mode. |
| `reasoningEffort` | Deliberation tier                    | `low`, `medium`, or `high`; shown with the route.                           |
| `safetyLane`      | Required quality lane                | `standard`, `elevated`, or `critical`.                                      |
| `signals`         | Why the decision was made            | Non-empty list derived from the scenario.                                   |
| `fallback`        | Any route change due to availability | Explicit state; never silently omitted.                                     |
| `confidence`      | Product policy confidence            | `guided` or `needs-input`; not a provider claim.                            |

## Plan Revision and Review Record

| Entity          | Fields                                                                          | Lifecycle                                                                        |
| --------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `PlanRevision`  | `id`, `label`, `materialChange`                                                 | Starts frozen. A material change changes `id` and invalidates previous reviews.  |
| `ReviewRecord`  | `id`, `provider`, `modelTier`, `revisionId`, `verdict`, `summary`, `findings[]` | Current only when `revisionId` equals the frozen plan revision; otherwise stale. |
| `ReviewFinding` | `id`, `requirement`, `severity`, `summary`, `nextAction`                        | Disclosure-ready evidence; a requested change blocks the plan audit.             |

## Run State

| Field         | Meaning                           | Rules                                                                                      |
| ------------- | --------------------------------- | ------------------------------------------------------------------------------------------ |
| `stages`      | Ordered planning-to-release items | Each is `complete`, `active`, `gated`, or `blocked`; all states also have text labels.     |
| `writerLease` | Bounded execution ownership       | `none`, `reserved`, or `active`; only a valid route with a ready plan audit may be active. |
| `evidence`    | Review and verification trace     | Each item has source, outcome, and release-gate relevance.                                 |
| `releaseGate` | Current release decision          | `ready`, `waiting`, or `blocked`; tied to current evidence.                                |

## Relationships

`TaskScenario -> RouteDecision -> RunState`. `PlanRevision -> ReviewRecord[]`. `RunState` contains
one `WriterLease` and many `EvidenceRecord` entries.
