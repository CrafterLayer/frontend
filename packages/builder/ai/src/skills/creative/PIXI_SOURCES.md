# PixiJS v8 skills — sources and licences

The five `craftkit.pixi-v8-*` skills in `pixi-v8.ts` were written on **2026-10-10** at the owner's
request («ضيف على الـ agent الـ skills من https://pixijs.com/8.x/guides/getting-started/intro»).
Following the house rule for published Skills, nothing was installed or pasted: the guides were
read, and the skills were **rewritten as reviewed data** against what this agent can run — the
free-code `ck` runtime (`ck.stage`, `ck.onDispose`, `ck.reducedMotion`, `ck.editor`) and the full
pixi.js namespace that `ck.pixi()` ships.

## Sources (retrieved 2026-10-10 with Node `fetch`)

| Source                                                                                                                       | What was used                                                                                                                                                                                                                                                                                                                                                                                         | Licence                                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| https://pixijs.com/llms.txt (9.9 kB index, llmstxt.org format)                                                               | the table of guides                                                                                                                                                                                                                                                                                                                                                                                   | see below                                                    |
| https://pixijs.com/llms-full.txt (≈990 kB: every 8.x guide, then the API reference)                                          | Quick Start, Architecture, Render Loop, Scene Graph, Render Groups, Performance Tips, Garbage Collection, Application + Resize/Ticker/Culler plugins, Ticker, Container, Graphics, Graphics Fill, Text / BitmapText / HTMLText / SplitText / TextStyle, Assets, Textures, Sprite, Tiling/NineSlice Sprite, Particle Container, Mesh, Filters / Blend Modes, Events, Accessibility, v8 Migration Guide | see below                                                    |
| https://github.com/pixijs/pixijs (pixi.js 8.22.0, the version installed from the pnpm catalog and bundled into `ck-pixi.js`) | API names and signatures, checked against `node_modules/pixi.js/lib` (e.g. `defaultFilterVert` export, renderer `resize` event, ParticleContainer `boundsArea`)                                                                                                                                                                                                                                       | **MIT** — Copyright (c) 2013-2023 Mathew Groves, Chad Engler |

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
- **`ck.pixi()` alone has no add-ons** because it bundles `import * as PIXI from 'pixi.js'` only.
  The existing Studio path exposes filters as `s.lib.filters` only when the runtime card admits
  `ck.scene({libs:['filters']})`; advanced blend modes require `blend:true`. Installation does not
  authorize arbitrary `@pixi/*` imports. The same lazy allowlist owns physics, viewport, emitter,
  brush and rough adapters.
- The custom-filter coordinate formula (`vTextureCoord*uInputSize.xy/uOutputFrame.zw`) is derived
  from pixi.js's MIT default filter vertex shader (`filters/defaults/defaultFilter.vert`), not from
  a guide. Shaders are not compiled in the tests (no GPU in Node); verify a new shader in a browser.

## Skills

| id                                  | priority | loads for                                                              | ≈ tokens (own) |
| ----------------------------------- | -------- | ---------------------------------------------------------------------- | -------------- |
| `craftkit.pixi-v8-core`             | 43       | any Pixi / mural / generative / free-code ask                          | 1,160          |
| `craftkit.pixi-v8-graphics`         | 42       | any Pixi / mural / generative ask                                      | 1,040          |
| `craftkit.pixi-v8-text-assets`      | 41       | sprite, spritesheet, bitmap/HTML/split text, image or text murals      | 960            |
| `craftkit.pixi-v8-effects`          | 41       | shader, GLSL, particles, displacement, Pixi filters/mesh               | 1,140          |
| `craftkit.pixi-v8-interaction-perf` | 41       | follow-the-mouse, interactive mural/scene/background, Pixi performance | 1,010          |

All but the core depend on the core. Token counts are the resolver's estimate (JSON length / 4),
measured 2026-10-10; the floor (craft manual) is 464 more. Floor + core + effects is 2,764 against
the 2,800 per-skill ceiling in `builtins.test.ts`, so growth in the core or effects must be paid for
by cuts. A request that loads all five costs 5,771 tokens, floor included.

## Creative scene skills — 2026-10-11

`pixi-creative.ts` adds three original, data-only project AI skills. These are not copied upstream
guides or globally installed coding-agent skills. Their contract comes from CraftKit's existing
`studio/kit` and lazy add-on adapters, plus the approved PX scene-input/fixed-tick/chapter
extension. They do not grant free-code access: when it is off, the model must use closed `media.add`
scenes and explain the opt-in. No additional dependency is implied by a skill's presence.

| id                      | priority | activation                                                                                     | estimated floor + core + own tokens |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------- | ----------------------------------- |
| `craftkit.pixi-games`   | 44       | Playable/2D/browser game phrases in English and Arabic                                         | 2,737                               |
| `craftkit.pixi-stories` | 44       | Interactive stories, visual narratives and chapter-scene phrases, not bare business-story copy | 2,456                               |
| `craftkit.pixi-murals`  | 44       | Mural/generative-art requests in English and Arabic                                            | 2,337                               |

All three depend on the v8 core. Core/graphics activation now recognizes game/story requests;
ordinary landing pages, game-store copy and company-history requests remain outside these creative
playbooks. Activation is the existing deterministic whole-word/phrase resolver, not a claim that an
LLM semantically classifies every possible phrasing.

The worked game has an objective, pixel-distance collection/hazard contact, timeout failure,
pause/restart and native DOM movement controls. Reduced motion offers manual steps and explicit
rendering without an automatic simulation. The chapter story has DOM narrative, boundary-disabled
navigation, layer visibility and replay without autoplay. The seeded mural has palette-derived
ribbons, layered details and bounded local-pointer parallax, not only generic particles.

Exported example code and companion DOM-marker markup are also consumed by local developer browser
fixtures. `pixi-creative.test.ts` runs their real Pixi v8 Graphics/Container scene objects with a
structural host, tests interaction/cleanup/resize and exact prompt activation, and retains the
existing floor-plus-one-skill-plus-dependencies ceiling below 2,800 estimated context tokens.
Measured with the canonical resolver on 2026-10-11, the broad combined example request is 8,439
estimated tokens and stays below the 11,000 test gate. These estimates are not billed tokens; Node
tests do not prove GPU rendering, real browser input isolation or live model design quality.
