/**
 * @craftkit/builder-pixi-assets — PixiJS AssetPack for CraftKit (2026-10-12). Node only, a build
 * step: nothing here ships to a page. The page side is PixiJS itself:
 * `await Assets.init({ manifest: '<url>/manifest.json' }); await Assets.loadBundle('game')`.
 */
export {
  PIXI_ASSET_DEFAULTS,
  PIXI_MANIFEST_FILE,
  pixiAssetsConfig,
  type PixiAssetFormats,
  type PixiAssetsOptions,
} from './config.ts';
export {
  parsePixiManifest,
  readPixiManifest,
  summarizePixiManifest,
  type PixiManifest,
  type PixiManifestAsset,
  type PixiManifestBundle,
} from './manifest.ts';
export { parsePixiAssetsArgs, type PixiAssetsCommand } from './cli.ts';
