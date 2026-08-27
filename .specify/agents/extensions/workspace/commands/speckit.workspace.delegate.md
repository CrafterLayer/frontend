---
description: 'Delegate bounded approved work across agents and integrate the returned evidence'
---

# Delegate Approved Workspace Work

Partition and delegate only the independently verifiable part of an approved task set. Caller
guidance, including `mode=auto|required|off`, is:

```text
$ARGUMENTS
```

## Scope Guard

This command does not broaden the user's authority. The coordinating agent may delegate only work
already authorized by the user and approved in the active Spec Kit artifacts. It MUST NOT delegate
unresolved product decisions, final integration, the overall completion verdict, a commit, push,
deployment, dependency installation, secret access, or external-state mutation unless the user has
separately authorized that exact action.

`mode=auto` is the default: use a worker only when a safe independent slice and a healthy transport
exist; otherwise continue locally or leave the task pending and report the reason. `mode=required`
fails closed when the selected worker or transport is unavailable. `mode=off` records a deliberate
no-op and returns without delegation. A generic transport smoke test is not approved feature work;
run that diagnostic directly through the selected bridge instead of this command.

## Required Context

1. Read `.specify/memory/constitution.md`, `.specify/agents/README.md`,
   `.specify/agents/context.json`, and `.specify/agents/rules/collaboration.md`.
2. Resolve the active scoped feature and read its `spec.md`, `plan.md`, and `tasks.md`.
3. Inspect the real repository status immediately before partitioning. Existing changes belong to
   the user unless proven otherwise.
4. Confirm the exact workspace root, affected apps/packages, available agent transports, and any
   runtime-specific approval boundary.

## Partition Gate

Delegate a task only when all of these are true:

- its expected deliverable and acceptance evidence are explicit;
- it can proceed without a new product, architecture, security, data, or deployment decision;
- its write scope is path-disjoint from every other active writer, or it is read-only;
- its required inputs are stable and already recorded in Spec Kit;
- its result can be independently reviewed and verified by the coordinator; and
- delegation saves meaningful time or adds an independent review lens.

Do not infer safety from a `[P]` marker alone. Re-check actual files and shared contracts. The
coordinator owns an in-memory lease for every active write scope and MUST NOT assign overlapping
leases. Do not create a permanent worker registry.

## Transport Selection and Preflight

Use the best available Codex transport exposed to the active integration. For Claude, use the
installed official `codex@openai-codex` plugin backed by the Codex app server. Do not select the
user-scoped generic `codex` MCP server, the retired `codex-craftkit-async` or
`codex-craftkit-worker` adapters, or deprecated `codex mcp-server` routes for new work. Policy MUST
NOT depend on a transport's command or tool schema.

Before dispatch:

1. verify that `/codex:setup` reports ready in the current Claude host session;
2. use the repository root as the worker `cwd`;
3. start a fresh worker session for a new task; continue a thread only for the same bounded task;
4. state read-only intent explicitly for discovery, review, diagnosis, or research;
5. allow the plugin's workspace-write profile only for an explicitly authorized fix and only within
   the delegation envelope;
6. never broaden the task to unrestricted filesystem access; and
7. set a model or effort override only when the caller, active workflow, or approved plan requires
   one.

For an interactive substantial Claude-to-Codex task:

1. start it once with `/codex:rescue --background --fresh <task>` and immediately report that it is
   running;
2. tell the user that `/codex:status <job-id> --wait --timeout-ms 30000` provides a real checkpoint;
3. print a compact update only when phase or meaningful activity changes;
4. continue status reads without resending the task or starting another Codex job;
5. fetch `/codex:result <job-id>` only after terminal status; and
6. call `/codex:cancel <job-id>` only after an explicit user or coordinating-workflow choice for
   that exact task.

Status and result are on-demand user commands: they read plugin-tracked job state rather than
starting another Codex task. Do not promise continuous unsolicited progress. Tight polling,
fabricated percentages, raw reasoning, and repeated task context are forbidden. When a workflow
engine must receive, inspect, and record the worker result in its current step, use
`/codex:rescue --wait --fresh <task>` instead of background mode so `delegation.json` does not remain
pending.

An MCP or plugin connection can fail when the host cannot write the worker's user-scoped state.
Never redirect Codex state, authentication, or credentials into the repository to make a probe pass.

## Workflow Result Contract

When the caller supplies a valid workflow run ID, the coordinator MUST replace the pending
`.specify/workflows/runs/<run-id>/delegation.json` file before returning. This run-local file is
machine state, not a durable governance artifact. Write this exact JSON shape:

```json
{
  "schemaVersion": 1,
  "runId": "<exact supplied run id>",
  "mode": "auto|required|off",
  "status": "delegated|not-needed|unavailable|disabled|failed",
  "transport": "<selected transport or null>",
  "delegatedTaskCount": 0,
  "acceptedResultCount": 0,
  "reason": "<required when status is not delegated>",
  "updatedAt": "<ISO-8601 timestamp>"
}
```

Use `delegated` only after at least one bounded result has been independently inspected and
accepted; both counts must then be at least one and `transport` must be non-empty. Use `not-needed`
only in `auto`, `unavailable` only when `auto` may safely continue locally, `disabled` only for
`off`, and `failed` for a partial or unsafe attempt. Never report `delegated` merely because a
worker was dispatched. When no workflow run ID was supplied, do not create this file.

The workflow validates this file in a separate engine step. Missing, stale, malformed, `pending`, or
`failed` results stop the run. `required` accepts only `delegated`, so an unavailable transport
cannot silently advance to implementation.

## Delegation Envelope

Send every worker one self-contained contract containing:

```text
ROLE: bounded worker; the caller remains coordinating primary
OBJECTIVE: one concrete outcome
DELIVERABLE: exact files, findings, or evidence expected
AUTHORITY: read-only or write
ALLOWED PATHS: exact non-overlapping paths
RUNTIME: exact cwd, sandbox, approval policy, and any deliberate model override
SOURCE OF TRUTH: constitution plus exact spec/plan/task/rule paths
VERIFICATION: exact focused checks and expected evidence
PROHIBITED: unrelated edits, scope expansion, recursive delegation, commit, push, deploy,
            dependency changes, external writes, and secret access
RETURN: status; changed files; checks with outcomes; findings; blockers; residual risk
```

The worker MUST read current file contents after dispatch because all agents share the filesystem.
It MUST stop and report if its allowed paths changed incompatibly, a required decision is missing,
or another writer enters its scope. A delegated worker MUST NOT recursively delegate, spawn another
worker without explicit coordinator authority, delegate back to the coordinator, or create another
cross-runtime chain.

## Integration Gate

The coordinator MUST NOT accept a worker summary as proof. For every result:

1. inspect the returned status and evidence;
2. inspect the actual current files and relevant diff;
3. reject or revert out-of-scope work without disturbing unrelated user changes;
4. run the narrowest relevant checks, then the owning-package and affected-workspace gates;
5. resolve integration issues itself; and
6. mark an approved task complete only after its acceptance evidence is verified.

Independent review MUST use a fresh worker context, not the implementation thread. Required review
never falls back to self-review. The coordinator alone updates handoff/context, performs final
convergence, and reports completion to the user.

## Output Contract

Return:

1. selected mode and transport state;
2. coordinator identity and each delegated task's read/write lease;
3. worker results and exact evidence accepted or rejected;
4. integration checks run by the coordinator;
5. any fallback, unavailable transport, or unfinished task; and
6. whether the active task set may proceed to implementation, review, or convergence.

Do not expose worker thread identifiers, credentials, private payloads, or raw transcripts in the
output or durable memory.
