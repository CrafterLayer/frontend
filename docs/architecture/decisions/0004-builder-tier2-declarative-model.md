# ADR 0004: Builder Tier-2 Content Is Declarative JSON, Never Code

- **Status:** Accepted
- **Date:** 2026-08-25
- **Scope:** Builder kernel contracts and every future marketplace/org-content feature
- **Spec:**
  [`specs/workspace/003-builder-b0-kernel`](../../../specs/workspace/003-builder-b0-kernel/spec.md)

## Context

The builder's extension system serves two very different sources: trusted extensions that ship with
the platform, and organization/marketplace content that arrives as database rows. Letting stored
content carry executable behavior would create a permanent code-injection surface, and a single
manifest type whose `render`/`setup` fields are "sometimes forbidden" is unsound — the type admits
what the law forbids.

## Decision

1. **Discriminated manifest union.** `TrustedExtensionManifest` (tier 1) may carry functions
   (renderers, commands, setup). `DeclarativeExtensionManifest` (tier 2) is typed entirely with
   `JsonValue` payloads — functions are unrepresentable at the type level, not merely rejected at
   runtime.
2. **Structural defense in depth.** Hydration still walks raw rows and rejects any function value
   anywhere (`ext/tier2-executable`, naming the offending path), then strict-parses the shape
   (unknown keys such as `setup`/`render` fail), all-or-nothing.
3. **One node type.** Because the document itself is JSON-pure by construction (`props`/`responsive`
   are `JsonValue`), tier-2 stored subtrees reuse the runtime `Node` directly — no parallel
   "declarative node" type exists to drift.
4. **Schemas as data.** Stored widget contracts carry `SchemaDescriptor` values (a JSON-Schema
   subset, itself JSON); a Tier-1 interpreter compiles them into validators at hydration. Live zod
   instances never sit in database rows.
5. **Versioned snapshots.** Tier-2 rows are immutable versions; inserting a composition clones it
   detached by default, linked references pin a version, and upgrades are explicit undoable commands
   (semantics consumed fully at milestone B6).

## Consequences

- An org block hydrated from the database is indistinguishable in catalog lookups from a built-in
  one — the marketplace is the extension system with a payment gate, not a second system.
- All pixels are drawn by Tier-1 code; Tier-2 supplies only data that Tier-1 renderers interpret.
  User content can never execute.
- The four-state widget gate (loading/empty/error/success) is validated at the same boundary, so
  incomplete skins cannot enter the catalogs.
