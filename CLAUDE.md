# Claude Project Instructions

`AGENTS.md` is the shared entrypoint for all agents. Read and follow it before material work, then
load only the relevant files under `.specify/agents/`.

Project governance, context, handoff, React rules, monorepo boundaries, review, and commit policy
are owned by Spec Kit. Do not duplicate or fork them here.

Claude invokes the installed Spec Kit skills as `/speckit-<command>`.

For substantial Claude-to-Codex delegation, use the installed official plugin:
`/codex:rescue --background --fresh <bounded task>`. The user can inspect its real phase with
`/codex:status <job-id>` and fetch completion with `/codex:result <job-id>`; use `--resume` only for
the same bounded task. Never use a Codex MCP transport, including the user-scoped `codex` server or
any `codex-craftkit-*` server. If the plugin is unavailable, report that route unavailable instead
of falling back to an MCP adapter.

<!-- SPECKIT START -->

For additional context about technologies to be used, project structure, shell commands, and other
important information, read the current plan at
specs/workspace/011-builder-b4-transforms-code-view/plan.md
<!-- SPECKIT END -->
