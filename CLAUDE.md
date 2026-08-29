# Claude Project Instructions

`AGENTS.md` is the shared entrypoint for all agents. Read and follow it before material work, then
load only the relevant files under `.specify/agents/`.

Project governance, context, handoff, React rules, monorepo boundaries, review, and commit policy
are owned by Spec Kit. Do not duplicate or fork them here.

Claude invokes the installed Spec Kit skills as `/speckit-<command>`.

<!-- CODEX ROUTE PAUSED FOR EXPERIMENT (started 2026-08-29, by explicit user request) -->
<!-- The plugin-only policy below is temporarily paused, not removed. The user is A/B testing
     the `boundedrelay` MCP server (their own `claude-codex-worker` project) against the
     official plugin, across multiple days and task types, before deciding which stays.
     This intentionally revisits the 2026-08-27 retirement noted in
     `.specify/agents/MEMORY.md` ("codex-craftkit-worker ... never restore them as a fallback") —
     the reversal is explicit and time-boxed, not silent. To end the experiment and restore the
     plugin-only policy: delete `.mcp.json` at the repo root and remove this comment wrapper so
     the block below is active prose again.

For substantial Claude-to-Codex delegation, use the installed official plugin:
`/codex:rescue --background <bounded task>`.

**One Codex thread per Claude conversation.** Do not open a new Codex chat for every request. The
plugin already tracks a resume candidate keyed by the current Claude session, so:

- **Sequential follow-up work → `--resume`.** When the previous Codex task in this conversation has
  finished and the next one continues it, resume that thread. This keeps Codex's accumulated context
  and avoids re-reading the repository from scratch.
- **Parallel fan-out → `--fresh` for every agent.** The companion has no guard against two jobs
  resuming the same thread, so concurrent `--resume` calls interleave turns in one Codex thread.
  Give each parallel agent its own fresh thread.
- **First delegation of a conversation, or an unrelated task → `--fresh`.** Prior context would
  mislead Codex on genuinely different work.
- Passing neither flag makes the plugin check for a resumable thread and ask the user which to use.

The plugin already protects the parallel case in one direction: `findLatestResumableTaskJob` skips
`queued` and `running` jobs and only considers `jobClass === "task"` from the current Claude
session, so `--resume` can never attach to a live agent's thread and never to a review job. Review
steps therefore stay independent by design — do not try to make them resume.

Verify what is resumable with
`node "$CLAUDE_PLUGIN_ROOT/scripts/codex-companion.mjs" task-resume-candidate --json`.

The user can inspect a job's real phase with `/codex:status <job-id>` and fetch completion with
`/codex:result <job-id>`. Never use a Codex MCP transport, including the user-scoped `codex` server
or any `codex-craftkit-*` server. If the plugin is unavailable, report that route unavailable
instead of falling back to an MCP adapter.
-->

During this experiment, prefer the `boundedrelay` MCP server registered in `.mcp.json`
(`codex_worker_status`, `codex_worker_result`, etc.) for Claude-to-Codex delegation instead of
`/codex:rescue`. Read `docs/getting-started.md` in the `claude-codex-worker` project for the tool
surface. Keep delegated tasks bounded and read-only unless the user explicitly enables proposals.

**Codex model per task kind.** BoundedRelay does not pick a model on its own, and by design it never
will — its `AGENTS.md` forbids shipping a built-in "best model" table. Model choice is project-owned
data instead, in `boundedrelay-profile.json` at this repo root (`codexPolicy`, precedence `byRisk` →
`byKind` → `default`). To use it, pass that file as `projectProfile` to `codex_worker_sdd_route`,
read `assignments[].codexPolicy`, then pass that exact `model` + `reasoningEffort` to
`codex_worker_analyze` / `codex_worker_propose` — the analyze/propose tools do not read the profile
themselves.

- **Write tasks carry required checks.** `requiredChecks` attaches check IDs to write work
  (`byAuthority.write` = typecheck + lint + test, plus per-kind/risk additions). BoundedRelay never
  runs them — it only attaches them as required evidence, so a proposal is not done until those
  commands have actually been run and reported.
- **Change it:** edit `boundedrelay-profile.json`, then re-validate with
  `node <worker>/dist/cli.js profile validate < boundedrelay-profile.json`.
- **Turn it off:** omit `projectProfile` from the route call. Routing falls back to the plain v0.1
  router and Codex uses the default from `~/.codex/config.toml` (currently `gpt-5.6-sol` + `ultra`).
- The server allowlist stays authoritative: any model in the profile must also be in
  `CCW_ALLOWED_MODELS`, or the route call fails before a job is created.

<!-- SPECKIT START -->

For additional context about technologies to be used, project structure, shell commands, and other
important information, read the current plan at
specs/workspace/011-builder-b4-transforms-code-view/plan.md
<!-- SPECKIT END -->
