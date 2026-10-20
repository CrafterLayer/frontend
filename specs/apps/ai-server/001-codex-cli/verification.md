# Verification — 2026-10-20

Scope: `apps/ai-server`, including app documentation, scoped Spec Kit artifacts and additive
continuity notes. The owner's clarification is binding: use the existing `dev` command and model
picker exactly like Claude. `package.json` and `scripts/dev.sh` have no diff.

## Delivered behavior

- `codex:` in the ordinary `CRAFTKIT_AI_MODELS` list selects the local Codex ChatGPT login. Explicit
  `codex:<model>` selections share the same six-process limit.
- Existing Claude default and routes remain intact. Codex requests do not enter OpenRouter
  probing/generation or Claude fallback. Enhancement respects the selected Codex route.
- Subscription-only environment, private prompt/image files, bounded output, final-answer-only
  transport, measured/unknown usage, cancellation, deadlines and shutdown disposal are tested.
- The existing ignored `.env` allowlist gained only `codex:`. No credential was printed or copied.
  No dependencies, commits, pushes, deployments or saved editor data changes.

## Evidence

- Installed `codex-cli 0.162.1`; `codex login status`: logged in using ChatGPT.
- App full suite at the initial integration checkpoint: **51 files, 830 tests passed** using
  `pnpm --filter @craftkit/ai-server exec vitest run --config vitest.config.ts --maxWorkers=1`.
  Local socket tests required sandbox escalation; an earlier restricted run was interrupted after
  the existing CORS socket test could not bind. It is not counted as a pass.
- Final focused routing/client/handler/enhancer/API group: **8 files, 116 tests passed** with
  `--maxWorkers=1`, including the final direct-default selection regression.
- Owning app `lint`, `typecheck`, and `build`; `check:workspace`, `check:boundaries`,
  `check:file-sizes`, scoped formatting and `git diff --check`.
- The unchanged `pnpm --filter @craftkit/ai-server dev` command started the server on 8787.
  Authenticated `GET /v1/models` returned 200, retained `cli:claude-sonnet-5-5` as default, and
  included `codex:`.
- A small real `POST /v1/prompt/enhance` with `x-craftkit-ai-model: codex:` on that same server
  returned **200** with a valid version-1 enhancement through the subscription adapter. This
  verifies actual transport, not full-page visual quality. The dev server was left running.

## Independent review and convergence

Fresh native read-only review found and verified repairs for:

1. Cancelled children must retain their concurrency slot and shutdown ownership until `close`;
   otherwise SIGTERM grace-period children could exceed the cap or survive an immediate exit.
2. A direct-backend request explicitly selecting bare `codex:` must choose the CLI default even when
   the configured default is a named model; an omitted model still uses the configured one.

Separate fake-child reproduction and behavior regressions passed. The final independent review
reported no unresolved app-scope findings. No external CLI review process is claimed. All six
requirements and six acceptance scenarios are covered by implementation and evidence; there are no
remaining implementation tasks for this scoped development feature.

Limits: no new browser/full-CI/production or full-page quality evidence; no dedicated live
process-tree kill test or managed-policy test. Schemas/token budgets are prompt guidance, while
bytes and deadlines are enforced. The current Playground labels all explicit Codex IDs as “Codex”;
the configured single bare route works alongside Claude. Frontend labels remain outside this
app-only change.
