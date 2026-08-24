---
description: "Implement approved tasks with complete component and verification gates"
strategy: wrap
---

{CORE_TEMPLATE}

## Workspace Implementation Requirements

Apply `.specify/agents/rules/monorepo.md` and, for React or UI work,
`.specify/agents/rules/react-ui.md` throughout implementation.

- Keep writes inside the approved app/package scope. Update the plan before crossing an
  unplanned boundary.
- Create one substantive component per `.tsx` file. Extract every real subcomponent into
  its own folder; do not defer decomposition to cleanup.
- Treat implementation, local export, typed story, MDX docs, and behavior test as one
  atomic component contract. Do not mark a component task complete while one is missing.
- Run checks from changed component to owning package, direct consumers, and affected
  workspace. Record exact commands and distinguish unavailable from failed.
- Re-read the diff and complete all approved tasks before the mandatory workspace review
  hook. Do not commit, push, or deploy unless the user separately authorizes it.
