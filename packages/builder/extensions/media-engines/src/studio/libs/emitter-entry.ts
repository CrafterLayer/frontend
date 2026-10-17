import * as emitter from '../../../vendor/particle-emitter/src/index';
import { ColorPickBehavior, DriftBehavior } from './emitter/behaviors';
import { createParticleKit, type EmitterClass } from './emitter/spawn';

/**
 * The pinned, locally patched Pixi v8 particle emitter, unchanged, plus CraftKit's tuned presets
 * (particles and physics, 2026-10-13): `presets.<name>(s, options)` → a config for
 * `new Emitter(container, config)`, `spawn(s, name, options)` → a running, self-disposing
 * emitter, `burst(s, name, options)` → one shot. The two behaviours the presets use (`colorPick`,
 * `drift`) register through upstream's own Emitter.registerBehavior; the vendored files stay as
 * fetched (vendor/particle-emitter/PATCHES.md).
 */
export function createEmitterLibrary() {
  const Emitter = emitter.Emitter as unknown as {
    registerBehavior(behavior: unknown): void;
  } & EmitterClass;
  Emitter.registerBehavior(ColorPickBehavior);
  Emitter.registerBehavior(DriftBehavior);
  return Object.freeze({ ...emitter, ...createParticleKit(Emitter) });
}
