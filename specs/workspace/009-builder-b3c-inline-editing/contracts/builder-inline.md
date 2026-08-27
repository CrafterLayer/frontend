# Contract: Builder B3c Inline Editing & Floating Toolbars

Normative TypeScript as fenced blocks (001–008 precedent).

## 1. Declaration (`@craftkit/builder-schema`, additive)

```ts
interface BlockSchema<P extends z.ZodTypeAny = z.ZodTypeAny> {
  // …unchanged…
  /** Property key edited IN PLACE on the canvas; absent ⇒ not inline-editable. */
  inlineEditable?: string;
}
// d1. `defineBlockSchema` rejects an `inlineEditable` key that is not a property of `props`,
//     and one whose resolved kind is neither string nor rich text — a mis-declaration is a
//     registration-time error, never a runtime surprise.
// d2. Declaration is data: no package needs the shell or an engine to declare it.
```

## 2. Positioning (`shell/src/overlay/floating-position.ts`)

The bar is not "adequate" — it is feature-for-feature with a positioning library's middleware stack,
minus the parts our architecture makes unnecessary.

```ts
interface FloatingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface FloatingAnchor {
  box: FloatingBox;
  rects?: FloatingBox[];
}
interface FloatingPlacement {
  x: number;
  y: number;
  placement: 'above' | 'below';
  hidden: boolean;
  arrowOffset: number;
}

declare function positionFloating(input: {
  /** LAYER-LOCAL (= preview-local, 005 §1) — anchors never need conversion. */
  anchor: FloatingBox | FloatingAnchor;
  size: { width: number; height: number };
  /** The frame's box in HOST space — the ONLY reason host space is consulted. */
  frame: FloatingBox;
  viewport: { width: number; height: number };
  /** The frame's visible (scrolled) area in layer-local space. */
  visible?: { width: number; height: number };
  dir: 'ltr' | 'rtl';
  align?: 'center' | 'start';
  gap?: number;
  padding?: number;
  arrowSize?: number;
}): FloatingPlacement;
// p1. FLIP — prefer above, flip below when host space leaves no room, and when NEITHER side
//     fits take the side with more room. (GrapesJS clamps instead and covers its own content.)
// p2. SHIFT — slide along the inline axis with padding rather than snapping to an edge, so the
//     toolbar stays visually attached. `align: 'start'` mirrors under RTL;
//     `prefer: 'below'` seats the block action bar off the outline's name chip
//     (top-start is the chip's corner), flipping above at the frame's bottom.
// p3. PURE — no DOM, no globals, no time; every case table-testable (SC-004).
// p4. INLINE — a selection spanning LINES is many rects, not one union: above hugs the FIRST
//     line, below hugs the LAST. Placing against the union box is the tell of a naive bubble.
// p5. HIDE — an anchor scrolled out of the frame's visible area reports `hidden`, so a toolbar
//     never floats over content the user cannot see.
// p6. ARROW — the pointer keeps aiming at the anchor centre after a shift, clamped to the
//     toolbar's own corner range.
// NOT inherited from a library: an ancestor-walking auto-update loop. Invalidation is
// observer-driven through the rect index — strictly better than the 10 fps rect polling the
// prior art resorts to, and cross-frame correctness is ours by construction rather than by a
// frameElement walk (the exact area that needed four rounds of upstream patches).
```

## 3. Inline session (`shell/src/overlay/inline-session.ts`)

```ts
interface InlineSession {
  nodeId: NodeId;
  propKey: string;
  kind: 'text' | 'rich';
}
// s1. Entered by double-click on an inline-editable node, or Enter with it selected; entering
//     dispatches NOTHING.
// s2. Ended by Escape (selection kept), by selecting another node, or by the node vanishing —
//     always without a trailing commit.
// s3. VIEW state: never in the document, never in the kernel.
```

## 4. Editing surfaces

```ts
interface InlineTextSurfaceProps {
  value: string;
  onCommit: (next: string) => void; // ONE dispatch per commit — the door decides
  editable: boolean; // hover/focus gated (Safari drag-focus, webkit 112854)
}
// t1. VENDORED from Puck `InlineTextField` (MIT) — see vendor/VENDOR.md. Adapted: the upstream
//     per-keystroke store write is replaced by our door law; the value-sync guard
//     (write the DOM only when the incoming value differs from what is shown) is kept
//     verbatim in spirit — it is the caret-safety lesson.
// t2. Rich properties edit through the SAME B3b editor component (no second engine, still
//     lazily loaded, published path still engine-free).
```

