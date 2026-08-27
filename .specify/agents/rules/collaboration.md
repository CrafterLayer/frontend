# Multi-Agent Collaboration and Context Continuity

Load this file when delegating work, running agents in parallel, resuming interrupted work, or
transferring a task between Claude, Codex, and Cursor. Use `speckit.workspace.delegate` when
partitioning and dispatching work as an explicit Spec Kit operation.

## Shared Context Protocol

Agents understand each other through durable artifacts, not hidden chat state:

- Constitution: non-negotiable rules.
- Spec, plan, and tasks: current feature intent and approved implementation path.
- `context.json`: replaceable workspace facts and active scope.
- `HANDOFF.md`: exact unfinished-work state.
- `MEMORY.md`: validated durable decisions and recurring failure modes.
- Git diff: actual code and document changes.
- Agent transport: a replaceable execution adapter, never a source of product or governance truth.

At task start, read the load order in `README.md`. When the task becomes substantial, record the
active scope and spec in `context.json`. Before pausing or transferring work, replace `HANDOFF.md`
with the exact current state. After verified completion, reset the handoff to idle and retain only
durable knowledge in `MEMORY.md`.

Do not store raw transcripts, tool output dumps, speculative decisions, private endpoint bodies,
secrets, tokens, cookies, personal data, or credentials.

## Coordinator and Worker Roles

The agent that accepts the user request is the coordinating primary agent unless the user assigns
that role elsewhere. It owns user intent, the task graph, active write leases, integration,
verification, continuity, and the final result. A delegated agent is a bounded worker for one
contract; it does not become a second coordinator merely because it can edit files or start tools.

A worker MUST NOT expand its objective, change its allowed paths, recursively delegate or spawn
another worker without explicit coordinator authority, or create a cross-runtime delegation chain.
It stops and returns a blocker when the contract is insufficient. The coordinator creates the
smallest useful team and never more active writers than there are path-disjoint scopes.

## When to Use Sub-Agents

Delegate only when work is concrete, bounded, and can run independently, for example:

- read-only documentation or dependency research;
- repository discovery with an exact question;
- an independent code review;
- tests for a component owned by another non-overlapping implementation task; or
- implementation in path-disjoint apps/packages with a stable shared contract.

Do not delegate a tiny edit, an unresolved product decision, final integration, or work whose write
scope overlaps another active agent.

## Delegation Contract

Every task sent to a sub-agent states:

1. objective and expected deliverable;
2. read-only or write authorization;
3. exact allowed paths or package ownership;
4. source-of-truth artifacts to read;
5. required verification;
6. prohibited actions such as commit, push, dependency install, or unrelated edits; and
7. what evidence to return to the primary agent, including status, changed files, checks, blockers,
   and residual risk.

Exploration and code-review agents are read-only by default. Implementation agents receive
non-overlapping ownership. All agents share the filesystem, so the primary agent MUST check current
file contents immediately before integration.

The coordinator holds active path leases in its task state. A `[P]` task marker is a hint, not proof
that writes are independent; shared types, manifests, lockfiles, generated output, and package
barrels require an explicit ownership decision. Do not persist a worker roster. Record an in-flight
lease in `HANDOFF.md` only when work pauses while that lease still matters.

## Cross-Runtime Transport

The same contract applies whether the worker is started as a native sub-agent, through MCP, through
an agent plugin, through a CLI, or through a future transport. For Claude-to-Codex delegation,
use the installed official `codex@openai-codex` Claude Code plugin backed by the Codex app server.
Do not route new work through any Codex MCP server, including a user-scoped server named `codex`,
the retired `codex-craftkit-worker` and `codex-craftkit-async` adapters, or the deprecated
`codex mcp-server` command. Those MCP adapters are not governance truth.

Run `/codex:setup` after installing or upgrading the plugin. For a new bounded task, use a fresh
thread. Use `/codex:rescue --background --fresh <task>` for substantial investigation or an
explicitly authorized fix, and `/codex:review --background` for review-only work. The user observes
the same background job on demand through `/codex:status <job-id> --wait`, fetches terminal output
through `/codex:result <job-id>`, and uses `/codex:cancel <job-id>` only when cancellation is
explicitly chosen. Continue with `--resume` only when the new instruction belongs to that same
bounded task. When a workflow engine must receive and validate the result in its current step, use
the foreground `--wait` route instead of leaving the workflow result pending.

