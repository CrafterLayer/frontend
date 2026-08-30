/*
  @craftkit/component-foundry — the pipeline that turns a component REQUEST
  into a promoted, gated component without a developer in the loop.

  ## The one thing this package exists for

  BoundedRelay attaches `requiredChecks` to a write task as metadata. It never
  runs them — CLAUDE.md says so in those words. Measured twice while
  integrating delegated work on this repo: the worker's sandbox has no
  installed dependencies and no network, so every verification command failed
  with ENOTFOUND and produced no verdict at all, while the worker's own report
  read as success.

  A promotion pipeline built on "the checks are attached" therefore promotes
  unchecked code. `runPromotionGates` is the part that actually runs them, and
  it treats a gate that did not RUN as a gate that did not pass.
*/
export { runPromotionGates, GATE_PROFILE, KNOWN_BLIND_SPOTS } from './gates/run-gates.mjs';