## 5. Text bubble (`components/TextBubble/`)

```ts
interface TextBubbleProps {
  /** Layer-local anchor for the current selection, or null when there is none. */
  anchor: Box | null;
  actions: { id: string; label: string; pressed?: boolean; run: () => void }[];
}
// b1. Shown only for a NON-EMPTY selection inside a rich inline edit; hidden when the
//     selection collapses, editing ends, or the anchor leaves the frame viewport.
// b2. Cancels pointer-down so activation never moves focus out of the editor, and the canvas
//     click path ignores layer-origin clicks (risk 2/9 — otherwise Bold deselects the block).
// b3. Each action is ONE transaction and preserves the selection.
// b4. `shouldShow` + the selection→rect derivation are VENDORED LOGIC from TipTap's
//     BubbleMenu plugin (MIT, attributed); `posToDOMRect`/`isTextSelection` come from the
//     already-pinned `@tiptap/core` — no new package (research R2).
```

## 6. Block action bar (`overlay/block-actions.ts`)

```ts
// Registered through the EXISTING canvas-tool contribution point (`on: 'selection'`), so lazy
// load, exactly-once cleanup, error containment, and layer-only mounting are inherited (005 §4).
// a1. Actions: duplicate, delete, move earlier, move later, edit text (when declared).
// a2. Each is ONE transaction through the kernel door, announced, with the resulting selection
//     defined: the duplicate, the surviving sibling, the moved node.
// a3. An action that cannot apply (delete on the root, move at an edge) is ABSENT or DISABLED —
//     never a door failure.
// a4. Hidden for the duration of a drag session; restored on drop or cancel.
```

## 7. Canvas additions (`EditorCanvas`, additive)

```ts
// c1. `toHost` — the inverse of `toFrame`, the SECOND and last member of the one bridge; every
//     scale term (today none, tomorrow zoom) lives in this pair.
// c2. Gestures: double-click enters, Enter enters on the selected node, Escape exits.
// c3. Layer-origin clicks never reach the selection path.
```

## 8. Lane-A proof contract (merge-blocking, counting only)

| Proof                  | Instrument                                     | Assertion                                                                                                 |
| ---------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Enter/exit             | session state + `transactions().length`        | entering and exiting dispatch nothing                                                                     |
| Transactions ≡ commits | `transactions().length`                        | +1 per inline commit; canvas follows                                                                      |
| Document truth         | undo with a session open                       | surface and canvas both show the restored value                                                           |
| Bubble lifecycle       | anchor presence                                | shown on non-empty selection; hidden on collapse/exit/out-of-view                                         |
| Placement              | table over anchor/size/frame/viewport/dir      | prefer-above, FLIP at the top edge, clamped, RTL-mirrored                                                 |
| Action bar             | one action at a time                           | +1 transaction each, expected document change AND resulting selection                                     |
| Drag interplay         | session start/stop                             | bar hidden during drag, restored after                                                                    |
| Zero-render law        | `onBlockRender` counter on the stress document | 0 content renders for hover/select/scroll/toolbar positioning; exactly 1 node's subtree per inline commit |
| Engine containment     | loader invocation counter                      | 0 loads in sessions that never inline-edit rich text                                                      |
| Browser truth          | Chromium play()                                | enter-edit, format via the bubble, exit — inside the real frame                                           |

## 9. As-implemented records (US1)

1. **The edit boundary is declared, not hidden** (`NodeView`): the seam replaces the declared
   property's VALUE with a React element, so a block that renders `{props.heading}` renders the
   editor where the text lives — the field-transform idea from the vendored prior art, expressed
   through our own wrapper machinery. The stored type says `JsonValue`; at this one boundary, in
   edit mode only, it is an element. Scoped to one node, so exactly one subtree re-renders (proven
   by the render-scope test).
