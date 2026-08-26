# @craftkit/builder-schema

The builder's constitution: every pure contract of the Crafterlayer builder kernel. Zero runtime
dependencies beyond `zod`; React appears as **types only** (value imports are lint-fatal, DOM usage
is a compile error via the headless TypeScript config).

Normative source:
[`specs/workspace/003-builder-b0-kernel`](../../../specs/workspace/003-builder-b0-kernel/plan.md)
(contracts in `contracts/builder-kernel.md`). Layer 0 of the builder dependency law (ADR 0003) —
this package may depend on nothing in the workspace.

## Public API (single entrypoint, `@craftkit/builder-schema`)

- **Document model** — `BuilderDocument`, `Node` (flat map, named-slots, JSON-pure by type),
  `DEFAULT_SLOT`, `LATEST_SCHEMA_VERSION`.
- **Validation** — `validateDocument(doc, lookup?)`: structural pass plus a registry-aware pass when
  a `BlockSchemaLookup` is provided; `findRawStyleLiterals` (no raw hex/px law); `findJsonViolation`
  / `isJsonValue` / `jsonValueZod` (Law J).
- **Definitions** — `defineBlockSchema` (rejects non-JSON-representable prop schemas at definition
  time), `blockPropsJsonSchema` (AI-context derivation), widget contracts (`SkinDef`,
  `DeclarativeWidgetTypeDef`, `CompositionDef`) and `validateSkin` (four-state gate).
- **Extension contracts** — `TrustedExtensionManifest` / `DeclarativeExtensionManifest`
  discriminated union (ADR 0004), contribution-point shapes, `validateTier2Manifest` (structural
  function rejection, all-or-nothing), `KernelApi` (the read-only contract extensions receive).
- **Kernel data contracts** — `Transaction`/`Patch`, command shapes
  (`CommandInput`/`RegisteredCommand`/`CommandRuntime`), ports (`ClockPort`, `IdPort`,
  `PersistenceAdapter`, `DataSource`), migrations (`createMigrationRunner`), and the typed
  `BuilderError` taxonomy.

## Development

```bash
pnpm --filter @craftkit/builder-schema lint
pnpm --filter @craftkit/builder-schema typecheck
pnpm --filter @craftkit/builder-schema test
```

Internal-packages mode: consumers import TypeScript source through the `"."` entrypoint; there is no
build step in B0.
