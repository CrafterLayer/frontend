# @craftkit/builder-media-engines

The canvas scene engine behind `data-ck-scene` (media-motion, 2026-10-06): PixiJS 8.22.0 plus five
CraftKit scenes, bundled into ONE self-running IIFE.

This is the only package allowed to depend on `pixi.js` or `@pixi/*`. The workspace validator
(`CONTAINED_DEPENDENCIES`, "canvas scene engine") enforces the declaration;
`src/containment.test.ts` enforces the imports. Nothing in the workspace imports this package at
runtime: the renderer carries the built bundle as a generated string.

## Build

```sh
export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
node scripts/build-scene-engine.mjs
```

The script bundles `src/entry.ts` + `installSceneEngine(window)` with esbuild (iife, es2020,
minified, no splitting), reads the licence of every bundled package from its `package.json` and
`LICENSE`, and writes `packages/builder/renderer/src/engines/scene-source.ts` with `PIXI_VERSION`,
`SCENE_SHA256`, `SCENE_BANNER` and `SCENE_SOURCE` (banner + bundle). It fails above 200 kB gzip.
Re-run it after any change under `src/`, and commit the regenerated module.

## Markup

```html
<div data-ck-scene="mural" data-ck-density="medium" data-ck-palette="theme" aria-hidden="true">
  <img src="…" alt="" />
  <!-- the no-JS / reduced-motion fallback AND texture 1 -->
  <img src="…" alt="" />
  <!-- texture 2 -->
</div>
```

| Scene             | What it draws                                                                    |
| ----------------- | -------------------------------------------------------------------------------- |
| `particles`       | Linked, drifting dots in the palette                                             |
| `mesh-gradient`   | Blurred, grained palette blobs on slow paths                                     |
| `parallax-layers` | The images as depth layers following pointer and scroll                          |
| `mural`           | The images tiled into a slowly panning wall under a soft displacement («جدارية») |
| `ripple`          | A pointer-following displacement ripple over the first image                     |

- `data-ck-density`: `low` / `medium` / `high` → capped counts (36 / 72 / 120), halved on a coarse
  pointer or `hardwareConcurrency ≤ 4`.
- `data-ck-palette`: `theme` / `accent` / `mono`, read from the site tokens `--t-accent`,
  `--t-text`, `--t-text-muted`, `--t-surface` (chrome `--bldr-*` as a second source, then defaults).

## Runtime contract

The bundle registers `window.ckEngines.engines.scene` through the `ckEngines` handshake
(media-motion DESIGN §2.3; `src/ck-engines.ts` duplicates the minimal `ensureCkEngines`).
`mount(el, ctx)`:

- does nothing under `prefers-reduced-motion: reduce` (the fallback image stays);
- loads every child `img` (`currentSrc || src`) as a texture, and on any failure keeps the fallback;
- appends a runtime `<canvas aria-hidden="true" role="presentation">` (pointer-events none, except a
  live `ripple`), DPR capped at 2, WebGL preferred with Pixi's fallback order;
- sets `data-ck-ready` after the first frame (CSS hides the fallback only then);
- pauses off-screen and on a hidden tab; on the editor canvas (`ctx.still`) draws one frame and runs
  only between `onPlay` and `onStop`; destroys itself on `webglcontextlost`; mirrors drift under
  RTL;
- returns a disposer that calls `app.destroy(true)` and removes `data-ck-ready`.

## The full pixi.js bundle (free-code mode, 2026-10-09)

A custom-code block's `js` can draw its own Pixi scene (`ck.pixi()` / `ck.stage()`), which needs the
whole library, not the five-scene subset above. `src/pixi-entry.ts` (+ `src/pixi-engine.ts`) is that
second bundle: `import * as PIXI from 'pixi.js'` handed to the page through the same `ckEngines`
handshake as the `pixi` engine, whose `mount` calls `ctx.provide(PIXI)` for the script that queued
the entry. It writes no `window.PIXI`.

```sh
node scripts/build-scene-engine.mjs pixi     # → renderer/src/engines/pixi-full-source.ts (PIXI_FULL_*)
```

`ck-pixi.js` is **244.6 kB gzip** on pixi.js 8.22.0 against a **256.9 kB** budget of its own
(measured + 5 %; the 200 kB scene budget is unchanged). The export ships it only when some page's
`data-ck-js` code matches `/pixi|ck\.stage/i`; the canvas injects it into the frame head on the same
condition. `node scripts/build-scene-engine.mjs` with no argument rebuilds both. Its bundled
packages are the list below. pixi.js imports `@xmldom/xmldom` only for `WebWorkerAdapter.parseXML`;
`ck-pixi.js` is a page script, never a worker, so the build answers that import with the page's own
`DOMParser` (performance pass, 2026-10-12: -23.8 kB gzip, and a published Studio scene's first frame
289 -> 207 ms desktop, 2022 -> 1642 ms at 4x CPU and 10 Mbit/s, Chromium, median of 9).

## Creative scene kit (1.1.0)

`await ck.scene()` uses the same lazy full Pixi namespace and adds input, simulation and story
helpers. It is available inside an opted-in custom-code region, not an arbitrary import in a managed
React project. Details and library decisions live in the canonical
[design libraries guide](../../../../docs/architecture/builder-design-libraries.md).

