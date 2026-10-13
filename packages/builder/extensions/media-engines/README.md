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

Attach visible Graphics/sprites to `s.stage` and synchronize them with the bodies. The kit owns
created Matter engines' cleanup. Do not start Matter's Runner or a second Pixi ticker. A game still
needs an objective, state, score, controls, collision handling and restart; the helper does not
invent these.

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

## Bundled licences

pixi.js is MIT. The bundle also carries `@pixi/colord` (MIT), `earcut` (ISC), `eventemitter3` (MIT),
`ismobilejs` (MIT), `parse-svg-path` (MIT) and `tiny-lru` (**BSD-3-Clause**, permissive; its notice
is reproduced in the banner, as the licence requires for binary redistribution). Every notice
travels in `SCENE_BANNER`.
