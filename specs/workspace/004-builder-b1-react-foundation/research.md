# Research & Decisions: Builder B1 View Foundation

Verified 2026-08-25 against the repository, the accepted 003 artifacts, and the installed toolchain.
Format: Decision / Rationale / Alternatives.

## R1 — Zero new dependencies

**Decision**: No catalog additions. react/react-dom 19.2.8, @types/react(-dom), @vitejs/plugin-react
6.1.0, vite 8.2.2, vitest 4.1.11, @testing-library/react, jsdom, and the Storybook 10.5.10 stack are
already pinned and installed; builder deps are `workspace:*`.

**Rationale**: eliminates the trust-policy/minimum-release-age risk class entirely; the reference
docs' cva/clsx/tailwind-merge belong to the shell milestone's styling system, not to B1's token-CSS
approach (R5).

**Alternatives**: adding cva now (rejected — no Tailwind in B1, plain CSS with custom properties
covers five blocks); react-frame-component (rejected — R3).

## R2 — Layer-2 siblings must not import each other

**Decision**: `builder-renderer` does NOT depend on `builder-react`. The live renderer receives the
kernel **by prop** and subscribes through the 003 `StateFacade` with its own `useSyncExternalStore`
wiring; context/hooks ergonomics live in `builder-react`; the layer-5 preset composes both in
`<Builder>`.

**Rationale**: ADR 0003 forbids equal-layer builder edges (`targetLayer >= sourceLayer` fails CI) —
verified in `validate-builder-boundaries.mjs`. The design honors the law instead of carving an
exception, and keeps the renderer usable in publish pipelines with no context at all.

**Alternatives**: renderer→react dep (rejected — violates the shipped validator); merging the two
packages (rejected — static publish rendering must not drag context machinery; reference
architecture keeps them distinct engines).

## R3 — In-repo CanvasFrame instead of a B1 vendor pass

**Decision**: Build a focused isolation frame in `builder-renderer`: an iframe that (a) mirrors the
parent document's `<style>`/`<link rel="stylesheet">` nodes into its head (initial copy +
`MutationObserver` on `document.head` for dev-server style injection), (b) writes one managed
`<style>` of `--t-*` token variables from the `theme` prop, (c) sets `dir` on the iframe root, and
(d) portals children into the iframe body. Recorded in spec Clarifications as a deviation from the
reference docs' Puck vendor pass.

**Rationale**: B1 consumes only the isolation behavior; Puck's value in the reference plan
(drop-zones, drag choreography, field controls) is consumed at B2/B3 — vendoring it now imports
surface without consumers. Zero vendored code in B1 keeps the license/VENDOR.md machinery where its
payload is.

**Alternatives**: vendor AutoFrame now (rejected as premature); Shadow DOM instead of iframe
(rejected — the reference architecture's isolation story, including future `content-visibility` and
user-CSS isolation, is iframe-based).

## R4 — Blocks live under `src/components/` (mechanical contract)

**Decision**: Every block folder sits at `extensions/blocks-marketing/src/components/<Name>/`
carrying the five mandatory artifacts PLUS `schema.ts`, `examples.ts`, and `<Name>.css`.

**Rationale**: `validate-components.mjs` (read in full) checks artifact PRESENCE and permits extra
files; its discovery runs over `discoverWorkspace`, which since 003 includes the builder family — so
the complete-component law is CI-fatal for blocks with zero validator changes. The reference triad
stays colocated.

**Alternatives**: `src/blocks/<name>/` with hand-maintained contract (rejected — convention where a
mechanism exists); extending the validator (unnecessary — verified permissive).

## R5 — Styling: plain CSS files, logical properties, `--t-*` tokens

**Decision**: Each block ships `<Name>.css` (imported by its component; package
`sideEffects: ["**/*.css"]`) using ONLY logical properties (`margin-inline`, `padding-block`,
`text-align: start`…) and `var(--t-…)` tokens with fallbacks. `builder-renderer` owns `themes.ts`
(starter `lightTheme`/`darkTheme`: surface, surfaceInverse, text, textMuted, accent, accentText,
radius, gap) and `themeToCssVars`.

