# Creative agent reliability — 2026-10-20

Status: implementation authorized by the user's incident report and repair request. Scope:
`packages/builder/ai`, its public Builder consumer, `apps/ai-server` and the existing
`apps/playground` agent integration where verification requires it. `apps/evals` owns the offline
browser regression for the build initializer's actual scene output.

## Incident and evidence boundary

The user reports long charged requests ending in failure without visible work and other requests
stopping after seconds. The concrete prompt is `اصنع لعبه`, sent from another device; the model,
provider trace, and saved document for that run are unavailable. Reproductions establish
current-code defects, not the cause or billed amount of that remote incident.

## Acceptance scenarios

- R1: A slow first section cannot prevent a later independently validated section from appearing.
  Apply through the existing kernel one section at a time; preserve document position, final report
  order, section undo/redo, Stop, speculative-plan approval, and target ownership.
- R2: Generation, retries and repair have bounded lifetimes. Never retry a terminal provider
  refusal. A timed-out or stopped writer cannot apply a late answer or keep starting repair work.
  Retain already applied work and the truthful partial/stopped result.
- R3: `اصنع لعبه`, its standard-spelling equivalent, and equivalent Arabic/English story/game/mural
  creation requests select the appropriate creation route and built-in expertise automatically.
  Questions, existing-scene edits, explicit exclusions and permission/token limits retain their
  existing behavior.
- R4: A server refusal before streaming preserves its bounded actionable explanation. Untrusted
  HTML, oversized responses and malformed errors must not become unrestricted UI output.
- R5: Reuse tested scene kits/presets and composition helpers before adding a second generation
  system. Creative verification and benchmark evidence must distinguish deterministic correctness
  from unmeasured live latency, billing and artistic quality.

## Plan and ownership

Primary owns integration, build scheduling/lifetime, Spec Kit artifacts and final verification.
Bounded workers may own request recognition under `ai/src/{intent,skills,creative}` and provider
error handling under `ai/src/provider` and `apps/ai-server/src`, with non-overlapping paths.
Research and final review are read-only. No new dependencies, public API package, storage schema or
data migration is planned. Applications continue to import the Builder facade; the kernel remains
the only document writer. No new React component is planned.

Replace head-of-line blocking with a bounded completion queue after the final-plan gate. All kernel
applications remain serial and validated; final reports remain in document order. Use existing
deadline/abort machinery and preserve recoverable applied sections. Changes to timeout policy must
be regression-tested against ready-scene fallback, explicit caller budgets and cancellation. Keep
provider errors typed and bounded. Reuse shared request folding and creative selectors.

The continuing local-only review preference for this incident follow-up is preserved; fresh native
independent review is required. No external CLI workflow/review pass is claimed.

## Requirements checklist and analysis

- [x] Explicit user authorization and affected ownership identified.
- [x] Original-incident uncertainty and unmeasured provider costs recorded.
- [x] Acceptance checks include no late writes, partial preservation and routing false positives.
- [x] No dependency direction, permission, storage or component-contract exception introduced.
- [x] Research compares documented behavior; competitor implementation internals are not assumed.
- [x] Focused reproductions, consumer checks and final independent review accepted; see
      [verification](verification-reliability-2026-10-20.md).

## Verification and recovery

Run focused real-kernel build, request-skills/intent, provider-error and controller tests first;
then owner and direct-consumer typechecks/lint, server/Playground builds and applicable workspace
size/boundary checks. Tests use deterministic providers and no billable generation. Existing
creative browser fixtures and offline scene benchmarks provide evidence only for exercised cases.
Live generation quality, original device behavior and billed-token savings require separate
measurements. Reverting the source changes needs no data migration; applied documents remain valid.
