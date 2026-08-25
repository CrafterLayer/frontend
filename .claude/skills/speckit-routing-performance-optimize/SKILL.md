---
name: speckit-routing-performance-optimize
description: Analyze or implement route/query lazy boundaries and verify bundle impact
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: routing-performance:commands/speckit.routing-performance.optimize.md
---

# Routing Performance

Analyze the requested route, query, or bundle scope. The caller's focus is:

```text
$ARGUMENTS
```

## Required Context

1. Read `.specify/memory/constitution.md`.
2. Read `.specify/agents/context.json` and
   `.specify/agents/rules/routing-performance.md`.
3. Resolve the active feature and read its `spec.md`, `plan.md`, and `tasks.md` when the
   work is material or already scoped by Spec Kit.
4. Read the owning app/package manifest, public exports, build configuration, route tree,
   query keys, and current production output before proposing a boundary.

## Operating Contract

- If the request is diagnostic or review-only, remain read-only and report the measured
  cause plus the smallest coherent correction.
- If the request authorizes implementation, update incomplete Spec Kit artifacts first,
  then make only the scoped route/query/bundle changes.
- Keep code prefetch and data prefetch separate. Use intent events for both where the
  destination is expensive and the request is safe to repeat.
- Preserve stable parent route ids, ordered deferred patches, concurrent import
  deduplication, abort safety, retryability, and visible pending UI.
- Create QueryClient instances at the browser-root or request boundary; never add a
  hidden SSR singleton.
- Measure emitted output. Do not claim a faster route or smaller bundle from source
  inspection alone.

## Verification and Output

Run the narrow owner checks, production build, declared size checks, direct consumer
checks, workspace validators, and full verification in the order required by the
monorepo rule. If a valid before/after application build exists, list the affected chunk
names and sizes. Otherwise state that runtime navigation impact remains unmeasured.

Return:

1. code-load, data-load, render, and transition-UI findings;
2. implemented boundaries or exact recommended patch;
3. before/after artifact evidence and budget results;
4. commands that passed, failed, or could not run; and
5. residual risk and any unfinished Spec Kit task.