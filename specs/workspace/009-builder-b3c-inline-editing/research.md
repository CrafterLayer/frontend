# Research: Builder B3c Inline Editing & Floating Toolbars

Prior-art study FIRST, then decisions. User direction (2026-08-26): study Puck and GrapesJS and
adopt what they proved rather than inventing; vendor code, never npm-depend it. Every claim below
was read in the upstream source at the stated path.

## R0 — What the prior art actually does

### Puck (`puckeditor/puck`, core v0.23.0)

| Concern                        | How                                                                                                                                                                                                                                                                                                                                                                                      | Verdict for us                                                                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inline text                    | `packages/core/components/InlineTextField/index.tsx` — a `<span contentEditable="plaintext-only">` swapped in by a FIELD TRANSFORM (`lib/field-transforms/default-transforms/inline-text-transform.tsx`) when the field config sets `contentEditable`. Config-driven, zero per-block code.                                                                                               | **ADOPT the shape** (our FR-001 declaration is the same idea) and **VENDOR the file**                                                                                                                 |
| Caret safety                   | Writes the DOM only when the external value differs: `if (safeValue !== ref.current.innerText) ref.current.replaceChildren(safeValue)`                                                                                                                                                                                                                                                   | **VENDOR** — the same lesson as B3b review fix 13                                                                                                                                                     |
| Safari/drag                    | `contentEditable` enabled only while hovered/focused, because Safari focuses contenteditables during drag (webkit 112854)                                                                                                                                                                                                                                                                | **VENDOR** — our nodes carry drag machinery too                                                                                                                                                       |
| Commit                         | Raw `input` listener → store write **per keystroke**                                                                                                                                                                                                                                                                                                                                     | **REJECT** — floods undo; B3b's "one onUpdate ⇒ one onChange" law replaces it                                                                                                                         |
| Selection overlay + action bar | Portaled INTO THE IFRAME BODY (`DraggableComponent` L273-280, L762-838); position kept in React state; invalidation = rAF sync + ResizeObserver + capture-scroll **+ a 10 fps polling loop comparing rects with a 0.5px epsilon** (`MEASURE_EVERY_MS = 100`) because transforms fire no event; overflow handled by clamping with `transformOrigin` hacks and magic numbers — **no flip** | **REJECT** — violates our g4 (tools mount into the layer, never the frame) and FR-008 (flip). Our observer-driven RectIndex (incl. the structural MutationObserver) already covers what they poll for |
| Interactive islands            | `registerOverlayPortal` + capture-phase `mouseover`/`pointerdown` stop-propagation + a 200 ms post-focus `setTimeout` (a confessed hack)                                                                                                                                                                                                                                                 | **Instructive** — our layer keeps `pointer-events: none` with `auto` only on the toolbars; risk 9 below                                                                                               |
| Rich text                      | TipTap v3 (16 direct `@tiptap/*` deps); the formatting menu renders **inside the block action bar**, lazily (`RichTextMenu`), one live editor at a time                                                                                                                                                                                                                                  | Confirms lazy containment; we still want a real selection bubble (US2)                                                                                                                                |

### GrapesJS (`GrapesJS/grapesjs`, master)

- **The toolbar lives in the HOST document**: `rich_text_editor/index.ts` `postRender()` appends it
  to `canvas.getToolsEl()` — the same architecture as our overlay layer. Independent confirmation
  that host-side chrome over an iframe is the right shape.
- **Positioning** hand-folds frame offset, frame scroll, and zoom per axis (`canvas/index.ts`
  `canvasRectOffset` L384-406, `getTargetToElementFixed` L415-430), always places above
  (`top = -targetHeight`) and then **clamps** — so at the canvas top the toolbar covers the
  component. A long-standing complaint; the `rteToolbarPosUpdate` event exists purely so users can
  redo the math. **This is the mistake FR-008 exists to avoid.**
- **Invalidation is event-driven, no polling**: `canvas refresh + frame:scroll + component update`,
  subscribed on enable and unsubscribed on disable. Validates our RectIndex channel model.
