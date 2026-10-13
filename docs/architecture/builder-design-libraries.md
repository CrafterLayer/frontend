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

| Installed capability       | Actual access                                         | Intended use                                                                                        |
| -------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| PixiJS 8.22.0              | `s.PIXI` from `await ck.scene()`                      | Containers, Graphics, sprites, text, assets and custom scenes; one namespace                        |
| Matter.js 0.20.0           | `libs: ['physics']`, `s.lib.physics`                  | Collisions/rigid bodies; `world(s)` (2026-10-13) or `Engine.update` inside `s.fixedTick`, no Runner |
| pixi-viewport 6.0.3        | `libs: ['viewport']`, `s.lib.viewport.Viewport`       | World camera; own plugin teardown, manual update when appropriate                                   |
| pixi-filters 6.1.5         | `libs: ['filters']`, reviewed `s.lib.filters` adapter | Fifteen registered filter constructors, not the whole upstream filter catalog                       |
| Particle emitter v8 port   | `libs: ['emitter']`, `s.lib.emitter`                  | Tracked emitters; 13 presets via `spawn`/`burst` (2026-10-13); release on scene disposal            |
| perfect-freehand / roughjs | `libs: ['brush', 'rough']`                            | Stroke polygons and hand-drawn Graphics paths                                                       |
| Existing sound engine      | `s.sound` / `ck.sound`, with explicit audio request   | Procedural effects and admitted project sound assets; gesture unlock, mute and voice caps           |

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

### Game libraries (2026-10-12)

Three more keys, same pipeline. Each `create(s, …)` takes the scene, so editor silence, page
language, the seeded random and disposal through `s.dispose` cannot be forgotten.

