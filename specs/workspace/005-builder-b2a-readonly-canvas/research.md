# Research & Decisions: Builder B2a Read-Only Canvas

Verified 2026-08-25 against the repository, the accepted 003/004 artifacts, and the installed
toolchain. Format: Decision / Rationale / Alternatives.

## R1 — Zero new dependencies

**Decision**: No catalog additions. The chrome uses platform primitives only (element size
observation, attribute/childlist observation, frame-rhythm batching, point hit-testing). dnd-kit,
floating-ui, and tinykeys stay deferred to B2b/B3 with their consumers; the Tailwind v4 `--bldr-*`
styling system stays deferred to the milestone that ships real chrome surface (palette/panels) —
B2a's outlines use plain CSS with shell-owned `--bldr-*` custom properties (fallback values inline),
mirroring the R5-004 precedent.

**Rationale**: eliminates trust-policy risk entirely; two outlines and a badge do not justify a
styling system; every needed primitive is native.

**Alternatives**: vendoring Puck's AutoFrame/overlay now (rejected — B1's in-repo CanvasFrame
already provides isolation; the vendor pass is reconsidered at B2b where drag choreography is the
actual payload); floating-ui for outline positioning (rejected — outlines are axis-aligned rects
over a known frame, no collision/flip logic needed).

## R2 — New member `@craftkit/builder-shell` at layer 3

**Decision**: One new package `packages/builder/shell` (`@craftkit/builder-shell`), layer 3 —
already present in `validate-builder-boundaries.mjs`'s layer map (deliberate B0 provision, line 28).
Dependencies: `@craftkit/builder-{schema,core,react,renderer}` (all strictly lower layers) + peers
`react`/`react-dom`. Internal mode (src exports), react-library tsconfig, `createReactTestConfig`.

**Rationale**: the reference architecture homes canvas chrome (overlay host, rect cache) in the
shell tier; the layer map anticipated exactly this member, so `check:workspace` accepts it with zero
validator changes while still forbidding sideways/upward imports.

**Alternatives**: extending `builder-renderer` (rejected — the renderer stays a publish-safe engine
with no editing chrome; equal-layer law also keeps it importable by future engines); starting
`builder-shell` as the full editing shell now (rejected — B2a ships only the read-only canvas slice;
top bar/panels/palette arrive with their milestones).

## R3 — Composition: `EditorCanvas` in the shell, hot path React-free

**Decision**: The shell exports ONE React component, `EditorCanvas` (kernel by prop): it renders the
B1 `CanvasFrame` + `DocumentView` (with geometry attachment, R4) + a chrome layer element + an
accessibility live region, wires pointer/keyboard listeners, and drives the imperative overlay
machinery. Everything on the interaction hot path (pointer move, outline positioning, tool mounting)
lives in plain TypeScript modules (`overlay/`, `rects/`) that write to the chrome layer directly —
React renders the static scaffold once and is never on the per-event path.

**Rationale**: honors the reference law "overlay hot path is React-free" and the milestone exit
criterion (0 content re-renders) BY CONSTRUCTION — there is no React state that could re-render on
hover; the single-component-per-file law holds (one `.tsx`, machinery in `.ts` modules).

**Alternatives**: React state + memoized overlay components (rejected — every hover would schedule
renders; the zero-render criterion becomes a fight instead of a property); rendering chrome inside
the iframe (rejected — chrome must never inherit or disturb document styles, and host-side chrome
survives document re-renders untouched).

## R4 — Geometry discovery: edit-only node wrappers registered by callback ref

**Decision**: `DocumentView` gains one additive optional prop
`attachNodeElement?: (id: NodeId, element: HTMLElement | null) => void`. When present, NodeView
wraps each block in a `<div data-bldr-node={id} data-bldr-type={type}>` whose callback ref reports
mount (element) and unmount (null). Absent prop (default, and always for `StaticDocument`) renders
exactly as today — the publish path is byte-identical.

**Rationale**: arbitrary block components expose no ref contract, so a wrapper element is the only
reliable per-node box; registration-by-ref makes membership tracking exact (no childlist scanning
for identity), and edit-only wrapping keeps the static/publish renderer pure. This is the same
structural choice the reference vendor makes for zones/items.

