# Vendored code

Third-party builder code is **vendored, never depended on** (standing workspace decision):
copied here from a pinned commit with its license and provenance, and adapted deliberately
inside our own packages. Nothing under `vendor/` is compiled, linted, bundled, or imported —
these files exist so the derivation is auditable.

License texts: [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## puck — inline text editing on the canvas

| | |
| --- | --- |
| Upstream | [puckeditor/puck](https://github.com/puckeditor/puck) |
| File | `packages/core/components/InlineTextField/index.tsx` |
| Commit | `84e1764016d6c7fbb7dc5653c384de74fbd3e667` (2026-08-21) |
| License | MIT — `vendor/puck/LICENSE` |
| Verbatim copy | `vendor/puck/InlineTextField.upstream.tsx` |
| Adapted into | `packages/builder/shell/src/components/InlineTextSurface/` |

**Why vendored rather than reimplemented**: the file encodes three behaviors that are cheap to
copy and expensive to rediscover —

1. **Caret-safe value sync**: write the editable DOM only when the incoming value differs from
   what is displayed (`if (safeValue !== ref.current.innerText) ref.current.replaceChildren(...)`).
   Rewriting the DOM for your own echo resets the caret mid-typing.
2. **Safari drag-focus defense**: `contentEditable` is `"plaintext-only"` only while hovered or
   focused, because Safari focuses contenteditables during a drag
   ([webkit 112854](https://bugs.webkit.org/show_bug.cgi?id=112854)). Our nodes carry drag
   machinery too, so the same hazard applies.
3. **Nullish coercion**: `replaceChildren` stringifies non-Node arguments, so an unguarded
   `null`/`undefined` renders the literal text `"null"`.

**What we changed in the adaptation** (and why):

- **Commit law**: upstream writes the store on every `input` event. Ours dispatches through the
  kernel door with the workspace's one-transaction-per-commit law, so undo granularity and the
  `transactions ≡ commits` gate hold.
- **No Puck store/portal coupling**: `useAppStoreApi`, `resolveAndReplaceData`, `setDeep`,
  `getSelectorForId`, `registerOverlayPortal`, and `getClassNameFactory` are replaced by props
  and our own overlay conventions.
- **Selection**: upstream sets its own UI selector on click-capture; ours leaves selection to
  the canvas's existing kernel-selection path.
- **Styling**: CSS modules replaced by our `--bldr-*` token stylesheet.

## tiptap — bubble-menu logic (logic only, no file copied)

| | |
| --- | --- |
| Upstream | [ueberdosis/tiptap](https://github.com/ueberdosis/tiptap) |
| Reference | `packages/extension-bubble-menu/src/bubble-menu-plugin.ts` (v3.30.x) |
| License | MIT — see THIRD_PARTY_LICENSES.md |
| Adapted into | `packages/builder/extensions/richtext/src/InlineRichText/` |

Two ideas are reimplemented from the upstream plugin, with attribution in the adapting file:
its default `shouldShow` predicate (hide on empty selection, on an empty text block, and while
the menu itself owns focus) and its selection→rect derivation (`posToDOMRect`, with the
node-selection special case). No code is copied and **no package is added**: `posToDOMRect` and
`isTextSelection` already ship inside the pinned `@tiptap/core@3.30.3`.

The extension's own dependency (`@floating-ui/dom`) is deliberately NOT adopted — see
`specs/workspace/009-builder-b3c-inline-editing/research.md` R2 for the decision and the
conditions under which it would be revisited.

## aceternity — the aurora background

| | |
| --- | --- |
| Upstream | [Aceternity UI](https://ui.aceternity.com/components/aurora-background) |
| License | MIT — `vendor/aceternity/LICENSE` |
| Verbatim copy | `vendor/aceternity/AuroraBackground.upstream.tsx` |
| Adapted into | `packages/builder/extensions/aceternity/src/components/AuroraBackground/` |

**Why vendored rather than depended on**: Aceternity ships as a copy-paste catalog, not a package.
There is nothing to depend on, which makes it the clearest possible case for the standing rule.

**What we changed in the adaptation** (and why):

- **The palette.** Upstream hard-codes Tailwind's own colours into the gradient — `--blue-500`,
  `--indigo-300`, `--violet-200`. Copied as-is, every generated site would have carried the same
  blue aurora regardless of its brand, at the top of the page where people look first. The gradients
  are rewritten in terms of `--t-*`, so the effect follows the generated design system.
- **The form.** Upstream expresses the whole effect as Tailwind arbitrary values
  (`[--aurora:repeating-linear-gradient(...)]`, `[background-size:300%,_200%]`, `blur-[10px]`).
  Arbitrary values are exactly what this project refuses to store, and a block whose implementation
  is a wall of them cannot honestly be described as token-bound. The gradients live in one
  stylesheet instead.
- **The engine.** Upstream's sibling components reach for `framer-motion`. This one does not need
  to, and staying engine-free is what lets a published page render the effect without downloading
  anything.
- **Height units.** `h-[100vh]` becomes `min-h-[100svh]`: on a phone `100vh` excludes browser
  chrome, so a full-height hero sits under the address bar until the user scrolls.
- **Reduced motion.** Upstream has no `prefers-reduced-motion` handling. Ours stops the drift and
  keeps the gradient — removing the effect entirely would cost the section its identity for no
  accessibility gain.

## magicui — the shine border

| | |
| --- | --- |
| Upstream | [Magic UI](https://magicui.design/docs/components/shine-border) |
| License | MIT — `vendor/magicui/LICENSE` |
| Verbatim copy | `vendor/magicui/ShineBorder.upstream.tsx` |
| Adapted into | `packages/builder/extensions/magicui/src/components/ShineBorder/` |

**Why vendored rather than depended on**: Magic UI ships as a copy-paste catalog, like Aceternity.
There is nothing to depend on.

**What we kept verbatim, because it is the reason to vendor at all**: the mask-composite trick that
paints a gradient on the BORDER only. Two masks — one clipped to the content box, one to the whole
box — composited with `exclude` cut the fill out and leave the ring. Four lines, and genuinely
annoying to rediscover. Both the prefixed and unprefixed spellings ship, because WebKit still wants
the prefix.

**What we changed in the adaptation** (and why):

- **Numbers became named steps.** Upstream takes `borderRadius={8}`, `borderWidth={1}`,
  `duration={14}`, `color="#000000"`. Every one is a literal a theme cannot move — a black shine on
  a terracotta brand, an 8px radius on a page whose corners are 12. `weight` now resolves to
  multiples of `--t-border-width`, `speed` to a duration the stylesheet owns, and the gradient reads
  `--t-accent` and `--t-success`.
- **Arbitrary values became a stylesheet.** Upstream carries the whole effect in
  `before:[background-image:--background-radial-gradient]` and friends. Arbitrary values are exactly
  what this project refuses to store, and a block whose implementation is a wall of them cannot be
  described as token-bound.
- **Reduced motion.** Upstream guards with `motion-safe:` on the animation only. Ours stops the
  travel and keeps the ring — losing the border entirely would cost the element its identity for no
  accessibility gain.

## use-stick-to-bottom — the agent thread's scroll follow

| | |
| --- | --- |
| Upstream | [stackblitz-labs/use-stick-to-bottom](https://github.com/stackblitz-labs/use-stick-to-bottom) |
| File | `src/useStickToBottom.ts` (v1.1.6) |
| Commit | `8d6a19a0ca6ab632830588073e6a29312a06a088` (2026-06-04) |
| License | MIT — `vendor/use-stick-to-bottom/LICENSE` |
| Verbatim copy | `vendor/use-stick-to-bottom/useStickToBottom.upstream.ts` |
| Adapted into | `apps/playground/src/features/agent/hooks/stick-to-bottom/use-stick-to-bottom.ts` |

**Why vendored rather than reimplemented**: the v1 panel scrolled the thread to the bottom on every
progress tick, which yanked a reader who had scrolled up (SPEC §4.4). Telling the reader's scrolls
from the thread's own is the whole problem, and upstream has already paid for the edge cases:

1. **Its own scrolls are marked** (`ignoreScrollToTop`), so an animation frame is never mistaken for
   the reader moving.
2. **A scroll event can arrive before the ResizeObserver's**, so the escape decision waits a tick,
   and the content's own growth (`resizeDifference`) never counts as the reader scrolling.
3. **Wheel-up releases at once**, because a browser cancels a wheel scroll that an animation frame
   overwrites; waiting for the scroll event would fight the reader.
4. **A spring that accumulates sub-pixel steps** until they move the thread a whole pixel, which is
   what makes the follow smooth when the browser snaps `scrollTop` to device pixels.
5. **Selecting text with the button held** is never yanked.

**What we changed in the adaptation** (and why). Reverting either of the first two to upstream's
code fails the adapted tests: five reduced-motion tests, and two wheel tests.

- **Reduced motion.** Upstream has none. Under `prefers-reduced-motion: reduce` every scroll the
  hook makes is `instant`: the first follow, each follow on growth, and an explicit
  `scrollToBottom('smooth')` (the jump pill). The query is read when a scroll starts, so an OS
  setting changed mid-session applies to the next scroll.
- **The wheel check.** Upstream releases only when the nearest ancestor whose computed `overflow`
  is exactly `auto` or `scroll` is the thread. The thread clips inline overflow, and
  `overflow-x: hidden; overflow-y: auto` computes to the shorthand `hidden auto`, so upstream walks
  past it and never releases. Ours asks whether an element between the pointer and the thread can
  still scroll up: if one can, the wheel is its; otherwise the wheel moves the thread and the
  follow is released. (An inner scroller already at its top chains to the thread, which upstream
  also missed.)
- **`scrollToBottom()` clears `escapedFromLock`.** Upstream set `isAtBottom` but left the escape
  flag set, because the scroll events of its own animation are ignored; the flag then kept saying
  "scrolled away" while the thread sat at the bottom following.
- **`isScrolled`**, new: the thread is scrolled away from its top, which is when the header draws
  its hairline (SPEC §2.5).
- **Out of React.** Upstream's hook body mutates a `useMemo` object and writes a ref during render,
  both of which the React Compiler lint rules reject. The logic now lives in a plain controller made
  once in a lazy `useState`, React holds only the four booleans a component renders, and the ref
  callbacks and actions keep one identity for the component's life. The `state` object is no longer
  returned, since reading it in render would be the same violation.
- **Options are read live.** Upstream's `calculatedTargetScrollTop` closed over the first render's
  options, so a later `targetScrollTop` was ignored.
- **Mouse tracking is installed on first use**, not at import: upstream adds `document` listeners as
  a module side effect while its package declares `"sideEffects": false`.
- **`scroll-behavior` restore.** Upstream restores the computed value as an inline style, which
  leaves one behind for good; ours restores whatever inline value was there.
- **Dropped:** a `Promise` as `duration` (nothing in the panel passes one), and upstream's
  `StickToBottom.tsx` component and context, because `AgentThread` owns its own markup. Two layout
  facts from that component are worth keeping in `AgentThread`: it forces `overflow: auto` when the
  scroller is `visible`, and gives the scroller `scrollbar-gutter: stable both-edges`.
- **Licence pointer.** The StackBlitz copyright header is kept, but its "See License.txt in the
  project root" now names `vendor/use-stick-to-bottom/LICENSE`: this repository has no
  `License.txt` at its root.

## streamdown — text direction by majority of letters

| | |
| --- | --- |
| Upstream | [vercel/streamdown](https://github.com/vercel/streamdown) |
| File | `packages/streamdown/lib/detect-direction.ts` (streamdown 2.6.0) |
| Commit | `0b6b20d3a85986a39b4bcd454cdcb6aabfc9b3e6` (2026-09-25) |
| License | Apache-2.0 — `vendor/streamdown-detect-direction/LICENSE` (upstream's notice), full text in `vendor/streamdown-detect-direction/LICENSE-2.0.txt` |
| Verbatim copy | `vendor/streamdown-detect-direction/detect-direction.upstream.ts`, and its suite `detect-direction.test.upstream.ts` |
| Adapted into | `apps/playground/src/features/agent/model/resolve-dir.ts` |

**Why vendored rather than reimplemented**: `dir="auto"` looks at the first strong character only,
so «Hero قسم الخدمات» (four Latin letters, then ten Arabic) lays out left to right. People writing to
the agent mix scripts constantly, and upstream's answer is the honest one: count the letters, let
the majority decide, break a tie on the first letter, and strip markdown first so code and link
URLs do not vote. Upstream has no NOTICE file at this commit (checked in the tree), so the licence
text and the modification notice at the top of the adapted file are what Apache-2.0 §4 asks for.

**What we changed in the adaptation** (and why):

- **Only letters vote.** Upstream counts every code point in U+0590–U+08FF as a strong RTL
  character, which includes Arabic-Indic digits (٣), Arabic punctuation (؟ ،) and harakat. A count
  typed in Arabic digits is a number, not Arabic, and a vocalised word must not outvote the same
  number of Latin letters.
- **No letters means the UI direction**, not `ltr`: `resolveDir(text, uiDir)`. A message of «5/8»
  sits in an Arabic panel, and nothing in it asks to be laid out left to right.
- **`resolveLang(text, uiLocale)`**, new, for the `lang` attribute (SPEC §4.5): right-to-left
  letters read as Arabic, everything else as English, the UI locale when there are no letters.
- Every case in upstream's own suite is kept as a test; the two whose expectation changed (empty
  text and digits only) are asserted both ways.
- The RTL character class keeps upstream's three ranges in upstream's `\u` escape spelling. The
  only addition is the `u` flag, to match the letter test; every range is inside the Basic
  Multilingual Plane, so it changes no result. A test holds the declaration to that spelling and
  fails the file on any invisible format character: an earlier draft wrote the ranges as literal
  code points, which put a BOM and a combining mark inside the class.
