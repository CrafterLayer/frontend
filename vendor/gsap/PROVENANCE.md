# GSAP 3.15.0 — provenance

Written by `scripts/vendor-gsap.mjs`. The three `.min.js` files are byte-for-byte copies of
the npm tarball's `dist/` files: nothing is edited, minified again or stripped (the licence's
§III forbids removing or altering notices).

- Tarball: `https://registry.npmjs.org/gsap/-/gsap-3.15.0.tgz`
- Integrity: `sha512-dMW4CWBTUK1AEEDeZc1g4xpPGIrSf9fJF960qbTZmN/QwZIWY5wgliS6JWl9/25fpTGJrMRtSjGtOmPnfjZB+A==`
- npm "license" field: `Standard 'no charge' license: https://gsap.com/standard-license.`
- Licence: GSAP Standard No-Charge License (Webflow), NOT OSI — text in `LICENSE.md`
- Licence fetched: `2026-10-06`
- Licence served from: `https://gsap.com/community/standard-license/`
- Adopted: owner request 2026-10-06, under the conditions in media-motion DESIGN.md §C.1
  (agent recipes only; no visual timeline editor; pinned version; unmodified files)

| File | Bytes | sha256 |
| --- | --- | --- |
| `gsap.min.js` | 72927 | `92bb9a96476f983d212a2bc4f54c889039c1696dd4461d40a736860938570fbb` |
| `ScrollTrigger.min.js` | 44575 | `b0b14d67b55b0c43c756ac0b106cfcb09d0879945f6ead64451065b0672916a2` |
| `SplitText.min.js` | 7732 | `419f7027a5f086a12cb7988736d8fdd3a6ed2200229661de25b6628ca7ced344` |

Generated string module: `packages/builder/renderer/src/engines/timeline-source.ts`
(`TIMELINE_SOURCE` = the three files joined by `"\n;"`; `sources.test.ts` hashes each slice).
