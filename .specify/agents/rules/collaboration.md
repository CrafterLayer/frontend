# Multi-Agent Collaboration and Context Continuity

Load this file when delegating work, running agents in parallel, resuming interrupted work,
or transferring a task between Claude, Codex, and Cursor.

## Shared Context Protocol

Agents understand each other through durable artifacts, not hidden chat state:

- Constitution: non-negotiable rules.
- Spec, plan, and tasks: current feature intent and approved implementation path.
- `context.json`: replaceable workspace facts and active scope.
- `HANDOFF.md`: exact unfinished-work state.
- `MEMORY.md`: validated durable decisions and recurring failure modes.
- Git diff: actual code and document changes.

At task start, read the load order in `README.md`. When the task becomes substantial,
record the active scope and spec in `context.json`. Before pausing or transferring work,
replace `HANDOFF.md` with the exact current state. After verified completion, reset the
handoff to idle and retain only durable knowledge in `MEMORY.md`.

Do not store raw transcripts, tool output dumps, speculative decisions, private endpoint
bodies, secrets, tokens, cookies, personal data, or credentials.

## When to Use Sub-Agents

Delegate only when work is concrete, bounded, and can run independently, for example:

- read-only documentation or dependency research;
- repository discovery with an exact question;
- an independent code review;
- tests for a component owned by another non-overlapping implementation task; or
- implementation in path-disjoint apps/packages with a stable shared contract.

Do not delegate a tiny edit, an unresolved product decision, final integration, or work
whose write scope overlaps another active agent.

## Delegation Contract

Every task sent to a sub-agent states:

1. objective and expected deliverable;
2. read-only or write authorization;
3. exact allowed paths or package ownership;
4. source-of-truth artifacts to read;
5. required verification;
6. prohibited actions such as commit, push, dependency install, or unrelated edits; and
7. what evidence to return to the primary agent.

Exploration and code-review agents are read-only by default. Implementation agents receive
non-overlapping ownership. All agents share the filesystem, so the primary agent MUST
check current file contents immediately before integration.

## Primary Agent Responsibilities

The primary agent:

- owns the plan, scope, and user intent;
- prevents overlapping writes;
- reviews every returned change against the constitution and active artifacts;
- resolves integration conflicts;
- runs final relevant checks;
- updates context and handoff state; and
- alone claims completion to the user.

Sub-agents MUST NOT commit, push, deploy, send external messages, or mark the overall task
complete. A permanent sub-agent registry is intentionally absent; create the smallest
dynamic team needed for the current task.

## Handoff Standard

A useful handoff contains exact paths and executable next steps, not narrative history.
It records:

- objective and monorepo scope;
- active spec, plan, and tasks;
- completed and incomplete work;
- changed files;
- checks run with outcomes;
- blockers and decisions still required; and
- safe recovery or rollback notes.

The receiving agent re-verifies drift-prone facts and current file state before continuing.
