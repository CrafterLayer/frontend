# @craftkit/builder-core

The Crafterlayer builder kernel: sealed document store, one validated dispatch door, transactions
with inverse patches (undo/redo), extension lifecycle, contribution catalogs, and deterministic
ports. Fully headless — no React runtime, no DOM, no network; every behavior is verified in a node
environment.

Normative source:
[`specs/workspace/003-builder-b0-kernel`](../../../specs/workspace/003-builder-b0-kernel/plan.md).
Layer 1 of the builder dependency law (ADR 0003) — depends only on `@craftkit/builder-schema` plus
`immer`, `nanoid` (behind `IdPort`), `zod`, and `zustand/vanilla` (module-private behind the
read-only facade; Law S).

## Public API (`@craftkit/builder-core`)

- `createBuilder(options)` → `BuilderKernel` (17 members): `dispatch` (typed for the twelve core
  commands, string-typed for extension commands), `dispatchGroup` (every step over ONE immer produce
  — one transaction, one history entry, one undo, and atomic failure), `undo`/`redo`, `validate`,
  `extensions` (register / registerAll / hydrateDeclarative / dispose), `flush` (count-coalesced
  persistence), `setSelection`, `focusElement`, `transactions`.
- `openDocument(adapter, docId, options)` — Law M load path: load(snapshot + tail) → migrate →
  validate → open; never half-opens.
- `createSiteBuilder(options)` → `BuilderSiteKernel`: a whole SITE — pages, shared regions, design
  system, asset table — behind **one** store, one dispatcher, one transaction log, one history and
  one save session. `kernel.page(pageId)` returns a lens satisfying the 17-member `BuilderKernel`
  interface, so every component built for a document works over a site unchanged. Patches are rooted
  in the site, which is what makes a batch touching several pages one transaction and therefore one
  undo
  ([ADR 0006](../../../docs/architecture/decisions/0006-builder-site-model-and-design-tokens.md)).
- `siteCommands` / `SiteCommands` — addPage, removePage, renamePage, reorderPage, setSharedRegion,
  setPageRegions, setDesignToken, setDesignSystem, registerAsset, setSiteDirection, and the
  host-only `applySitePatches`, which refuses to move `siteVersion` because the migrations own it.
- `defineCommand` — authoring with full zod inference, registered variance-safe with parsing INSIDE
  the door (Law V).
- `coreCommands` / `CoreCommands` — insertNode, insertComposition, removeNode, moveNode, setProp,
  setBinding, setResponsive, setDocMeta, duplicateNode, wrapNode, groupNodes, and the host-only
  applyPatches.
- `applyPatchSet` (replay), `systemClock`/`systemIds` (the only ambient-capability call sites; Law
  D), `insertedNodeId`, `emptyDocument`.

## Testing surface (`@craftkit/builder-core/testing`)

Deterministic ports (`fixedClock`, `seededIds`), fixtures (`fixtureBlocks`, `landingFixture`,
`stressDocument(1000)`), `fakeExtension`, and `createMemoryPersistence` — shared by this package's
suites and by B1+ consumer tests (the approved second entrypoint; see plan Complexity Tracking).

## Guarantees under test

Property suites run ≥1,000 randomized sessions per CI run: undo-all ≡ original, redo-all ≡ final,
log replay ≡ final, identical seeds ⇒ field-for-field identical histories. Law suites prove JSON
purity at the door, the sealed store's 1:1 change↔transaction pairing, node-scoped notifications on
the 1,000-node stress document, and load-invariant linear scaling of structural validation (the
SC-006 budget guard; the absolute number is recorded by the uncontended evidence run).

## Development

```bash
pnpm --filter @craftkit/builder-core lint
pnpm --filter @craftkit/builder-core typecheck
pnpm --filter @craftkit/builder-core test        # includes the property suites
pnpm --filter @craftkit/builder-core test:coverage
```
