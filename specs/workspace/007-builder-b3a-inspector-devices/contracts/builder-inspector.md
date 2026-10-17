# Contract: Builder B3a Inspector, Devices & Preview

Normative TypeScript contracts as fenced blocks (001–006 precedent). Types not declared here come
from `@craftkit/builder-{schema,core,renderer,shell}`.

## 1. Field resolution (`shell/src/fields/`)

```ts
type ResolvedField =
  | { kind: 'contributed'; def: FieldTypeDef } // highest match(schema) > 0 wins
  | { kind: 'default'; control: 'text' | 'select' | 'switch' | 'number' }
  | { kind: 'readonly' }; // accessible JSON fallback

declare function resolveField(registry: RegistryRead, schema: z.ZodType): ResolvedField;
// f1. Contributions first: registry.fieldTypes() scored by match(schema); scores ≤ 0 skipped;
//     ties break by registration order (catalog insertion order is contractual).
// f2. Default mapping AFTER unwrapping optional/default/nullable to the core kind:
//     string→text · enum→select · boolean→switch · number→number · anything else→readonly.
// f3. A contributed def whose load() rejects or whose component throws falls back to the
//     DEFAULT resolution for that schema, contained to that one property (FR-005).
```

## 2. Registry read (additive, `@craftkit/builder-schema` + core impl)

```ts
interface RegistryRead {
  // …existing members unchanged…
  /** Field types in REGISTRATION ORDER (the tie-break rule rides on it). */
  fieldTypes: () => readonly FieldTypeDef[];
}
// Core: duplicate-id probe joins the all-or-nothing check; disposal removes the owner's
// entries; recorded as a 003 §13 additive note (the canvasTools precedent).
```

## 3. Buckets and devices (`shell/src/devices/buckets.ts`)

```ts
export const BUCKET_THRESHOLDS = { tablet: 768, desktop: 1024 } as const;
export type EditingBucket = 'base' | 'tablet' | 'mobile';
declare function bucketForWidth(width: number): EditingBucket;
// b1. Half-open ranges: width < 768 ⇒ 'mobile'; 768 ≤ width < 1024 ⇒ 'tablet'; ≥ 1024 ⇒ 'base'.
// b2. Device/preview state is VIEW state — never document, never kernel.

interface DeviceBarProps {
  value: { width: number; bucket: EditingBucket };
  onChange: (next: { width: number; bucket: EditingBucket }) => void;
}
// Presets: desktop 1280 · tablet 834 · mobile 390; custom width input maps through
// bucketForWidth. RTL-safe; announced via its own polite region.
```

## 4. Inspector (`components/Inspector/`)

```ts
interface InspectorProps {
  kernel: BuilderKernel; // BY PROP (shell no-context law)
  /** Active editing bucket; 'base' edits props, others edit responsive overrides. */
  bucket?: EditingBucket | undefined; // default 'base'
}
```

- i1. Renders the SELECTED node's schema properties as resolved controls (label = the property key;
  value from DOCUMENT truth: `props[key]` for base, `responsive[bucket][key]` with inherited-base
  placeholder for overrides). No selection or a node with no editable properties ⇒ accessible
  empty/notice states.
- i2. `onChange` commits ONE dispatch: base → `setProp`; override bucket → `setResponsive`;
  clear-override → `setResponsive` with `null`. A door rejection is caught per control, shown via
  `aria-describedby`, and provably changes nothing (SC-002).
- i3. Controls re-render from document changes (undo/redo/external) — the inspector holds no
  authoritative copy; a pruned selection returns it to the empty state.
- i4. Override markers show exactly where `responsive[bucket]` owns the key; an override equal to
  the base is still an override.
- i5. Focus-safe swaps: a control that owns focus keeps its resolved component until blur or
  selection change even if a better-matching field type registers meanwhile (R8).

## 5. PreviewMode (`components/PreviewMode/`)

```ts
interface PreviewModeProps {
  kernel: BuilderKernel;
  theme: Theme;
  /** View-state direction override; null = the document's own direction. */
  dirOverride?: ContentDirection | null | undefined;
  onExit: () => void; // Escape triggers this too
}
```

- p1. Renders the publish-safe path (CanvasFrame + DocumentView with NO attachment, NO chrome layer,
  NO editable wiring) — content live and interactive.
- p2. The direction override changes ONLY the frame rendering; `getDocument()` stays
  reference-identical and the log length unchanged across the whole round trip (SC-005).
- p3. Escape (frame or host) calls `onExit`; the composing surface restores editing chrome with the
  prior selection intact (the kernel was never touched).

## 6. EditorCanvas addition (additive)

