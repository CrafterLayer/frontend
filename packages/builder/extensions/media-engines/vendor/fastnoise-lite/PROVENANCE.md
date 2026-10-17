# FastNoiseLite 1.1.1 (vendored, pinned)

| | |
| --- | --- |
| Upstream | [Auburn/FastNoiseLite](https://github.com/Auburn/FastNoiseLite) by Jordan Peck and contributors |
| Package | npm `fastnoise-lite@1.1.1` (`dist-tags.latest` on 2026-10-13, published 2024-03-05) |
| Tarball integrity | `sha512-PA0FW9ZpcHbojUCMu28z9Vg/fNkwTj5YhusSAjHHDfHDGLxJ6YUKrAN2vk1fP2MMOxVw4Oko16FMlRGVBGqLKg==` |
| Licence | MIT — package.json `"license": "MIT"` and the MIT notice opening `FastNoiseLite.js`. The tarball carries no LICENSE file, so `LICENSE` here is the repository's own (raw.githubusercontent.com/Auburn/FastNoiseLite/master/LICENSE, read 2026-10-13). |
| Verbatim copy | `FastNoiseLite.js` (sha256 `83cdfcdc9f65e02b4a8ea6fc157283119379b316b28b0021e9cc0f4d15de01bb`), unchanged |
| Ours | `FastNoiseLite.d.ts` (types for what we call) |
| Used by | `src/studio/libs/noise/fast.ts`, bundled into `ck-lib-noise.js` |

**Why copied, not installed** (the owner's choice, 2026-10-13): the npm tarball carries no licence
file, and the engine build's licence audit admits an installed package only with one. A vendored
copy is audited the way `webgl-noise` and `zzfx` are: `scripts/studio-engine-targets.mjs` lists
this `LICENSE` under the `noise` target's `vendored`, and `scripts/build-studio-engines.mjs` puts it
in the `ck-lib-noise.js` banner, so the notice travels with every copy of the published asset.

**Upgrading**: replace `FastNoiseLite.js` with the new release's file verbatim, update the version,
integrity and sha256 above and the `vendored` entry's version, then rebuild the noise target.