2. **React's synthetic events do not cross the frame** — a third instance of the same law (B2b
   keydown, B2b pointer routing). The inline surface attaches NATIVE listeners to its own element;
   an `onInput` prop would never fire for content portaled into the preview document. The upstream
   file uses native listeners for exactly this reason.
3. **`innerText` is unimplemented in jsdom.** The surface reads it when present and falls back to
   `textContent`, with the DOM type narrowed to say what is actually true — a real browser takes the
   first branch, the suite takes the second, both read the same string.
4. **The surface mounts LIVE.** A programmatic focus updates React state on the NEXT render, so a
   keystroke in that gap is dropped by a real browser — invisible in jsdom, caught by the Chromium
   story. `contentEditable` is therefore live on first paint; the Safari drag-focus guard (hover OR
   focus) applies from the first blur onwards.
5. **Enter reads kernel truth, not a render closure.** The gesture listener lives on the frame
   document and resolves the selection from the store at call time, so it can never act on a stale
   render.
6. **`userEvent` cannot type into `contenteditable="plaintext-only"`** (its guard accepts only
   `"true"`), so the browser-truth story fires the real `InputEvent` a browser fires and waits for
   React's batched update — what it proves and what it does not is stated in the story.

## 10. Live anchoring (`overlay/anchor-channel.ts`, `overlay/floating-host.ts`)

The two floating surfaces (§5, §6) need geometry that CHANGES — the anchor rect, the frame's own box
in host space, and the host viewport. Two small pieces supply it, and between them they are the
reason this milestone needs no auto-update loop.

```ts
interface AnchorSnapshot {
  block: FloatingBox | null;          // the selected node's rect (layer-local)
  text: FloatingAnchor | null;        // the inline editor's selection anchor (+ per-line rects)
  frame: FloatingBox;                 // host space
  viewport: { width: number; height: number };
  visible: { width: number; height: number };
}
createAnchorChannel({ index, bridge, schedule, onSnapshot }): AnchorChannel
  // setBlock(nodeId | null) · setText(anchor | null) · refresh() · dispose()

createFloatingHost({ layer, className?, align?, gap?, arrowSize?, ports? }): FloatingHost
  // element (React's portal target) · place(target) · reposition() · placement() · dispose()
```

**Why a channel rather than a poll.** The channel rides the rect index's existing `onInvalidate` —
element resize, content mutation, frame scroll, viewport resize, direction flip — and coalesces a
burst into ONE scheduled flush. The prior art polls rects at 10 fps precisely because it has no such
signal, and the library alternative walks scroll ancestors for the same reason (research R0/R2).
Nothing here polls, and `onSnapshot` is never called synchronously, so positioning stays on the
frame rhythm.

**Why a host rather than a styled component.** A floating bar has two halves that must not share a
rhythm: its CONTENT (which buttons, which are pressed) changes with the document and belongs to
React; its POSITION changes on every scroll and reflow and must never reach React. React portals the
toolbar into the host's element and never positions it; the host writes `transform` straight onto
that element, exactly as the outline chrome does. Scrolling a canvas with an open toolbar therefore
renders zero components (SC-002) — the property a bar that computes its style in render cannot have.

**Measured, never assumed.** The host observes its own element and re-places from the last input, so
a toolbar whose buttons change width re-centres, and the FIRST paint is correct: it stays hidden
while unmeasurable (0×0 before React paints) and lands measured when the size arrives. Placement
writes are rounded to whole pixels — a half-pixel transform blurs the text on every bar.

## 11. Inline editors are contributed, not imported (`inlineEditors`)

The shell is layer 3 and an editing engine lives at layer 4, so the canvas can never import one. It
resolves editors from the registry instead — a new contribution point, additive to the manifest and
lazy by the same contract every implementation-bearing point already uses:

```ts
interface InlineEditorDef {
  id: string;
  kind: 'text' | 'rich';
  load: () => Promise<{ default: ComponentType<InlineEditorProps> }>;
}
interface InlineEditorProps {
  value: unknown;
  label: string;
  onCommit: (next: unknown) => void; // ONE call per change
  onExit: () => void;
  onAnchor: (anchor: InlineSelectionAnchor | null) => void; // layer-local geometry
  onActions: (actions: InlineFormatAction[]) => void; // empty ⇒ no bubble
}
registry.inlineEditor(kind); // FIRST registration wins — extensions register topologically
```

