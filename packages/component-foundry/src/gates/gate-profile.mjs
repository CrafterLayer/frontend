/**
 * What a candidate component must survive before anyone sees it.
 *
 * ## Why this file exists at all
 *
 * `boundedrelay-profile.json` already lists `requiredChecks` — `ck-typecheck`,
 * `ck-lint`, `ck-test`, `ck-components`, `ck-boundaries`. That list is
 * METADATA. The project's own CLAUDE.md states it plainly: *"BoundedRelay never
 * runs them — it only attaches them as required evidence."* Measured twice
 * while integrating Codex work: its sandbox has no installed dependencies and
 * no network, so `pnpm exec vitest`, `pnpm typecheck`, and `pnpm lint` all fail
 * with ENOTFOUND after several minutes and produce no verdict at all.
 *
 * So a promotion pipeline that trusts "the checks are attached" promotes
 * unchecked code. This module is the part that actually runs them.
 *
 * ## Why the list is not simply copied from the profile
 *
 * The profile's checks answer "is the workspace still healthy". A candidate
 * component needs those AND two more that only matter for generated code:
 * whether it is REACHABLE (a component in an unscanned directory passes every
 * gate by not being looked at — `check:components` reports 59 today and does
 * not count anything under `fields/`), and whether it is CONTAINED (nothing it
 * pulls in escapes the layer law).
 */

/**
 * One gate: a command, and what its failure means to a person.
 *
 * `blocking` is the whole point of the shape. A non-blocking gate records a
 * finding without stopping promotion; a blocking one stops it. Nothing here is
 * non-blocking today, and the field exists so that adding a soft signal later
 * cannot be done by accident.
 */
export const GATE_PROFILE = Object.freeze([
  Object.freeze({
    id: 'typecheck',
    argv: ['pnpm', 'typecheck'],
    blocking: true,
    meaning: 'The candidate does not compile against the workspace it will live in.',
  }),
  Object.freeze({
    id: 'lint',
    argv: ['pnpm', 'lint'],
    blocking: true,
    meaning: 'The candidate violates a rule this codebase enforces on every other file.',
  }),
  Object.freeze({
    id: 'test',
    argv: ['pnpm', 'test'],
    blocking: true,
    meaning: 'Something in the workspace broke, or the candidate own tests fail.',
  }),
  Object.freeze({
    id: 'components',
    argv: ['pnpm', 'check:components'],
    blocking: true,
    meaning:
      'The candidate is missing one of the five artifacts every component here ships: implementation, export, story, MDX, test.',
  }),
  Object.freeze({
    id: 'boundaries',
    argv: ['pnpm', 'check:workspace'],
    blocking: true,
    meaning:
      'The candidate breaks the layer law, or declares a dependency contained to another package.',
  }),
]);

/**
 * Gates whose PASS is not evidence of anything.
 *
 * Named explicitly so a promotion report cannot present them as safety. Each
 * one is a real check that catches real problems; none of them can catch the
 * class of problem written beside it, and a pipeline that promotes on green
 * without saying so is claiming a guarantee it does not have.
 */
export const KNOWN_BLIND_SPOTS = Object.freeze([
  Object.freeze({
    gate: 'test',
    cannotCatch:
      'Tests written by the same author as the code. Green means "it does what its author thought", not "it is correct". Both delegated waves in this project arrived claiming success — one with a real type error, one with four lint errors and a test expectation off by 2x.',
  }),
  Object.freeze({
    gate: 'components',
    cannotCatch:
      'A component in a directory the scanner does not walk. It reports 59 today and does not count anything under fields/.',
  }),
  Object.freeze({
    gate: 'a11y',
    cannotCatch:
      'Roughly 60% of real accessibility defects. Axe cannot see a keyboard trap, a focus destination that fell to body, or a composite widget that announces nonsense.',
  }),
  Object.freeze({
    gate: 'boundaries',
    cannotCatch:
      'What a vendored implementation does at runtime. It checks declarations and imports, not behaviour.',
  }),
]);
