import { AssetPack } from '@assetpack/core';
import type { Plugin, ResolvedConfig } from 'vite';

import { pixiAssetsConfig, type PixiAssetsOptions } from './config.ts';

/**
 * AssetPack inside Vite, as https://pixijs.io/assetpack/docs/guide/getting-started/vite/ wires it:
 * `vite dev` watches the raw folder and rewrites what changed; `vite build` runs it once before
 * the bundle. Without an `output` the files go to `<publicDir>/assets/`, so the page loads
 * `/assets/manifest.json`.
 *
 *   // vite.config.ts
 *   import { pixiAssetsPlugin } from '@craftkit/builder-pixi-assets/vite';
 *   export default defineConfig({ plugins: [pixiAssetsPlugin({ entry: './raw-assets' })] });
 */
export type PixiAssetsPluginOptions = Omit<PixiAssetsOptions, 'output'> & {
  readonly output?: string;
};

/** Where the files go when no `output` is given: `assets/` under Vite's public folder. */
export function defaultPixiAssetsOutput(
  config: Pick<ResolvedConfig, 'publicDir' | 'root'>,
): string | undefined {
  if (config.publicDir === '') return undefined;
  return `${config.publicDir}/assets`;
}

export function pixiAssetsPlugin(options: PixiAssetsPluginOptions): Plugin {
  let command: ResolvedConfig['command'] = 'build';
  let output = options.output;
  let watcher: AssetPack | undefined;
  return {
    name: 'craftkit-pixi-assets',
    configResolved(config) {
      command = config.command;
      output ??= defaultPixiAssetsOutput(config);
    },
    async buildStart() {
      if (output === undefined) {
        this.warn('pixi-assets: no output and no public folder, so nothing was written.');
        return;
      }
      const config = pixiAssetsConfig({ ...options, output });
      if (command === 'serve') {
        if (watcher !== undefined) return;
        watcher = new AssetPack(config);
        void watcher.watch();
        return;
      }
      await new AssetPack(config).run();
    },
    async buildEnd() {
      if (watcher === undefined) return;
      await watcher.stop();
      watcher = undefined;
    },
  };
}