**Alternatives**: `display: contents` markers (rejected — no box, nothing to measure); requiring
blocks to spread `rootProps` (rejected — burdens every block author and breaks existing blocks);
measuring block first-children heuristically (rejected — fragile with fragments/portals).

## R5 — Rect index: registration + observation in, lazy measurement out

**Decision**: `createRectIndex(ports)` in the shell:

- **Membership**: `attach(id, element)` / `detach(id)` driven by R4's callback refs.
- **Invalidation (version bump, O(1))**: one shared ResizeObserver over attached elements; frame
  scroll (capture) + frame viewport resize listeners; a MutationObserver on the frame root's
  `dir`/`class` attributes (a direction flip reflows positions without resizing every element).
- **Measurement**: lazy — `rect(id)` re-measures ONLY that element when its cached version is stale,
  translating into host coordinates via the frame's own rect; `version()` exposes the monotonic
  invalidation counter; nothing measures on a timer and nothing measures per pointer event across
  the index.
- **Hit-testing**: `nodeAt(clientX, clientY)` uses the frame document's point hit-test and walks to
  the closest `[data-bldr-node]` — identity without measurement.
- **Ports for determinism**: the measurement function, hit-test function, and frame-rhythm scheduler
  are injectable (defaults: real DOM/`requestAnimationFrame`); jsdom has no layout, so unit tests
  inject fake geometry/scheduling — the same Law-D port philosophy the kernel uses. Real-geometry
  proofs run in the Storybook browser suite (Chromium, real layout) via story play functions.

**Rationale**: satisfies FR-001/002 with zero idle cost and observer-only currency; lazy per-node
measurement bounds work to what chrome actually reads (hover/selection + mounted tools), which is
what makes the 1,000-node guarantee cheap.

**Alternatives**: eager full re-measure on every invalidation (rejected — O(n) reads per
keystroke-sized reflow on the stress doc for no consumer); IntersectionObserver-based positions
(rejected — reports intersection ratios, not authoritative rects, and quantizes updates).

## R6 — Overlay: prebuilt host-side chrome, one write batch per frame

**Decision**: The overlay machinery owns THREE prebuilt DOM elements in the chrome layer (hover
outline, selection outline, name badge is part of each outline) plus a tool mount area. State
changes (hover id, selection id, geometry version) mark the overlay dirty; one frame-rhythm callback
per frame reads the needed rects (batched reads) then writes `transform/width/height/visibility`
(batched writes) — read/write phase discipline, no layout thrash. Outline label text = block schema
description (fallback: type). Chrome colors/z-index come from `--bldr-*` custom properties with
inline fallbacks; all geometry writes use transforms, direction-safe in LTR and RTL.

**Rationale**: direct reuse of the reference performance laws (§ "Overlay hot path is React-free",
"read/write phase discipline"); prebuilt elements mean the pointer path allocates nothing.

**Alternatives**: per-hover element creation (rejected — GC churn on sweep); CSS
`outline`/`box-shadow` injected INTO the document nodes (rejected — mutates document-rendered DOM,
breaks the zero-content-touch guarantee and leaks into static output risk).

## R7 — Selection wiring stays kernel-owned

**Decision**: Click → `kernel.setSelection([id])`; empty-canvas click and Escape →
`kernel.setSelection([])`. The overlay renders FROM kernel selection (store subscription on the cold
path): selection made programmatically or by any other surface shows identically (FR-004). Hover
never enters the kernel — it is overlay-local. Selection changes are kernel bookkeeping (B0 Law-S:
not transactions) and provably cause zero content re-renders (the B1 SC-002 suite already asserts
DocumentView ignores selection churn).

**Rationale**: single source of truth for selection was built in B0 precisely for this; the existing
per-node subscription design already isolates content from selection state.

