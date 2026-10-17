import type { AssetPackConfig } from '@assetpack/core';
import { pixiPipes } from '@assetpack/core/pixi';

/**
 * CraftKit's AssetPack preset (2026-10-12): the PixiJS pipes of
 * https://pixijs.io/assetpack/docs/guide/getting-started/pixi/ with this project's defaults.
 *
 * A raw-assets folder goes in; optimised files and a PixiJS manifest come out:
 *
 * - every image at each resolution (`default` 1×, `low` 0.5× → `hero@0.5x.webp`), as WebP plus
 *   its own format (PNG or JPEG) for the rare browser without WebP; AVIF on request;
 * - a folder tagged `{tps}` becomes one texture atlas (a spritesheet JSON PixiJS reads);
 * - a folder tagged `{m}` becomes a manifest bundle (`Assets.loadBundle('game')`);
 * - audio is compressed with ffmpeg, fonts become woff2, JSON is minified;
 * - file names carry a content hash (`cacheBust`), so a changed image is never served stale.
 *
 * Other tags: `{fix}` one resolution only, `{nomip}` no smaller copies, `{copy}` copied as is,
 * `{ignore}` left out, `{mIgnore}` processed but kept out of the manifest.
 */

export interface PixiAssetFormats {
  readonly webp?: boolean;
  readonly avif?: boolean;
  readonly png?: boolean;
  readonly jpg?: boolean;
}

export interface PixiAssetsOptions {
  /** The raw assets folder. */
  readonly entry: string;
  /** Where the optimised files and `manifest.json` are written. */
  readonly output: string;
  /** Resolution names → scale; the source is the largest. Defaults to `{ default: 1, low: 0.5 }`. */
  readonly resolutions?: Readonly<Record<string, number>>;
  /** Image formats written beside each image. Defaults to WebP plus the source's own format. */
  readonly formats?: PixiAssetFormats;
  /** A content hash in every file name. Defaults to true. */
  readonly cacheBust?: boolean;
  /** AssetPack's cache folder (skips unchanged files). Defaults to `.assetpack` beside the run. */
  readonly cacheLocation?: string;
  /** Fail the run when any asset fails. Defaults to false (CI should pass true). */
  readonly strict?: boolean;
  readonly logLevel?: AssetPackConfig['logLevel'];
}

/** The manifest's file name inside `output`. */
export const PIXI_MANIFEST_FILE = 'manifest.json';

export const PIXI_ASSET_DEFAULTS = {
  resolutions: { default: 1, low: 0.5 },
  formats: { webp: true, avif: false, png: true, jpg: true },
  cacheBust: true,
} as const satisfies Required<Pick<PixiAssetsOptions, 'resolutions' | 'formats' | 'cacheBust'>>;

/** The AssetPack config for `options`: hand it to `new AssetPack(config).run()` or `.watch()`. */
export function pixiAssetsConfig(options: PixiAssetsOptions): AssetPackConfig {
  const formats = { ...PIXI_ASSET_DEFAULTS.formats, ...options.formats };
  return {
    entry: options.entry,
    output: options.output,
    cache: true,
    ...(options.cacheLocation === undefined ? {} : { cacheLocation: options.cacheLocation }),
    strict: options.strict ?? false,
    ...(options.logLevel === undefined ? {} : { logLevel: options.logLevel }),
    pipes: pixiPipes({
      cacheBust: options.cacheBust ?? PIXI_ASSET_DEFAULTS.cacheBust,
      resolutions: { ...(options.resolutions ?? PIXI_ASSET_DEFAULTS.resolutions) },
      compression: formats,
      texturePacker: { texturePacker: { nameStyle: 'short', removeFileExtension: true } },
      // Short aliases without extensions: `Assets.get('hero')`, `Sprite.from('btn-a')`.
      manifest: { createShortcuts: true, trimExtensions: true },
    }),
  };
}
