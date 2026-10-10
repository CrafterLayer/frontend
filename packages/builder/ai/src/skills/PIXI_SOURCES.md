# PixiJS v8 skills — sources and licences

The five `craftkit.pixi-v8-*` skills in `pixi-v8.ts` were written on **2026-10-10** at the owner's
request («ضيف على الـ agent الـ skills من https://pixijs.com/8.x/guides/getting-started/intro»).
Following the house rule for published Skills, nothing was installed or pasted: the guides were
read, and the skills were **rewritten as reviewed data** against what this agent can run — the
free-code `ck` runtime (`ck.stage`, `ck.onDispose`, `ck.reducedMotion`, `ck.editor`) and the
full pixi.js namespace that `ck.pixi()` ships.

## Sources (retrieved 2026-10-10 with Node `fetch`)

| Source | What was used | Licence |
| --- | --- | --- |
| https://pixijs.com/llms.txt (9.9 kB index, llmstxt.org format) | the table of guides | see below |
| https://pixijs.com/llms-full.txt (≈990 kB: every 8.x guide, then the API reference) | Quick Start, Architecture, Render Loop, Scene Graph, Render Groups, Performance Tips, Garbage Collection, Application + Resize/Ticker/Culler plugins, Ticker, Container, Graphics, Graphics Fill, Text / BitmapText / HTMLText / SplitText / TextStyle, Assets, Textures, Sprite, Tiling/NineSlice Sprite, Particle Container, Mesh, Filters / Blend Modes, Events, Accessibility, v8 Migration Guide | see below |
| https://github.com/pixijs/pixijs (pixi.js 8.22.0, the version installed from the pnpm catalog and bundled into `ck-pixi.js`) | API names and signatures, checked against `node_modules/pixi.js/lib` (e.g. `defaultFilterVert` export, renderer `resize` event, ParticleContainer `boundsArea`) | **MIT** — Copyright (c) 2013-2023 Mathew Groves, Chad Engler |

### Licence of the guides

The guides live in the website repository **https://github.com/pixijs/pixijs.com** (Docusaurus,
`docs/guides/`). On 2026-10-10 that repository declared **no licence**: the GitHub API reports
`"license": null`, there is no `LICENSE` file on `main`, and its `package.json` is `"private": true`
with no `license` field. Unlicensed text is all-rights-reserved by default, so **no guide prose or
guide example is copied** into the skills. What the skills carry is:

- facts about the pixi.js API (names, option shapes, defaults, what was renamed in v8) — the library
  itself is MIT;
- CraftKit's own rules and wording (the `ck` runtime, reduced motion, pausing, cleanup, Arabic
  shaping limits, what `ck.pixi()` does and does not ship);
- ten worked examples written for this runtime, each compiled and run against pixi.js 8.22.0 by
  `pixi-v8.test.ts`, which fails on any v8 deprecation warning.

If PixiJS later licenses the guides, nothing here needs to change; if the owner wants guide text
quoted verbatim, ask PixiJS first.

## What is CraftKit's, not PixiJS's

- **Arabic**: the guides only say HTMLText is "compatible with … RTL". The rule that BitmapText,
  SplitText and SplitBitmapText break Arabic letter joining (they place glyph by glyph) is CraftKit
  engineering guidance, not a PixiJS statement.
- **pixi-filters and advanced blend modes are not available** because `ck.pixi()` bundles
  `import * as PIXI from 'pixi.js'` only (`packages/builder/extensions/media-engines/src/pixi-entry.ts`);
  if the pixi-studio work adds libraries, update the effects skill.
- The custom-filter coordinate formula (`vTextureCoord*uInputSize.xy/uOutputFrame.zw`) is derived
  from pixi.js's MIT default filter vertex shader (`filters/defaults/defaultFilter.vert`), not from a
  guide. Shaders are not compiled in the tests (no GPU in Node); verify a new shader in a browser.

## Skills

| id | priority | loads for | ≈ tokens (own) |
| --- | --- | --- | --- |
| `craftkit.pixi-v8-core` | 43 | any Pixi / mural / generative / free-code ask | 1,160 |
| `craftkit.pixi-v8-graphics` | 42 | any Pixi / mural / generative ask | 1,040 |
| `craftkit.pixi-v8-text-assets` | 41 | sprite, spritesheet, bitmap/HTML/split text, image or text murals | 960 |
| `craftkit.pixi-v8-effects` | 41 | shader, GLSL, particles, displacement, Pixi filters/mesh | 1,140 |
| `craftkit.pixi-v8-interaction-perf` | 41 | follow-the-mouse, interactive mural/scene/background, Pixi performance | 1,010 |

All but the core depend on the core. Token counts are the resolver's estimate (JSON length / 4),
measured 2026-10-10; the floor (craft manual) is 464 more. Floor + core + effects is 2,764 against
the 2,800 per-skill ceiling in `builtins.test.ts`, so growth in the core or effects must be paid for
by cuts. A request that loads all five costs 5,771 tokens, floor included.
