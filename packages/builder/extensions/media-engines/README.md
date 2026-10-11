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

`ck-pixi.js` is **268.5 kB gzip** on pixi.js 8.22.0 against a **300 kB** budget of its own (the 200
kB scene budget is unchanged). The export ships it only when some page's `data-ck-js` code matches
`/pixi|ck\.stage/i`; the canvas injects it into the frame head on the same condition.
`node scripts/build-scene-engine.mjs` with no argument rebuilds both. Its bundled packages are the
list below plus `@xmldom/xmldom` (MIT).

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

## Bundled licences

pixi.js is MIT. The bundle also carries `@pixi/colord` (MIT), `earcut` (ISC), `eventemitter3` (MIT),
`ismobilejs` (MIT), `parse-svg-path` (MIT) and `tiny-lru` (**BSD-3-Clause**, permissive; its notice
is reproduced in the banner, as the licence requires for binary redistribution). Every notice
travels in `SCENE_BANNER`.
