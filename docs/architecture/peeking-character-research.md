# Peeking Character Pattern: Research Report
*Generated: 2026-11-05 | Sources: 9 read (5 in full) | Confidence: Medium-High*

## Executive Summary
The "peeking character" is a small animated mascot whose head rises from behind an edge
(a line, a progress bar, a card's top border, a capsule) so only the ears, face and eyes
show. Production apps use the same recipe: the character is drawn **behind** the edge
and clipped there; it is **measured so its eyes sit just above the edge**; it rises on a
spring, holds, and drops back quickly; while up it **blinks and breathes**; and it is
static under `prefers-reduced-motion`. No repo found ships this as a reusable "any
character" generator. The closest building block is a JSON-defined vector mascot
(open-mascot, MIT), which is the right model for "build this from any character".

The reference screenshot is GitHub's own mascot art. That character is GitHub's
trademarked IP, so this feature must generate **original** characters with the same
*pattern*. It must not reproduce that cat.

## 1. How production apps build the peek
- **Vellum Assistant** (MIT): every 3–10 s, chosen at random, the creature rises from
  behind the capsule's top edge (or hangs under the bottom edge). It goes "far enough to
  show its eyes", holds 1.6 s, then ducks back. A shared `avatarPeekMetrics` measurement
  "puts every creature's eyes on the edge". Motion is a spring up and a quick duck.
  While up, the creature blinks and breathes. It is off under reduced motion and while the
  app is busy.
  Lessons from the PR history: peeking from the sides "read as detached", a collar
  joining edge and creature "read as a second shape", and a bordered rim "read as a slot
  in a device". **Top or bottom only, plain rise.**
  ([PR #41924](https://github.com/vellum-ai/vellum-assistant/pull/41924))
- **Gumroad** (MIT): at rest the mascot is "a small static peek behind the card's top
  edge". On hover it jumps through lift, squash and rebound frames and lands on the
  border. It blinks every 4 s. Touch devices show the raised state, and reduced-motion
  users get the static peek. Done with CSS keyframes plus sprite frames.
  ([PR #7334](https://github.com/antiwork/gumroad/pull/7334))
- **PyRIT docs** (MIT): mascot PNGs slide in flush from the page edge at scroll
  positions, using CSS scroll-driven reveal.
  ([PR #2099](https://github.com/microsoft/pyrit/issues/2099))

## 2. Character rigs and idle motion
- **open-mascot-studio** (MIT, zero deps): "one portable JSON definition into expressive
  SVG motion". It has blob shapes, per-eye scale, placement and gaze, 15 expressions,
  blinking, micro-saccades, drift, cursor-follow, and `setLookTarget({x,y})`.
  This is the model for "build it from any character definition".
  ([repo](https://github.com/0oooh/open-mascot-studio))
- **svg-character-animator** (code MIT, example art CC BY-NC): an Agent Skill. Parts
  share `id`s across states (`left-eye`, `mouth`, `body`). It interpolates exactly when
  path structure matches, morphs only when the shape really changes, and fades parts
  that appear in only some states. It **blends idle motion with transitions** so they
  don't fight. ([repo](https://github.com/molauu/svg-character-animator))
- **Codrops mascot breakdown**: a `<clipPath>` cuts limbs at the ground line, the same
  trick that hides the body below a peek edge. Parts move together on one timeline beat,
  with a different easing going up than coming down for weight, and a tiny overshoot on
  landing. ([article](https://tympanus.net/codrops/2026/05/05/reverse-engineering-claude-ais-mascot-animations-with-svg-and-gsap/))
- **mascots** (MIT): a desktop companion with eye-tracking and natural blink.
  ([repo](https://github.com/0xPD33/mascots))

## 3. Technique matrix for CraftKit
| Surface | Hide below edge | Rise / idle | Notes |
|---|---|---|---|
| HTML/CSS (customCode) | parent `overflow:hidden` or `clip-path: inset(0 0 X 0)` on the head wrapper | `@keyframes` rise (spring via `cubic-bezier(.34,1.56,.64,1)`), blink = `scaleY` on eye group | Works without JS; JS only adds look-at-pointer |
| Inline SVG | `<clipPath>` rect ending at the edge's y | same keyframes on `<g>` with `transform-box: fill-box` | Best for crisp vector characters |
| PixiJS | `container.mask = Graphics rect` above edge (or draw the edge on top) | ticker: spring on `y`, blink timer scales eye `Graphics` | Use the scene's existing ticker; respect reduced motion |

## Key Takeaways
- Treat the **edge** as the anchor. Place the character so its eye line sits about 8–15%
  of head height above the edge, and clip everything below it.
- Use a **spring up, quick duck, random 3–10 s interval, and blink every 3–5 s** while up.
  For reduced motion, show a static raised peek.
- Define characters as **data** (shape, ears, palette, eye style, blush), so any original
  character can peek. Don't hand-draw one mascot.
- Ship **top or bottom edge only**, with no collar and no bordered rim (from Vellum's
  iteration history).
- Licences: everything worth borrowing as *ideas* is MIT. Don't copy CC BY-NC example
  art, and never the GitHub mascot.

## Sources
1. [vellum-ai/vellum-assistant PR #41924](https://github.com/vellum-ai/vellum-assistant/pull/41924): creature peeks over a capsule edge, eye-on-edge metrics, iteration lessons
2. [antiwork/gumroad PR #7334](https://github.com/antiwork/gumroad/pull/7334): mascot peeks behind a card's top edge, hover jump, blink, reduced motion
3. [microsoft/pyrit PR #2099](https://github.com/microsoft/pyrit/issues/2099): scroll-driven edge peeks in docs
4. [0oooh/open-mascot-studio](https://github.com/0oooh/open-mascot-studio): JSON-defined SVG mascot engine (MIT)
5. [molauu/svg-character-animator](https://github.com/molauu/svg-character-animator): agent skill for SVG character state machines and idle motion
6. [Codrops: mascot animations with SVG + GSAP](https://tympanus.net/codrops/2026/05/05/reverse-engineering-claude-ais-mascot-animations-with-svg-and-gsap/): clipPath ground cut, timeline beats, easing for weight
7. [0xPD33/mascots](https://github.com/0xPD33/mascots): eye tracking and blink companion (MIT)
8. [gist 7959409](https://gist.github.com/7959409): canvas eyes following the cursor
9. [Petit-Lutin/svg-css-animations](https://github.com/Petit-Lutin/svg-css-animations): single-SVG cat with CSS class animations

## Methodology
Ran 4 searches (web + developer index). Read 5 sources in full and the rest from
excerpts. Sub-questions: production peek implementations; character rigs and idle
motion; definition-driven generation; PixiJS masking; licences. Gap: no public repo
does a PixiJS-specific peek. The Pixi column above is inferred from standard Pixi
masking APIs, not from a cited repo.
