# Claude and Codex Collaboration

**Status:** Current collaboration contract with an additive observable read-only bridge and a
deprecated synchronous compatibility fallback.

**Scope and owner:** Workspace agent operations owned by Spec Kit. This guide explains local runtime
setup and troubleshooting; policy remains in the constitution and collaboration rule.

**Related sources:** `.specify/memory/constitution.md`, `.specify/agents/rules/collaboration.md`,
`speckit.workspace.delegate`, `.mcp.json`, and the `professional-sdd` workflow.

## Operating Topology

```text
Codex entry (project default)
    -> Codex coordinator -> Codex-owned work and bounded native workers
    -> fresh read-only Codex reviewer

Claude entry (explicit)
    -> Claude coordinator -> codex-craftkit-async -> observable read-only Codex worker(s)
    -> codex-craftkit-worker only for explicitly authorized writes
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

The preferred long-term Claude-to-Codex transport is the official Codex plugin for Claude Code,
backed by the Codex app server. The repository adapters remain replaceable transport plumbing; the
[official Codex CLI reference](https://developers.openai.com/codex/cli/reference) is the source of
truth for the installed CLI surface.

This repository currently registers two project adapters in `.mcp.json`:

- `codex-craftkit-async`: the default for bounded read-only discovery and review. Its local Node
  wrapper starts `codex exec --json --ephemeral`, exposes start/status/result/cancel, and keeps one
  model call alive while Claude reads coalesced progress from memory.
- `codex-craftkit-worker`: the synchronous fallback for explicitly authorized implementation. It
  still uses deprecated `codex mcp-server` because the async v1 bridge intentionally does not relay
  write approvals.

Both use stdio and commit no secrets or environment values. The async worker enforces read-only,
never-approve, ignored user config, disabled local/remote plugins, a core-only model shell
environment, repository-contained `cwd`, bounded concurrency and output, and full POSIX process
group cleanup. It fails closed on Windows rather than risk leaving descendant processes alive.

The unique ids avoid colliding with user-scoped servers named `codex`. Claude's trust decision is
machine-local in the ignored `.claude/settings.local.json`; each developer must approve the project
servers on their own machine. Never commit `CODEX_HOME`, authentication files, access tokens, or an
absolute user directory.

The Spec Kit collaboration contract is transport-neutral. Migrating from either project adapter to
the official plugin must not require changes to feature specs, task envelopes, path leases, review
separation, or completion gates.

## Session Preflight

Run these checks from the repository root in the Claude host environment that will start Codex:

```bash
command -v claude
command -v codex
claude --version
codex --version
codex login status
claude mcp get codex-craftkit-async
claude mcp get codex-craftkit-worker
specify integration status --json
```

Each adapter is healthy only when its `claude mcp get` output identifies `Project config` and
reports `Connected`. A valid `.mcp.json` proves configuration only, and `specify integration status`
proves managed Spec Kit integrity only; neither substitutes for the connection checks.

After setup or an upgrade, invoke the async bridge directly from a fresh Claude session for one
diagnostic probe. Do not invoke `speckit.workspace.delegate`: that operation is reserved for
approved feature tasks.

```text
Call `codex_start` on the project MCP server `codex-craftkit-async` once. Read only
`.specify/agents/README.md`, return its first heading, and do not edit files. Then call
`codex_status` with the returned sequence until terminal and call `codex_result` once.
```

Before and after the probe, compare `git diff --binary HEAD` and the path-plus-content hashes of
files returned by `git ls-files --others --exclude-standard`. `git status --short` alone is not
sufficient in an already-dirty tree because edits to an existing `M` file leave the status entry
unchanged. The probe succeeds only when the returned facts match and this Git-visible snapshot is
identical. Ignored machine-local state, including Codex's own state, is explicitly outside that
snapshot.

## Observable Progress Contract

For a long read-only task, Claude starts exactly one async Codex call and immediately tells the user
that it is running. It then calls status with the last seen sequence and `wait_ms=30000-55000`.
Status reads local bridge memory; it does not resend the prompt or consume another Codex call.
Claude prints only meaningful phase or activity changes and fetches the full result after terminal
status.

Do not tight-poll, invent a completion percentage, show raw reasoning, or repeat the whole task
context in each update. A status tool call adds a small amount of Claude tool/context overhead even
though Codex usage does not increase. Cancellation requires an explicit user or coordinating
workflow choice and targets only the named async task; it never touches the synchronous adapter.

## Delegation Modes

| Mode       | Behavior                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `auto`     | Delegate only when the bridge is healthy and a safe independent slice exists; otherwise report the local fallback or pending task.      |
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

| Work                               | Project adapter         | Sandbox                   | Approval policy              | Session                 |
| ---------------------------------- | ----------------------- | ------------------------- | ---------------------------- | ----------------------- |
| Discovery or review                | `codex-craftkit-async`  | `sandbox=read-only`       | `approval-policy=never`      | fresh                   |
| Authorized implementation          | `codex-craftkit-worker` | `sandbox=workspace-write` | `approval-policy=on-request` | fresh per task          |
| Follow-up on the same bounded task | original safe transport | unchanged                 | unchanged                    | continue that task only |

Never default a worker to `danger-full-access`. A model override is deliberate only when the user,
workflow, or approved plan requires one. Do not use transport-level base instructions to erase the
repository's Spec Kit load order.

Every dispatch includes the objective, deliverable, read/write authority, exact allowed paths,
source-of-truth artifacts, focused verification, prohibited actions, and expected evidence. The
coordinator inspects the real files and diff and reruns checks before accepting any worker result.

## Troubleshooting

| Symptom                                                | Meaning and response                                                                                                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server resolves at `User config`                       | A user-scoped name is shadowing the project adapter. Use the exact `codex-craftkit-async` or `codex-craftkit-worker` id; do not reuse generic `codex`.                    |
| `CONNECTION_CLOSED` with a read-only state database    | The host cannot write Codex's user-scoped state. Run the check from the real Claude host and repair user-state permissions; never move state or auth into the repository. |
| Bridge absent or untrusted                             | Approve the project server locally, then repeat the preflight. Do not commit the local trust file.                                                                        |
| New bridge configured but tools are absent             | Finish the active synchronous call, then start a fresh Claude session so it reloads `.mcp.json`; do not interrupt in-flight work.                                         |
| Async task looks frozen                                | Call status with the last sequence and a 30–55 second wait. A quiet reasoning interval is valid; do not start a duplicate worker.                                         |
| Spec Kit status is healthy but delegation fails        | Spec Kit composition and MCP health are separate. Diagnose the bridge without reinstalling generated skills.                                                              |
| Bridge works but a generated delegate skill is missing | Reconcile the workspace extension and all three integrations through Spec Kit; never hand-edit generated skill folders.                                                   |
| Required worker unavailable                            | Stop and report the failed gate. Do not silently self-review or weaken the requested distribution.                                                                        |

The MCP Inspector can examine the deprecated server protocol, but it downloads/runs an external
package and is not part of the default preflight.

## Staleness Conditions

Revalidate this guide when OpenAI removes `codex mcp-server`, the official Claude Code plugin is
installed, Codex JSONL or MCP protocol behavior changes, either project server id changes, Spec Kit
changes its integration composition behavior, or the project default integration or workflow
coordinator, delegation, or review semantics change.
