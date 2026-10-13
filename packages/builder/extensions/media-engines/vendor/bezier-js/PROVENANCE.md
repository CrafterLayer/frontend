# Bezier.js 6.1.4 (vendored, pinned)

| | |
| --- | --- |
| Upstream | [Pomax/bezierjs](https://github.com/Pomax/bezierjs) by Mike "Pomax" Kamermans |
| Package | npm `bezier-js@6.1.4` (`dist-tags.latest` on 2026-10-13, published 2023-07-16) |
| Tarball integrity | `sha512-3XEk16gmVq1HUL0+BdoR+/wD/tfB6VQjpliqQ7rSSE2omh23wrJGidQ5Mfr4mECCUtBGtcEov44BGIyVqs+U4w==` |
| Licence | MIT — package.json `"license": "MIT"`. The tarball carries no LICENSE file, so `LICENSE` here is the repository's `LICENSE.md` (raw.githubusercontent.com/Pomax/bezierjs/master/LICENSE.md, read 2026-10-13). |
| Verbatim copies | `bezier.js` (sha256 `ae20cb2547fe05581d07a67f966004ee4d86aeaf0117505bada9b1442114eb47`), `utils.js` (`b09ff99724bac1ab7663a6944487fd25c31e8c684814083f9eb2c33833c5a64f`), `poly-bezier.js` (`f73640e4d80a0d317136375d8b2e77d2ad9e77caf5b973709b4a19199b044c38`) — the package's ES module `src/`, unchanged |
| Ours | `bezier.d.ts` (types for what we call) |
| Used by | `src/studio/libs/geom/curve.ts`, bundled into `ck-lib-geom.js` |

**Why copied, not installed** (the owner's choice, 2026-10-13): as for FastNoiseLite — no licence
file in the tarball. `scripts/studio-engine-targets.mjs` lists this `LICENSE` under the `geom`
target's `vendored`, so `ck-lib-geom.js` carries the notice in its banner.

**Upgrading**: replace the three files with the new release's `src/` verbatim, update the version,
integrity and sha256 values above and the `vendored` entry's version, then rebuild the geom target.
