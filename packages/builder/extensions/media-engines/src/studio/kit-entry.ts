/* The namespace returned by ck-lib-kit.js after it binds to the page's one Pixi instance. */

import { createScene, KIT_VERSION } from './kit/create-scene';
import type { SceneApp, SceneHost, SceneLibs, SceneOptions, ScriptParamValue } from './kit/types';

interface RuntimeSceneContext {
  readonly ck: SceneHost;
  readonly app: SceneApp;
  readonly canvas: HTMLCanvasElement;
  readonly lib: SceneLibs;
  readonly options: SceneOptions;
  readonly params: Readonly<Record<string, ScriptParamValue>>;
}

/** Build the stable scene API adapter once per document. */
export function createKitLibrary(PIXI: unknown) {
  return Object.freeze({
    version: KIT_VERSION,
    createScene(context: RuntimeSceneContext) {
      return createScene(context.ck, PIXI, context.app, context.canvas, context.lib, {
        ...context.options,
        params: { ...context.params },
      });
    },
  });
}
