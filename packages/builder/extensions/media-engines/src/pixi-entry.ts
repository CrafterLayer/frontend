/*
  The FULL pixi.js bundle's entry (free-code mode, 2026-10-09).

  `scripts/build-scene-engine.mjs pixi` bundles THIS file plus a one-line runner
  `installFullPixi(window)` with esbuild into one IIFE and writes it to
  packages/builder/renderer/src/engines/pixi-full-source.ts as a string. `import * as PIXI` is
  deliberate: the namespace is handed to author code whole, so nothing may be tree-shaken away.
  Excluded from unit tests and coverage for the reason `entry.ts` is: it pulls the whole library in.
*/

import * as PIXI from 'pixi.js';

import type { CkEngine, CkEnginesHost } from './ck-engines';
import { installPixiEngine } from './pixi-engine';

/** Register the whole pixi.js namespace on `win.ckEngines` as the `pixi` engine. */
export function installFullPixi(win: CkEnginesHost): CkEngine {
  return installPixiEngine(win, PIXI);
}
