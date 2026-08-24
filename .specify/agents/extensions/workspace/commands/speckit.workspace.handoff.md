---
description: "Refresh the shared context and exact continuation handoff"
---

# Refresh Workspace Handoff

Update the canonical shared state for Claude, Codex, Cursor, and future agents. Caller
notes, if any:

```text
$ARGUMENTS
```

## Scope Guard

This command may edit only:

- `.specify/agents/context.json`;
- `.specify/agents/HANDOFF.md`; and
- `.specify/agents/MEMORY.md` when a validated durable decision or recurring failure mode
  genuinely belongs there.

Do not edit feature or application files, stage changes, commit, push, deploy, install
dependencies, or write to external systems.

## Procedure

1. Read the constitution, `.specify/agents/README.md`, current context, current handoff,
   and the active feature artifacts.
2. Inspect the real repository status and verification evidence. Never rely on chat
   history alone when the filesystem can confirm the state.
3. Replace stale current facts in `context.json`: active monorepo scope, current feature,
   lifecycle phase, actual installed versions, important paths, and runnable commands.
   Preserve the schema and keep the JSON valid.
4. Replace `HANDOFF.md` with the exact continuation state: objective, scope, active
   artifacts, completed work, incomplete work, changed files, checks and outcomes,
   blockers, decisions required, next executable steps, and recovery notes.
5. If the work is fully verified, reset the handoff to `idle` and leave no fake next task.
   If work is unfinished, use `paused` or `blocked` accurately and make the first next step
   executable without reconstructing the session.
6. Add to `MEMORY.md` only if the information is validated, durable, reusable, and has a
   clear staleness condition. Do not copy transient TODOs or raw logs into memory.
7. Validate `context.json` with a JSON parser and re-read all changed continuity files.

Return a concise summary of what state was recorded and why. Never include secrets,
tokens, cookies, credentials, personal data, or private payloads.
