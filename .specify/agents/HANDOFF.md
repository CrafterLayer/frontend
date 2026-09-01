# Active Work Handoff

**Status:** Idle — feature 013 User Story 9 production-agent readiness (T179–T211) is complete and
verified. The broader full-site feature remains planned; no commit, push, deploy, dependency
installation, or external mutation was performed or authorized.

**Updated:** 2026-09-01

## Objective completed

Make the already-built Skills/runner core the only Playground Assistant execution path and harden
the request-to-command boundary enough for the later multi-page pipeline to build on it. The agent
now accepts host-provided Custom Skills while the kernel remains the only mutation authority. Custom
CSS and the broader Assistant visual redesign were explicitly deferred from this slice.

## Active artifacts and scope

- Feature: `specs/workspace/013-ai-full-site-design-agent`
- Tasks completed by the two agent-core slices: T159–T211
- Production-readiness evidence:
  `specs/workspace/013-ai-full-site-design-agent/verification-agent-readiness.md`
- Skills evidence: `specs/workspace/013-ai-full-site-design-agent/verification-agent-skills.md`
- Public package contract: `packages/builder/ai/README.md`
- Main implementation owners: `packages/builder/ai`, narrow schema/core contracts,
  `apps/playground/src/features/preview/components/AssistantPanel`, and `scripts/ai-plan-bridge.mjs`

## Completed in US9

- Removed duplicate block/template/document/selection prompt representations. The real 54-block
  landing request is 62,511 estimated tokens, the empty request is 59,237, and all 27 selected
  landing nodes are 62,584; all are below the 64,000 default and reach the provider once.
- Added one live-registry command catalog with emitted JSON argument schemas, a versioned output
  contract, compact property intents, and complete detached node facts (`bindings`, `variantOf`,
  `responsive`). Selection carries ordered focus ids only.
- Added provenance (`source`, `kind`, `trust`) to additive context and changed durable Assistant
  memory to bounded host-authored outcomes. Model rationale is never replayed as instruction memory.
- Made Ask and Auto enter `runAiAgent`; host Skill registries and selected ids are accepted,
  activated versions/fingerprints are visible, typed progress/failures are rendered, and the old
  direct generate/apply bypass is gone.
- Pinned plan, effective policy, Skill fingerprints, and context identity in authenticated,
  detached, frozen proposals. Preview/apply snapshot proposal getters once and fail closed on
  omitted, substituted, stale, or broadened authority.
- Denied `applyPatches` by default, counted nested operations before materialization, recursively
  blocked human-only utility fields, and tracked ordered node-type changes so later commands cannot
  hide a utility write.
- Hardened local allocation bounds, own-property number lookup, canonical cache identity, custom
  cancellation normalization to `AbortError`, observer isolation, stable typed failures, and every
  JSON/SSE cleanup path.
- Reworked the optional development bridge into an authenticated `127.0.0.1` boundary with an origin
  allowlist, body/output/deadline/concurrency caps, `429` with no pending queue, no Claude
  tools/customization/session state, exactly one model call, socket cleanup, and POSIX process-group
  TERM-to-KILL cleanup.
- Evaluated `p-limit` and intentionally did not add it as a direct dependency. The current path is
  sequential, and queueing untrusted excess bridge work is weaker than immediate bounded rejection.
- Two independent final reviews (command/context and security/resource/trust) found no remaining
  Critical, High, or Medium issue. Final Spec Kit convergence found no untracked gap and appended no
  duplicate task.

## Exact changed files

### Playground

- `apps/playground/src/features/preview/assistant-agent-readiness.test.ts`
- `apps/playground/src/features/preview/components/AssistantPanel/AssistantPanel.docs.mdx`
- `apps/playground/src/features/preview/components/AssistantPanel/AssistantPanel.stories.tsx`
- `apps/playground/src/features/preview/components/AssistantPanel/AssistantPanel.test.tsx`
- `apps/playground/src/features/preview/components/AssistantPanel/AssistantPanel.tsx`
- `apps/playground/src/features/preview/components/AssistantPanel/AssistantPanel.utils.ts`
- `apps/playground/src/features/preview/components/AssistantPanel/planProviderFromEnv.test.ts`
- `apps/playground/src/features/preview/components/AssistantPanel/planProviderFromEnv.ts`

### AI package

