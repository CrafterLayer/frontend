# Active Work Handoff

**Status:** Paused — feature 013 remains active, but its foundational User Story 8 Agent Skills/core
slice (T159–T178) is complete and verified. No commit, push, or deploy was performed or authorized.

**Updated:** 2026-09-01

## Objective

Build the AI Full-Site Design Agent without creating a second document-write path. The completed
slice lets hosts give the agent reviewed Skills and run a deterministic, bounded, observable command
planner whose only live mutation path is the grouped kernel door with `author: 'ai'`.

## Active scope and artifacts

- Feature: `specs/workspace/013-ai-full-site-design-agent`
- Agent package: `packages/builder/ai`
- Supporting contracts: `packages/builder/schema/src/extensions/contribution-points.ts` and
  `packages/builder/schema/src/index.ts`
- Supporting kernel semantics: grouped dispatch plus post-commit event/store observer isolation in
  `packages/builder/core`
- Detailed evidence: `specs/workspace/013-ai-full-site-design-agent/verification-agent-skills.md`
- Public contract: `specs/workspace/013-ai-full-site-design-agent/contracts/agent-skills.md`

## Completed in US8

- Audited `open-builder`, `open-v0`, and `OpenLovable` and recorded the reusable strengths and unsafe
  patterns in `research.md` R11.
- Added versioned, runtime-validated, immutable Skills with progressive disclosure, request-local
  activation, dependency/conflict/trust resolution, explicit storage/token bounds, SHA-256 content
  pins, and reviewed first-party Skills.
- Enforced command authority as a restrictive intersection. An explicit empty restriction denies
  all; Skills cannot grant tools, commands, scripts, filesystem/network access, or document writes.
- Added a UI-independent agent runner with sequenced typed events, deterministic run id/time,
  proposal-only and auto-apply modes, one repair, cancellation, host supersession leases, stale
  progress suppression, and exactly one terminal event.
- Bounded the complete wire request, history, repair attempt, plan commands, Skill payloads, and
  remote JSON/SSE response bodies. Remote/local/cache/repair paths re-check cancellation after async
  work; SSE accepts LF/CRLF and rejects duplicate or post-result data.
- Made context providers least-authority: detached/deep-frozen document and selection snapshots plus
  data-only frozen block/composition/widget summaries, never live registry objects or renderers.
- Made validated plans detached, JSON-only, and deeply frozen before telemetry/caller exposure.
- Hardened grouped author/label validation and isolated throwing post-commit observers so committed
  work cannot be reported as a false failure.
- Closed every Critical/High/Medium finding from two independent adversarial reviews.

## Final verification

- `@craftkit/builder-ai`: lint and typecheck passed; 28 files / 224 tests passed; coverage 95.47%
  statements, 88.50% branches, 95.59% functions, 95.97% lines.
- `@craftkit/builder-core`: lint and typecheck passed; 14 files / 123 tests passed.
- `@craftkit/builder-schema`: lint and typecheck passed; 18 files / 199 tests passed.
- `pnpm check:workspace`: passed for 29 workspace members.
- `pnpm check:boundaries`: passed for 1,310 files across 29 packages.
- `git diff --check`: passed.

## Incomplete feature work

- Feature 013's multi-page site substrate, design-system/asset/motion pipeline, staged full-site
  reasoning, and later delivery phases remain represented by unchecked tasks outside T159–T178.
- The Assistant visual redesign and block-library work are being handled in another user-owned
  session. This US8 slice intentionally did not modify those UI/block surfaces.

## Shared-worktree warning

The branch is `builder-core` and the worktree is heavily dirty with concurrent UI, block, renderer,
schema, playground, and configuration edits owned by the user/another session. Preserve them. Do
not reset, stash, broad-format, or assume every dirty file belongs to US8. The US8-owned surfaces are
the paths listed above and the exact file list visible in its scoped diff/evidence.

## Next executable steps

1. After the other active session settles, inspect `git status` and reconcile the current code with
   unchecked `tasks.md` entries; several early tasks may have implementation present while their
   checkboxes remain stale.
2. Declare a bounded, non-overlapping path lease before continuing feature 013.
3. Keep T159–T178 closed unless a regression is demonstrated. Run the focused package gates before
   and after any follow-up that touches these contracts.
4. Do not create a commit unless the user explicitly authorizes it.

## Recovery notes

- `pnpm --filter <package> test -- <path>` does not reliably focus Vitest here. Use
  `pnpm --filter <package> exec vitest run --config vitest.config.ts <relative paths>`.
- `head` is shadowed on this machine; use `sed` or an explicit system PATH.
- Browser proof was not applicable to this headless core slice. Do not reuse these gates as proof of
  the Assistant UI or later full-site behavior.
