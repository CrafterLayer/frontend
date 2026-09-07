# @craftkit/builder-shell

The builder's shell tier — in B2a, the **read-only canvas**: an observer-invalidated geometry index,
hover/selection chrome above the isolated preview, keyboard traversal, and the first live consumer
of the extension contract's `canvasTools` contribution point. Zero editing gestures: nothing here
mutates the document (drag/drop/resize/palette/layers arrive with later milestones).

Normative source:
[`specs/workspace/005-builder-b2a-readonly-canvas`](../../../specs/workspace/005-builder-b2a-readonly-canvas/plan.md).
Layer 3 of the builder dependency law (ADR 0003) — depends only on
`@craftkit/builder-{schema,core,react,renderer}`; `react`/`react-dom` are peers; apps still import
ONLY `@craftkit/builder`.

## Public API

- `EditorCanvas` — the one React component: B1 `CanvasFrame` + `DocumentView` (edit-mode geometry
  attachment) + chrome layer + a11y live region + pointer/keyboard wiring. React renders the
  scaffold once; every per-event path runs in plain-TS machinery with direct DOM writes batched to
  the frame rhythm — **zero document-content re-renders by construction**.
- `createRectIndex` / `RectIndex` / `NodeRect` — geometry index: membership by callback ref,
  invalidation by observation only (element resize, frame scroll, viewport resize, `dir` flip), lazy
  per-node measurement, `onInvalidate` notification, zero idle cost, `stats()` for the Lane-A
  observer-attribution proofs.
- `GeometryPorts` / `systemGeometryPorts` — injectable measure/hit-test/scheduler (jsdom has no
  layout; tests inject fakes — the kernel's Law-D port philosophy applied to geometry).
- `defineCanvasTool` / `CanvasToolTarget` — tool authoring with the concrete target type; the stored
  `OverlayToolDef` keeps the schema's abstract shape (single-cast variance erasure, the
  `defineCommand` pattern). Tools mount imperatively into the chrome layer and MUST return a
  cleanup; failures are contained via `onToolError` and can never break built-in chrome.

## Drag editing (B2b)

`EditorCanvas editable` adds the in-repo drag engine — session state machine + pure drop resolver +
prebuilt drag chrome — on the SAME geometry index and flush rhythm (no dnd library: library drag
state lives in view context and would re-render content mid-drag). One transaction per drop,
zero-trace cancel, resolver≡door rule agreement proven by an exhaustive sweep. `Palette`
(catalog-driven, drag- or keyboard-insert with the walk-up placement rule) and `LayersTree` (ARIA
tree sharing kernel selection both ways) compose beside it; `Alt+Arrows` delivers pointer-free
arrangement parity.

## Inspector, devices & preview (B3a)

`Inspector` generates the selected block's properties panel from its OWN schema — zero panel code
per block: text/select/switch/number defaults (optional/default/nullable unwrapped), an accessible
read-only fallback, one kernel transaction per commit, rejections caught at the door and surfaced
via `aria-describedby`. Field renderers are extensible through the registry's field-type
contribution point (highest `match(schema)` wins, ties by registration order, lazy load,
per-property failure containment, focus-locked swaps). `DeviceBar` + `bucketForWidth` map ANY width
to the editing bucket through one exported threshold constant (`BUCKET_THRESHOLDS`: mobile < 768 ≤
tablet < 1024 ≤ base); `EditorCanvas frameWidth` narrows and centers the frame shell (overlay shares
its origin — a layout-only change), and the inspector's non-base buckets read/write
`responsive[bucket]` with override markers and one-transaction clears. `PreviewMode` renders the
publish-safe path — no attachment, no chrome, live content, Escape from either document, a
view-state direction override, and zero transactions for the whole round trip.

## B3c — editing where the content lives

A block declares one property as `inlineEditable`; a double-click (or Enter on the selection) opens
that property in place, and the renderer's seam swaps its VALUE for an editing surface on exactly
one node — same typography, same box, no dialog, one node's subtree re-rendered. Plain strings open
`InlineTextSurface` (adapted from Puck — see `vendor/VENDOR.md`); rich text opens
`InlineRichSurface`, the **engine-free** built-in: select a word, press Bold, and exactly that word
is marked and stored, with the document edited by pure functions (`inline/mark-range.ts`) over a
selection mapped through `inline/dom-range.ts`. A contributed editor from the registry's
`inlineEditors` point outranks either built-in when an extension registers one — that is the upgrade
path to headings, lists, links, and engine-level undo — and a session that edits no rich text still
loads no engine.

Two floating toolbars sit above the preview: `TextBubble` over a live text selection and
`BlockActionBar` over the selected block (duplicate / delete / move earlier / move later, one
transaction each with a defined resulting selection, absent during a drag and while the block's own
text is open). Both are **content-only** components. Their geometry belongs to `createFloatingHost`,
which measures its own content and writes `transform` straight to the DOM from `createAnchorChannel`
— the same observer-driven invalidation the outlines ride. `positionFloating` supplies
flip/shift/arrow/hide/inline placement as a pure function, with no positioning library and no
auto-update loop.

## Site panels

Five components serve the SITE rather than one document, and each is a sibling under `components/`
rather than a nested part of a bigger panel — the component contract walks direct children only, and
a nested one would be invisible to it.

- `SitePages` — the site's pages as a list: switch, add, rename, reorder. One transaction each.
- `DesignSystemPanel` + `TokenSwatchGrid` — the site's palette, editable in place. A swatch is never
  a colour alone: every cell carries the token's NAME and VALUE as text, because a grid of coloured
  squares is unusable to roughly one man in twelve, every screen reader, and anybody on a bad
  monitor. Draft state is adjusted DURING render when an external write arrives — React's documented
  pattern — never in an Effect.
- `AssetPicker` — the site's pictures. Every state is a SENTENCE: loading, unavailable (carrying the
  library's own words), empty, and filtered-to-nothing each say what happened where the pictures
  would have been, because each of those drawn as blank space is indistinguishable from the
  component being broken. It hands back the whole `AssetEntry`, not an id, so the caller can copy it
  into the site's asset table.
- `GenerationProgress` — the named stages of a site run, each with a status and an optional
  caller-supplied `detail` line. It owns no clock: whatever should appear beside a stage — an
  elapsed time, a page count — the host passes in.

## Performance laws (merge-gated by counting, not wall-clock)

Hover/select/sweep ⇒ 0 content re-renders (proven on the 1,000-node stress document), and so does
scrolling a canvas with a toolbar open — toolbar positioning is a direct DOM write, never a render;
geometry updates are 100% observer-attributed (no polling, no per-interaction measurement);
browser-truth positioning, inline editing, and bubble activation are asserted by Storybook play
functions in real Chromium.

## Development

```bash
pnpm --filter @craftkit/builder-shell lint
pnpm --filter @craftkit/builder-shell typecheck
pnpm --filter @craftkit/builder-shell test
```
