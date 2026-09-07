# Responsive audit — the marketing sections (T122)

Measured, not read. The list below is what a real browser reported at 360, 768, 1024 and 1440, plus
RTL at 360, over **every** section registered in `blocksMarketing` — rendered from each block's own
last example, because defaults are the easy case and examples are what a generated page actually
contains.

The gate is `packages/builder/extensions/blocks-marketing/src/responsive.stories.tsx`. It reads the
section list from the manifest rather than from a list in the file, so a section added tomorrow is
measured the day it is registered.

## What the measurement found

Two sections overflowed. Both by the same 348px at 360px, and both for the same reason.

| Section       | Width | Overflow | Element                                | Cause                                  |
| ------------- | ----- | -------- | -------------------------------------- | -------------------------------------- |
| `promoBanner` | 360   | 348px    | `figure[data-promo-media]` at 683px    | `min-h-96` + aspect ratio, no `w-full` |
| `carousel`    | 360   | 348px    | `figure[data-carousel-media]` at 683px | identical                              |

**The cause, stated once.** An overlay figure carried `min-h-96` (384px) and an aspect ratio but no
width. CSS resolved the ratio in the direction it was given: the minimum HEIGHT decided the width,
producing 384 × 16/9 ≈ 683px inside a 360px phone. `min-w-0` was already present and did nothing,
because the figure was not being squeezed by its track — it was being inflated by its own height.

Both now carry `w-full`, so the track decides the width and the ratio decides the height, and both
step `min-h-64 @md:min-h-96` so the narrow case has a narrow minimum.

## What the measurement did NOT find

Everything else passes at all four widths and in RTL. That includes the sections a code-reading
audit would have flagged: `comparisonTable` and `pricingPlan` use one responsive prefix each, and
`navLinks`, `pageHeader`, `pageFooter`, `stack` and `richTextBlock` use none — and none of them
overflows, because they are built from flow layout that narrows on its own.

That is the whole reason this audit is a measurement. A count of `@sm:` prefixes would have produced
a list of seven sections to "fix", five of which are correct as they are, and would have missed both
of the two that were actually broken.

## Two measurement errors in the gate itself, found before they could mislead

Recorded because a gate that has been wrong once is worth reading carefully.

1. **The RTL edge was computed, not read.** `board.left + width` is only the right edge in LTR; in
   RTL the board lays out from the right, and the gate reported a 96px overflow that did not exist.
   It now reads `getBoundingClientRect().right`.
2. **Absolutely-positioned decoration counted as overflow.** A hero's decorative glow sits outside
   the flow deliberately and is not something a person can scroll into. The gate reported a constant
   64px overflow at every width, which is the signature of a fixed decoration rather than a layout
   fault. Elements with `position: absolute` are now excluded.

Both were mine, and both would have sent the next reader to the wrong file.

## The gate fails when it should

Reverting the `PromoBanner` fix reproduces
`"promoBanner" overflows by 348px at 360px — figure[data-promoMedia].m-0 is 683px wide`. The message
names the section, the width, the amount and the element, which is the difference between a gate
someone can act on and one they learn to re-run hoping it goes green.

## T125: why the pipeline does NOT emit `setResponsive` per section

The obvious reading of FR-041 is that a generation should write per-breakpoint overrides onto every
section it creates. It was built far enough to see why it is wrong, then removed.

**A `responsive` override is keyed to a BREAKPOINT — a guess about the viewport. These sections
declare their behaviour with CONTAINER queries — a statement about the space the section is actually
in.** A three-column feature grid dropped into a narrow sidebar on a 1440px monitor becomes one
column under a container query and stays three under a breakpoint override, because the viewport is
wide and the section is not. Writing overrides at generation time would freeze, in the document, a
decision the block makes better at render time — and would do it for every section of every page, in
a document that then cannot be re-laid-out by moving it.

**A static per-section check was also attempted and removed**, because it measures the wrong thing:
the responsive behaviour lives in shared modules (`section-classes.ts`, `section-layout.css`) that
most sections compose, so a per-folder scan cannot tell a covered section from a neglected one. It
would have shipped a thirty-entry allow-list encoding one person's guesses about which sections "do
not need any", which is worse than no test.

What carries FR-041 instead is the measurement: `responsive.stories.tsx` renders **every registered
section** from its own example at 360, 768, 1024 and 1440 plus RTL, and fails with the section, the
width, the overflow in pixels and the offending element. That is what caught the two real defects,
and it is what will catch the next one.
