# Claude and Codex Collaboration

**Status:** Current collaboration contract using the official Codex plugin for Claude Code and its
observable background-job runtime.

**Scope and owner:** Workspace agent operations owned by Spec Kit. This guide explains local runtime
setup and troubleshooting; policy remains in the constitution and collaboration rule.

**Related sources:** `.specify/memory/constitution.md`, `.specify/agents/rules/collaboration.md`,
`speckit.workspace.delegate`, the official `codex@openai-codex` plugin, and the `professional-sdd`
workflow.

## Operating Topology

```text
Codex entry (project default)
    -> Codex coordinator -> Codex-owned work and bounded native workers
    -> fresh read-only Codex reviewer

Claude entry (explicit)
    -> Claude coordinator -> official Codex plugin -> observable background Codex job(s)
    -> /codex:status and /codex:result expose tracked progress and terminal output
    -> coordinator verifies evidence and integrates
    -> fresh read-only Codex reviewer
```

The initiating agent remains the coordinator. A Codex worker owns only the objective and paths in
its delegation envelope. It never owns final integration, continuity, the completion verdict, or a
recursive delegation chain.

The two Codex lanes are intentionally different:

- `speckit.workspace.delegate` may use Codex for approved path-disjoint delivery work; and
- `professional-sdd` starts a fresh ephemeral Codex process for mandatory read-only review,
  independent of the implementation thread and transport.

`integration=auto` and `integration=codex` keep a Codex-started workflow in Codex. Codex MUST NOT
invoke Claude unless the user explicitly requests it. `integration=claude` is an explicit
Claude-coordinated run; it does not claim that Claude wrote every changed file because Claude may
delegate bounded work to Codex.

The asymmetry is deliberate: Claude may call Codex, while Codex does not automatically call Claude.
Bounded task envelopes and fresh sessions reduce duplicated context, but total token savings still
depend on task size and partition quality.

## Transport Status