```ts
interface EditorCanvasProps {
  // …005/006 contract unchanged…
  /** Preview frame width in px (device emulation); absent ⇒ full width. */
  frameWidth?: number | undefined; // centered; layout-only, no new hot paths
}
```

## 7. Lane-A proof contract (merge-blocking, counting only)

| Proof                       | Instrument                                | Assertion                                                                |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ |
| Transactions ≡ commits      | `transactions().length`                   | +1 per base/override/clear commit; +0 per rejection                      |
| Rejection surfaces          | control `aria-describedby`                | reason visible; document unchanged                                       |
| Bucket mapping              | table over widths incl. 767/768/1023/1024 | exact declared buckets                                                   |
| Override rendering          | canvas at bucket vs desktop               | override at bucket, base at desktop                                      |
| Runtime field swap          | registry version                          | custom control in, default back on dispose, no reload                    |
| Field failure containment   | throwing/rejecting field                  | that property falls back; panel intact                                   |
| Preview round trip          | tx count + document reference             | zero transactions; identity during flip; selection restored              |
| Law-S with the full surface | audit re-run                              | 1:1 pairing unchanged                                                    |
| Browser truth               | Chromium play()                           | inspector edit changes canvas text; device switch narrows the real frame |

## 8. Preset surface additions (`@craftkit/builder`)

```ts
export {
  DeviceBar,
  Inspector,
  PreviewMode,
  bucketForWidth,
  BUCKET_THRESHOLDS,
} from '@craftkit/builder-shell';
export type {
  DeviceBarProps,
  EditingBucket,
  InspectorProps,
  PreviewModeProps,
} from '@craftkit/builder-shell';
// surface.test.ts gains 'Inspector', 'DeviceBar', 'PreviewMode', 'bucketForWidth',
// 'BUCKET_THRESHOLDS'. Apps still import ONLY '@craftkit/builder'.
```

## 9. As-implemented records (implementation phase)

1. **Core ordering defect found and fixed (003 §15):** the B3a playground transaction counter
   exposed a latent B0 defect — `dispatch` notified the store BEFORE appending to the log, so
   log-derived uSES snapshots lagged one event behind (React checks snapshots synchronously inside
   the notification and bails out on "no change"). Every pre-B3a UI path masked it with a follow-up
   write (insert→select); inspector commits are single-write. Fix: log/history recorded before
   `store.write`. Regression: kernel-laws "log complete AT notification".
2. **`FieldControlProps` (internal):** the in-repo default controls accept `FieldProps` plus
   optional `controlId`/`describedBy`/`placeholder`; the row spreads the full object, so contributed
   components typed against plain `FieldProps` receive (and ignore) the extras.
3. **Inheritance display rule (i1 refinement):** text/number defaults express an inherited base as a
   PLACEHOLDER with an empty value; select/switch and contributed/readonly renderers receive the
   effective value (`override ?? base`) — a placeholder cannot express a choice control's state.
4. **Failure containment implementation (f3):** loader rejection → per-def failure record → default
   resolution; render throw → per-row error boundary reports up, the row records the failure and
   remounts the boundary (new key) around the default control. A throwing `match()` is treated as
   no-match (a broken contribution never breaks resolution).
5. **R8 lock unit:** the lock freezes the RENDERING (contributed id + loaded component vs default
   control kind), not just the resolution — so a lazy load completing mid-focus cannot swap the
   mounted control either.
6. **Frame shell (§6):** `frameWidth` narrows a `bldr-canvas-frame-shell` wrapper that contains BOTH
   the CanvasFrame and the overlay layer — chrome alignment under centering is by construction
   (shared origin), zero coordinate translation anywhere.

## 10. Review fixes (dual independent reviews, as-implemented)

Two read-only reviewers (kernel-laws lens; React/a11y lens) audited the B3a diff. Accepted findings,
all fixed with regression tests:

1. **C1 — the canvas renders the ACTIVE breakpoint**: `EditorCanvasProps.breakpoint` (additive)
   forwards to `DocumentView`; the composition derives it from the SAME bucket the inspector edits
   (`base → 'desktop'`). Proven through the real canvas (unit) and the playground scenario 7 (the
   editor frame shows the override being authored).
2. **H1 — Escape exits preview from anywhere**: PreviewMode focuses its region on mount and binds
   Escape at the HOST document for its lifetime (entering preview unmounts the focused trigger, so
   exit must not depend on focus landing). Scenario 7 now exits via Escape.
3. **H2a — structural labeling**: every control slot is wrapped in an implicit label carrying the
   property key — a contributed component that ignores `controlId` still has an accessible name; a
   contributed-field story puts that path under the catalog a11y gate.
4. **H2b — draft discipline for text/number defaults**: a local draft covers door-rejected states
   (an emptied `.min(1)` prop no longer snaps back mid-edit); the draft is seeded on first change
   (never focus) and dropped the moment an incoming value is not the draft's own commit —
   undo/redo/external writes always show through, even mid-focus (FR-003).
