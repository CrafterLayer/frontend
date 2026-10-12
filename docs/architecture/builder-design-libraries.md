# Builder design libraries and AI capabilities

Scope: the existing professional-builder-agent feature, Element Library and AI design guidance.
Checked against local registrations and official documentation on 2026-10-11. This is not a claim
that every upstream component is installed, nor a certification of generated visual quality.

This increment stays within the
[professional builder agent plan](../../specs/workspace/014-professional-builder-agent/plan.md); its
scoped acceptance and verification are recorded in
[the element/library increment](../../specs/workspace/014-professional-builder-agent/verification-element-patterns-2026-10-10.md)
and
[the quality/Frontend increment](../../specs/workspace/014-professional-builder-agent/verification-quality-frontend-2026-10-10.md).

## Runtime boundaries

| Capability               | Current integration                                                  | How an agent may use it                                                                                         |
| ------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| shadcn-inspired controls | 12 owned, token-bound block adaptations in `extensions/shadcn`       | Registered block types with their actual catalog props; not arbitrary upstream imports                          |
| Magic UI effects         | ShineBorder, Marquee, ShimmerButton, DotPatternSurface               | Optional registered signature effects, only when their props schema is supplied                                 |
| Aceternity effects       | AuroraBackground, CloudShader, SpotlightSurface                      | Same registered-block boundary; not the whole upstream catalog                                                  |
| Motion                   | Managed `motion/react` module and existing animation integration     | Import only in a managed React code project whose dependency lock admits it                                     |
| GSAP / PixiJS            | Existing named timelines, closed scenes and opt-in free-code runtime | `motion.add`, `media.add`, or scoped custom scene code when free-code is on                                     |
| Compound elements        | Eight shared declarative recipes                                     | Manual Library or AI `element.insert` with `preset` + bounded `content`                                         |
| Embla 8.6.0              | Lazy carousel behavior + managed vanilla module                      | Existing carousel marker, or `embla-carousel` in an explicitly locked React project; not `embla-carousel-react` |
| axe 4.13.0               | Development-only Playwright evaluation                               | Automated WCAG checks with bounded findings; not a generated-site dependency or a visual-design score           |

The code-project managed catalog is separate from the declarative block catalog. Installing a
dependency in the editor does not automatically make it available to an authored site. Apps still
reach these capabilities through the public `@craftkit/builder` facade.

## Composition first, targeted dependencies next

The immediate gap was reusable composition and capability guidance, not a missing rendering engine.
Ordinary cards, checklists, steps and Bento layouts use static markup. Existing controls/effects
cover ordinary page composition without another palette or decorative engine. The subsequently
approved quality increment adds axe for evaluation and Embla for a concrete interaction gap.

Possible later additions should be driven by a concrete use case: an audited chart adapter for
dashboard/data pages, or additional registered controls from shadcn for richer forms. Each needs its
actual schema, accessible behavior, RTL tests, licensing, export path and an explicit AI usage
contract. Do not mark an entire library supported merely by listing its name in a prompt.