| Key      | Source / licence                                                    | gzip / budget | What it gives an authored scene                                                                                                                                       |
| -------- | ------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio`  | @pixi/sound 6.0.1 + zzfx 1.3.2 (MIT, Pixi-bound)                    | 16.0 / 18 kB  | 11 procedural ZzFX effects with no files, music from admitted URLs with fades, master volume/mute, an accessible bilingual mute toggle, pause on a hidden page        |
| `gameai` | yuka 0.7.8 (MIT)                                                    | 20.7 / 22 kB  | Steering agents bound to display objects (seek, flee, arrive, pursue, evade, seeded wander, patrol, avoidance, separation), A* chases over tilemap worlds, small FSMs |
| `hud`    | @pixi/ui 2.3.2 (MIT; tweedle.js MIT, typed-signals CC0, Pixi-bound) | 25.1 / 27 kB  | Health/xp bars, sliders, buttons, check boxes, scrolling lists and score text in RTL-aware corners, themed from the site tokens, each with a native DOM twin          |

- **No audio before a gesture.** @pixi/sound and ZzFX both create an AudioContext when their module
  runs, so `ck-lib-audio.js` evaluates them only from a pointer/key/touch inside the scene's region
  (single-file `import()`); music requested earlier waits, effects are skipped. Music URLs reuse the
  `s.texture` scheme rule (`https:`, `data:audio/`, `blob:`), bounded to 6 tracks × 12 MB.
- **Pixel-scale steering.** yuka's x/z plane carries the scene's (x, y); its metre-tuned separation
  and path arrival are rescaled, wander uses `s.random`, and a bounded grid A* reads tile solidity
  live. The build marks yuka's module-scope scratch vectors pure so ~40 % of it tree-shakes.
- **HUD is not UI.** Only glanceable state goes on the canvas; every canvas control has a keyboard
  path through a visually hidden native twin that appears on focus. Menus and forms stay DOM.
- **Teaching.** `craftkit.pixi-audio`, `craftkit.pixi-game-ai` and `craftkit.pixi-hud` auto-activate
  on narrow game phrases only; plain words ("music", "أعداء", "xp") count inside a creative lane
  (`GAME_LIB_CUES`), where the planner also adds the libraries and their mechanics.

### Character art: `peeps` (2026-10-13)

People for stories and games come from `s.lib.peeps`: Open Peeps, Pablo Stanley's hand-drawn
characters (design CC0 1.0), drawn by DiceBear's `open-peeps` style (`@dicebear/core` +
`@dicebear/open-peeps` 9.4.3, code MIT). `ck-lib-peeps.js` is 111.3 / 116.9 kB gzip, nearly all of
it the art's SVG path data, and loads only for scenes listing `'peeps'`; nothing is fetched at run
time.

- **One name, one look.** The seed is the character's name, so a cast stays consistent across
  sections, chapters and visits (`s.lib.peeps.cast([...])`, a literal array the story bible learns
  like `dialogue.cast`). A mood picks only the face; art direction pins hair, skin, outfit, hair
  colour, accessories or facial hair without reshuffling the rest; a cast colour dresses the outfit.
- **Three outputs.** `svg(options)` and `dataUrl(options)` are pure; `texture(s, options)` and
  `textures(s, options, moods?)` rasterize at the scene's resolution for the canvas;
  `cast.members()` hands `s.lib.dialogue.cast` a portrait per mood for the accessible box.
- **Teaching.** The director carries the API (people are `s.lib.peeps`; animals and creatures stay
  drawn); the dialogue playbook's example stages two peeps whose faces follow each line's emotion;
  the story and game playbooks point people there; the planner adds `peeps` to visual novels and to
  briefs that name people (girl, family, أصدقاء…).

### Responsive scenes: design mode (2026-10-13)

`ck.scene({ design: { width: 1280, height: 720, fit?, align?, zoom?, maxZoom? } })` gives a scene
`s.world`, a container in design units that the kit scales and centres to the region on every resize
(`fit`: `contain` default, `cover`, `width`, `height`; `align`: `center`, `top`, `bottom`), so a
story or game composed for a desktop stage keeps its whole composition on a 390 px phone. The
letterbox takes the theme surface (the canvas clear colour) unless the scene set `background`
(`null` keeps it clear); `s.pointer.x/y` read design units (`nx/ny` stay fractions of the region);
`s.design` gives `scale` and `view`, the visible part of design space, to paint backdrops over;
`s.compact` (< 600 CSS px), `s.portrait` and `s.ui(px)` (design units that show as `px` CSS px)
switch layouts and keep canvas text and hit radii readable. Copy and controls stay native-size DOM.

- **Why not pixi-viewport by default.** Fitting a fixed design is one scale and one offset per
  resize: a plain Container in `ck-lib-kit.js` (15.8 kB gzip budget unchanged). pixi-viewport's
  drag, pinch, wheel, inertia and clamps earn their 12.9 kB only for a big map: `zoom: true` with
  `libs: ['viewport']` makes `s.world` a Viewport fitted to the design (the fit is the furthest zoom
  out), built inside `ck-lib-viewport.js` (`zoomWorld`) so the camera code ships only with scenes
  that list it.
- **Never trapping the page.** The wheel zooms only with ctrl/⌘ (a trackpad pinch) or while the
  canvas has focus; a plain wheel scrolls the page. On touch one finger scrolls the page
  (`touch-action: pan-x pan-y`) and two fingers pan and pinch. No inertia under reduced motion,
  where each move clamps and renders at once; the editor canvas gets the fitted world, no gestures.
- **Teaching.** The core skill's SIZE line carries the API; the game and story playbooks compose at
  1280 × 720 (`align: 'bottom'` keeps the art under the DOM copy on a phone). The scene probe holds
  a design-mode scene filling a 390 px phone with its pointer in design units
  (`apps/evals/src/pixi-creative/probe.browser.test.ts`), and `design.browser.test.ts` the camera.

### Particle presets and the physics world (2026-10-13)

The user asked for Matter.js and `@pixi/particle-emitter` in Pixi. Both were already there:
`s.lib.physics` is Matter 0.20.0, and `s.lib.emitter` is the Pixi v8 port of
`@pixi/particle-emitter` (`@spd789562/particle-emitter` 1.0.2, vendored and audited — the official
package supports Pixi v7 only). What was missing was the craft between the API and a good scene, so
this round adds a thin, optional layer on top of each, upstream APIs unchanged:

- **`s.lib.emitter.spawn(s, name, options)` / `burst(s, name, options)` /
  `presets.<name>(s, options)`**: thirteen tuned recipes (fire, smoke, sparkles, snow, rain,
  confetti, magic, bubbles, leaves, petals, fireworks, dust, embers) on procedural textures — eight
  white shapes drawn with Pixi Graphics into one atlas per renderer, since a v8 `ParticleContainer`
  draws from a single texture source; never a fetched image. Colours come from `s.palette` and
  whether its surface is dark (additive glow only there), wind and slant mirror with `s.dir`, rates
  follow the area and `s.count`, the editor gets half, streams start pre-warmed, and reduced motion
  gets one frozen frame (a burst emits nothing). Two CraftKit behaviours (`colorPick`, `drift`)
  register through upstream's `Emitter.registerBehavior`, so the vendored source keeps only its
  three audited patches. `ck-lib-emitter.js` budget 12,000 → 17,400 bytes gzip (measured 16,545).
- **`s.lib.physics.world(s, options)`**: an Engine stepped in `s.fixedTick`, static walls just
  outside the design (or the region, refitted on resize), `add(body, display)` links that copy
  position and angle each step, pointer drag through a Matter `MouseConstraint` fed from `s.pointer`
  in design units (armed only by a press on the scene, never through DOM controls; a touch on a body
  alone stops page scrolling), synchronous settling plus one still frame in the editor and under
  reduced motion, and disposal of loop, listeners, constraint and engine. It fits inside the
  unchanged 29,500-byte `ck-lib-physics.js` budget (29,424).
- **Teaching.** `CK_LIBRARY_REFERENCE` lists both entry points (EN/AR); the physics playbook's
  example is now a design-mode toy on `world(s)` (no hand-written loop, settle or resize code, 200
  tokens shorter), the scroll-mural playbook spawns its fireflies with one `spawn` call, and the
  games and murals playbooks name the helpers in place of the raw calls — each still under the
  single-skill ceiling.
- **Proof.** `apps/evals/src/pixi-creative/particles.browser.test.ts` reads pixels back from the
  renderer for every preset and every burst at 390 and 1280 px in LTR and RTL, checks the rain slant
  mirrors, the reduced-motion still frame, a world settling on its floor, a pointer drag and a
  disposal that leaves no body, constraint or ticker behind.

### Procedural maps and animated GIFs: `procgen`, `gif` (2026-10-13)

Asked to strengthen PixiJS results with packages, we evaluated rot-js, poisson-disk-sampling,
@pixi/gif and @pixi/layout with yoga-layout against the same bar: a permissive licence read from the
installed tarball, the gzip size of the lazy asset, the Studio preview's CSP
(`script-src 'unsafe-inline' 'unsafe-eval'`; the unreviewed preview has `connect-src 'none'`) and
the export's (none of its own), Pixi v8 fit, and what the Agent's scenes gain. Two libraries were
admitted, as plain (not Pixi-bound) lazy assets.

| Key       | Source / licence                              | gzip / budget  | What it gives an authored scene                                                                                                                                                                                                     |
| --------- | --------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `procgen` | rot-js 2.2.1 (BSD-3-Clause)                   | 11.7 / 12.4 kB | Dungeons (rooms + corridors), cellular caves and perfect mazes seeded by the scene, always connected, with a reachable start (inline-start side) and exit, BFS paths, field of view, spaced scattering, tilemap rows and a Graphics |
| `gif`     | gifuct-js 2.1.2 (MIT, Pixi's own GIF decoder) | 7.5 / 7.9 kB   | A GIF the person supplied, animated as a `PIXI.Sprite` with AnimatedSprite controls on the scene's ticker; first frame under reduced motion; bounded, thinned when long; `data:` URLs need no network                               |

- **Why procgen.** Hand-written ASCII levels are where generated mazes go wrong: an exit walled off,
  a key behind a wall. `s.lib.procgen` returns a map that is connected by construction (what a
  generator leaves cut off is filled), so the planner adds it to maze, dungeon, cave and roguelike
  games, and the same scene seed always draws the same level. rot.js is imported module by module
  (six generators, its RNG, precise shadowcasting); paths are our BFS (exact on a unit-cost grid),
  and open-space scattering stays the kit's `s.poisson`.
- **Why our own GIF sprite over `@pixi/gif` 3.0.1.** `@pixi/gif`'s entry registers a global `.gif`
  Assets loader on the page's one Pixi namespace when imported, steps frames on `Ticker.shared`,
  keeps every frame's pixels with no bound, would have to be Pixi-bound, and ships gifuct-js and
  js-binary-schema-parser inside its own `lib/` without their licence notice. PixiJS has since
  merged it into `pixi.js/gif`, whose files import Pixi internals by path, so bundling it would ship
  a second copy of Texture/Sprite beside the page's namespace. `s.lib.gif` uses the same decoder
  (gifuct-js 2.1.2, already in the lockfile as pixi.js 8.22's dependency), composites in plain
  arrays, and subclasses the scene's own `PIXI.Sprite`.
- **Not admitted:** `@pixi/layout` 3.2.1 + yoga-layout 3.2.1 — 59.8 kB gzip, nearly all of it Yoga's
  base64 WebAssembly (71.7 kB binary). Measured in Chromium, it compiles under the preview CSP only
  because `'unsafe-eval'` is present and is refused under a policy without it or
  `'wasm-unsafe-eval'`. It also mixes `layout` into Container/Text prototypes for every scene on the
  page, needs its renderer system registered before `app.init` (Studio opens the stage while
  libraries load), and the yoga-layout tarball carries no LICENSE file for the build's audit. Canvas
  menus stay DOM (the HUD rule); responsive canvas layout is design mode plus `s.compact`/`s.ui`.
  `poisson-disk-sampling` 2.3.1 (MIT, 2.8 kB) duplicates `s.poisson`.
- **Teaching.** `CK_LIBRARY_REFERENCE` lists both (EN/AR). The physics playbook teaches a marble
  maze on `s.lib.procgen.maze`, the scroll-mural playbook the person's own GIF; the creative planner
  adds `procgen` (with a mechanic line carrying the API) to maze/dungeon/cave games and procedural
  or roguelike briefs, and `gif` when the brief brings a GIF.
- **Proof.** `apps/evals/src/pixi-creative/procgen-gif.browser.test.ts`: a drawn dungeon whose rooms
  are all reachable, a maze walked as a tilemap world, a `data:` GIF whose read-back pixels change
  colour, at 390 and 1280 px in LTR and RTL, and reduced motion's first frame.

### Mural libraries and hex art: `noise`, `geom`, `hex` (2026-10-13)

Asked (in Arabic) for helper libraries that strengthen murals, installed without hesitation, and
free art packs, so the Agent makes richer murals with less code of its own, we measured each
candidate against the same bar — licence read from the tarball, gzip of the lazy asset, the preview
CSP, what the kit already gives (`s.noise2/3`, `s.fbm`, `s.poisson`, `s.delaunay(…).voronoi`,
`s.palette`) — and admitted three plain lazy assets plus six ready presets.

| Key     | Source / licence                                  | gzip / budget  | What it gives an authored scene                                                                                                                      |
| ------- | ------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `noise` | simplex-noise 4.0.3 (MIT) + first-party           | 4.4 / 4.6 kB   | Worley cells, ridged/billow fractals, domain warp, a seamless 4-D loop and sampled grids, in design units, seeded by the scene                       |
| `geom`  | d3-contour 4.0.2 (ISC), polybooljs 1.2.2 (MIT)    | 10.5 / 11.0 kB | Terraced contour bands and isolines, polygon booleans with holes cut, arch-trimmed Voronoi mosaics with grout, ribbons, insets, smoothing, arches    |
| `hex`   | Kenney Hexagon Pack via kenney-hexagon-pack (CC0) | 75.6 / 79.4 kB | 28 hex tiles (5 terrains with trees, rocks, cacti, crystals; 8 buildings) in one lossless WebP, and a seeded board that mirrors in RTL, with picking |

- **Presets first.** Set D of the scene-preset catalogue — terraced-topography, paper-cut-landscape,
  ribbon-flow, hex-island (mural), mosaic-arch-window, ebru-marbling (pattern) — is applied with one
  `scene.preset` call of 6–8 tokens instead of 240–440 tokens of scene code (4 characters a token),
  code that would itself be several times longer without the libraries (the hand-written
  topographic-contours preset spends 838 tokens on line contours alone). The mural playbook opens
  with every mural, pattern and type preset and asks new scene code to stay under ~9,000 characters;
  set D stays out of the cached tool menu (its edit lane is at its cap) as the kits do.
- **Why our own noise on simplex-noise over fastnoise-lite.** fastnoise-lite 1.1.1 (MIT) is 16.1 kB
  gzip as one class nothing tree-shakes, duplicates the kit's simplex, and its tarball carries no
  LICENSE file (the MIT text sits only in the source header), which the build's licence audit
  refuses. Cellular noise, fractals, warp and loops on the kit's own simplex-noise cost 4.4 kB.
- **Why polybooljs.** polygon-clipping 0.15.7 and martinez-polygon-clipping 0.9.0 depend on
  robust-predicates (Unlicense, outside the licence list — the reason the kit's Delaunay is our own
  code); @velipso/polybool 2.0.11 (0BSD + tslib) is 8.9 kB; polybooljs's four algorithm modules are
  3.5 kB. Its entry file assigns `window.PolyBool`, so it is never imported.
- **Hex art.** kenney.nl, opengameart.org, itch.io and github.com are unreachable from here; npm's
  kenney-hexagon-pack (Lukas Bach, 2019) is Kenney's own sprite sheets and CC0 notice, identical to
  its GitHub repository read through raw.githubusercontent.com. It is a devDependency only:
  `scripts/build-hex-atlas.mjs` packs 28 tiles; the notice and the CC0 1.0 legal code travel in the
  asset banner. The atlas is decoded by an `<img>` because Pixi's Assets loader fetches `data:`
  URLs, which the unreviewed preview's `connect-src 'none'` refuses.
- **Not admitted:** d3-delaunay / delaunator 5 (the kit has it; robust-predicates), bezier-js 6.1.4
  (no LICENSE file), chromotome / nice-color-palettes (the page palette wins), Game Icons
  (`@iconify-json/game-icons`, CC BY 3.0 — attribution an agent-built page cannot guarantee;
  `@icongo/gi` relabels the same icons MIT), `@anabis/kenney-space-kit-mirror` (3-D models).
- **Proof.** `apps/evals/src/pixi-creative/mural-libs.browser.test.ts`: bands from a noise grid, a
  boolean hole that reads back as background, an arch-trimmed mosaic, the hex atlas decoded offline
  with a green grass tile and a board mirrored in RTL; each set-D preset draws, moves within a
  second, runs in RTL, holds one unchanged frame under reduced motion with the ticker stopped, and
  leaves `Ticker.shared` untouched after its region goes; 390 and 1280 px.

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