Claude-to-Codex delegation uses the installed official `codex@openai-codex` plugin backed by the
Codex app server. The
[official Codex CLI reference](https://developers.openai.com/codex/cli/reference) marks
`codex mcp-server` as deprecated in favor of this plugin, and the
[Codex app-server guide](https://developers.openai.com/codex/app-server) documents the streamed
event model behind it.

The plugin owns transport state outside the repository and exposes repository-scoped jobs through
Claude commands. It must not place Codex authentication, state databases, tokens, or private
payloads in the worktree. The retired `codex-craftkit-async` and `codex-craftkit-worker` experiments
are not valid routes for new sessions. A user-scoped MCP server named `codex` may still be visible
for unrelated projects; this workspace must not select it as a fallback.

The Spec Kit collaboration contract remains transport-neutral. The official plugin changes how a
worker starts and how progress is read; it does not change feature specs, task envelopes, path
leases, independent review, or completion gates.

## Session Preflight

Install the user-scoped plugin once on each developer machine:

```bash
claude plugin marketplace add openai/codex-plugin-cc
claude plugin install codex@openai-codex
```

Then run `/reload-plugins` in an existing Claude session or start a fresh session.

Run these checks from the repository root in the Claude host environment that will start Codex:

```bash
command -v claude
command -v codex
claude --version
codex --version
codex login status
claude plugin list
specify integration status --json
```

`claude plugin list` must show `codex@openai-codex` enabled. In a fresh or reloaded Claude session,
run:

```text
/codex:setup
```

The setup command must report that Codex is installed, authenticated, and ready. Plugin health and
Spec Kit composition are separate checks; neither substitutes for the other.

After setup or an upgrade, run one fresh read-only diagnostic from Claude. Do not invoke
`speckit.workspace.delegate`: that operation is reserved for approved feature tasks.

```text
/codex:rescue --background --fresh Read only .specify/agents/README.md, return its first Markdown
heading, and do not edit files.
/codex:status
/codex:result <job-id>
```

Before and after the probe, compare `git diff --binary HEAD` and the path-plus-content hashes of
files returned by `git ls-files --others --exclude-standard`. `git status --short` alone is not
sufficient in an already-dirty tree because edits to an existing `M` file leave the status entry
unchanged. The probe succeeds only when the returned facts match and this Git-visible snapshot is
identical. Ignored machine-local state, including Codex's own state, is explicitly outside that
snapshot.

## Observable Progress Contract

For a long interactive task, Claude starts exactly one background Codex job and immediately returns
the job id instead of blocking behind a static `Tinkering...` row. The user invokes
`/codex:status <job-id> --wait --timeout-ms 30000` whenever a checkpoint is wanted and
`/codex:result <job-id>` after terminal status. These commands read the same stored job; they do not
resend the prompt or start a duplicate Codex task.

Status is on demand, not a continuous unsolicited feed. Do not promise automatic progress, tight
poll, invent a completion percentage, show raw reasoning, or repeat the whole task context.
Cancellation requires an explicit user or coordinating-workflow choice and targets only the named
job. When a workflow step must validate the worker result before proceeding, use
`/codex:rescue --wait --fresh <task>` so the step receives terminal output instead of leaving its
run-local result pending.

## Delegation Modes

| Mode       | Behavior                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `auto`     | Delegate only when the plugin is healthy and a safe independent slice exists; otherwise report the local fallback or pending task.      |
| `required` | Proceed only after the engine validates at least one delegated and independently accepted result; otherwise stop before implementation. |
| `off`      | Record an explicit no-op and keep execution in the coordinator.                                                                         |

Use `required` when distribution itself is part of the requested workflow. A mandatory independent
review always fails closed, regardless of delivery mode.

The workflow records delegation at `.specify/workflows/runs/<run-id>/delegation.json`. It
initializes the result to `pending`, then a separate engine step validates the coordinator's
replacement. The workflow's packaged Codex review launcher bypasses Spec Kit's generic dispatcher so
the runtime itself receives `--sandbox read-only`, `--ask-for-approval never`, and `--ephemeral`. A
non-empty review artifact is required before the approval gate opens. Its internal 29-minute
deadline fires before the workflow shell's 30-minute deadline, preventing a hung reviewer from
silently surviving the step.

## Worker Profiles

| Work                               | Official plugin route                        | Authority                                 | Session        |
| ---------------------------------- | -------------------------------------------- | ----------------------------------------- | -------------- |
| Discovery, diagnosis, or research  | `/codex:rescue --background --fresh <task>`  | explicitly read-only                      | fresh          |
| Review                             | `/codex:review --background`                 | review-only                               | fresh          |
| Authorized implementation          | `/codex:rescue --background --fresh <task>`  | plugin write profile within task envelope | fresh per task |
| Workflow-blocking delegated work   | `/codex:rescue --wait --fresh <task>`        | follows the approved delegation envelope  | fresh          |
| Follow-up on the same bounded task | `/codex:rescue --background --resume <task>` | unchanged                                 | same task only |

The official rescue command defaults explicit fix requests to its write-capable profile. State
read-only intent in discovery, diagnosis, and research envelopes, and never broaden a worker to
unrestricted filesystem access. A model or effort override is deliberate only when the user,
workflow, or approved plan requires one. Do not use transport-level instructions to erase the
repository's Spec Kit load order.

Every dispatch includes the objective, deliverable, read/write authority, exact allowed paths,
source-of-truth artifacts, focused verification, prohibited actions, and expected evidence. The
coordinator inspects the real files and diff and reruns checks before accepting any worker result.

## Troubleshooting

| Symptom                                  | Meaning and response                                                                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Only `Tinkering...` is visible           | The session is still using a retired synchronous MCP task row. Let in-flight work finish, reload plugins or start a fresh session, and use the official plugin for the next task. |
| Background job appears quiet             | Run `/codex:status <job-id> --wait --timeout-ms 30000`. Quiet reasoning intervals are valid; do not start a duplicate job.                                                        |
| `/codex:*` commands are absent           | Run `/reload-plugins` or start a new Claude session. Confirm `codex@openai-codex` is enabled with `claude plugin list`.                                                           |
| `/codex:setup` reports not ready         | Repair the user-scoped Codex CLI installation or login in the real Claude host. Never move authentication or state into the repository.                                           |
| A generic `codex` MCP server is visible  | It is separate from the official plugin and may belong to another project. Leave it untouched globally, but never select it for this workspace.                                   |
| Spec Kit is healthy but delegation fails | Spec Kit composition and plugin health are separate. Diagnose `/codex:setup` without weakening workflow gates.                                                                    |
| A generated workspace skill is missing   | Reconcile the workspace extension for all installed integrations through Spec Kit; never hand-edit generated skill folders.                                                       |
| Required worker unavailable              | Stop and report the failed gate. Do not silently self-review or weaken the requested distribution.                                                                                |

## Staleness Conditions

Revalidate this guide when the official Claude Code plugin changes its command or permission
contract, the Codex app-server event model changes, Spec Kit changes its integration composition
behavior, or the project default integration or workflow coordinator, delegation, or review
semantics change.