The project default integration is Codex. A task initiated inside Codex stays in Codex: it MUST NOT
launch Claude, switch the workflow integration to Claude, or create a Codex-to-Claude delegation
chain unless the current user explicitly requests Claude for that task. Claude remains an available
entrypoint and MAY call Codex for bounded work through the official plugin. This direction is
intentional: it avoids agent ping-pong and duplicated context while preserving Claude-to-Codex load
distribution.

Before dispatch, verify `/codex:setup` reports ready in the current Claude host and use the exact
repository as the worker `cwd`. Discovery, review, diagnosis, and research are read-only unless the
user explicitly authorizes a fix. A fix request may use the plugin's workspace-write profile only
for the approved scope; never broaden it to unrestricted filesystem access. The plugin owns its
runtime flags, while the Spec Kit task envelope remains the authority boundary. Start a fresh worker
session for each new task, continue a worker thread only for the same bounded task, and always start
mandatory independent review fresh. Do not replace the worker's project instructions with
transport-level base instructions.

For a long background task, start it once and immediately tell the user it is running. The user may
invoke `/codex:status <job-id> --wait --timeout-ms 30000` for a meaningful checkpoint; this reads the
plugin's tracked job rather than starting another Codex task. Report only the actual phase and
latest activity, not a fabricated percentage or raw reasoning. Fetch `/codex:result <job-id>` only
after terminal status. Status and result are on-demand commands, so Claude MUST NOT promise
continuous unsolicited progress or treat a static task label as proof that the job is frozen.

Never place Codex state, authentication, credentials, or private payloads in the repository to make
a transport connect. Runtime state stays user-scoped and outside Spec Kit policy and versioned
secrets.

## Primary Agent Responsibilities

The primary agent:

- owns the plan, scope, and user intent;
- prevents overlapping writes;
- verifies the selected worker and transport before relying on them;
- reviews every returned change against the constitution and active artifacts;
- resolves integration conflicts;
- runs final relevant checks;
- updates context and handoff state; and
- alone claims completion to the user.

Sub-agents MUST NOT commit, push, deploy, send external messages, or mark the overall task complete.
A permanent sub-agent registry is intentionally absent; create the smallest dynamic team needed for
the current task.

Worker output is a claim, not verification. The primary agent re-reads the actual files and diff,
rejects out-of-scope edits, and reruns the narrowest relevant checks before it marks a delegated
task complete. Workers do not update `tasks.md`, `context.json`, `HANDOFF.md`, or `MEMORY.md` unless
their exclusive task contract names those exact files.

The `professional-sdd` workflow initializes a run-local `delegation.json` before dispatch and
validates the coordinator's replacement in a separate shell step. A `required` run accepts only a
result with at least one delegated and independently accepted task; missing, stale, malformed,
pending, unavailable, or failed results stop the engine before implementation. Files below
`.specify/workflows/runs/` are machine-local execution evidence, not shared governance state.

Mandatory workflow reviews run through the workflow's packaged Codex launcher, not the generic Spec
Kit integration dispatcher. The launcher starts a fresh ephemeral process with explicit
`--sandbox read-only` and `--ask-for-approval never`, requires a non-empty review artifact, and uses
an internal 29-minute deadline below the workflow shell's 30-minute deadline so a hung Codex process
is terminated first. It then exposes fresh evidence to the following approval gate. A
workflow-designated fresh reviewer does not sub-delegate another review.

## Failure Semantics

Delegation runs in one of three explicit modes:

- `auto`: delegate when a healthy worker and safe slice exist; otherwise continue locally or leave
  the slice pending and report the fallback;
- `required`: stop when the selected worker or transport is unavailable; and
- `off`: record a deliberate no-op and keep execution in the coordinator.

An unavailable bridge MUST NOT weaken an acceptance or independence gate. Required implementation
review fails closed instead of falling back to the implementer. A local fallback in `auto` mode is
valid only when it preserves the approved scope, verification, and review separation.

## Handoff Standard

A useful handoff contains exact paths and executable next steps, not narrative history. It records:

- objective and monorepo scope;
- active spec, plan, and tasks;
- completed and incomplete work;
- changed files;
- checks run with outcomes;
- blockers and decisions still required; and
- safe recovery or rollback notes.

The receiving agent re-verifies drift-prone facts and current file state before continuing.
