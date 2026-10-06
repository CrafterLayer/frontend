/*
  The scene engine bundle's entry (media-motion DESIGN §D.3).

  `scripts/build-scene-engine.mjs` bundles THIS file with esbuild into one IIFE
  and writes it to packages/builder/renderer/src/engines/scene-source.ts as a
  string. The renderer never imports Pixi: the published site loads that string
  as `assets/ck-scene.js` on pages carrying `data-ck-scene`, and the editor
  canvas injects it into the frame document.

  Pixi surface used (and nothing else, so the tree-shaken bundle stays small):
  Application, Container, Sprite, Graphics, Assets, Texture, ParticleContainer,
  Particle, DisplacementFilter, NoiseFilter, BlurFilter.
*/

import {
  Application,
  Assets,
  BlurFilter,
  Container,
  DisplacementFilter,
  Graphics,
  NoiseFilter,
  Particle,
  ParticleContainer,
  Sprite,
  Texture,
} from 'pixi.js';

import { ensureCkEngines, type CkEngine, type CkEnginesHost } from './ck-engines';
import { createSceneEngine, type SceneName } from './engine';
import { meshGradient } from './scenes/mesh-gradient';
import { mural } from './scenes/mural';
import { parallaxLayers } from './scenes/parallax-layers';
import { particles } from './scenes/particles';
import { ripple } from './scenes/ripple';
import type { PixiScene } from './scenes/shared';

/** The Pixi classes this bundle is allowed to reach; kept referenced so the subset is explicit. */
export const PIXI_SUBSET = Object.freeze({
  Application,
  Assets,
  BlurFilter,
  Container,
  DisplacementFilter,
  Graphics,
  NoiseFilter,
  Particle,
  ParticleContainer,
  Sprite,
  Texture,
});

export const SCENES: Readonly<Record<SceneName, PixiScene>> = Object.freeze({
  particles,
  'mesh-gradient': meshGradient,
  'parallax-layers': parallaxLayers,
  mural,
  ripple,
});

/**
 * Register the scene engine on `win.ckEngines` (creating the handshake if the
 * `engines` pack has not run yet) and mount every scene already queued.
 */
export function installSceneEngine(win: CkEnginesHost): CkEngine {
  const engine = createSceneEngine<Application, Texture>({
    createApp: () => new Application(),
    // `parser: 'texture'` because catalog URLs often carry no file extension.
    loadTexture: (url) => Assets.load<Texture>({ src: url, parser: 'texture' }),
    scenes: SCENES,
  });
  ensureCkEngines(win).ready('scene', engine);
  return engine;
}
