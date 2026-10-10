import * as emitter from '../../../vendor/particle-emitter/src/index';

/** The pinned, locally patched Pixi v8 particle emitter. */
export function createEmitterLibrary() {
  return Object.freeze({ ...emitter });
}
