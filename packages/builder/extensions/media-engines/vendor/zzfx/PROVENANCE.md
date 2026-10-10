# ZzFX 1.4.0 (vendored, pinned)

| | |
| --- | --- |
| Upstream | [KilledByAPixel/ZzFX](https://github.com/KilledByAPixel/ZzFX) by Frank Force |
| Package | npm `zzfx@1.4.0` (`dist-tags.latest` on 2026-10-10) |
| Tarball integrity | `sha512-yV/7JnIBPThWh/ZLVZLlmadms5bHQQeoWKKA+DafX4554FHypsop1BQrDHhsf2xxXweUmwjWrnpiB42uBGyGlQ==` (verified on download) |
| Licence | MIT — `LICENSE` here (package.json `"license": "MIT"`, LICENSE text reads MIT) |
| Verbatim copy | `ZzFX.js` (sha256 `43f321101a935892c112a291e2e943b4da33159b43fcd4a21f3eae710f4a27ff`) |
| Adapted into | `src/sound/zzfx.ts` (the `buildSamples` synth only) |

**Why adapted, not imported**: upstream creates `new AudioContext` when the module is evaluated
(`ZZFX.audioContext`). CraftKit's sound rule (pixi-studio DESIGN D12) creates the one context
lazily and resumes it only inside a user gesture, and every voice goes through the engine's buses
and mute. So `src/sound/zzfx.ts` keeps `buildSamples` (the sample generator, arithmetic unchanged)
as a pure function of `(sampleRate, params)` and drops `play`/`playSamples`/`ZZFXSound`.

`scripts/build-sound-engine.mjs` puts this `LICENSE` text in the `ck-sound.js` banner, so the
notice travels with every copy of the published asset. The repo-level ledgers
(`vendor/VENDOR.md`, `THIRD_PARTY_LICENSES`) are kept by the engine-libs package.