- `packages/builder/ai/README.md`
- `packages/builder/ai/src/agent/errors.test.ts`
- `packages/builder/ai/src/agent/errors.ts`
- `packages/builder/ai/src/agent/index.ts`
- `packages/builder/ai/src/agent/run-agent.test.ts`
- `packages/builder/ai/src/agent/run-agent.ts`
- `packages/builder/ai/src/agent/types.ts`
- `packages/builder/ai/src/context/assemble-context.contract.test.ts`
- `packages/builder/ai/src/context/assemble-context.test.ts`
- `packages/builder/ai/src/context/assemble-context.ts`
- `packages/builder/ai/src/context/index.ts`
- `packages/builder/ai/src/context/memory-provider.test.ts`
- `packages/builder/ai/src/context/memory-provider.ts`
- `packages/builder/ai/src/context/skill-context.test.ts`
- `packages/builder/ai/src/index.ts`
- `packages/builder/ai/src/internal/canonical-json.test.ts`
- `packages/builder/ai/src/internal/canonical-json.ts`
- `packages/builder/ai/src/plan/apply-plan.property.contract.test.ts`
- `packages/builder/ai/src/plan/apply-plan.test.ts`
- `packages/builder/ai/src/plan/apply-plan.ts`
- `packages/builder/ai/src/plan/generate-plan.test.ts`
- `packages/builder/ai/src/plan/generate-plan.ts`
- `packages/builder/ai/src/plan/index.ts`
- `packages/builder/ai/src/plan/plan.property.test.ts`
- `packages/builder/ai/src/plan/policy-enforcement.test.ts`
- `packages/builder/ai/src/plan/preview-plan.test.ts`
- `packages/builder/ai/src/plan/preview-plan.ts`
- `packages/builder/ai/src/plan/validate-plan.test.ts`
- `packages/builder/ai/src/plan/validate-plan.ts`
- `packages/builder/ai/src/plan/validated-proposal.test.ts`
- `packages/builder/ai/src/plan/validated-proposal.ts`
- `packages/builder/ai/src/provider/caching-provider.test.ts`
- `packages/builder/ai/src/provider/caching-provider.ts`
- `packages/builder/ai/src/provider/errors.ts`
- `packages/builder/ai/src/provider/index.ts`
- `packages/builder/ai/src/provider/local-provider.test.ts`
- `packages/builder/ai/src/provider/local-provider.ts`
- `packages/builder/ai/src/provider/remote-provider.test.ts`
- `packages/builder/ai/src/provider/remote-provider.ts`
- `packages/builder/ai/src/provider/wire.test.ts`
- `packages/builder/ai/src/provider/wire.ts`
- `packages/builder/ai/src/skills/command-policy.test.ts`
- `packages/builder/ai/src/skills/command-policy.ts`
- `packages/builder/ai/src/skills/index.ts`
- `packages/builder/ai/src/smoke.test.ts`
- `packages/builder/ai/src/testing/scripted-provider.contract.test.ts`
- `packages/builder/ai/src/types.ts`

### Narrow core/schema contracts and bridge

- `packages/builder/core/src/commands/core-commands.ts`
- `packages/builder/schema/src/extensions/contribution-points.test.ts`
- `packages/builder/schema/src/extensions/contribution-points.ts`
- `packages/builder/schema/src/index.ts`
- `packages/builder/schema/src/json-schema.test.ts`
- `packages/builder/schema/src/json-schema.ts`
- `scripts/ai-plan-bridge.mjs`
- `scripts/ai-plan-bridge.test.mjs`
- `package.json`

### Feature and continuity artifacts

- `specs/workspace/013-ai-full-site-design-agent/plan.md`
- `specs/workspace/013-ai-full-site-design-agent/spec.md`
- `specs/workspace/013-ai-full-site-design-agent/tasks.md`
- `specs/workspace/013-ai-full-site-design-agent/verification-agent-readiness.md`
- `.specify/agents/context.json`
- `.specify/agents/HANDOFF.md`

## Fresh verification

- AI lint/typecheck passed; coverage passed 33 files / 290 tests: 93.18% statements, 86.14%
  branches, 94.11% functions, 94.09% lines.
- Schema lint/typecheck passed; coverage passed 20 files / 202 tests: 95.45% statements, 89.67%
  branches, 96% functions, 95.67% lines.
- Playground lint/typecheck passed; coverage passed 16 files / 87 tests: 93.96% statements, 88.81%
  branches, 94.35% functions, 93.98% lines.
- Core lint/typecheck passed; 14 files / 123 tests passed.
- Focused Assistant/readiness/env: 3 files / 40 tests passed.
- Development bridge: 14/14 passed outside the loopback-restricted sandbox.
- Playground production build passed: 1,199 modules transformed.
- `pnpm check:workspace`: 29 members passed.
- `pnpm check:components`: 101 components passed.
- `pnpm check:boundaries`: 1,073 files, no issues.
- Changed-file Prettier and `git diff --check`: passed.
- Targeted Assistant Storybook Chromium: 1 file / 9 interaction tests passed outside the
  loopback-restricted sandbox.

## Known non-blocking repository gates and residual risks

- Full `pnpm format:check` is red only on ten unchanged baseline files: `App.css`, `CLAUDE.md`, and
  eight marketing-block files. Do not broad-format them as part of this slice.
- Full Storybook stops before Chromium on existing `autodocs` plus colocated-MDX duplicate indexing
  outside AI scope. The targeted Assistant browser gate is the valid affected-surface proof; its
  first sandbox attempt failed with `listen EPERM ::1:63315`, which is unavailable evidence rather
  than a pass.
- The production build retains the existing 1,016.12 kB entry-chunk warning. Route splitting is a
  later performance task.
- The default CLI bridge intentionally refuses Windows because its process-tree containment is
  POSIX-specific. No paid live Claude CLI request was sent during deterministic verification.
- No Critical, High, or Medium issue remains in the reviewed US9 scope.

## Remaining feature work

- Feature 013 still has the site substrate, design-system/asset/motion work, five-stage full-site
  pipeline, refinement, new UI surfaces, evaluation, and later polish represented by T001–T158.
- The next unchecked task by canonical checklist order is **T001**. Before implementation, reconcile
  early task checkboxes with current source because some substrate files already exist, declare a
  non-overlapping path lease, and preserve any concurrent user work.
- Custom CSS remains deferred by explicit user direction. The larger Assistant visual redesign is
  also not part of US9; this slice only made the existing UI expose the professional core states.

## Recovery notes

- Focus Vitest with
  `pnpm --filter <package> exec vitest run --config vitest.config.ts <relative paths>`; passing a
  path after `pnpm --filter <package> test --` does not reliably focus this workspace.
- Loopback tests may require explicit sandbox escalation. Treat `listen EPERM` as unavailable, not
  passing evidence.
- `head` is shadowed on this machine; use `sed` or an explicit system PATH.
- Do not reset, stash, broad-format, commit, push, deploy, or add `p-limit` when resuming this work
  unless the user separately authorizes and the architecture condition changes.
