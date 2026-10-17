# Research & Decisions: Builder B3a Inspector, Devices & Preview

Verified 2026-08-25 against the repository, the accepted 003–006 artifacts, and the installed
toolchain. Format: Decision / Rationale / Alternatives.

## R1 — Zero new dependencies; the B3 split

**Decision**: B3a adds nothing to the catalog. The reference milestone's TipTap leaf props move to
**B3b** as their own feature with a registry-verified dependency decision (pins, release age, trust
policy) — the first third-party editing dependency since B0 deserves an isolated, auditable step.
B3a's four base field kinds need only React + zod, both present.

**Rationale**: the B2a/B2b split precedent paid for itself twice (review depth per slice); mixing a
dependency decision into a five-surface milestone would bury it.

## R2 — Field resolution: introspect zod 4 definitions directly

**Decision**: `fields/resolve-field.ts` inspects a property's zod schema via its public `_zod.def`
discriminator chain (zod 4's stable introspection surface, already relied on by
`defineBlockSchema`'s JSON-representability gate in B0): unwrap `optional`/`default`/ `nullable`
wrappers to the core kind; map `string`→Text, `enum`→Select, `boolean`→Switch, `number`→Number;
everything else → the read-only JSON fallback. Contributed field types are consulted FIRST:
`registry.fieldTypes()` sorted by `match(schema)` score (highest wins, ties by registration order),
scores ≤ 0 skipped — the B0 contract verbatim.

**Rationale**: the same introspection primitive B0 already uses (one mechanism, one truth); the
default library covers every property the shipped blocks declare (verified: blocks- marketing uses
exactly string/enum/array-of-object — arrays fall back read-only in B3a and get first-class editing
with B3b's richer library).

**Alternatives**: converting schemas to JSON Schema first via `z.toJSONSchema` (rejected — loses the
direct zod instance the FieldTypeDef.match contract requires); a hand-rolled serialized field DSL
(rejected — B0 chose live zod at tier 1 deliberately).

## R3 — Registry read for field types (additive, the canvasTools precedent)

**Decision**: `RegistryRead.fieldTypes(): readonly FieldTypeDef[]` — typed read over the
already-stored bucket, duplicate-id probe joining the all-or-nothing registration check,
disposal-aware; recorded as a 003-§13 additive note. Registration ORDER is preserved by the catalog
(Map insertion order) so the tie-break rule is mechanical.

## R4 — Inspector: a shell component that owns commit wiring, not values

**Decision**: `components/Inspector/` (full contract; kernel BY PROP). It renders the selected
node's properties from `registry.block(type).schema.props` shape entries; every control receives
`FieldProps` where `value` comes from the DOCUMENT (base: `node.props[key]`; override bucket:
`node.responsive?.[bucket]?.[key]`, placeholder = inherited base) and `onChange` wraps ONE dispatch
(`setProp` or `setResponsive`). Rejections (the door throws) are caught per control and shown
control-adjacent (`aria-describedby`), with zero document change by the kernel's own guarantee. The
inspector subscribes per-node (the B1 hook path) so undo/external edits refresh controls; it holds
no authoritative copy (FR-003).

**Rationale**: the door already validates everything — the inspector is a thin projection + dispatch
surface, which is exactly why blocks need zero panel code.

## R5 — Editing bucket + device model

**Decision**: `devices/buckets.ts` exports `BUCKET_THRESHOLDS = { tablet: 768, desktop: 1024 }` and
`bucketForWidth(width): 'base' | 'tablet' | 'mobile'` (half-open: <768 mobile, 768–1023 tablet,
≥1024 base). `components/DeviceBar/` (full contract) owns view state: preset buttons (desktop/tablet
834/mobile 390 — common hardware defaults) + a custom-width number input; it reports
`{ width, bucket }` upward. The canvas gains an additive `frameWidth?: number` input (centered frame
at that width); the renderer's `RenderBreakpoint` for the live view follows the bucket ('base' →
'desktop').

**Rationale**: one constant, one function, declared in the spec — no scattered magic numbers; device
state is view state by law (never document).

## R6 — Responsive editing writes through the existing door

**Decision**: override read/write path per R4; the override marker shows when
`node.responsive?.[bucket]` owns the key; "clear" dispatches `setResponsive` with `null` (the B0
command's documented removal form). An override equal to the base is still an override (explicit
intent — spec edge case).

## R7 — Preview mode: composition, not a new renderer

**Decision**: `components/PreviewMode/` (full contract): renders `CanvasFrame` + `DocumentView` with
NO attachment, NO chrome layer, NO editable wiring — the same publish- safe path the plain
`<Builder/>` uses — plus a minimal floating exit control and a direction toggle that overrides the
frame `dir` locally (view state; the document is untouched and `getDocument()` stays
reference-identical). Escape exits; the composing surface (playground) keeps selection state alive
because the kernel was never touched.

**Rationale**: FR-012-005 already proved the no-attachment path byte-identical; preview is that path
plus an exit affordance — no third rendering truth.

## R8 — Focus-safe runtime field swaps

**Decision**: the resolved field component per property is FROZEN while that control owns focus:
resolution re-runs on registry version changes, but a pending swap applies on blur or selection
change (spec edge case). Implemented with a per-property "locked while focused" ref in the inspector
row.

## R9 — Lane-A proofs (counting, the standing policy)

Transactions ≡ commits arithmetic (base/override/clear); rejection ⇒ zero transactions; preview
round trip ⇒ zero transactions + reference identity during the flip; bucket mapping table-driven
over both thresholds; runtime field swap without reload; Law-S audit with the full B3a surface
mounted. Browser truth: Storybook play() — edit a property in Chromium and assert the canvas text
changed; device switch narrows the real frame. No wall-clock gates.

## R10 — Storybook coverage

Existing globs cover new shell components; the evidence run's catalog-presence check extends to
Inspector, DeviceBar, and PreviewMode entries.
