# ADR 0003: Enforce the Builder Dependency Law with Workspace Validators

- **Status:** Accepted
- **Date:** 2026-08-25
- **Scope:** `packages/builder/*` family and every workspace member that references it
- **Spec:**
  [`specs/workspace/003-builder-b0-kernel`](../../../specs/workspace/003-builder-b0-kernel/spec.md)

## Context

The Crafterlayer builder is a kernel-plus-extensions architecture whose value depends on a strict
layer order: contracts (`@craftkit/builder-schema`), kernel (`@craftkit/builder-core`), engines,
shell, extensions, and finally the `@craftkit/builder` preset that applications consume. The
reference plan proposed enforcing that order with Turbo `boundaries` tags, but ADR-relevant research
for the monorepo foundation (`specs/workspace/001-monorepo-foundation/research.md`) explicitly
deferred that experimental feature, and the repository already enforces manifest contracts
deterministically through `@craftkit/workspace-tools`.

## Decision

Enforce the layer law inside `@craftkit/workspace-tools`, which `pnpm check:workspace` (and
therefore `pnpm verify`) runs:

1. Workspace discovery covers the nested family roots `packages/builder/*` and
   `packages/builder/extensions/*` in addition to direct `apps/*` and `packages/*` members.
2. `validate-builder-boundaries.mjs` assigns each builder member a deliberate layer (schema=0,
   core=1, engines=2, shell=3, extensions=4, preset=5) and fails the build when: a builder member
   depends on an equal or higher layer; an extension depends on another extension; a builder member
   depends on a workspace member outside the family other than the approved tooling configs; a
   non-builder member reaches the family through anything but `@craftkit/builder`; or a builder
   member has no layer assignment at all.
3. Non-builder members' other dependencies remain governed exclusively by the existing workspace
   rules; bare `turbo boundaries` stays in the pipeline as defense in depth.

## Consequences

- Violations fail CI with stable diagnostic codes (`BUILDER_LAYER_VIOLATION`,
  `BUILDER_EXTENSION_COUPLING`, `BUILDER_FAMILY_ACCESS`, `BUILDER_FOREIGN_DEPENDENCY`,
  `BUILDER_UNKNOWN_LAYER`) and are covered by dedicated fixture tests.
- Adding a builder package is a deliberate act: it must be placed in the layer map, so architectural
  drift cannot happen silently.
- If Turbo boundaries tags graduate from experimental, they can be layered on top without removing
  this validator; revisit at milestone B2.
