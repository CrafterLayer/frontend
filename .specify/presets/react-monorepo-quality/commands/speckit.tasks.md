---
description: "Generate dependency-ordered tasks with mandatory UI and delivery gates"
strategy: wrap
---

{CORE_TEMPLATE}

## Workspace Task Requirements

The core command's optional-test language is superseded for this repository: tests are
mandatory for implementation, and every UI component requires its story and MDX docs.

Generate tasks by owning app or package and dependency order. Every new UI component MUST
have explicit, traceable tasks for:

1. the single component implementation and local public export;
2. typed Storybook states and useful interaction play coverage;
3. MDX purpose, usage, API, variants, accessibility, RTL/responsive/theme constraints;
4. behavior-focused and accessibility-oriented tests; and
5. owning-package plus affected-consumer verification.

Do not hide these artifacts in one optional cleanup task. Tasks that can run in parallel
must have path-disjoint ownership. Add explicit tasks for public API updates, migrations,
consumer validation, final diff review, fixing accepted findings, rerunning checks,
`speckit.converge`, and the shared handoff refresh. Every task must name an exact path or
deliverable and preserve the declared scoped feature directory.