**Alternatives**: overlay-local selection mirrored into the kernel (rejected — two sources of truth;
breaks FR-004's "selection made anywhere shows identically").

## R8 — Keyboard model

**Decision**: The canvas host is a focusable region (`tabIndex=0`, accessible name). Keys:
ArrowDown/ArrowUp = next/previous node in document order at the current nesting level (siblings
within the same slot, wrapping across the parent's slot list order); ArrowRight = step INTO the
first child of the selected node's first populated slot, ArrowLeft = step OUT to the parent —
horizontal keys mirror when the content direction is RTL; Escape clears. With no selection, any
traversal key selects the document root's first child. Tab is never trapped. Selected-state
announcements go through a visually-hidden `aria-live=polite` status in the HOST (chrome inside
outlines carries the visible name; cross-frame `aria-activedescendant` is not reliable, so the live
region is the AT channel). Traversal computes from the kernel document (cold path).

**Rationale**: matches familiar tree-navigation conventions, respects RTL (FR-009/011), and stays
honest about iframe accessibility limits (the live region + visible labels are the dependable
channel).

**Alternatives**: roving `aria-activedescendant` into the frame (rejected — cross-document id
references are not honored consistently by AT); trapping Tab for traversal (rejected — steals
document focus order, harms keyboard users).

## R9 — Canvas tools: first consumer of the B0 contribution point

**Decision**: Two additive core/schema refinements (003-contract §13 style):

1. `RegistryRead.canvasTools(): OverlayToolDef[]` — the registry already STORES canvasTools in its
   generic owner-tagged buckets; this adds the typed read (sorted by `order`), plus duplicate-id
   probe in the existing all-or-nothing registration check.
2. The shell concretizes `OverlayToolRenderer`'s deliberately-abstract inputs: `rect` receives a
   `NodeRect` (host-coordinate box) and `layer` receives the chrome layer element; the shell exports
   the concrete `CanvasToolTarget` type. No schema signature change — `unknown` accepts the concrete
   values; tools import the shell type for DX.

Tool lifecycle in the overlay: on activation ('selection' | 'hover' | 'always') mount via `load()`
(lazy, cached per id) then `renderer(target)`; keep the returned cleanup; run cleanups on
deactivation, re-activation with a new target, registry version change, and unmount. `load`
rejection or a throwing mount is caught, reported through an `onToolError` callback (default:
`console.error`), and never breaks built-in chrome (FR-014). `'drag'` activation registers but never
fires in B2a (documented).

**Rationale**: proves the extension architecture on real chrome with the contract B0 already
shipped; the typed read is the missing half the registry comment anticipated ("consumers arrive…").

**Alternatives**: a new shell-local tool registry (rejected — parallel extension system); making
`rect`/`layer` generic parameters in schema (rejected — churns a shipped contract for zero runtime
gain).

## R10 — Lane-A proofs (counting, no wall-clock)

**Decision**: Merge-blocking proofs are counters:

- **Zero content re-renders**: `onBlockRender` counter stays 0 through pointer sweep, hover, select,
  clear — on landing and 1,000-node stress docs (jsdom with injected geometry ports).
- **Observer-only currency**: RectIndex exposes a test-only `stats()` (measure count, invalidation
  count); tests assert measures happen only after invalidation events and never while idle (fake
  scheduler ticks with no events ⇒ 0 new measures).
- **Real geometry**: Storybook play functions (Chromium, real layout) assert outline boxes actually
  cover their targets and reposition after a programmatic resize — the browser-truth complement to
  jsdom's injected ports.

Absolute timing stays out of merge gates entirely (B1's SC-006 lesson, recorded in 003 §13.13); the
uncontended evidence run records observed numbers.

## R11 — Playground demonstration

**Decision**: Playground adds an edit-mode toggle (`EditMode` full-contract component) that swaps
`<Builder/>`'s canvas for the shell's `EditorCanvas`, and extends the existing `playground-demo`
runtime extension with one canvas tool (a selection badge showing the node type) proving FR-012/013
live. Preset `@craftkit/builder` re-exports `EditorCanvas` + its types (curated surface +
surface.test.ts entries).

**Rationale**: keeps "apps import only the preset" true while making B2a demonstrable in the browser
with zero new app plumbing.

## R12 — Storybook coverage

**Decision**: The existing `packages/builder/*` globs already cover `packages/builder/shell`
(single-level glob matches `shell`); no `main.ts` change is expected — verified against the glob
shape, and the evidence run must confirm the shell stories appear in the catalog (the B1 review
lesson: globs gate the a11y suite).