5. **M1 — per-def load cache**: contributed components cache by FieldTypeDef OBJECT identity in a
   module-level WeakMap (an id is a registry slot name, not a version identity): re-registered ids
   load their own component; the cache survives selection changes.
6. **M5 — inert loading interim**: while a contributed field loads, the row renders the default
   control DISABLED (f3 reserves the live default for FAILURE, not loading).
7. **M2/M4 — DeviceBar drafts + bucket-keyed rows**: a partially typed width never becomes device
   state (commit on blur/Enter — a transient "1" would have re-laid out the frame at 1px AND routed
   the next inspector edit into the mobile bucket); inspector rows key by `node:bucket:prop`, so
   rejections and drafts never leak across a bucket switch.
8. **Guarded clear**: all three commit paths (setProp, setResponsive, clear) share one guarded
   dispatch — door rejections are always caught, described, and announced (i2).
9. **Marker association**: the override marker joins the control's `aria-describedby` chain.
10. **Smaller accepted items**: shared `styles/visually-hidden.css` (one definition, imported per
    consumer); preview entry announced as a post-mount mutation ({text,nonce} pattern); render-throw
    fallback maps to the MATCHING default kind; `role="group"` on DeviceBar (toolbar semantics
    require roving focus it does not need); focus lock survives window blur (relatedTarget null
    while the control still owns document focus); `frameWidth` guarded (≥ 1, finite); playground
    reads the document dir through a subscribed snapshot; `useRegistryEpoch` reused from the
    renderer (no duplicated subscription wiring); `FieldProps`/`FieldTypeDef` types exported from
    the preset; unknown-block-type gets its own inspector message; stories:
    rejection/contributed/no-editable (Inspector), boundary-width custom play (DeviceBar), Escape +
    asserted exit (PreviewMode), DeviceWidth browser-truth (EditorCanvas), FieldControls catalog
    entry (the five defaults as ONE entry — recorded decision, they are a single library), story
    components hoisted to module scope, EditProps play unbounded (rerun-idempotent forever).

**Deferred with rationale**: choice-control override-equals-base stays a two-change gesture (the
spec edge case is about SEMANTICS — an equal override survives — which holds; a pin affordance is a
design addition for B3b+). Multi-id selection reduces to the first id (the shell's single-selection
law since B2a; documented). Preview has no device-width input by contract (recorded as a follow-up).
Store subscribers are expected not to throw (a throwing subscriber after the log/notify reorder sees
a COMMITTED transaction; isolation-with-reporting is a core follow-up, noted in 003 terms).
`InspectorRow`/`FieldErrorBoundary` are internal subcomponents of the Inspector folder documented
through the Inspector entry (recorded).

## 11. Convergence records (multi-agent audit + adversarial verification)

Five parallel auditors (US1+fields, US2+US3, US4+preview, laws+deps, artifact coherence) produced 10
raw findings; 8 deduped, each challenged by an adversarial refuter. One was REFUTED (the
full-surface Law-S audit — the artifacts themselves locate it in the playground scenario-7 counter,
which demonstrably ran as an audit: it caught the §9.1 core defect). The confirmed gaps, all closed:

1. **Pending-drag × preview-entry proof (US4 edge case)**: the T012 record was structurally true but
   unbacked — EditorCanvas now proves unmount mid-PENDING and mid-ACTIVE drag leaves zero
   transactions, zero chrome traces, and inert listeners (preview entry unmounts the canvas, so
   unmount-mid-session IS the edge case's mechanism).
2. **FR-010 preview EXIT announcement**: PreviewMode's own region unmounts with it, so the COMPOSER
   owns the exit announcement — the playground announces "Preview closed — back to editing." through
   a persistent polite region ("Mode") as a post-mount rAF mutation, and scenario 7 asserts it.
   Recorded here as the composing surface's contractual duty.
3. **§7 row 12 browser truth**: the merge-blocking Chromium proof "inspector edit changes canvas
   text" now exists (Inspector `EditWithCanvas` story: Inspector + EditorCanvas over one kernel,
   play() asserts the frame text follows the edit); quickstart row 12's stale attribution fixed
   (frame narrowing lives in EditorCanvas `DeviceWidth`).
4. **§10.H1 refinement**: the preview region focus runs ONCE on mount (own effect) — an `onExit`
   identity change (a fresh composer closure per render) no longer re-steals focus;
   regression-locked.
5. **`DeviceState` recorded**: the named public type `DeviceState { width; bucket }` (§3's inline
   shape) is exported from the shell and the preset surface — added to the §8 type list by this
   record.
