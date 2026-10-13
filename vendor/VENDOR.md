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
- **Viewport and hidden-panel handling.** The same observer watches both the thread viewport
  and its content. Resizing the composer follows only a pinned reader; zero-height hidden reports
  preserve the reading offset and escape state. A pinned reader resumes at the newest content on
  reopening, while a reader browsing history stays put. A visible shrink never silently re-locks
  a reader. The non-negative target also avoids a negative offset for an empty thread.
- **Touch and keyboard intent.** Upward touch movement and ArrowUp/PageUp/Home/Shift+Space on
  the focused thread release an active spring before a browser scroll can be overwritten.
  Descendant controls keep their arrow keys, and inner scrollers with room keep their touch scroll.
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

## bolt.diy — act on each closed unit of a streamed answer (logic only, no file copied)

| | |
| --- | --- |
| Upstream | [stackblitz-labs/bolt.diy](https://github.com/stackblitz-labs/bolt.diy) |
| Reference | `app/lib/runtime/message-parser.ts` — `StreamingMessageParser` (`onActionOpen` / `onActionStream` / `onActionClose`) |
| License | MIT |
| Adapted into | `packages/builder/ai/src/agent/page-plan/plan-stream.ts` (`createPlanStreamReader`) |

One idea is taken, with attribution in the adapting file: read the model's answer incrementally,
keep the scan position between deltas, and act on each unit the moment it closes instead of
waiting for the whole answer (upstream writes each file while the next is still being generated;
ours lands the page skeleton when the plan's outline closes and starts each section writer when
its brief closes). **No code is copied and no package is added**: upstream parses XML-like action
tags, ours is a small JSON scanner (strings with escapes, a container stack, the key path)
that cuts each closed unit out of the text and `JSON.parse`s it. Because no upstream code is
reproduced, no licence text is carried in THIRD_PARTY_LICENSES.md for it.

Considered and not adopted (DESIGN 2026-10-05, D4): partial-JSON parsers (`partial-json`,
`@streamparser/json`, Vercel `ai`'s `fixJson`) — every unit acted on is complete JSON by the time
it closes, so a partial parser buys nothing.

<!-- P0-libs additions (style-manager DESIGN.md, 2026-10-05) -->

## lenis — opt-in smooth scrolling for published sites

| | |
| --- | --- |
| Upstream | [darkroomengineering/lenis](https://github.com/darkroomengineering/lenis) |
| Release | `lenis@1.3.26` (npm, published 2026-08-05), upstream gitHead `27059e9054142979e88b2f2b027c7cbf1540310c` |
| Tarball | `https://registry.npmjs.org/lenis/-/lenis-1.3.26.tgz`, integrity `sha512-s/xTCZCxTFvHbAN1OzuhNaN5YPJH2ail0XAkctKW1b+RUAG4nUL5UHLXwNko1h8aEeT2jspBXegMgPJd8zcuag==` (checked on download) |
| License | MIT (c) 2024 darkroom.engineering — `vendor/lenis/LICENSE`; text in THIRD_PARTY_LICENSES.md |
| Verbatim copies | `vendor/lenis/lenis.min.js` (sha256 `53195c9797e7ce7bf9d7fa9242b08209e57f46de4c9dac126a6494fa780e3346`), `vendor/lenis/lenis.css` (sha256 `2f668ae84a668327f246faf8a770383a2bf69196d214290fbc4d5548910606c5`), `vendor/lenis/LICENSE` |
| Adapted into | `packages/builder/renderer/src/behaviors/lenis-source.ts` (generated string module: `LENIS_SOURCE`, `LENIS_CSS`, `LENIS_VERSION`, `LENIS_SHA256`, `LENIS_CSS_SHA256`, `LENIS_BANNER`); `lenis-source.test.ts` asserts both strings hash to the vendored files |

**Why vendored rather than depended on**: the published static site cannot import npm code, so
the script must travel as a string the export writes out (`assets/ck-smooth-scroll.js`, emitted
only when the site setting `smoothScroll` is on; DESIGN.md D7). It never runs in the editor canvas
and is skipped under `prefers-reduced-motion: reduce`. Nothing is changed: the bytes are upstream's
minified build, including its trailing `sourceMappingURL` comment (the map is not shipped, so an
emitter may drop that last line). The emitter prepends `LENIS_BANNER` so the MIT notice travels
with the shipped copy. To upgrade: download the new tarball, re-copy the three files, regenerate
`lenis-source.ts` with new hashes, and update this entry.

## Animation idea ports (planned, filled by P4)

Planned 2026-10-05 by the style-manager design (LIBRARIES.md §B). Each row is **planned, filled by
P4**: when P4 copies or adapts code it records the commit consulted, the exact upstream file, what
was copied and the adapting file here, and keeps the licence text in THIRD_PARTY_LICENSES.md (the
texts below are already there). These ports exist because the behaviours runtime is one serialised
function and cannot import, and because published sites ship no animation library.

| Port | Upstream | Licence | What is taken | Planned destination | Status |
| --- | --- | --- | --- | --- | --- |
| Splitting.js | [shshaw/Splitting](https://github.com/shshaw/Splitting) | MIT (c) 2018 Stephen Shaw | Wrap chars and words in `span`s carrying `--ck-char-i` / `--ck-word-i`; full text in `aria-label` on the parent, `aria-hidden` on the spans (about 30 lines) | `packages/builder/renderer/src/behaviors/runtime.ts` (`split-chars`, `split-words`) | planned, filled by P4 |
| auto-animate | [formkit/auto-animate](https://github.com/formkit/auto-animate) | MIT (c) 2022 FormKit Inc. | MutationObserver + WAAPI FLIP (under 60 lines), plus our reduced-motion guard | behaviour `layout` in the same runtime | planned, filled by P4 |
| NumberFlow | [barvian/number-flow](https://github.com/barvian/number-flow) | MIT (c) 2024 Maxwell Barvian | Rolling digits: a per-digit vertical strip translated by `--ck-digit` | behaviour `ticker` | planned, filled by P4 |
| anime.js v4 | [juliangarnier/anime](https://github.com/juliangarnier/anime) | MIT (c) 2025 Julian Garnier | Ideas: `splitText` line detection; SVG line-draw with `pathLength=1` + `stroke-dashoffset`. Attribute any line copied | presets `draw-line`, `split-lines` | planned, filled by P4 |
| Magic UI (more ports) | [magicuidesign/magicui](https://github.com/magicuidesign/magicui) | MIT — same licence as the Magic UI entries above (`vendor/magicui/LICENSE`) | border-beam, animated-gradient-text, blur-fade, word-rotate, number-ticker, retro-grid, grid-pattern, meteors, orbiting-circles, animated-beam, each ported to CSS + tokens the way ShineBorder was | `packages/builder/renderer/src/motion/presets-css.ts`; block-style ones in `packages/builder/extensions/magicui` | planned, filled by P4 |

<!-- end P0-libs additions -->

## Animation idea ports — as built (P4, style-manager DESIGN.md §B, §C)

Recorded 2026-10-05 by P4; this fills in the planned table above. **No upstream file was copied
into the repository.** Every port below is a technique re-expressed in our own CSS (generated by
`packages/builder/renderer/src/motion/presets-css.ts` and `effects-css.ts`) or inside the
serialised behaviours runtime (`packages/builder/renderer/src/behaviors/runtime.ts`), which cannot
import anything. Each adapting site carries an attribution comment beside the idea. Upstream files
were read at the commits named, to learn the technique and the defaults; no licence text beyond the
existing MIT entries in THIRD_PARTY_LICENSES.md is needed, because no code is reproduced — the
entries are kept anyway so provenance stays answerable.

What changed in every Magic UI port, the same way ShineBorder changed: numbers became named steps
(`data-ck-speed`, `data-ck-distance`), colours became tokens (`--t-accent`, `--t-success`, …,
overridable per element through `--ck-fx-c1` / `--ck-fx-c2`), every movement lives under
`prefers-reduced-motion: no-preference`, inline-axis movement reads `--ck-inline-sign` so Arabic
pages mirror, and nothing depends on `motion` / `framer-motion` (published pages ship no animation
library, DESIGN D7).

### Magic UI — commit `cdb348cb4c72a9b54b554d8617801e479fbc8714` (2026-10-05), MIT

| Upstream file | Our name | What is taken | Adapting site |
| --- | --- | --- | --- |
| `apps/www/registry/magicui/border-beam.tsx` | hover `border-beam` | A beam travelling round the border, masked to the border box. Upstream moves a gradient square along `offset-path: rect()` with Motion; ours paints the ShineBorder ring with a `conic-gradient` whose start angle is a registered `@property` (`--ck-beam-angle`) rotated by keyframes — no engine | `presets-css.ts` (`HOVER['border-beam']`) |
| `apps/www/registry/magicui/animated-gradient-text.tsx` | motion `gradient-text` | A 300 % three-stop gradient clipped to the text and panned (`background-position`) | `presets-css.ts` (`TEXT['gradient-text']`) |
| `apps/www/registry/magicui/blur-fade.tsx` | motion `blur-in` | Start from `blur(6px)`, transparent, a quarter-distance below; play on view | `presets-css.ts` (`ENTRANCE_FROM['blur-in']`) |
| `apps/www/registry/magicui/word-rotate.tsx` | motion `word-rotate` | One word at a time, entering from above with a fade; ours keeps all words in a visually hidden `.ck-sr` span for screen readers | `runtime.ts` (`wordRotate`), `presets-css.ts` |
| `apps/www/registry/magicui/number-ticker.tsx` | behaviour `ticker` | Count to a value once it is in view (with NumberFlow's rolling-digit presentation, below) | `runtime.ts` (`ticker`), `behaviors-css.ts` |
| `apps/www/registry/magicui/retro-grid.tsx` | effect `ck-fx-retro-grid` | Upstream now renders with WebGL and keeps a CSS fallback: a grid plane tipped back by `perspective(200px) rotateX(…)` that scrolls toward the viewer, faded by a gradient. The CSS fallback is what is ported, as one `::before` | `effects-css.ts` |
| `apps/www/registry/magicui/grid-pattern.tsx`, `dot-pattern.tsx` | effects `ck-fx-grid`, `ck-fx-dots` | A 1 px lattice / one dot per cell behind the content, faded out by a radial mask; drawn with gradients instead of an SVG `<pattern>` | `effects-css.ts` |
| `apps/www/registry/magicui/meteors.tsx` | loop `meteors` | Small heads with a gradient tail, random start position, delay 0.2–1.2 s and duration 2–10 s, travelling diagonally and fading out; the runtime adds the spans (none under reduced motion) | `runtime.ts` (`meteors`), `presets-css.ts` (`LOOP.meteors`) |
| `apps/www/registry/magicui/orbiting-circles.tsx` | loop `orbit` | Children placed round a circle by `rotate(a) translateY(r) rotate(-a)`, rotating 360° per loop; the runtime writes each child's index and the count | `presets-css.ts` (`LOOP.orbit`), `runtime.ts` (`indexChildren`) |
| `apps/www/registry/magicui/animated-beam.tsx` | — | **Not ported**: it measures two element refs and draws an SVG path between them at run time; the vocabulary has no slot for "connect A to B", and a CSS-only version cannot know the endpoints | — |

### Logic ideas (no file copied)

| Upstream | Commit read | Licence | Idea | Adapting site |
| --- | --- | --- | --- | --- |
| [shshaw/Splitting](https://github.com/shshaw/Splitting) | `d5a8fd0137e90770ae10d2e0e874a4a101161544` | MIT (c) 2018 Stephen Shaw | Wrap words / characters in spans that carry their index as a custom property (`--ck-word-i`, `--ck-char-i`, `--ck-line-i`, and `--ck-u-i` for the animated unit); the parent's `aria-label` keeps the sentence, the spans are `aria-hidden`. Ours adds: the original text nodes stay in place (emptied) so React can still own them; joining scripts (Arabic, Syriac, N'Ko, Mongolian, Indic) split by word, never by letter, so their shapes survive; graphemes via `Intl.Segmenter` | `runtime.ts` (`splitText`) |
| [juliangarnier/anime](https://github.com/juliangarnier/anime) v4 | `01b81be1df6843ccfe0a71c0699a746bf740dd77` | MIT (c) 2025 Julian Garnier | Line drawing with `pathLength="1"` so a dash of 1 is the whole stroke, animating `stroke-dashoffset` 1 → 0; `splitText`'s line detection (words grouped by their top edge, re-measured on resize) | `runtime.ts` (`drawLine`, `splitText` lines), `presets-css.ts` (`draw-line`) |
| [formkit/auto-animate](https://github.com/formkit/auto-animate) | `06882a8e69ba9bc8456d8f2ae6010f697fd7a37c` | MIT (c) 2022 FormKit Inc. | FLIP on child changes: remember each child's place, observe the container with a MutationObserver, play moved children from the old place with WAAPI, fade new ones in. Ours adds the reduced-motion guard and stays off on the canvas | `runtime.ts` (`layout`) |
| [barvian/number-flow](https://github.com/barvian/number-flow) | `c5906cf35c86583e756a6b91e043291c10b416e0` | MIT (c) 2024 Maxwell Barvian | Rolling digits: each digit a vertical strip of 0–9 translated to its value. Ours uses the page language's digits (Arabic-Indic on Arabic pages), isolates the number LTR, and puts the final value in `aria-label` | `runtime.ts` (`ticker`), `behaviors-css.ts` |

Curves: the `spring` and `bounce` eases are CSS `linear()` curves sampled at build time from a
damped-spring formula and the four-arc bounce-out definition, written in `presets-css.ts`; no
curve table was copied.

<!-- end P4-animation additions -->

<!-- media-motion (2026-10-06) engine-timeline additions -->

<!-- gsap-pixi (2026-10-08) additions -->

## animejs — the MIT timeline engine (replaced GSAP, 2026-10-08)

GSAP left the repository on 2026-10-08. Its Standard "No Charge" licence prohibits use "in tools
that allow users to build visual animations without code", which is what the CraftKit editor is
(decision and quote: `durable/gsap-pixi/LICENCE.md`). The engine is now an anime.js subset. The
recipe names and attributes are unchanged (`data-ck-timeline`, `data-ck-scrub`,
`data-ck-ease/speed/stagger/delay/depth`), so no page changes.

| | |
| --- | --- |
| Upstream | [juliangarnier/anime](https://github.com/juliangarnier/anime) ([animejs.com](https://animejs.com)) |
| Release | `animejs@4.5.0` (npm, published 2026-06-22; passes `minimumReleaseAge`), pinned |
| Tarball | `https://registry.npmjs.org/animejs/-/animejs-4.5.0.tgz`, integrity `sha512-NQimYX+lz8WaXonGS9zVVoviCIAjONeJayxacUditaivYLqyXgGjFKjuyl0aUUhFKm5MriX9ty1TGovNzoJQWA==` (checked on download) |
| License | MIT (c) 2025 Julian Garnier — `vendor/animejs/LICENSE.md` (the tarball's, verbatim; npm `license` field `MIT`, both checked by the script); text in THIRD_PARTY_LICENSES.md |
| Files | `vendor/animejs/anime.ck.min.js` (sha256 `79207dd3aa8635a180d55cecbe68b17bfda713635e18486f825af35f833a2969`, 57,077 B, 22,318 B gzip), `vendor/animejs/LICENSE.md`, `vendor/animejs/PROVENANCE.md` |
| What the bundle is | NOT a verbatim copy: esbuild 0.28.2 bundles the tarball's ESM `dist/modules/` keeping only `createTimeline`, `animate`, `stagger`, `onScroll`, `splitText` (iife, es2020, minified) and sets `window.ckAnime`. MIT permits the modification; the full licence travels in the asset banner. The full UMD bundle would be 118 kB / 41 kB gzip |
| Script | `scripts/vendor-timeline-engine.mjs` (download + integrity + MIT checks + bundle + generation; `--offline` regenerates from `vendor/animejs/`) |
| Adapted into | `packages/builder/renderer/src/engines/timeline-source.ts` (generated: `TIMELINE_ENGINE`, `ANIME_VERSION`, `TIMELINE_LICENSE`, `TIMELINE_GLOBAL`, `TIMELINE_EXPORTS`, `TIMELINE_SHA256`, `TIMELINE_BANNER`, `TIMELINE_SOURCE`); the recipe runner `timeline-runner.ts` (`installTimelineEngine`) is our own code. `sources.test.ts` hashes the bundle; `timeline-runner.test.ts` evaluates the real asset in jsdom |

Shipped as `assets/ck-timeline.js` (banner + bundle + runner) only on pages with
`data-ck-timeline`; the editor reaches it only by dynamic `import()`. anime.js has no pin: the
runner emulates `pin-sequence` / `horizontal-scroll` holds with a transform plus a reserved
`margin-block-end`, never reparenting nodes. With the MIT engine in, the style-manager recipe picker
is on (`TIMELINE_PANEL_ENABLED = true`).

**Removed:** `vendor/gsap/` (gsap 3.15.0 `gsap.min.js`, `ScrollTrigger.min.js`, `SplitText.min.js`,
`LICENSE.md`, `PROVENANCE.md`) and `scripts/vendor-gsap.mjs`. They stay in git history (added in commit
`537acb0`) for the record; nothing ships or loads them.

<!-- end gsap-pixi additions -->

## lottie-web — the light Lottie player for published sites

| | |
| --- | --- |
| Upstream | [airbnb/lottie-web](https://github.com/airbnb/lottie-web) |
| Release | `lottie-web@5.13.0`, upstream gitHead `bede03d25d232826e0c9dca1733d542d8a7754fb` |
| Tarball | `https://registry.npmjs.org/lottie-web/-/lottie-web-5.13.0.tgz`, integrity `sha512-+gfBXl6sxXMPe8tKQm7qzLnUy5DUPJPKIyRHwtpCpyUEYjHYRJC/5gjUvdkuO2c3JllrPtHXH5UJJK8LRYl5yQ==` (checked on download) |
| License | MIT (c) 2015 Bodymovin — `vendor/lottie/LICENSE` (the tarball's `LICENSE.md`, checked to be MIT); text in THIRD_PARTY_LICENSES.md |
| Verbatim copies | `vendor/lottie/lottie_light.min.js` (`build/player/lottie_light.min.js`, SVG renderer only, no `eval`; sha256 `9588432bec30c8ef8200bac4a67d8aaad881047bc2a6c9fa624d90ec96402410`), `vendor/lottie/LICENSE`, `vendor/lottie/PROVENANCE.md` |
| Script | `scripts/vendor-lottie.mjs` (`--offline` regenerates from `vendor/lottie/`) |
| Adapted into | `packages/builder/renderer/src/engines/lottie-source.ts` (generated: `LOTTIE_VERSION`, `LOTTIE_SHA256`, `LOTTIE_BANNER`, `LOTTIE_SOURCE`); the runner `lottie-runner.ts` (`installLottieEngine`) is our own code |

Shipped as `assets/ck-lottie.js` (banner + source + runner) only on pages with `data-ck-lottie`.
The poster `img` child is the no-JS, reduced-motion and failed-load fallback.

## pixi.js — canvas scenes (murals, all-motion pages)

**Installed, not vendored**: `pixi.js@8.22.0` (MIT (c) 2013-2023 Mathew Groves, Chad Engler)
comes from the pnpm catalog into ONE contained package, `@craftkit/builder-media-engines`
(containment enforced by `validate-builder-boundaries.mjs`). esbuild bundles one IIFE (the Pixi
subset + our scenes) into the generated `packages/builder/renderer/src/engines/scene-source.ts`,
shipped as `assets/ck-scene.js` only on pages with `data-ck-scene`. Owner: package `engine-scene`.

- bundled dependency licences: see scene-source.ts banner

## Studio game libraries — audio, game AI, HUD (2026-10-12)

**Installed, not vendored**, from the pnpm catalog into `@craftkit/builder-media-engines` only, and
bundled into the lazy assets `assets/ck-lib-audio.js`, `ck-lib-gameai.js` and `ck-lib-hud.js`
(generated `packages/builder/renderer/src/engines/studio/<key>-source.ts`), shipped only on pages
whose code names the key. `scripts/build-studio-engines.mjs` audits each bundled package's
`LICENSE` text against its declared licence and carries every notice in the asset's banner.

| Package       | Version | Licence  | Asset              |
| ------------- | ------- | -------- | ------------------ |
| @pixi/sound   | 6.0.1   | MIT      | `ck-lib-audio.js`  |
| zzfx          | 1.3.2   | MIT      | `ck-lib-audio.js`  |
| yuka          | 0.7.8   | MIT      | `ck-lib-gameai.js` |
| @pixi/ui      | 2.3.2   | MIT      | `ck-lib-hud.js`    |
| tweedle.js    | 2.1.0   | MIT      | `ck-lib-hud.js`    |
| typed-signals | 2.5.0   | CC0-1.0  | `ck-lib-hud.js`    |

`@types/yuka` 0.7.4 (MIT) is a dev dependency for types only and ships nowhere.

## Studio character art — Open Peeps through DiceBear (2026-10-13)

**Installed, not vendored**, from the pnpm catalog into `@craftkit/builder-media-engines` only, and
bundled into the lazy asset `assets/ck-lib-peeps.js` (generated
`packages/builder/renderer/src/engines/studio/peeps-source.ts`, 111.3 kB gzip, budget 116.9 kB),
shipped only on pages whose code names the `peeps` key (`ck.scene({ libs: ['peeps'] })`). Nothing
is fetched at run time: the 48 hair styles, 30 faces, accessories and facial hair are SVG path data
inside the bundle. `scripts/build-studio-engines.mjs` audits both packages' `LICENSE` text against
the declared licence and carries both whole in the asset's banner; each drawn SVG also carries
DiceBear's RDF metadata (title, creator, source and licence URL of the design).

| Package              | Version | Licence                                      | Asset             |
| -------------------- | ------- | -------------------------------------------- | ----------------- |
| @dicebear/core       | 9.4.3   | MIT (c) 2024 Florian Körner                  | `ck-lib-peeps.js` |
| @dicebear/open-peeps | 9.4.3   | code MIT; design **CC0 1.0** (Pablo Stanley) | `ck-lib-peeps.js` |

Read on 2026-10-13 from the installed tarballs: `@dicebear/core/LICENSE` is the MIT text;
`@dicebear/open-peeps/LICENSE` opens with "# Design — Applies to all design files in this package.
Source: Open Peeps (https://www.openpeeps.com/) · Designer: Pablo Stanley · License: CC0 1.0
(https://creativecommons.org/publicdomain/zero/1.0/)" and then gives the MIT text for the code; its
`package.json` declares MIT and its README credits "Open Peeps by Pablo Stanley, licensed under
CC0 1.0. / Remix of the original." The style's `meta` (`lib/index.js`) says the same: title
"Open Peeps", creator "Pablo Stanley", license `{ name: 'CC0 1.0', url: …/publicdomain/zero/1.0/ }`.
`@types/json-schema` (MIT, a type-only dependency of core) ships nowhere. 9.4.3 (2026-07-05) is the
v9 LTS that `@dicebear/open-peeps` peers on; the older 9.2.4 lacks 9.4's XML escaping of colour and
rotate options. Texts: THIRD_PARTY_LICENSES.md. Kenney packs were not used (kenney.nl is not reachable
from this environment).

## Studio procedural maps and animated GIFs — rot.js, gifuct-js (2026-10-13)

**Installed, not vendored**, from the pnpm catalog into `@craftkit/builder-media-engines` only, and
bundled into the lazy assets `assets/ck-lib-procgen.js` (generated
`packages/builder/renderer/src/engines/studio/procgen-source.ts`, 11.7 kB gzip, budget 12.4 kB) and
`assets/ck-lib-gif.js` (`gif-source.ts`, 7.5 kB gzip, budget 7.9 kB), shipped only on pages whose
code names `procgen` or `gif`. `scripts/build-studio-engines.mjs` audits each bundled package's
`LICENSE` text against its declared licence and carries the texts in the asset's banner. Neither
asset evaluates code, compiles WebAssembly or bundles Pixi.

| Package                 | Version | Licence                                       | Asset               |
| ----------------------- | ------- | --------------------------------------------- | ------------------- |
| rot-js                  | 2.2.1   | **BSD-3-Clause** (c) 2012-now() Ondrej Zara   | `ck-lib-procgen.js` |
| gifuct-js               | 2.1.2   | MIT (c) 2015 Matt Way                         | `ck-lib-gif.js`     |
| js-binary-schema-parser | 2.0.3   | MIT (c) 2015 Matt Way (gifuct-js's parser)    | `ck-lib-gif.js`     |

Read on 2026-10-13 from the installed tarballs: `rot-js/license.txt` is the three-clause BSD text
("Neither the name of Ondrej Zara…"), `package.json` declares `BSD-3-Clause`; its `lib/rng.js` (in
the bundle) notes "This code is an implementation of Alea algorithm; (C) 2010 Johannes Baagøe. Alea
is licensed according to the MIT License" — that notice is reproduced in THIRD_PARTY_LICENSES.md.
Only `lib/rng.js`, six `lib/map/*` generators and `lib/fov/precise-shadowcasting.js` are imported.
`gifuct-js/LICENSE` and `js-binary-schema-parser/LICENSE` are the MIT text, both "Copyright (c)
2015 Matt Way"; gifuct-js 2.1.2 is the version pixi.js 8.22.0 itself depends on (for
`pixi.js/gif`), so the lockfile gained no new package for it. rot-js 2.2.1 was published
2024-11-13.

Evaluated and **not admitted** (2026-10-13), each read from its installed tarball:

| Package                   | Version | Licence (as read)                          | Why not                                                                                                                                                                                                                                                                                                                             |
| ------------------------- | ------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @pixi/gif                 | 3.0.1   | MIT (c) 2021 Matt Karl, LLC                | Its entry calls `extensions.add` for a `.gif` Assets loader on the page's one Pixi namespace; frames step on `Ticker.shared`; every frame's pixels kept with no bound; it would have to be Pixi-bound; it copies gifuct-js and js-binary-schema-parser into `lib/external/` without their notice. Superseded by `pixi.js/gif`, whose modules import Pixi internals by path (a second Pixi copy if bundled). Replaced by `s.lib.gif` on the same decoder. |
| @pixi/layout + yoga-layout | 3.2.1 + 3.2.1 | MIT (c) 2025 PixiJS + MIT (`package.json` only: the yoga-layout tarball has **no LICENSE file**, which the build's audit refuses) | 59.8 kB gzip (Yoga's base64 WebAssembly is 127 kB of the 152 kB raw bundle). In Chromium the 71.7 kB module compiles under the preview CSP only because `'unsafe-eval'` is present; it is refused without `'unsafe-eval'`/`'wasm-unsafe-eval'`. Mixes `layout` into Container/Text/ViewContainer prototypes page-wide; its `LayoutSystem` must be registered before `app.init`, while Studio opens the stage as libraries load. Canvas menus stay DOM. |
| poisson-disk-sampling     | 2.3.1   | MIT (c) 2015 Kevin Chapelier (+ moore MIT) | 2.8 kB gzip for what the kit's own seeded `s.poisson(w, h, r, max?)` already does.                                                                                                                                                                                                                                                  |

## Studio mural libraries and hex art — d3-contour, polybooljs, Kenney Hexagon Pack (2026-10-13)

**Installed, not vendored**, from the pnpm catalog into `@craftkit/builder-media-engines` only, and
bundled into the lazy assets `assets/ck-lib-geom.js` (generated
`packages/builder/renderer/src/engines/studio/geom-source.ts`, 10.5 kB gzip, budget 11.0 kB),
`assets/ck-lib-noise.js` (`noise-source.ts`, 4.4 kB, budget 4.6 kB; simplex-noise 4.0.3 is already in
the catalog for the kit, nothing new) and `assets/ck-lib-hex.js` (`hex-source.ts`, 75.6 kB, budget
79.4 kB), shipped only on pages whose code names `geom`, `noise` or `hex`.
`scripts/build-studio-engines.mjs` audits each bundled package's licence text against its declared
licence; the hex art reaches the bundle through a generated module, so its notice is audited from
`packages/builder/extensions/media-engines/vendor/kenney-hexagon-pack/LICENSE` (Kenney's notice
followed by the CC0 1.0 legal code it links to; `PROVENANCE.json` beside it). No asset evaluates
code, fetches or bundles Pixi.

| Package                | Version | Licence                                              | Asset                         |
| ---------------------- | ------- | ---------------------------------------------------- | ----------------------------- |
| d3-contour             | 4.0.2   | ISC (c) 2012-2023 Mike Bostock                       | `ck-lib-geom.js`              |
| d3-array               | 3.2.4   | ISC (c) 2010-2023 Mike Bostock (d3-contour's dep)    | `ck-lib-geom.js`              |
| internmap              | 2.0.3   | ISC (c) 2021 Mike Bostock (d3-array's dep)           | none (0 bytes in the bundle)  |
| polybooljs             | 1.2.2   | MIT (c) 2016 Sean Connelly                           | `ck-lib-geom.js`              |
| kenney-hexagon-pack    | 1.0.0   | **CC0 1.0** (art; `package.json` says "CC0 1.0")     | `ck-lib-hex.js` (28 tiles)    |

Read on 2026-10-13 from each tarball (extracted as data into a scratch directory, no script run):
`d3-contour/LICENSE` and `d3-array/LICENSE` are the ISC text; `polybooljs/LICENSE` the MIT text, and
its `index.js` assigns `window.PolyBool` when a window exists, so only its five `lib/` algorithm
modules are imported. `kenney-hexagon-pack` (published 2019-08-05 by Lukas Bach, repository
lukasbach/kenney-hexagon-pack) holds Kenney's unmodified sprite sheets (TexturePacker Starling XML,
120 × 140 tiles) and Kenney's standard `License.txt` ("License (Creative Commons Zero, CC0) … Credit
(Kenney or www.kenney.nl) would be nice but is not mandatory"); its terrain sheet XML and licence are
identical to the GitHub repository read through raw.githubusercontent.com (kenney.nl itself is not
reachable from this environment). Credit is given anyway: `s.lib.hex.credit` reads "Hexagon Pack by
Kenney (www.kenney.nl), CC0 1.0". The package is a devDependency (23 MB unpacked, 1,301 files) read
only by `scripts/build-hex-atlas.mjs`, which packs 20 terrain tiles and 8 buildings (military
tiles and the stereotyped `western_indians` tile left out) into one 67.6 kB lossless WebP.

**Vendored as copies on the owner's word** (2026-10-13), because neither npm tarball carries a
LICENSE file and the engine build's licence audit admits an installed package only with one:

| Package        | Version | Licence                                                          | Copied to                                   | Used by                                       |
| -------------- | ------- | ---------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| fastnoise-lite | 1.1.1   | MIT — package.json, the source header, the repository's LICENSE  | `media-engines/vendor/fastnoise-lite/`      | `s.lib.noise` types perlin, value, value-cubic, opensimplex2, opensimplex2s (`ck-lib-noise.js`, 21.1 kB) |
| bezier-js      | 6.1.4   | MIT — package.json and the repository's LICENSE.md               | `media-engines/vendor/bezier-js/` (its `src/`) | `s.lib.geom.curve` (`ck-lib-geom.js`, 19.5 kB) |

Each folder holds the verbatim files (sha256 in its PROVENANCE.md, pinned by the unit tests), the
upstream licence and our own `.d.ts`; `scripts/studio-engine-targets.mjs` lists each LICENSE under
its target's `vendored`, so the asset banner carries the notice. Upgrading is a manual replace.

Evaluated and **not admitted** (2026-10-13), each read from its tarball or registry entry:

| Package                         | Version  | Licence (as read)                     | Why not                                                                                                                                                                        |
| ------------------------------- | -------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| d3-delaunay (+ delaunator 5)    | 6.0.4    | ISC; delaunator → robust-predicates   | The kit's own `s.delaunay` already gives triangles, Voronoi cells and `find`; delaunator 5 depends on robust-predicates (**Unlicense**, outside the licence list).           |
| polygon-clipping                | 0.15.7   | MIT; → robust-predicates (Unlicense)  | Unlicense dependency.                                                                                                                                                          |
| martinez-polygon-clipping       | 0.9.0    | MIT; → robust-predicates (Unlicense)  | Unlicense dependency.                                                                                                                                                          |
| @velipso/polybool               | 2.0.11   | 0BSD (+ tslib 0BSD)                   | 8.9 kB gzip for the booleans polybooljs's modules give in 3.5 kB; 0BSD is not yet in the build's audited list.                                                               |
| chromotome / nice-color-palettes | 1.21.4 / 4.0.0 | MIT                           | Curated palettes, but the page palette (`s.palette`) wins, and the `palette` param already takes up to six colours of the person's own.                                       |
| @iconify-json/game-icons        | 1.2.4    | **CC BY 3.0**                         | Attribution on every page that shows an icon, which an agent-built page cannot guarantee; this policy admits no CC BY art. `@icongo/gi` 1.2.0 relabels the same icons "MIT" (unclear licence). |
| @anabis/kenney-space-kit-mirror | 2.0.0    | CC0-1.0                               | Kenney's Space Kit is 3-D models, not 2-D art for Pixi; "unofficial mirror".                                                                                                 |
| hexagonopolis-assets            | 1.0.0    | ISC (registry entry)                  | Read from its registry entry only: "Assets for the webbased game Hexagonopolis", art declared ISC with no stated source; not admitted without clear provenance.               |

## Media idea sources (logic only, no file copied)

Read for technique only; the behaviours in `packages/builder/renderer/src/behaviors/packs/` are
our own serialised code. Each adapting site names its idea source in a comment.

| Upstream | Version read | Licence | Idea | Adapting site |
| --- | --- | --- | --- | --- |
| [@justinribeiro/lite-youtube](https://github.com/justinribeiro/lite-youtube) | 1.9.0 | MIT (c) 2019 Justin Ribeiro | Facade: a poster link that swaps in the `youtube-nocookie.com` iframe on click; no third-party request before | `packs/embed-facade.ts` |
| [lite-vimeo-embed](https://github.com/luwes/lite-vimeo-embed) | 0.3.0 | MIT (npm `license` field; the repository ships no LICENSE file — checked `main`/`master`) | The same facade for Vimeo | `packs/embed-facade.ts` |
| [PhotoSwipe](https://github.com/dimsemenov/PhotoSwipe) | 5.4.4 | MIT (c) 2014-2022 Dmitry Semenov | Gallery dialog: group navigation, swipe, focus return, captions | `packs/gallery.ts` |
| [Embla Carousel](https://github.com/davidjerleke/embla-carousel) | 8.6.0 | MIT (c) David Jerleke | Carousel indicators (dots/counter), autoplay with a pause control | `packs/carousel.ts` |
| [img-comparison-slider](https://github.com/sneas/img-comparison-slider) | 8.0.7 | MIT (c) 2019 Dmytro Snisarenko | Before/after compare driven by a native range input, clipped with `clip-path` | `packs/compare.ts` |

<!-- end media-motion engine-timeline additions -->

<!-- tailwind-plugins additions (2026-10-13) -->

## Tailwind plugins — prose, form fields and entrances for generated pages (2026-10-13)

**Installed, not vendored**, from the pnpm catalog. Each licence was read from the installed
tarball's own LICENSE file (not only `package.json`) on 2026-10-13; texts in
THIRD_PARTY_LICENSES.md. Each pin is the latest release and more than two weeks old.

| Package                 | Version | Published  | Licence (tarball LICENSE)       | Installed into                      |
| ----------------------- | ------- | ---------- | ------------------------------- | ----------------------------------- |
| tw-animate-css          | 1.4.0   | 2025-09-24 | MIT (c) 2025 Wombosvideo        | builder-renderer                    |
| @tailwindcss/typography | 0.5.20  | 2026-06-08 | MIT (c) Tailwind Labs, Inc.     | builder-renderer, builder-code-runtime (playground and storybook already listed it) |
| @tailwindcss/forms      | 0.5.11  | 2025-12-17 | MIT (c) Tailwind Labs, Inc.     | builder-renderer, builder-code-runtime |
| mini-svg-data-uri       | 1.4.4   | —          | MIT (c) 2018 Taylor Hunt        | (forms' dependency)                 |
| postcss-selector-parser | 6.0.10  | —          | MIT (c) Ben Briggs              | (typography's dependency, already in the graph) |

How they reach a page (generator: `packages/builder/renderer/src/tailwind/plugin-bridge.ts`):

- **Animate layer** (`tailwind-animate.css`: `@import 'tw-animate-css'`, the slide step bound to
  `--t-space-unit`, and `animation: none` on every enter/exit class under
  `prefers-reduced-motion: reduce`) — behind the editor's Tailwind door, so in every static sheet,
  and in the in-page compiler and the export.
- **Content layer** (`tailwind-content.css`: typography, and forms with `strategy: 'class'` so no
  input is reset globally, both re-pointed at the `--t-*` tokens) — generated per page by the
  in-page compiler (canvas, preview, the AI door's oracle) and by `compileFor` (export), not by
  the static sheet: one `prose` is ~20 KB of CSS and the static scan would ship it on every
  editor load (measured +3 to +5 KB gzip against a first-load CSS budget with 1.85 KB to spare).
- The in-page compiler loads both plugins through a closed `loadModule` (`compiler-loaders.ts`)
  in a lazy chunk (115 KB minified / 26.7 KB gzip, beside Tailwind's own 74 KB gzip).
- `tw-animate-css` exports its stylesheet only under the `style` condition, which a script
  bundler does not resolve, so the in-page compiler reads a byte-for-byte copy:
  `packages/builder/renderer/src/tailwind/tw-animate-source.ts` (sha256
  `6035b41301945cd65eb233b4653965e3c235338faae51b0f55676d591daaef23`, 14,880 B), held equal to the
  installed tarball by `tw-animate-source.test.ts` (`UPDATE_TAILWIND_CSS=1` regenerates it).
- Code projects (`@craftkit/builder-code-runtime`) compile with typography and forms as trusted
  plugins (still refusing any authored `@plugin`), in Tailwind's own palette since a code project
  wears no site tokens; tw-animate is left out there — a code project animates with the managed
  `motion/react` its lock allows.

<!-- end tailwind-plugins additions -->
