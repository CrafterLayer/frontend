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

## magicui — the marquee and the dot pattern (pattern only, no file copied)

| | |
| --- | --- |
| Upstream | [magicuidesign/magicui](https://github.com/magicuidesign/magicui) |
| Reference | `apps/www/registry/magicui/marquee.tsx`, `apps/www/registry/magicui/dot-pattern.tsx` |
| License | MIT — `vendor/magicui/LICENSE`; text in THIRD_PARTY_LICENSES.md |
| Verbatim copy | none: the blocks were written from the components' documented behaviour |
| Adapted into | `packages/builder/extensions/magicui/src/components/Marquee/`, `MarqueeTrack/`, `DotPatternSurface/` |

Recorded 2026-09-30, because the blocks said "inspired by Magic UI" with no provenance entry. What
was taken is the idea, not the code: a row written twice and translated by `-50%` so the loop has
no seam (Marquee), and a decorative dot field drawn behind the slot content (DotPatternSurface).
Both are Builder-native: the speed, gap and colours are named steps over `--t-*` tokens, the motion
stops under `prefers-reduced-motion`, and nothing depends on `motion` or `framer-motion`.

## Section kit — HyperUI, Tailark and Meraki UI

The section kit (`packages/builder/ai/src/section-kit/`) is a closed library of section templates
the agent fills with slot values instead of writing markup token by token (DESIGN B, 2026-09-30:
a section writer answers with one `kit.section` tool step of ~30–300 tokens instead of a full
tree). Every kit names its upstream file and commit in its own `source` field, and a unit test
(`section-kit/kits.test.ts`) fails when that file is missing from `vendor/`.

The kits are **adaptations, never copies**, made by `scripts/section-kit/convert.mjs` and then by
hand: direction classes become logical (`ms-`/`ps-`/`start-`/`text-start`/`rounded-s`/`border-s`,
so an Arabic page mirrors), every palette colour becomes a page-kit class (`ck-ground`, `ck-card`,
`ck-ink`, `ck-muted`, `ck-accent-ink`, `ck-border`, `ck-btn`…), heroicons SVGs become Lucide
`<icon>` nodes, Alpine (`x-data`, `@click`) becomes `details`/`summary` or a `popover`, forms become
a registered-block reference, and every text, image and link becomes a `{{slot}}`. The upstream
files are fetched verbatim, at the pinned commits, by `scripts/section-kit/fetch-upstream.mjs`
(the list is `scripts/section-kit/upstream-files.json`).

Excluded on purpose (licence): Tailwind Plus, Float UI, Aceternity Pro, Origin UI (AGPL root).
Preline is deferred (its Fair Use licence needs the owner's sign-off). Tailark's brand-logo SVGs
(`registry/core/ui/svgs/*`) are trademarks and are never copied.

### hyperui

| | |
| --- | --- |
| Upstream | [markmead/hyperui](https://github.com/markmead/hyperui) |
| Files | 22 examples under `public/examples/marketing/` (headers, announcements, footers, sections, banners, feature-grids, pricing, product-collections, cards, team-sections, testimonials, stats, logo-clouds, blog-cards, faqs, ctas) and `public/examples/application/steps/2.html` |
| Commit | `2b5aebbc50d2c9ac89650f51b554f53895b4803c` (2026-09-26) |
| License | MIT (c) Mark Mead — `vendor/hyperui/LICENSE` |
| Verbatim copy | `vendor/hyperui/upstream/<same path>` |
| Adapted into | `packages/builder/ai/src/section-kit/kits/` (the kits whose `source.lib` is `hyperui`) |

The primary source: plain HTML on Tailwind v4, the same major the renderer compiles, so a class
survives as written unless it names a physical side or a palette hue.

### tailark

| | |
| --- | --- |
| Upstream | [tailark/blocks](https://github.com/tailark/blocks) |
| Files | 8 blocks under `registry/bases/radix/` (veil: hero-section/one, features/two, content/one, comparator/one, faqs/one; mist: features/four, testimonials/one, stats/one) |
| Commit | `8139698115c1341bfd2e3e286c04bb4d8146f472` (2026-07-29) |
| License | MIT (c) 2025 Irung — `vendor/tailark/LICENCE.md` |
| Verbatim copy | `vendor/tailark/upstream/<same path>` |
| Adapted into | `packages/builder/ai/src/section-kit/kits/` (the kits whose `source.lib` is `tailark`) |

The premium look (veil and mist kits). The blocks are React TSX with shadcn `Button`/`Card`,
`next/link`, `next/image` and `lucide-react`; they were transcribed by hand into the converter's
draft shape (Lucide names map one to one onto the tree's icon node). `motion-primitives`
animations are not carried over; the curated behaviours (`data-ck-behavior`) stand in.

### merakiui

| | |
| --- | --- |
| Upstream | [merakiuilabs/merakiui](https://github.com/merakiuilabs/merakiui) |
| Files | 12 components under `components/` (footers/CTAWithLinks, heros/BackgroundImage, heros/SideImage, features/GridListWithImage, teams/Cards, testimonials/Single, portfolio/Cards, portfolio/HoverEffect, blog/Grid, cta/Card, contact/TwoColumn, contact/Grid2x2) |
| Commit | `fe0472efe93f6cd275424ecbdfa7f6cb8da6f908` (2025-07-11) |
| License | MIT (c) 2021 Khatab Wedaa — `vendor/merakiui/LICENSE` |
| Verbatim copy | `vendor/merakiui/upstream/<same path>` |
| Adapted into | `packages/builder/ai/src/section-kit/kits/` (the kits whose `source.lib` is `merakiui`) |

The RTL reference: Meraki ships `rtl:` variants throughout (`rtl:-scale-x-100` on directional
icons), which is where the kit's rule for arrows comes from. The kit cannot use `rtl:` utilities
(the static vocabulary does not generate them), so an arrow carries `ck-flip` and the kit css
mirrors it with `.ck-flip:dir(rtl){transform:scaleX(-1)}`. Alpine carousels and toggles are dropped
for native `details` and scroll-snap.

## SEO logic references (logic only, no file copied)

Used by the SEO core (`packages/builder/schema/src/seo/`) and the agent SEO checks
(`packages/builder/ai/src/seo/`). No code is copied and no package is added; the facts below are
restated in our own code, with attribution in the adapting files.

### next-seo — the head tags a page ships

| | |
| --- | --- |
| Upstream | [garmeeh/next-seo](https://github.com/garmeeh/next-seo) |
| Reference | the default-SEO and JSON-LD component set (which head tags, in which order, with which fallbacks) |
| Commit consulted | `ba5afbd8aaa794b0267f5cd815a940b78689d569` (2025-09-19) |
| License | MIT (c) 2018 Gary Meehan — text in THIRD_PARTY_LICENSES.md |
| Adapted into | `packages/builder/schema/src/seo/` (`buildSeoHead`) |

### schema-dts — the JSON-LD vocabulary

| | |
| --- | --- |
| Upstream | [google/schema-dts](https://github.com/google/schema-dts) |
| Reference | the schema.org type and property names for WebSite, Organization, LocalBusiness subtypes, WebPage, BreadcrumbList, FAQPage, Menu, Product, Service, Article, Event |
| Commit consulted | `8e3138bc1a02c93d86db132dd41bcefe6ae643b0` (2026-09-25) |
| License | Apache-2.0 — notice in THIRD_PARTY_LICENSES.md; full text at `vendor/streamdown-detect-direction/LICENSE-2.0.txt` |
| Adapted into | `packages/builder/schema/src/seo/` (`buildJsonLdGraph`) |

The package is not depended on: only the names of the types and properties the graph emits are
used, as plain strings. Upstream has no NOTICE file at this commit.

### lighthouse — non-descriptive link text

| | |
| --- | --- |
| Upstream | [GoogleChrome/lighthouse](https://github.com/GoogleChrome/lighthouse) |
| Reference | `core/audits/seo/link-text.js` — the English `nonDescriptiveLinkTexts` list |
| Commit consulted | `08c05cdee7e191719480477056bd145abcb09c17` (2026-09-18) |
| License | Apache-2.0 (c) 2017 Google LLC — notice in THIRD_PARTY_LICENSES.md; full text at `vendor/streamdown-detect-direction/LICENSE-2.0.txt` |
| Adapted into | `packages/builder/schema/src/seo/` (`VAGUE_LINK_TEXT`) |

The English list is restated; the Arabic list (اضغط هنا، هنا، المزيد، اقرأ المزيد، التفاصيل، اعرف
أكثر، رابط) is ours. Upstream has no NOTICE file at this commit, so the licence notice and the
modification note in the adapting file are what Apache-2.0 §4 asks for.
