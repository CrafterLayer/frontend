# Implementation plan

App owner: `@craftkit/ai-server`. No package dependencies, public wire changes, UI components,
database migrations or deployments. This is an opt-in development adapter, not a production provider
release. Existing workspace feature 014 and its unrelated staged work remain intact.

- `codex-config.ts`: isolated subscription environment, validated launch settings and flags.
- `codex-prompt.ts`: disposable instructions/final-output/image files and prompt conversion. Pass
  the existing schema as instructions: CraftKit's open-ended JSON-value schemas do not all satisfy
  OpenAI's strict JSON Schema subset. Existing downstream validation stays binding.
- `codex-process.ts`: bounded JSONL lifecycle/usage decoding, exit/abort/deadline handling. Read
  `--output-last-message` after a successful turn and process exit, so commentary is never mistaken
  for the final answer. Full text arrives at completion, not as token deltas.
- `codex-client.ts`: existing `messages.stream` facade, six active children maximum, no queue,
  cleanup and disposal. No warm pool, session resume or automatic alternative provider.
- `main.ts`, `api-models.ts`, `plan-errors.ts`, `routing-client.ts`: opt-in `codex:` routing beside
  `cli:` through one shared Codex client across all model selections, and truthful batch limits. Use
  the existing `CRAFTKIT_AI_MODEL(S)` settings; a bare `codex:` uses CLI default.
- `enhance-route.ts`: keep prompt enhancement on Codex when the user selects a Codex model.
- `enhance.ts`: preserve unknown cache measurements instead of presenting missing values as zero,
  matching the existing plan usage contract.
- Existing package commands and `scripts/dev.sh` stay unchanged; local `.env` gains `codex:` in its
  existing model allowlist. There is no additional server or endpoint.
- App README and `.env.example`: installation/login and run commands, limitations.

Constitution check: app-only dependency direction unchanged; no React contract applicable; small
focused modules, behavior tests, independent native read-only review and scoped checks. The primary
agent implements and integrates; a bounded reviewer may read only this feature's diff. No commits,
pushes, installs, external writes or unrelated file cleanup.

Verification: focused fake-child/config/handler tests first, owning app typecheck/lint/test/build,
workspace boundary/file-size checks, local startup and login-status checks. A small real request may
verify subscription transport when the environment permits; report restrictions explicitly. Do not
claim browser design quality from a transport smoke.

Rollout: run the existing dev command and select Codex in the existing model picker. Rollback:
remove `codex:` from the allowlist. Existing default Claude model, saved editor data and other
provider configuration stay unchanged.

References checked 2026-10-20: installed CLI 0.162.1 `exec --help` and `login status`;
[noninteractive execution](https://learn.chatgpt.com/docs/non-interactive-mode),
[configuration](https://learn.chatgpt.com/docs/config-file/config-reference),
[authentication](https://learn.chatgpt.com/docs/auth).
