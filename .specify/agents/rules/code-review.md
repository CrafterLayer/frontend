# Code Review Gate

Load this file after implementation, before commit-message generation, and whenever the
user asks for a review or readiness verdict.

## Review Sequence

1. Read the constitution and the active spec, plan, and tasks.
2. Confirm the declared monorepo scope and inspect the real diff.
3. Run the narrowest relevant checks before broad checks.
4. Use an independent read-only reviewer for material or high-risk changes when available.
5. Report findings by severity with evidence and exact file/line references.
6. Fix accepted findings, then rerun affected checks.
7. Run `speckit-converge` after implementation and review to find remaining artifact gaps.

## Review Priorities

Review in this order:

1. correctness, data loss, security, privacy, and authorization;
2. regressions and contract compatibility across apps/packages;
3. React purity, Hooks, effects, async behavior, and state ownership;
4. accessibility, keyboard behavior, semantics, RTL, responsive states, and theming;
5. monorepo boundaries, public APIs, dependency direction, cycles, and deep imports;
6. error, loading, empty, optimistic, retry, and cancellation behavior;
7. performance supported by evidence rather than speculative memoization;
8. tests, Storybook states, MDX documentation, and user-facing examples; and
9. maintainability, naming, dead code, and unnecessary abstraction.

Reject any new UI component that lacks its implementation, local export, story, docs, or
behavior-focused test. Reject nested or sibling component declarations in a `.tsx` file.

## Finding Format

Each finding includes:

- severity: Critical, High, Medium, or Low;
- concise title;
- file and line;
- demonstrated or likely impact;
- evidence or reproduction path; and
- smallest coherent correction.

Do not inflate severity, list style preferences as defects, or hide uncertainty. If no
findings remain, say so and list residual untested risk separately.

## Verification Evidence

The review summary distinguishes:

- verified now;
- inferred from code;
- unavailable because tooling is not configured;
- failed because of the change;
- failed from pre-existing unrelated debt; and
- user-side or environment-side follow-up.

Expected gates, when configured, are changed-file checks, owning package lint/typecheck,
component and integration tests, Storybook build, direct consumer checks, affected
workspace build, and browser/API smoke tests where behavior warrants them.

## Approval Standard

Approval requires no unresolved Critical or High findings, no unexplained failing required
gate, constitution compliance, and honest reporting of anything not tested. Review does
not authorize commit, push, deploy, or other external mutations.