**Rationale**: FR-008/FR-009 need tokens + direction-agnosticism, not a styling framework; the
kernel's no-px/no-hex law governs DOCUMENT props while CSS files own real values — the boundary the
reference docs draw. RTL flip then works by `dir` alone.

**Alternatives**: inline styles (rejected — no pseudo/media ergonomics, harder theming); Tailwind
now (rejected — shell milestone owns the Tailwind v4 `--bldr-*` system).

## R6 — Static rendering via the server renderer

**Decision**: `StaticDocument` is a pure component over `(document, breakpoint, blocks)`;
`renderStaticMarkup(document, options)` wraps `react-dom/server`'s static markup rendering for
string output. `react-dom` is a peer (provided by apps/tests, already catalog-pinned).

**Rationale**: one component tree serves live and static (SC-003 content parity by construction);
bit-identical output across runs follows from purity (no ids, no effects in static mode).

**Alternatives**: hand-written HTML serializer (rejected — second rendering truth drifts from the
component renderers).

## R7 — Storybook coverage by glob, zero manifest coupling

**Decision**: Extend `apps/storybook/.storybook/main.ts` stories globs with
`../../packages/builder/*/src/**/*.stories.@(ts|tsx)`,
`../../packages/builder/extensions/*/src/**/*.stories.@(ts|tsx)`, and the matching `*.docs.mdx`
globs. No dependency edges are added to the storybook app.

**Rationale**: story files resolve their imports from their OWN package context (pnpm strict
linking), so globs suffice; adding builder deps to storybook would trip `BUILDER_FAMILY_ACCESS` —
the glob approach keeps the law intact (same pattern the ui package already uses).

## R8 — Playground app shape

**Decision**: `@craftkit/playground` is a Vite React app (react-library tsconfig,
`createReactTestConfig` vitest, standard `dev`/`build`/`lint`/`typecheck`/`test`), importing ONLY
`@craftkit/builder` (+ react/react-dom). Kernel wiring lives in
`features/preview/create-playground-kernel.ts` using `@craftkit/builder/testing` (fixtures, seeded
ports, memory persistence). The runtime-registration demo ships its own tiny trusted manifest
(`demo-extension.ts`) with one announcement block — registered through `kernel.extensions.register`
on user action.

**Rationale**: proves FR-001/FR-013/FR-014 through the exact surface real apps get; the boundary
validator makes deeper imports impossible, which IS the test of the preset's sufficiency.

## R9 — Counting re-renders (SC-002, Lane A)

**Decision**: Block render-count probes: the live renderer accepts an optional
`onBlockRender?: (nodeId) => void` instrumentation callback (dev/test-only prop, no-op default)
invoked inside each block wrapper's render; tests mount the stress fixture, dispatch one `setProp`,
and assert exactly one callback with the target id (plus zero on selection changes).

**Rationale**: deterministic counting owned by our code — no reliance on React Profiler internals in
jsdom; the callback is a prop of the view, not kernel state, so Law S is untouched.

**Alternatives**: React Profiler `onRender` (kept as a secondary assertion where stable; primary law
stays the explicit counter).

## R10 — Preset surface (curated, minimal)

**Decision**: `@craftkit/builder` re-exports: `<Builder>` (its own composition component),
`BuilderProvider`/hooks/`Slot` (react), `DocumentView`/`StaticDocument`/
`renderStaticMarkup`/`CanvasFrame`/themes (renderer), `createBuilder`/`openDocument`/
`defineCommand`/core types (core), `blocksMarketing` (extension manifest), and `"./testing"`
passthrough of `@craftkit/builder-core/testing`. Nothing else.

**Rationale**: "apps import THIS and nothing deeper" needs the preset to be sufficient on day one;
curation (not `export *` of everything) keeps the app-facing API reviewable and lets deeper churn
stay private.