- **Commit on EXIT, not per keystroke**: `ComponentTextView.disableEditing` diffs against
  `lastContent` then `resetFromString`. Engine is pell/`document.execCommand` — deprecated, their
  own #1 pain point and the reason `customRte` exists.
- **Nothing to vendor** (Backbone-coupled); the value is architectural.

### TipTap BubbleMenu v3.30.x (`extension-bubble-menu/src/bubble-menu-plugin.ts`)

- Uses `@floating-ui/dom` (`^1.0.0`) with flip/shift/offset/size/hide middleware.
- Anchor is a virtual element from `posToDOMRect(view, from, to)` — **and never sets
  `contextElement`** (verified L303-369). floating-ui can only walk the `frameElement` chain from a
  real element or a `contextElement`, so a frame-local rect handed to a host-document floating
  element is **wrong by the frame offset**. floating-ui's own iframe support arrived piecemeal (dom
  CHANGELOG 1.5.2, 1.5.3, 1.6.3, 1.6.9).
- **No `autoUpdate`**: hand-rolled invalidation — transaction handler debounced 250 ms (a visible
  lag users complain about), `window` resize, and ONE `scrollTarget` (default `window`; the option
  exists because scroll containers kept breaking it), plus a `setMeta(pluginKey,'updatePosition')`
  escape hatch.
- Bare `document`/`window` globals (`document.activeElement` at L212, `window` at L390/L409) — the
  exact bug class a cross-document mount hits, and one jsdom cannot catch.
- Registry: `@tiptap/extension-bubble-menu@3.30.3` (published 2026-08-24) pulls
  `@floating-ui/dom@1.8.0` (published 2026-07-11) + `@floating-ui/core` + `@floating-ui/utils`.
  `@tiptap/react` does NOT include it.

### Plate (`udecode/plate`) — floating-ui done right

`useVirtualFloating` = `useFloating({ whileElementsMounted: autoUpdate })` over a controlled virtual
element. Same-document only. Its `useFloatingToolbar` encodes the state subtleties every
implementation hits (wait-for-collapsed-selection on refocus, mousedown tracking, click-outside) —
**we steal those as test cases**, not as code.

## R1 — Decision: what to vendor, reuse, and write

**VENDOR** (pinned-commit copies, first vendor entries in this repository — they create `VENDOR.md`
and `THIRD_PARTY_LICENSES.md`):

1. `puck/packages/core/components/InlineTextField/index.tsx` (MIT) → the plain-text inline surface.
   Adapted: its per-keystroke store write is replaced by our door law; everything else (value-sync
   guard, `plaintext-only`, hover/focus gating, empty-value coercion) is why we copy rather than
   rewrite.
2. TipTap BubbleMenu **logic, not the file** (MIT): the `shouldShow` default (empty selection /
   empty text block / menu-owns-focus) and the selection→rect derivation including NodeSelection
   handling. `posToDOMRect` and `isTextSelection` come from the ALREADY-PINNED `@tiptap/core` — no
   new package.

**REUSE our own machinery** (the bulk of the milestone):

- `shell/src/rects/rect-index.ts` — the action-bar anchor IS `index.rect(selectedId)`; its
  invalidation channels already exceed Puck's polling and match GrapesJS's event set.
- `shell/src/overlay/overlay-controller.ts` rhythm — mark-dirty → one rAF flush, read-then-write,
  direct DOM transforms. Both toolbars are new occupants of the layer; zero React on the positioning
  path keeps FR-009 true by construction.
- `shell/src/overlay/tool-host.ts` — the block action bar is a `'selection'` canvas tool (lazy load,
  exactly-once cleanup, error containment, layer-only mounting all come free), and its actions
  dispatch through the kernel door, so FR-007's one-transaction law is inherited.
