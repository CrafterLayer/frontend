# anime.js 4.5.0 subset — provenance

Written by `scripts/vendor-timeline-engine.mjs` (gsap-pixi, 2026-10-08). `anime.ck.min.js` is an
esbuild bundle of the npm tarball's ESM `dist/modules/`, keeping only
`createTimeline`, `animate`, `stagger`, `onScroll`, `splitText` and setting `window.ckAnime`. MIT permits the modification;
the notice travels in the asset banner (`TIMELINE_BANNER`). `LICENSE.md` is the tarball's,
verbatim.

- Tarball: `https://registry.npmjs.org/animejs/-/animejs-4.5.0.tgz`
- Integrity: `sha512-NQimYX+lz8WaXonGS9zVVoviCIAjONeJayxacUditaivYLqyXgGjFKjuyl0aUUhFKm5MriX9ty1TGovNzoJQWA==`
- npm "license" field: `MIT`
- esbuild: `0.28.2`
- Build: format iife, target es2020, minified, legal comments dropped (the banner carries the licence)

| File | Bytes | gzip -9 | sha256 |
| --- | --- | --- | --- |
| `anime.ck.min.js` | 57077 | 22318 | `79207dd3aa8635a180d55cecbe68b17bfda713635e18486f825af35f833a2969` |

Generated string module: `packages/builder/renderer/src/engines/timeline-source.ts`
(`TIMELINE_SOURCE` = `anime.ck.min.js` byte for byte; `sources.test.ts` hashes it).