**The split this encodes.** The editor owns SEMANTICS — which marks exist, whether they are active,
how to toggle them, where the selection is. The canvas owns CHROME — it draws the same bubble
whoever contributed the editor, positions it, and hides it. That is why a contributed editor renders
no toolbar of its own, and why the shell needs no knowledge of any engine.

**Consequences, each with a proof:**

- A kind nobody can render never opens a session (`canEdit`), so the gesture is inert rather than
  opening an empty editor. Plain text is the canvas's own surface; every other kind needs a
  contribution.
- Asking the registry costs nothing, because the def carries a loader rather than a component — the
  containment law (SC-005): a session that edits no rich text loads no engine, counted mechanically.
- The load is keyed by kind and kept, so reopening the same kind costs nothing, and an editor loaded
  for another kind is simply not this session's editor (derived at render, never cleared by an
  effect).
- A contributed editor for `'text'` outranks the built-in surface, which is what makes the built-in
  a default rather than a special case.

## 12. The edit boundary reaches the BLOCKS (`inlineEditable` on the shipped vocabulary)

Declaring `inlineEditable` is what makes a block editable at all, so B3c also declares it across the
shipped vocabulary: `hero`/`features`/`pricing`/`testimonials` → `heading`, `richText` → `content`.

**`cta` is deliberately NOT declared.** Its `label` is the content of a `<button>`, and a button is
not a text container — Chromium will not place a caret inside one. Declaring it would ship a gesture
that silently does nothing, so the CTA's label stays an inspector property. Asserted, so a later
"completeness" pass cannot add it back without reading the reason.

Doing that exposed a real defect the milestone had to fix. Four of those blocks named their section
with `aria-label={props.heading}` — a second copy of text that is already visible. The seam swaps
the declared property for a React **element**, and an element in `aria-label` stringifies to
`"[object Object]"`: the moment an editor opened, the section would announce that to a screen
reader. The fix is the structurally correct one — the accessible name now comes from the visible
heading via `aria-labelledby`, which is both better a11y and immune to the swap. The guard is
mutation-verified: restoring `aria-label={props.heading}` fails
`names sections from the VISIBLE heading, never a second copy of its text`.

A second block failed the same way for a different reason: `richText` passes its declared property
to a component (`<RichText value={props.content} />`) rather than rendering it, so the seam's
element would never have reached the DOM — the editor would have opened into nothing. It now renders
the element directly when it is one, and reads the stored document otherwise. Also
mutation-verified.

**The general law**, in two halves:

1. A block's declared inline property must be rendered as CONTENT. It may not be passed to an
   attribute, an accessible name, a `title`, or anything else that stringifies — in edit mode its
   value is an element.
2. If the block hands that property to a component instead of rendering it, the block must render
   the element itself when it receives one.

**And the gesture must be possible.** Declaring a property whose text lives inside a non-editable
host (a `<button>`, an `<option>`, an `<img alt>`) ships a double-click that does nothing. The
declaration is a claim that the property is editable IN PLACE; where it is not, the inspector is the
honest answer.

## 13. One chrome at a time (the double-chrome defect)

Field report (screenshots, 2026-08-26): with an inline session open, the edited paragraph carried
THREE stacked chromes — the canvas selection outline, its name label, and the editing surface's own
focus ring — and the formatting bubble collided with the name label. An emptied block under all of
that read as a broken empty box. Separately, the FormattingBubble story's demo "Bold" action
appended literal `*` characters to the document — a demo that vandalises the text it demonstrates.

**The law**: while a block's text is open for editing in place, the editing surface's focus ring is
the ONLY chrome on that block. The selection outline and its label stand down (a class on the
overlay layer — `bldr-overlay--editing` — so the hot path is untouched; `display`, not `visibility`,
because the controller writes visibility inline and must win the moment the session ends). The
action bar already stood down (§7); the bubble is now the only floating surface over an edit.