```js
const s = await ck.scene({ seed: 7, libs: ['physics'] });
const M = s.lib.physics;
const engine = M.Engine.create();
M.Composite.add(engine.world, M.Bodies.circle(40, 20, 12));
const stop = s.fixedTick((dt) => {
  // dt is seconds, default 1/60; catch-up is capped at 5 steps per rendered frame.
  M.Engine.update(engine, dt * 1000);
});
s.dispose(stop);
```

Attach visible Graphics/sprites to `s.stage` and synchronize them with the bodies — or let
`s.lib.physics.world(s)` do the engine, walls, stepping, links and drag (see "Particle presets and
the physics world" below). The kit owns created Matter engines' cleanup. Do not start Matter's
Runner or a second Pixi ticker. A game still needs an objective, state, score, controls, collision
handling and restart; the helper does not invent these.

- `s.input.down(code)` and `axis(negativeCodes, positiveCodes)` enable keyboard input lazily on the
  focused canvas only. `set(code, held)` supports native DOM/touch buttons; release on pointer up,
  cancel and lost capture. `clear()` releases everything. Native/virtual sources are independent.
  Input never captures editor typing and is cleared when hidden/blurred. Decorative scenes remain
  unfocusable unless input is used. Name a game canvas rather than hiding a focusable surface.
- `s.fixedTick(fn, { step?, maxSteps? })` accepts steps 1/240..0.1 seconds and limits 1..8. It
  returns an idempotent unsubscribe, drops excess catch-up and never simulates in the editor/reduced
  motion. Draw a finished still state; accessible manual controls can redraw with `s.app.render()`.
- `s.story([{ id, enter?, leave? }], initial?)` enters once and returns `current`, `go(id)`,
  `next()`, `back()`, `reset()` and `dispose()`. IDs are unique (1..64 letters/digits/_/-), chapters
  1..32. Navigation does not wrap or autoplay. Keep narrative/control text in the DOM and callbacks
  synchronous/lightweight. Manual chapter changes render even when motion is reduced.
- `ck.scene({ design: { width: 1280, height: 720, fit?, align?, zoom?, maxZoom? } })` (responsive
  scenes, 2026-10-13, `src/studio/kit/design.ts`): draw in `s.world` in design units; the kit fits
  it to the region on every resize, paints the letterbox with the theme surface (unless
  `background`), maps `s.pointer.x/y` into design units and adds `s.design` (`scale`, `view`),
  `s.compact`, `s.portrait` and `s.ui(px)`. `zoom: true` with `libs: ['viewport']` makes `s.world` a
  clamped pixi-viewport camera (`src/studio/libs/viewport/zoom-world.ts`); the page keeps its
  scroll.

After scene-kit edits, run `node scripts/build-studio-engines.mjs kit` from repository root. It
regenerates only the renderer's kit asset and verifies the unchanged 16 kB gzip budget. The
component/scene unit tests and `pnpm --filter @craftkit/evals test:pixi-creative:browser` are
distinct from live model quality, audio hardware behavior or browser support outside the tested
Chromium.

## Creative engines (2026-10-12)

Five more lazy Studio libraries, each its own `ck-lib-<key>.js` asset (sources under
`src/studio/libs/`, entries `src/studio/libs/<key>-entry.ts`):

| Key        | Entry factory           | Pixi-bound | Highlights                                                                    |
| ---------- | ----------------------- | ---------- | ----------------------------------------------------------------------------- |
| `anim`     | `createAnimLibrary`     | no         | tweens, timelines, springs, shake, sprite states, procedural rigs (9 poses)   |
| `fx`       | `createFxLibrary`       | yes        | pooled particles, 12 bursts, 7 weathers, trails, rings, flash, float text     |
| `dialogue` | `createDialogueLibrary` | no         | cast, branching graph, eval-free conditions, saves, accessible dialogue box   |
| `ink`      | `createInkLibrary`      | no         | inkjs 2.4.0 compiler + runtime through the same dialogue interface            |
| `tilemap`  | `createTilemapLibrary`  | yes        | @pixi/tilemap 5.0.2, ASCII worlds, procedural tiles, collision, follow camera |

```js
const s = await ck.scene({ seed: 4, libs: ['tilemap', 'anim', 'fx'] });
const world = s.lib.tilemap.world(s.app, {
  tileSize: 32,
  rows: ['########', '#p..c..#', '########'],
  legend: {
    '#': { style: 'stone', solid: true },
    p: { kind: 'player', marker: true },
    c: { kind: 'coin', marker: true },
  },
});
s.stage.addChild(world.view);
const anim = s.lib.anim.create({ reducedMotion: s.reducedMotion });
const fx = s.lib.fx.create(s.app, { reducedMotion: s.reducedMotion, rng: s.random });
if (!s.editor && !s.reducedMotion)
  s.tick((t) => {
    anim.update(t.dt);
    fx.update(t.dt);
  });
s.dispose(() => {
  fx.dispose();
  anim.dispose();
  world.dispose();
});
```

`@pixi/tilemap` registers its render pipe at import, which is usually after the scene's renderer
initialised; `tilemap/pipe.ts` adds the pipe to the live renderer from Pixi's shared adaptor list,
once. `shared/fake-pixi.test-util.ts` is the structural Pixi stand-in the unit tests use; real WebGL
behaviour is covered by `pnpm --filter @craftkit/evals test:creative-engines:browser`, which runs
the Agent's taught examples in the generated sandboxed runtime (LTR/RTL, 390/1280 px, reduced
motion). Rebuild assets with `node scripts/build-studio-engines.mjs <key>`; first-party bundles
carry a "bundles no third-party package" banner instead of an empty notice. The full guide lives in
the
[design libraries architecture page](../../../../docs/architecture/builder-design-libraries.md#creative-engines-and-the-creative-agent-2026-10-12).

## Game libraries (2026-10-12)

Three more lazy Studio libraries for games, stories and interactive art, each its own
`ck-lib-<key>.js` asset generated by `scripts/build-studio-engines.mjs <key>`. Each `create(s, …)`
takes the scene itself, so it can read `s.editor`, the page language and `s.random`, and register
its own disposal with `s.dispose`.

| Key      | Entry factory         | Pixi-bound | Bundles (licence)                                               | gzip    |
| -------- | --------------------- | ---------- | --------------------------------------------------------------- | ------- |
| `audio`  | `createAudioLibrary`  | yes        | @pixi/sound 6.0.1 (MIT), zzfx 1.3.2 (MIT)                       | 16.0 kB |
| `gameai` | `createGameAiLibrary` | no         | yuka 0.7.8 (MIT)                                                | 20.7 kB |
| `hud`    | `createHudLibrary`    | yes        | @pixi/ui 2.3.2 (MIT), tweedle.js (MIT), typed-signals (CC0-1.0) | 25.1 kB |

```js
const s = await ck.scene({ seed: 6, libs: ['tilemap', 'gameai', 'audio', 'hud'] });
const audio = s.lib.audio.create(s); // silent in the editor; starts on the first gesture
audio.sfx('coin'); // jump, coin, hit, explode, powerup, click, laser, blip, step, win, lose
audio.music.play(url, { loop: true, volume: 0.5, fadeMs: 800 }); // renders the mute toggle
const ai = s.lib.gameai.create(s); // seeded by s.random
ai.grid(world); // a s.lib.tilemap world
const guard = ai.agent(sprite, { x, y, speed: 90, solid: true }).chase(hero);
const hud = s.lib.hud.create(s); // themed from s.palette
const hp = hud.bar({ label: 'Health', value: 100, max: 100 });
s.fixedTick((dt) => ai.update(dt));
```

- **audio** (`libs/audio/`): @pixi/sound and ZzFX both open an AudioContext the moment their module
  runs, so the asset reaches them only through `import()` (inlined by the single-file build,
  evaluated on first call) from a pointer/key/touch gesture inside the scene's region; music
  requested earlier is queued, effects are skipped. ZzFX only renders samples into buffers that
  @pixi/sound plays, so master volume, mute and the hidden-page pause cover both. Music URLs are the
  schemes `s.texture` admits (`libs/shared/media-url.ts`, shared with the kit): `https:`,
  `data:audio/` (decoded in-process, no request) and `blob:`; ≤ 6 tracks of ≤ 12 MB, ≤ 12 effects at
  once, a failed track is logged once. Whenever music is requested a bilingual
  `<button aria-pressed>` mute toggle renders in the region (WCAG 1.4.2). The last scene out closes
  the shared AudioContext.
- **gameai** (`libs/gameai/`): yuka steers on its x/z plane; agents map the scene's (x, y) onto it
  and write positions back to their display objects. Wander uses the scene's seeded random; yuka's
  separation is replaced by a pixel-scale one. `grid.ts` is a bounded A* (20 000 expansions,
  512-cell paths, no corner cutting) that reads a tilemap world's solidity live, plus a box mover
  that keeps `solid` agents out of walls; `fsm.ts` is a small state machine. ≤ 64 agents by default
  (≤ 256). The build marks yuka's module-scope scratch vectors pure so its unused ~40 % tree-shakes.
- **hud** (`libs/hud/`): @pixi/ui ProgressBar, Slider, FancyButton (without its tweened animations,
  which would leave a ticker callback behind), CheckBox and ScrollBox, stacked in RTL-aware corners
  (`topStart`, `topEnd`, `bottomStart`, `bottomEnd`, `top`, `bottom`). Every widget has a native DOM
  twin in a visually hidden panel that appears on focus (`mirror.ts`), so each canvas control has a
  keyboard and screen-reader path; menus and forms stay DOM.

Unit tests use fake backends/classes (`audio.test.ts`, `device.test.ts`, `hud.test.ts`) and the real
yuka (`gameai.test.ts`); `pnpm --filter @craftkit/evals test:creative-engines:browser` runs the
taught examples in the generated runtime (LTR/RTL, 390/1280 px, reduced motion).

## Character art: `peeps` (2026-10-13)

People for stories and games, with no network at run time: Open Peeps, Pablo Stanley's hand-drawn
characters (design **CC0 1.0**), drawn by DiceBear's `open-peeps` style (`@dicebear/open-peeps` +
`@dicebear/core` 9.4.3, code MIT). The asset `ck-lib-peeps.js` (`createPeepsLibrary`, not
Pixi-bound, 111.3 kB gzip — nearly all of it the art's path data) loads only for scenes that list
`'peeps'`.

```js
const s = await ck.scene({ libs: ['peeps', 'dialogue'] });
const people = s.lib.peeps.cast([{ id: 'layla', name: 'Layla', color: '#f59e0b' }, 'Omar']);
const layla = people.get('layla'); // { id, name, seed, color, colorNumber, …look }
const tex = await s.lib.peeps.texture(s, { ...layla, mood: 'happy', size: 220 }); // PIXI.Texture
const faces = await s.lib.peeps.textures(s, layla); // { calm, happy, surprised, sad, angry, thinking }
const cast = s.lib.dialogue.cast(people.members()); // a data: URL portrait per mood
const svg = s.lib.peeps.svg({ seed: 'Noor', mood: 'surprised', hair: 'hijab', skin: 'medium' });
img.src = s.lib.peeps.dataUrl({ seed: 'Noor', round: true, background: '#fde68a' });
```

- **Identity** is the seed (a name; case and spacing folded): the same name draws the same person on
  every page. DiceBear picks hair, skin, outfit and hair colour from one seeded sequence in a fixed
  order, and every pick consumes it whether or not an option pins it, so a mood or an art-direction
  override never reshuffles the rest of the character.
- **Moods** map to the style's faces (`looks.ts`): calm `smile`, happy `smileBig`, surprised `awe`,
  sad `solemn`, angry `veryAngry`, thinking `suspicious`, laughing, scared, worried, tired, serious,
  love; English and Arabic aliases (`excited`, `سعيد`, `حزين`…) resolve with `mood(word)`; anything
  else is calm. `face` takes a raw style face instead.
- **Art direction**: `hair` (48 styles, e.g. `long`, `bun`, `hijab`, `afro`), `hairColor`, `skin`
  (`light` … `dark` or `#rrggbb`), `clothing`, `color` (a cast colour dresses the outfit),
  `accessories` / `facialHair` (`false`, `true` or a name), `flip`, `background`, `round`, `size`.
  Unknown names and non-colours are ignored; masks are never drawn (they hide the mood).
- **Canvas**: `texture(s | s.PIXI, options)` decodes the SVG (a `data:` URL) into a canvas at
  `size × resolution` (the scene's `dpr` by default) and returns a Pixi texture with that
  resolution; a small per-namespace cache reuses looks until a texture is destroyed. A still
  (reduced-motion) scene is rendered once the texture is in use.
- **Dialogue**: `cast.members(moods?)` returns `s.lib.dialogue.cast` entries with a `portrait` and
  one `expressions[mood]` each; the dialogue cast admits data: URLs up to 128 kB whole.

Unit tests (`libs/peeps/peeps.test.ts`) cover determinism, moods, cast stability, art direction,
escaping and the texture pipeline with a fake browser; the dialogue playbook's taught example runs
it in Chromium (`test:creative-engines:browser`).

## Particle presets and the physics world (2026-10-13)

Both libraries keep their whole upstream API (`s.lib.emitter.Emitter`, every Matter module on
`s.lib.physics`) and add a small, optional layer that makes the common scene a few lines.

```js
const s = await ck.scene({ libs: ['emitter', 'physics'], design: { width: 1280, height: 720 } });
const snow = s.lib.emitter.spawn(s, 'snow'); // fills the view, follows resizes
const fire = s.lib.emitter.spawn(s, 'fire', { x: 640, y: 620, width: 90 });
s.pointer.onDown((p) => s.lib.emitter.burst(s, 'confetti', { x: p.x, y: p.y }));
const config = s.lib.emitter.presets.embers(s, { x: 640, y: 640 }); // for new Emitter(…)

const { Bodies } = s.lib.physics;
const w = s.lib.physics.world(s); // walls around the design, stepped, draggable
w.add(Bodies.circle(640, 0, 30), new s.PIXI.Graphics().circle(0, 0, 30).fill(s.palette.accent));
```

- **Presets** (`libs/emitter/recipes.ts`): `fire`, `smoke`, `sparkles`, `snow`, `rain`, `confetti`,
  `magic`, `bubbles`, `leaves`, `petals`, `fireworks`, `dust`, `embers`. Options: `x`, `y` (omit
  both to fill the view of `s.world`, `s.design.view` in design mode), `width`, `height`, `color` /
  `colors` (default: theme-aware, from `s.palette` and whether its surface is dark; glowing presets
  blend additively only on a dark surface), `intensity` (0..3), `size`, `speed`, `wind` (-1..1
  toward the inline end, mirrored by `s.dir`), `count` (bursts) and `parent` (default `s.world`).
  Rates scale with the area and with `s.count` (density × quality); the editor gets half.
- **Handles** (`libs/emitter/spawn.ts`): `spawn` returns
  `{ emitter, container, config, count, active, move, burst, start, stop, destroy }`; `burst`
  returns the same and destroys itself once its particles are gone. One `s.tick`, one resize hook
  and one `s.dispose` per scene drive them all; streams are pre-warmed so the first frame is full.
  Reduced motion: a stream is pre-warmed and frozen (one still frame), a burst emits nothing.
- **Textures** (`libs/emitter/atlas.ts`): eight white shapes (soft glow, streak, flake, leaf, petal,
  confetti slip, sparkle, bubble) drawn with Pixi Graphics into one 512 × 64 render texture per
  renderer — a v8 `ParticleContainer` draws from one texture source — freed on dispose. No image is
  fetched.
- **Behaviours** (`libs/emitter/behaviors.ts`): `colorPick` (a colour per particle or per wave) and
  `drift` (sway, flutter, spin, drag, kill lines) register through upstream's own
  `Emitter.registerBehavior`; the vendored files stay unpatched beyond `PATCHES.md`.
- **Physics world** (`libs/physics/world.ts`):
  `world(s, { gravity, walls: true | 'box' | false, bounds, drag, layer, step, settle, engine })` →
  `{ engine, bounds, walls, drag, add(body, display?), link, remove(body, keepDisplay?), settle(steps?), dispose }`.
  Walls sit just outside the design (design mode) or the region (refitted on resize, bodies kept
  inside); the loop is `s.fixedTick`; drag is a Matter `MouseConstraint` fed from `s.pointer` in the
  layer's units, armed only by a press on the scene itself, and a touch on a body stops the page
  scrolling for that gesture only. The editor and reduced motion run no loop: the world settles
  synchronously after the script turn and after each change, and reduced motion renders that still
  frame.

Budgets: `ck-lib-emitter.js` 17,400 bytes gzip (was 12,000; measured 16,545 with the presets),
`ck-lib-physics.js` unchanged at 29,500 (measured 29,424). Unit tests:
`libs/emitter/emitter.test.ts` (pure configs, behaviours, the real vendored Emitter on real
ParticleContainers) and `libs/physics/physics.test.ts` (real matter-js); Chromium:
`CRAFTKIT_BROWSER_QA=1 pnpm --filter @craftkit/evals exec vitest run src/pixi-creative/particles.browser.test.ts`.

## Procedural maps and animated GIFs: `procgen`, `gif` (2026-10-13)

Two plain (not Pixi-bound) lazy libraries: `ck-lib-procgen.js` (`createProcgenLibrary`, rot-js
2.2.1, BSD-3-Clause) and `ck-lib-gif.js` (`createGifLibrary`, gifuct-js 2.1.2, MIT). Neither
evaluates code, compiles WebAssembly or bundles Pixi: a map's Graphics and a GIF's Sprite come from
the scene's own `s.PIXI`.

```js
const s = await ck.scene({ libs: ['procgen', 'tilemap', 'gif'] });
const map = s.lib.procgen.dungeon(s, { width: 48, height: 30, style: 'digger' }); // or 'rooms'
const cave = s.lib.procgen.cave(s, { width: 60, height: 36, fill: 0.46, steps: 4 });
const maze = s.lib.procgen.maze(s, { width: 31, height: 21, style: 'divided' }); // icey, eller
const world = s.lib.tilemap.world(s.app, {
  tileSize: 24,
  rows: map.rows(), // '#' wall, '.' floor, 'p' start, 'e' exit (legend overrides symbols)
  legend: {
    '#': { style: 'stone', solid: true },
    p: { kind: 'player', marker: true },
    e: { kind: 'exit' },
  },
});
map.draw(s, { tile: 16 }); // or one Graphics on s.world in s.palette colours
const coins = map.scatter(8, { spacing: 4 }); // seeded, spaced, away from start and exit
const lit = map.fov(map.start.x, map.start.y, 8); // lit.has(x, y), lit.cells
const way = map.path(map.start, map.exit); // BFS, { diagonal: true } never cuts a corner

const cat = await s.lib.gif.load(s, url, { loop: true, animationSpeed: 1, pixelated: false });
cat.anchor.set(0.5);
s.world.addChild(cat); // play(), stop(), gotoAndStop(n), currentFrame, totalFrames, onLoop…
```

- **Seeded and connected** (`libs/procgen/`): the seed is one draw from the scene's seeded random
  (or `seed`), so the editor, the preview and the published page draw the same map. rot's generators
  share one module-level RNG; each call seeds it and generates synchronously. Whatever a generator
  leaves cut off is filled, so every floor cell — and every room, the start and the exit — is
  reachable. The start sits on the inline-start side (left in LTR, right in RTL); the exit is the
  room (or cell) farthest from it. Sizes 7..160 a side; mazes are odd-sized; a room spans at most
  half the map (rot places the first one unchecked). Only six generators, the RNG and precise
  shadowcasting are imported, module by module; rot's display, scheduler, noise and A\* stay out
  (BFS is exact on a unit-cost grid). Scattering of points in open space stays `s.poisson`.
- **GIFs** (`libs/gif/`): `inspect.ts` walks the block structure first and refuses anything that is
  not a GIF, over 12 MB, over 1024 px a side or over 4000 frames; `decode.ts` composites the frames
  (disposal 1/2/3, transparency, inherited control blocks, 100 ms for tiny delays) in plain RGBA
  arrays and keeps every n-th frame (with the skipped delays) when frames × pixels would pass 8 M
  pixels or 240 frames. URLs follow `s.texture`'s rule: a `data:image/gif` URL is decoded in place
  (it works under the unreviewed preview's `connect-src 'none'`); `https:` and `blob:` are fetched
  without credentials, 15 s and 12 MB at most. The sprite subclasses the page's `PIXI.Sprite`,
  advances on one `s.tick` per scene (never `Ticker.shared`), holds its first frame under reduced
  motion (rendered once placed), and `s.dispose` destroys it, its texture and frames.
- **Not admitted** (2026-10-13): `@pixi/gif` 3.0.1 (registers a global `.gif` Assets loader on the
  page's one Pixi on import, steps on `Ticker.shared`, keeps every frame unbounded, would have to be
  Pixi-bound, and ships gifuct-js inside its own `lib/` without that package's notice; PixiJS merged
  it into `pixi.js/gif`, whose files import Pixi internals and so cannot bind to the page's
  namespace), `@pixi/layout` 3.2.1 + yoga-layout 3.2.1 (59.8 kB gzip, WebAssembly that compiles only
  because the preview allows `'unsafe-eval'`, prototype mixins and a renderer system that must exist
  before `app.init`, no LICENSE file in the yoga tarball; menus stay DOM) and
  `poisson-disk-sampling` (`s.poisson` already does it).

Budgets: `ck-lib-procgen.js` 12,400 bytes gzip (measured 11,745), `ck-lib-gif.js` 7,900 (measured
7,480). Unit tests: `libs/procgen/procgen.test.ts`, `libs/gif/gif.test.ts` (a GIF writer in
`gif-encoder.test-util.ts`); Chromium:
`CRAFTKIT_BROWSER_QA=1 pnpm --filter @craftkit/evals exec vitest run src/pixi-creative/procgen-gif.browser.test.ts`.

## Mural libraries and hex art: `noise`, `geom`, `hex` (2026-10-13)

Three plain (not Pixi-bound) lazy libraries for murals: `ck-lib-noise.js` (`createNoiseLibrary`, on
simplex-noise 4.0.3, MIT — the kit's own noise package), `ck-lib-geom.js` (`createGeomLibrary`,
d3-contour 4.0.2, ISC, and polybooljs 1.2.2, MIT) and `ck-lib-hex.js` (`createHexLibrary`, 28 tiles
of Kenney's Hexagon Pack, CC0 1.0). None evaluates code, fetches or bundles Pixi; every polygon is a
flat `[x0, y0, …]` array in design units for `Graphics.poly`.

```js
const s = await ck.scene({ libs: ['noise', 'geom', 'hex'], design: { width: 1280, height: 720 } });
const n = s.lib.noise.create(s, { type: 'simplex', fractal: 'fbm', scale: 420, warp: 80 });
n.at(x, y, t); // [-1, 1]; t in seconds drifts the field
n.loop(x, y, phase); // seamless: loop(…, 0) === loop(…, 1)
const cells = s.lib.noise.create(s, { type: 'cellular', cell: 'edge' | 'f1' | 'f2' | 'id' });
const grid = n.grid({ width: 1280, height: 720, cell: 16, t }); // { values, cols, rows, min, max }
const G = s.lib.geom;
G.bands(grid, 8).forEach((b, i) => G.draw(g, b.shapes, colours[i])); // terraces, holes cut
G.lines(grid, 12); // isolines, no runs along the grid border
G.draw(g, G.difference(sheet, sun), paper); // also union / intersect / xor, shapes(rings)
const tiles = G.mosaic(s, {
  cells: s.count(200),
  relax: 2,
  gap: 4,
  clip: G.arch(x, y, w, h, 'pointed'),
});
G.ribbon(G.smooth(points), (t) => 40 * Math.sin(Math.PI * t));
G.inset(cell, 3);
const hex = await s.lib.hex.load(s);
const board = hex.board({
  cols: 9,
  rows: 6,
  terrain: (cell) => (cell.height < -0.1 ? 'water' : 'grass'),
});
board.pick(x, y);
board.neighbours(q, r);
board.set(q, r, 'castle');
hex.tile('windmill', 96);
```

- **noise** (`libs/noise/field.ts`): what the kit's `s.noise2`/`s.noise3`/`s.fbm` do not give —
  Worley (cellular) cells with an orbiting jitter so they animate and loop, ridged and billowed
  fractals, domain warp (marbling), a 4-D `loop` that returns to its first frame, and bounded grids
  (160 000 samples at most; a finer request widens the cell). Seeded by one draw from the scene's
  seeded random (or `seed`), so the editor, preview and page sample the same field. Nothing to
  dispose.
- **geom** (`libs/geom/`): `contours.ts` maps d3-contour's grid-unit GeoJSON to design units (sample
  i at `x + i·cell`), bands nested low to high for painter's-order terraces, isolines split off the
  border; `boolean.ts` imports polybooljs's four algorithm modules, never its entry (which assigns
  `window.PolyBool` and carries GeoJSON and debug-log helpers), and pairs rings into outer + holes
  from a point just inside each ring (touching rings — two L shapes at a corner — stay apart);
  `draw` fills and `cut()`s holes on the scene's own Graphics. `mosaic.ts` relaxes points through
  the kit's `s.delaunay(…).voronoi` (no second Voronoi), insets each cell by half the grout
  (half-plane clipping, so short Voronoi edges simply collapse) and trims cells across a mask with
  `intersect`. `paths.ts`: area, centroid, even-odd `contains`, Chaikin `smooth`, `ribbon`, `inset`,
  `arch` (round, two-centred pointed, horseshoe; symmetric, so no RTL mirroring).
- **hex** (`libs/hex/`): `scripts/build-hex-atlas.mjs` cuts 28 unscaled 120 × 140 tiles (grass,
  dirt, sand, mars, stone — plain, trees, forest, grove, rocks, hills, cacti, crystals — and house,
  cabin, farm, windmill, castle, tower, lumber, camp) out of kenney-hexagon-pack's own sprite sheets
  and packs one lossless WebP (868 × 576, 67.6 kB) into `atlas.generated.ts`. The atlas is a `data:`
  URL decoded by an `<img>`: Pixi's Assets loader fetches data URLs, which the unreviewed preview's
  `connect-src 'none'` refuses (as it does for `s.texture(data:…)`), while `img-src` admits `data:`.
  Boards are odd-r offset rows of pointy-top hexes in design units, column 0 on the inline-start
  side (mirrored in RTL), a seeded island by default (fbm height, rim falloff, palette water — the
  pack has none — and a share of buildings), `pick`, `neighbours` and `set`. The atlas and its
  frames are destroyed with the scene; a board queues the reduced-motion still frame.
- **Presets** (set D, `packages/builder/ai/src/scene-presets/set-d/`): terraced-topography,
  paper-cut-landscape, ribbon-flow, hex-island (mural), mosaic-arch-window, ebru-marbling (pattern)
  — each one `scene.preset` call (6–8 tokens) instead of 240–440 tokens of code that itself leans on
  these libraries.
- **Not admitted** (2026-10-13, reasons in `vendor/VENDOR.md`): d3-delaunay and delaunator 5 (the
  kit's own `s.delaunay` already gives Delaunay, Voronoi and `find`; delaunator 5 needs
  robust-predicates, Unlicense, outside the licence list), polygon-clipping 0.15.7 and
  martinez-polygon-clipping 0.9.0 (both need robust-predicates, Unlicense), @velipso/polybool 2.0.11
  (0BSD + tslib, 8.9 kB against polybooljs's 3.5 kB for the same booleans), chromotome and
  nice-color-palettes (the page palette wins, and `palette` already takes six colours of the
  person's own), @iconify-json/game-icons (CC BY 3.0: attribution on every page that shows one,
  which an agent-built page cannot promise; VENDOR.md admits no CC BY art).

- **Vendored on the owner's word** (1.1.0 of both, 2026-10-13): FastNoiseLite 1.1.1 (MIT, © Jordan
  Peck and contributors) gives `s.lib.noise` the `perlin`, `value`, `value-cubic`, `opensimplex2`
  and `opensimplex2s` types (one octave each; the field layers, warps, drifts and loops them as it
  does simplex — a crossfade loop, since FastNoiseLite has no 4-D noise), and Bezier.js 6.1.4 (MIT,
  © Pomax) gives `s.lib.geom.curve` (points, length, at, normal, project, offset, split, bbox and a
  tapered `outline` as one flat polygon). Neither npm tarball carries a LICENSE file, so both are
  COPIED verbatim under `vendor/fastnoise-lite/` and `vendor/bezier-js/` with their upstream
  licences and PROVENANCE.md (sha256 of every copied file, pinned by tests), and the targets list
  those licences as `vendored`, as for webgl-noise and zzfx; the build's audit is unchanged.

Budgets: `ck-lib-noise.js` 22,200 bytes gzip (measured 21,085; 4,375 before FastNoiseLite),
`ck-lib-geom.js` 20,500 (19,452; 10,473 before Bezier.js), `ck-lib-hex.js` 79,400 (75,575, nearly
all the WebP). Unit tests: `libs/noise/noise.test.ts`, `libs/geom/geom.test.ts`,
`libs/hex/hex.test.ts`; Chromium:
`CRAFTKIT_BROWSER_QA=1 pnpm --filter @craftkit/evals exec vitest run src/pixi-creative/mural-libs.browser.test.ts`.

## Mural libraries 2: `color`, `lsys`, geom 1.2 (2026-10-13)

Asked (in Arabic) for more strong libraries that make the Agent's murals richer with less code of
its own, two new plain lazy libraries and a geom minor, all installed from the catalog (each npm
tarball ships its LICENSE; the build's audit passes them unchanged):

```js
const s = await ck.scene({ libs: ['color', 'lsys', 'geom'], design: { width: 1280, height: 720 } });
const Co = s.lib.color,
  C = s.palette;
Co.ramp(C.surface, C.accent, 7, { space: 'oklch' }); // 7 × 0xRRGGBB, perceptually even
Co.ramp([C.surface, C.colors[4], C.accent], 12); // along stops (OKLab by default)
Co.shades(C.accent, 5); // lighter → darker, the hue kept
Co.harmony(C.accent, 'analogous' | 'complementary' | 'triadic' | 'split' | 'tetradic');
Co.mix(a, b, t);
Co.adjust(c, { l: 0.1, c: -0.02, h: 30 });
Co.oklch(c); // { l, c, h }
Co.contrast(a, b);
Co.readable(C.surface, [C.text, C.accent]); // first ≥ 4.5:1, else the best
Co.toHex(c);
Co.toNumber('oklch(0.7 0.12 200)');
const L = s.lib.lsys;
const plant = L.fit(
  L.grow(s, { preset: 'fern', dir: s.dir }),
  { x, y, width, height },
  { align: 'bottom' },
);
L.draw(g.clear(), L.upTo(plant, t), { color: [trunk, twig], width: 5, taper: 0.7 }); // t: 0 → 1
L.grow(s, { axiom: 'X', rules: { X: [{ to: 'F[+X]FX', p: 0.6 }, 'F[-X]FX'], F: 'FF' }, angle: 25 });
const G = s.lib.geom;
G.spline(points, { curve: 'catmull' | 'basis' | 'natural' | 'monotone' | 'step', closed, steps });
G.pie(values, { pad: 0.03, dir: s.dir }).forEach((span) =>
  g.poly(G.arc({ cx, cy, inner, outer, corner: 6, ...span })).fill(c),
);
G.simplify(strokePoints, 2);
```

- **color** (`libs/color/color.ts`, culori 4.0.2, MIT, © Dan Burzo): only the tree-shakable
  `culori/fn` entry, with four modes registered — sRGB (with its hex, `rgb()` and named parsers),
  linear sRGB (WCAG luminance), OKLab and OKLCH. HSL is left out (0.6 kB for `hsl()` strings a
  palette-bound scene never writes). Colours in: s.palette's 0xRRGGBB numbers, CSS strings or culori
  objects; out: 0xRRGGBB numbers for Pixi. OKLCH results come back into sRGB by lowering chroma
  (`clampChroma`), so a harmony or a shade keeps its hue instead of clipping into another. The kit's
  own `s.palette.mix/ramp` (OKLab, our code) stay: `s.lib.color` is for the scenes that need OKLCH,
  shades, harmonies or contrast. An unreadable colour reads as mid grey; an unreadable list gives
  `[]`.
- **lsys** (`libs/lsys/`, lindenmayer 1.5.4, MIT, © Tom Brewe): lindenmayer rewrites (string axioms,
  classic context-sensitive `A<B>C` keys); everything else is ours — the turtle (F/G draw, f
  moves, + left / - right on screen, | back, " shrinks the step, [ ] branches), the seeded choice
  between weighted successors (lindenmayer's own weighted successors call `Math.random`, so a
  stochastic rule reaches it only as a function drawing from a generator seeded by `seed` or one
  draw of `s.random`), mirroring about the start for `dir: -1`, `fit` into a box, the growth order
  (`upTo` shows a segment once the path from the root reaches it, so every branch grows at once,
  reusing one buffer per result) and `draw` (one round-capped stroke per branch depth). Ready rule
  sets: fern, tree, bush (ABOP figs. 1.24), vine, arabesque, koch, dragon, hilbert. Limits: 12
  iterations, 200,000 symbols (checked BEFORE each rewrite from the longest successor per symbol, so
  no runaway string is ever built), 30,000 segments, 32 rules.
- **geom 1.2.0** (`libs/geom/shape.ts`): d3-shape 3.2.0 (ISC, with d3-path 3.1.0, ISC) draws lines
  and arcs into a path context of ours that samples every Bézier and circular arc into points (no
  DOM, no SVG string): `spline` (catmull centripetal, basis, natural, monotone, step, linear; closed
  rings without a repeated point), `arc` (ring sectors, wedges, whole rings kept to ONE polygon a
  hairline short of a full turn; rounded corners and pad) and `pie` (spans in input order, mirrored
  with `dir: -1`, a `mid` angle for labels). `simplify` is simplify-js 1.2.4 (BSD-2-Clause, ©
  Vladimir Agafonkin): radial distance then Douglas–Peucker. Angles: radians, 0 at 12 o'clock,
  clockwise on screen. Bad input gives `[]`.
- **Presets** (set E, `packages/builder/ai/src/scene-presets/set-e/`): botanical-garden,
  gradient-waves, arc-rings (mural), arabesque-scroll (pattern) — one `scene.preset` call of 6–8
  tokens instead of 327–587 tokens of code (47–79× cheaper), which itself leans on these libraries.

Budgets: `ck-lib-color.js` 11,000 bytes gzip (measured 10,421), `ck-lib-lsys.js` 7,700 (7,271),
`ck-lib-geom.js` 28,000 (26,585; 19,452 before d3-shape and simplify-js — the curve factories, the
arc, d3-path's `Path` and three more notices). Unit tests: `libs/color/color.test.ts`,
`libs/lsys/lsys.test.ts`, `libs/geom/shape.test.ts`; Chromium: the same
`mural-libs.browser.test.ts`.

## Bundled licences

pixi.js is MIT. The bundle also carries `@pixi/colord` (MIT), `earcut` (ISC), `eventemitter3` (MIT),
`ismobilejs` (MIT), `parse-svg-path` (MIT) and `tiny-lru` (**BSD-3-Clause**, permissive; its notice
is reproduced in the banner, as the licence requires for binary redistribution). Every notice
travels in `SCENE_BANNER`.