- The ONE host↔frame bridge (`EditorCanvas.tsx` `toFrame`, 006 §3) — gains its inverse `toHost`.
  Note the happy accident: layer-local coordinates ARE preview-local (005 §1), so anchors need no
  conversion at all; only the FLIP decision needs host-viewport awareness. That is `toHost`'s only
  consumer, and every future scale term (zoom) belongs in that pair.
- B3b's `RichTextField` and its commit law — the inline rich surface is the SAME editor component in
  different chrome, so the engine stays lazily loaded and singly owned.

**WRITE FRESH** (small and provably ours):

- `positionFloating(anchor, size, frame, viewport)` — a pure function: prefer above, FLIP below when
  the anchor's host-space top leaves no room, clamp on the inline axis, RTL-aware logical placement.
  ~100 lines + a table-driven suite (SC-004). This is floating-ui's job in the general case; our
  case is one boundary, fixed-size toolbars, and pre-clipped anchors — and GrapesJS's actual failure
  was _no flip at all_, not hand-rolled math.
- Selection-rect channel: editor `selectionUpdate` → `posToDOMRect` → frame-local rect handed to the
  shell through the field-extras seam.
- Inline edit session state (node/prop/kind; Enter/Escape/blur lifecycle) — no prior art fits our
  kernel model.
- The renderer seam that swaps a declared prop's output for the editing surface on exactly ONE node
  (Puck's field-transform idea, expressed through our wrapper machinery so only that node's subtree
  re-renders).

## R2 — Rejected: adding `@floating-ui/dom`

FR-013 forecloses it ("B3c adds nothing to the dependency catalog"), and the cost/benefit is poor
HERE: two catalog entries plus three installed packages to buy `flip`/`shift`/`autoUpdate` against
arbitrary clipping ancestors — none of which we have. If FR-013 were ever renegotiated, the correct
shape would be `@floating-ui/dom` as a **catalog dependency, not a vendor copy** (it is maintained,
iframe-patched geometry code; vendoring it would be the worst of both worlds). Recorded so the
option is a decision, not an oversight.

## R3 — Risk register (specific failure modes prior art actually hit)

1. **Frame-offset-blind positioning** — TipTap's default virtual element across a frame. Defense:
   anchors never leave layer-local space; only the flip decision crosses, through `toHost`.
2. **Toolbar clicks destroy the selection** — every implementation defends (TipTap `preventHide`,
   GrapesJS mousedown stopPropagation, our own B3b review fix 11). The bubble cancels pointer-down
   AND the canvas click handler must ignore layer-origin clicks, or Bold deselects the block.
3. **Clamp instead of flip covers the content** — GrapesJS at the canvas top; Puck's
   `transformOrigin` hacks. SC-004's table MUST include anchor-at-frame-top and RTL.
4. **Missed invalidation ⇒ stale bubble** — TipTap's single `scrollTarget`; Puck's 10 fps poll.
   Ours: RectIndex covers the frame side; host scroll/resize re-checks the flip only; the bubble
   hides when its anchor leaves the frame viewport (US2/AC3).
5. **Per-keystroke commits** (Puck) — breaks transactions ≡ commits and floods undo.
6. **Caret yank on your own echo** — Puck's value-sync guard and B3b review fix 13 are the same
   lesson: never rewrite the editable DOM for a value you just emitted.
7. **Safari focuses contenteditables during drag** (webkit 112854) — gate editability on
   hover/focus, exactly as Puck does, because our nodes carry drag handlers.
8. **Bare-global cross-document bugs** live in the ENGINE (TipTap L212 `document.activeElement`).
   jsdom cannot catch them: SC-006's Chromium stories must exercise enter-edit / format / exit
   inside the real frame.
9. **Overlay passthrough vs interactive chrome** — Puck needed `registerOverlayPortal` plus a 200 ms
   hack. Our layer stays `pointer-events: none` with `auto` on the two toolbars only, and the
   tool-host click path must not re-enter `setSelection`.
10. **Zoom later** (B3a device widths → future zoom) — Puck divides, GrapesJS multiplies, both
    smeared across files. Every scale term stays inside the `toFrame`/`toHost` pair.