Official references: [shadcn's open-code model](https://ui.shadcn.com/docs),
[shadcn RTL](https://ui.shadcn.com/docs/rtl),
[Magic UI components](https://magicui.design/docs/components),
[Aceternity components](https://ui.aceternity.com/components), and
[Motion reduced-motion guidance](https://motion.dev/docs/react-use-reduced-motion).

## Shared elements and design guidance

`schema/src/element-recipes` owns feature/metric/quote cards, notice, checklist, process steps,
contact card and Bento grid. Inputs are bounded; unsafe link schemes and unknown content keys are
refused by the AI tool. Defaults do not fabricate metrics, endorsements or contact destinations.

Both insertion paths produce editable trees and a single undoable transaction. Existing generated
page-kit classes preserve the page palette; plain pages use site tokens. Preview CSS goes through
the static renderer's scoping, including the page kit's relative `> *` token selector.

The actual build-fill skill receives compact layout/readability checks. The server's build and edit
instructions share library/runtime guidance through the headless wire facade. Tool prompts list the
eight recipe ids and content shape; edit/section caps are bounded at 1900/1200 characters,
preserving important existing signatures instead of expanding the full component catalog.

Provider-produced visual improvement requires a separate representative generation evaluation; unit
tests alone do not establish it. Local QA can verify the recipes and rendering without paid model
calls or altering the user's saved browser project.

## Authored Frontend quality increment

The user explicitly expanded the authored path to interactive React sites, dashboards and multi-step
Frontend flows. `AUTHORED_DESIGN_TEACHING` is wired into `/authored/run`'s real cached system
prefix, through `@craftkit/builder/wire`. It teaches brief-specific composition, functional
state/events, responsive/RTL data layouts, accessible controls, honest local/demo states and managed
imports. The declarative fill contract remains separate; its restricted commands are not arbitrary
React.

Embla is MIT, dependency-free, and owned by `builder-media-engines`. Its npm tarball omits LICENSE,
so the matching tagged notice is retained with provenance and embedded in both asset/catalog builds.
The standalone asset is under a 20 kB gzip budget and loaded only for interactive carousels. Editor
canvas selection/dragging retains native markup. Catalog manifest/modules are part of the artifact
fingerprint; old v1 locks stay valid and new imports still require an exact dependency-lock entry.
Adding a catalog module does not rewrite existing projects or silently add their dependencies.

axe's MPL-2.0 package is only a dev dependency of `apps/evals`. `src/accessibility/scan.ts` scans an
already-open controlled page; it does not navigate or change sandbox permissions. Reports count all
serious/critical violations before bounding rule/node evidence, omit raw DOM HTML and distinguish
execution failures, empty content, manual-review-needed and automated pass. They are evaluation
evidence, not yet an automatic repair loop in the Source Agent. No failing scan is suppressed to
claim quality.

Run the real positive/negative browser gate with:

```sh
pnpm --filter @craftkit/evals test:accessibility:browser
pnpm --filter @craftkit/evals test:frontend:browser
```

The second gate compiles a hand-authored Dashboard/workflow through the managed catalog, then tests
search, filtering, empty results, validated steps, back navigation, mobile/desktop overflow and axe
in LTR/RTL Chromium. It proves runtime capability, not that model-produced designs meet the same
bar.

Next release gates: revision-bound preview inspections fed into bounded repair, a representative
website/dashboard/workflow corpus with interaction assertions, blind visual review, and live model
quality/cost comparisons with approval. Backend/auth/payment work remains separately scoped. This
increment does not certify global product quality or complete all feature 014 release requirements.

## Pixi creative increment: games, stories and murals

PX-001..005 in the existing feature plan govern this additive increment. `ck.scene()` now exposes
the 1.1.0 kit: focus-scoped native/virtual input, fixed-step simulation and manual chapter
navigation. Existing `s.tick`, seeded composition, palette/noise, resize and quality helpers remain.
Simulation stops in the editor and under reduced motion; story chapters still render on manual
navigation. Generated assets retain their existing licence, digest and 16 kB gzip kit budget.

| Installed capability       | Actual access                                         | Intended use                                                                                          |
| -------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| PixiJS 8.22.0              | `s.PIXI` from `await ck.scene()`                      | Containers, Graphics, sprites, text, assets and custom scenes; one namespace                          |
| Matter.js 0.20.0           | `libs: ['physics']`, `s.lib.physics`                  | Collisions/rigid bodies; `Engine.update(engine, dt * 1000)` inside `s.fixedTick`, not a second Runner |
| pixi-viewport 6.0.3        | `libs: ['viewport']`, `s.lib.viewport.Viewport`       | World camera; own plugin teardown, manual update when appropriate                                     |
| pixi-filters 6.1.5         | `libs: ['filters']`, reviewed `s.lib.filters` adapter | Fifteen registered filter constructors, not the whole upstream filter catalog                         |
| Particle emitter v8 port   | `libs: ['emitter']`, `s.lib.emitter`                  | Tracked emitters; update with seconds, release on scene disposal                                      |
| perfect-freehand / roughjs | `libs: ['brush', 'rough']`                            | Stroke polygons and hand-drawn Graphics paths                                                         |
| Existing sound engine      | `s.sound` / `ck.sound`, with explicit audio request   | Procedural effects and admitted project sound assets; gesture unlock, mute and voice caps             |

The new built-in project skills are `craftkit.pixi-games`, `craftkit.pixi-stories` and
`craftkit.pixi-murals`. Arabic/English playable or narrative requests activate the relevant skill
and core dependency; ordinary business "our story" copy and a games-store landing page do not
activate gameplay guidance. These are instructions on actual runtime APIs, not new tool grants or
global coding-agent skill installations. Their worked examples are also exported as data through
`@craftkit/builder/wire` for deterministic evals. Context estimates are not billed tokens.

Full-build and Plan lanes explicitly select matching expertise rather than assuming automatic
activation. The planner receives the original brief; a writer receives only its own scene contract,
with the original creative brief additionally available to the hero. Retry/Finish preserve this
targeting. With free code on, a creative scene uses a JS-capable writer instead of a fixed section
kit; ordinary sections keep their existing kit path. Existing skill/context budgets and policies
still apply, and unrelated automatic skills are not enabled.

Try briefs such as:

- `ابني لعبة جمع نجوم ثنائية الأبعاد، مع بدء وإيقاف وإعادة لعب وأزرار لمس.`
- `اعمل قصة تفاعلية من ثلاثة فصول، بنص عربي وأزرار السابق والتالي وإعادة القصة.`
- `اعمل جدارية توليدية بطبقات وألوان الموقع، تحريك خفيف واحترام تقليل الحركة.`

Free code must be enabled for custom runtime JS; otherwise the agent stays with the registered
closed `media.add` scenes and explains the opt-in. This does not automatically admit `pixi.js` into
a managed React project's dependency lock. Full games/backends, arbitrary imports and multiplayer
services are not implied by this capability.

### Dependency decisions, checked 2026-10-11

No dependency was added for this increment: physics, camera, filters, drawing and audio were already
installed and integrated. Official [Pixi ticker](https://pixijs.com/8.x/guides/components/ticker),
[scene graph](https://pixijs.com/8.x/guides/concepts/scene-graph) and
[performance](https://pixijs.com/8.x/guides/production/performance-tips/) guidance support reusing
one render loop and bounded scene objects. The existing
[filters v6](https://github.com/pixijs/filters) and
[viewport](https://github.com/pixijs-userland/pixi-viewport) target Pixi v8.

Proposed on 2026-10-11 and **admitted on 2026-10-12** (see the creative engines section below):
[@pixi/tilemap v5](https://github.com/pixijs-userland/tilemap), MIT and mapped to Pixi v8, now ships
as its own lazy `ck-lib-tilemap.js` asset with a single-namespace adapter, licence banner, export
path and measured budget. [@pixi/sound v6](https://github.com/pixijs/sound) is compatible/MIT but
would duplicate existing basic playback; reconsider only for audio-sprite/filter requirements the
current engine cannot meet. Do not install Phaser alongside Pixi merely to label this a game
builder; that is a separate engine and lifecycle decision.

Run exact taught examples against generated runtime assets with:

```sh
node scripts/build-studio-engines.mjs kit
pnpm --filter @craftkit/evals test:pixi-creative:browser
```

These checks exercise local runtime capability, not paid model output quality or all game genres.
The creative browser fixture has a local DOM/JSX-capable TypeScript project. Evals `typecheck`
checks it separately from the headless model-quality harness; Node service configuration is
unchanged.

## Creative engines and the creative agent (2026-10-12)

Five new lazily loaded Studio libraries extend `ck.scene({ libs: [...] })`. Each is a separate
minified IIFE generated by `scripts/build-studio-engines.mjs` into
`packages/builder/renderer/src/engines/studio/<key>-source.ts`, loaded only when a region names its
key literally, shipped by the export as `assets/ck-lib-<key>.js`, and described as data in
`CK_LIBRARY_REFERENCE` (`@craftkit/builder-schema`). Pixi-bound keys receive the page's one Pixi
namespace; nothing is bundled twice.

| Key        | Source / licence          | gzip / budget | What it gives an authored scene                                                                                                                                                   |
| ---------- | ------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anim`     | first-party               | 6.2 / 9 kB    | Penner easings, tweens (`to/from/fromTo`, repeat, yoyo, colour keys), timelines, springs, shake, sprite-sheet state machines and procedural character rigs (9 poses, blended)     |
| `fx`       | first-party (Pixi-bound)  | 5.1 / 9 kB    | Pooled particles over generated textures, 12 named bursts, 7 weather kinds, trails, shockwave rings, flash, shake, floating text, glow pulses; capped, no-op under reduced motion |
| `dialogue` | first-party               | 9.2 / 12 kB   | Cast table, branching dialogue graph (lines, choices, eval-free conditions, variables, random, endings), versioned save/restore, accessible DOM dialogue box (Arabic/English)     |
| `ink`      | inkjs 2.4.0 (MIT)         | 64.8 / 66 kB  | inkle's Ink compiler + runtime, wrapped in the same dialogue interface so the same box plays it; bounded source/steps                                                             |
| `tilemap`  | @pixi/tilemap 5.0.2 (MIT) | 10.8 / 14 kB  | `world()` from ASCII rows + legend, 12 procedural tile styles, sub-stepped AABB collision with one-way platforms, pickups, and a follow camera                                    |

Design decisions:

- **Late pipe registration.** `ck.scene` opens the stage and loads libraries in parallel, so the
  Pixi renderer usually exists before `@pixi/tilemap` registers its pipe. Pixi v8 builds pipes at
  `init()`; the tilemap adapter installs `TilemapPipe` on the live renderer from the shared adaptor
  list (`renderer.config.renderPipeAdaptors`) exactly as `_addPipes` would, once.
- **Data, not eval.** Dialogue conditions and updates use a parsed expression language (comparisons,
  arithmetic, and/or/not, variables) — never `eval`/`Function`; every jump target is validated
  before a story starts; silent-node loops and step limits stop with a RangeError.
- **Ink compiles in the page.** The 2026-10-11 roadmap preferred tool-side compilation, but
  agent-authored scenes have no tool step: the Agent writes Ink text inside the scene. The compiler
  therefore ships in the lazy `ink` asset only (never in editor or ordinary page bundles), with a
  100 000-character source and 2 MB JSON bound.
- **Accessibility first.** Story text, speakers and choices live in real DOM (`role=status` live
  line, numbered native buttons, number keys 1–8 scoped to the box, transcript). The typewriter is
  visual only and reveals whole words for Arabic. Every engine respects `s.reducedMotion` and
  `s.editor` (still frame, inert controls).
- **Not admitted:** AssetPack (its image pipeline needs the native `sharp` build this workspace
  disallows in `allowBuilds`), `@pixi/layout` (no demonstrated in-canvas HUD need yet) and Spine
  (runtime licence and licensed skeleton assets unresolved).

### The creative agent

`packages/builder/ai/src/creative/` is the Agent's creative domain:

- **Creative planner** (`planCreativeBrief`): a deterministic, model-free pass over an Arabic or
  English brief that decides the genre (platformer, maze adventure, visual novel, picture book,
  chapter story, physics toy, puzzle, arcade, mural), the libraries to name, mechanics, story beats,
  setting-matched effects/weather (forest → leaves/fireflies, sea → bubbles, winter → snow…), rig
  states to animate and the cast. Creative scene writers receive it as a `data` fragment
  (`craftkit:creative-brief`); ordinary writers and builds without free code do not.
- **Character & asset memory** (`CreativeMemoryV1`, the "story bible"): characters (id, name, role,
  colour, look, voice, traits, portrait), approved assets (with licence and owner), locations and
  canon facts. Hosts own persistence; anything loaded is re-validated and bounded.
  `learnCreativeMemory` grows it from the scenes the Agent actually wrote — their literal
  `dialogue.cast([...])` arrays (read by a data-only literal parser, never executed), literal
  texture URLs and background cues. Builds read it through `RunAiAgentOptions.creativeMemory`.
- **Skills** (in `skills/creative/`, next to the Pixi playbooks): `craftkit.pixi-director`
  (explicit: plan → cast → world → beats → mechanics → look → effects → motion → checks, and
  continuity rules), `craftkit.pixi-animation`, `craftkit.pixi-effects`, `craftkit.pixi-dialogue`
  (graph + Ink) and `craftkit.pixi-tile-worlds`. The creative selection lane brings companions with
  a matched playbook (a game gets effects and animation; a story gets dialogue and animation; a
  platformer gets the game playbook), within each writer's skill budget. Each skill's `e.g.` example
  is exported through `@craftkit/builder/wire` and executed in a real browser.

The playground keeps the story bible per browser (`ck-agent-story-bible:v1`), teaches it after every
build or applied edit, sends it to each run, and shows it in the **StoryBiblePanel** above the
composer (when free code is on or the bible holds anything), where the person can add a character or
a canon fact and remove or clear entries.

Try briefs such as (free code on):

- `اعمل لعبة منصات في غابة، بطلها ثعلب اسمه رومي يجمع النجوم ويتجنب الحمم.`
- `بدي رواية مرئية فيها حوار بين ليلى وعمر وخيارات تغيّر النهاية.`
- `قصة أطفال قبل النوم عن قمر صغير، مع شخصيات متحركة ومؤثرات سحرية.`
- `A maze adventure under the sea with a talking turtle and two endings.`

Verify with:

```sh
node scripts/build-studio-engines.mjs all
pnpm --filter @craftkit/builder-media-engines test
pnpm --filter @craftkit/evals test:creative-engines:browser
```

## Live Agent work and measured usage

The existing HTTP bridge streams public lifecycle `status` frames and an additive `usage` frame
before its unchanged final `result`. Unary peers expose the bounded `x-craftkit-ai-usage` response
header. Older peers remain readable; missing counts are unknown. Provider callbacks become
attributed run events, and the chat keeps a bounded operational history and deduplicated attempt
receipts. Private reasoning text is not surfaced. Cached local replies add zero newly incurred
usage; token counts and reported USD are separate from request/context estimates.

Each physical writer retry, checker repair and successor has its own receipt identity. The chat
retains up to 64 attempts and 16 operational updates. If an additional attempt exceeds that ledger,
an overflow marker survives reload and totals remain unknown, not a misleading partial bill.
Likewise, any missing receipt keeps its corresponding aggregate unknown. These are provider-reported
counts and costs, not an invoice or a reconstruction of unmeasured fallback calls.

Actual parallelism still means independent section writers with ordered validation/application. A
single-target edit is one writer; changing the worker menu does not accelerate one long model call.
Old unmeasured runs cannot be retroactively assigned exact token spending. Paid-model latency,
fallback costs and final design quality require separately authorized representative live evals.
