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
  router. Codex does NOT read `~/.codex/config.toml` (the worker passes `--ignore-user-config`);
  omitted model/effort fall back to the server env defaults in `.mcp.json`
  (`CCW_DEFAULT_MODEL=gpt-5.6-sol`, `CCW_DEFAULT_REASONING_EFFORT=high`).
- The server allowlist stays authoritative: any model in the profile must also be in
  `CCW_ALLOWED_MODELS`, or the route call fails before a job is created.

## Codex delegation playbook (BoundedRelay)

The worker runs codex with `--ignore-user-config`: `~/.codex/config.toml` never applies to
delegated jobs. Follow these rules on every delegation.

**0. Node 24 is required.** This repo's `engines.node` is `>=24.15.0 <25`. `.mcp.json` pins the
server's `PATH` with Node 24 first (Node 22's bin stays later because `codex` lives there). Without
it every proposal fails at `ERR_PNPM_UNSUPPORTED_ENGINE` during the clone bootstrap. If you ever
see that error, check that PATH pin before anything else.

**1. Every analyze/propose call passes explicit `model`, `reasoningEffort`, and `timeoutMs`.**
Resolve them from `boundedrelay-profile.json` `codexPolicy` (`byRisk` → `byKind` → `default`) even
when skipping the route tool. Floor is `medium` — never `low` beyond a single-file lookup. Scale
`timeoutMs`: 900000 (15m) quick lookups; 1800000 (30m) standard analyze/review; 2400000 (40m)
propose or debugging; up to 5400000 (90m) for sol+ultra multi-package work. A timeout or output
kill now salvages a partial result, but plan budgets so it does not happen.

**2. The task body carries the context — and the server enforces it.**
`CCW_REQUIRE_TASK_SECTIONS` makes `GOAL:`, `ACCEPTANCE CRITERIA:`, `FILES TO READ FIRST:`, and
`OUTPUT CONTRACT:` mandatory: a brief missing any of them is refused before a job exists, with the
missing headings named. This is a floor, not a ceiling — a brief that satisfies it can still be
thin, so fill each section with substance. (Budget ~90k chars; the schema rejects oversize, never
truncates.) Analyze template: GOAL · ACCEPTANCE CRITERIA · REPO ORIENTATION (pnpm monorepo;
relevant paths under `packages/builder/*` and `apps/*`; wire v1, block-owned className, tokens-only
colours) · FILES TO READ FIRST (5–15 paths) · KEY EXCERPTS (verbatim load-bearing snippets,
regenerated at send time) · YOU MAY RUN (`rg`, `pnpm typecheck`, targeted
`pnpm vitest run <path> --reporter=dot 2>&1 | tail -40` — always pipe long output through `tail`) ·
OUTPUT CONTRACT (findings as `file:line — claim — evidence`, severity, what was ruled out, open
questions). For propose: the clone is bootstrapped (`CCW_PROPOSAL_BOOTSTRAP` runs an offline pnpm
install), so REQUIRE Codex to run `pnpm typecheck` + targeted `pnpm vitest run <path>` on its own
patch before finalizing and to report the exact commands and outcomes. Fetch `expectedRevision`
from `codex_worker_workspace` immediately before the call; keep `writePaths` narrow and under the
profile's `writePolicy.allowedRoots`.

**3. Always pass `cwd` = the repo root.** Name target subdirectories inside the task text.

**4. Chain iterative work:** first job `persistSession: true`; follow-ups pass the returned
`sessionId` as `resumeSessionId` — strictly sequential, never resume one session concurrently.
A resumed job still needs its own explicit `model` and `reasoningEffort` (rule 1 applies to every
call, resumes included).
Restate what changed since the previous job. Cap a chain at ~3 resumes, then start fresh with a
distilled brief. Never resume FROM a proposal job (its clone is deleted at finalize) — resume the
analyze session instead.

**5. Host verification loop after every propose (mandatory):** fetch with `includePatch: true`,
verify `patchSha256`, apply in a scratch `git worktree` (or a clean tree at the same revision), run
the routed `requiredChecks` from the profile. On failure send ONE follow-up propose with
`resumeSessionId`, a fresh `expectedRevision`, the failing command, and the last ~100 relevant
output lines; at most 2 feedback rounds, then take over on the host. Only a fully passing patch
lands.

**6. One rich task vs a routed DAG:** single kind + one write scope + ≤5 effortPoints → one
well-briefed task. Multi-package, mixed kinds, multiple write scopes, or high/critical risk →
`codex_worker_sdd_route` with `projectProfile`, execute waves in order, copy each
`assignments[].codexPolicy` verbatim.

**7. Do not delegate:** planning/architecture/docs (host-first; the profile entries are the
fallback when such tasks ARE routed), work needing browser/MCP/network tools, trivial <10-line
edits, or vague "look around" prompts — sharpen them into the template first. TDD-style
implementation IS delegable now: the bootstrapped clone lets Codex run typecheck/tests in its own
loop.

**8. Failure triage:** read `error.code` + `error.diagnostics` + `progress` from the result; a
failed job may carry a partial `finalMessage` marked `finalMessagePartial`. TIMEOUT with high
eventCount → split the task; TIMEOUT with eventCount≈0 → check `codex_worker_capabilities`;
OUTPUT_LIMIT_EXCEEDED → resubmit with stronger quiet-output instructions; WORKTREE_DIRTY or
REVISION_MISMATCH → refresh workspace state and resubmit; two RUNTIME_FAILED in a row → do it on
the host. Use a fresh `idempotencyKey` suffix (`-v2`) per retry.

<!-- SPECKIT START -->

For additional context about technologies to be used, project structure, shell commands, and other
important information, read the current plan at
specs/workspace/013-ai-full-site-design-agent/plan.md
<!-- SPECKIT END -->