**And demo actions are honest**: a story's formatting toggles style the demo text visually and write
NOTHING to the document — a plain string prop cannot store formatting, so a demo that mutates the
text is a lie that looks like a bug. One-transaction-per-action is proven where formatting is real
(acceptance suite, the rich editor's suite, playground scenario 9); the story asserts the DOCUMENT
and the transaction log are untouched by a demo toggle.

Proofs: jsdom (`the selection chrome STANDS DOWN while the text is edited in place`) and Chromium
(the InlineEditing and FormattingBubble plays assert the outline is not visible during an edit, and
the FormattingBubble play asserts zero new transactions and unchanged text after a toggle).

## 14. The stale-echo protocol (a REAL browser race, found by the Chromium gate)

The Commit Law story failed only in Chromium: insert, then delete — the count reached +2 and the
text kept the insertion. jsdom's `act()` had hidden a genuine race in the B3b reconcile: with TWO
commits in one frame (fast typing; a bubble action right after a keystroke), React can run the
reconcile effect for the EARLIER value after a newer emission exists. A reconcile that remembers
only "the last emission" reads that stale echo as an external write and re-seeds the editor
BACKWARDS — a caret teleport that eats the newest change.

**The protocol** (`RichTextEditor`): the editor keeps a ring of its UN-ACKNOWLEDGED emissions
(canonical JSON, oldest→newest) plus the identity of the last reconciled `value`. Each reconcile
classifies by two signals — is the incoming value one of ours, and did the value's identity change
(an accepting host hands back a NEW object; a refusing host hands back the same one):

| incoming is…        | identity  | action                                                           |
| ------------------- | --------- | ---------------------------------------------------------------- |
| the NEWEST emission | —         | settled; prune acknowledged history                              |
| an OLDER emission   | changed   | STALE ECHO: skip (never re-seed backwards) + one deferred re-run |
| an OLDER emission   | unchanged | the door REFUSED the newer commit: re-seed to truth              |
| not ours            | —         | external write (undo/redo/collab): re-seed                       |

The deferred re-run closes the one ambiguity: a kernel undo landing between an emission and its echo
LOOKS like a stale echo. Skipping first means typing never teleports; the re-run one beat later sees
the same value with its identity unchanged — now it is document truth — and re-seeds.

Proofs, all mutation-verified (collapsing the ring to a single string fails both):
`a STALE echo of an older commit never re-seeds the editor backwards` and
`an external revert that RESEMBLES a stale echo still wins, one beat later`; the B3b refusal
regression still passes; the Commit Law story now passes in Chromium.

**Convergence item (T022):** editor-LOCAL undo (Ctrl+Z inside an inline rich edit) versus kernel
history — decide and pin the intended semantics; the Commit Law story deliberately no longer
exercises it.

## 15. The BUILT-IN rich surface (`InlineRichSurface`) — no engine required

Field report (2026-08-26): the canvas story's "Bold" styled the WHOLE paragraph, then — after that
was removed — did nothing at all. Both were symptoms of the same design hole: the shell had no rich
editor of its own, so its demo faked one. A builder whose headline feature only works when an
optional package is installed is not a builder.

`InlineRichSurface` closes it. It is the built-in path for `inlineEditable` properties whose kind is
rich: **select a word, press Bold, and exactly that word is marked and STORED** — no editing engine
anywhere.

```
inline/mark-range.ts   pure, no DOM   richTextLength · plainTextOf · isMarkActive · toggleMark · replaceRange
inline/dom-range.ts    DOM only       offsetsOfSelection · applyOffsets · rangeGeometry
components/InlineRichSurface/         renders via the renderer's RichText; reports selection + actions
```

**The offset model** (the reason the mapping is exact rather than approximate): document text
offsets are the concatenation of every text node in document order, with no separator characters
between blocks — which is precisely what `textContent` yields for the rendered document.

**Controlled contenteditable.** Every input is intercepted at `beforeinput` (native listener — this
surface is portaled into the frame, where React's synthetic events never reach) and applied to the
DOCUMENT; the browser's own mutation is refused. React stays the single authority over the DOM, so
stored truth can never drift from what is on screen. The caret is restored by offset in a layout
effect after each commit, which is what makes typing feel continuous through a round trip to the
kernel and back.

**Precedence.** A contributed editor (§11) still outranks the built-in wherever an extension
registers one — that is the upgrade path for headings, lists, links, and engine-level undo. With
this surface in place, `canEdit` no longer gates on a contribution: every declared property is
editable out of the box, and the gesture is never inert.

**Deliberate limits**, each stated in the component's docs: bold and italic only; no composition
(IME) — those inputs are refused rather than allowed to corrupt the document; no editor-local undo
(undo is the kernel's, one transaction per change); paste inserts plain text.

**Proofs.** jsdom cannot make a real selection or lay anything out, so the pure cores carry
exhaustive unit suites (including the anti-fragmentation guard: toggle on then off returns a
document deep-equal to the original) and the headline behaviour is proven in Chromium — the canvas's
`FormattingBubble` story selects one word, presses Bold, and asserts a `<strong>` whose text is
exactly that word, the paragraph's text unchanged, and exactly one new transaction.

## 16. The offset model is UNAMBIGUOUS (block separators)

The first cut of §15 defined offsets as the concatenation of every text node with no separators —
"exactly what `textContent` yields", which made DOM↔document mapping trivial. Adversarial
verification refuted it: the end of paragraph 1 and the start of paragraph 2 are then the SAME
number, both modules resolved it leftwards, and **typing at the visual start of a paragraph inserted
into the previous one**.

The model now carries ONE separator position between adjacent inline containers:

```
doc(para('ab'), para('cd'))
  offsets:  0 a 1 b 2 | 3 c 4 d 5      richTextLength = 5      plainTextOf = 'ab\ncd'
                      ^ separator (position 2 = end of p1, 3 = start of p2)
```

Consequences, each tested in BOTH modules against the same fixture so they can never drift:

- a caret at a block's end and one at the next block's start are DIFFERENT offsets, so typing lands
  where the user is visibly standing;
- deleting a range that spans a separator MERGES the blocks (the survivor keeps the first block's
  type) — which is exactly Backspace-at-paragraph-start;
- marks never apply to a separator; toggling across one marks the text on both sides and leaves the
  block structure alone;
- an empty document has length 0, and offset 0 is a real, addressable caret position.

## 17. What adversarial verification caught (and why it was worth it)

Two multi-agent passes — build, then three adversarial lenses per module (correctness, robustness,
test quality), then fix-and-independently-re-confirm — turned up **21 confirmed defects** in code
whose own suite was 100%-covered and green. The ones that would have reached a user:

| Defect                                                                                      | Symptom                                                                                    |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `everyRunCarries` demanded that ZERO-LENGTH runs carry the mark                             | `isMarkActive` false on fully-bold text ⇒ **Bold could not be turned off**                 |
| `replaceRange` stranded a `listItem` with no opening paragraph                              | the produced document FAILS the write door ⇒ the edit is silently lost                     |
| block-boundary offsets resolved leftwards                                                   | typing at a paragraph's start inserted into the previous paragraph                         |
| an empty document had no addressable position                                               | `beforeinput` went unhandled ⇒ the raw contenteditable mutated the DOM behind the document |
| `rangeGeometry` measured from the previous block at a boundary                              | the bubble anchored to the wrong block                                                     |
| `lineRectsOf` trusted `getClientRects()`'s return value                                     | TypeError when it returns null                                                             |
| `toggleMark`/`replaceRange` typed a non-nullable return but passed unreadable input through | a caller trusting the signature dereferences null                                          |

Test-quality lenses also found guards that were not guards: the depth ceiling was unpinned (any
value from ~5 to ~80 passed), and `rangeGeometry`'s clamps were untested in both directions.

**The lesson to carry forward**: coverage and a green suite say nothing about whether the tests
would FAIL if the behaviour broke. Every fix above ships with a regression test that was
mutation-checked — re-broken deliberately, observed failing, then restored.

### 17.1 Known parity gaps (recorded, not fixed)

Two LOW findings from the confirm pass are documented rather than fixed, because both require a
document the write door cannot produce:

1. **Unknown block holding BOTH text and a nested block** — `dom-range` counts the nested block's
   text, `mark-range` does not. Unreachable through the door (no such node type is storable).
2. **A whitespace-only text node directly under the editing root, between two blocks** — the DOM
   side would treat it as its own container and add a phantom separator. React does not emit such
   nodes between elements, so the rendered surface never contains one.

Both are parity notes for whoever extends the block vocabulary; neither is reachable from the
builder's own read/write path today.
