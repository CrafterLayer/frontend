import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PIXI_MANIFEST_FILE } from './config.ts';

/**
 * The PixiJS manifest AssetPack writes (`Assets.init({ manifest })` reads the same shape), and a
 * one-line-per-bundle summary of it for the command line.
 */

export interface PixiManifestAsset {
  readonly alias: readonly string[];
  readonly src: readonly string[];
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface PixiManifestBundle {
  readonly name: string;
  readonly assets: readonly PixiManifestAsset[];
}

export interface PixiManifest {
  readonly bundles: readonly PixiManifestBundle[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function strings(value: unknown): readonly string[] {
  if (typeof value === 'string') return [value];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

/** A manifest read defensively: entries of the wrong shape are dropped, never thrown on. */
export function parsePixiManifest(value: unknown): PixiManifest {
  const bundles = isRecord(value) && Array.isArray(value['bundles']) ? value['bundles'] : [];
  return {
    bundles: bundles.flatMap((bundle: unknown) => {
      if (!isRecord(bundle) || typeof bundle['name'] !== 'string') return [];
      const assets = Array.isArray(bundle['assets']) ? bundle['assets'] : [];
      return [
        {
          name: bundle['name'],
          assets: assets.flatMap((asset: unknown) => {
            if (!isRecord(asset)) return [];
            const data = asset['data'];
            return [
              {
                alias: strings(asset['alias']),
                src: strings(asset['src']),
                ...(isRecord(data) ? { data } : {}),
              },
            ];
          }),
        },
      ];
    }),
  };
}

/** The manifest a run wrote into `output`. */
export async function readPixiManifest(output: string): Promise<PixiManifest> {
  const text = await readFile(join(output, PIXI_MANIFEST_FILE), 'utf8');
  return parsePixiManifest(JSON.parse(text) as unknown);
}

/**
 * "game: 3 assets (webp, png; 1x, 0.5x)", one line per bundle that holds anything (AssetPack
 * always writes a `default` bundle for files outside every `{m}` folder, often empty).
 */
export function summarizePixiManifest(manifest: PixiManifest): readonly string[] {
  return manifest.bundles.flatMap(({ name, assets }) => {
    if (assets.length === 0) return [];
    const sources = assets.flatMap(({ src }) => src);
    const formats = [...new Set(sources.map((src) => /\.([a-z0-9]+)$/iu.exec(src)?.[1] ?? ''))]
      .filter((format) => format !== '')
      .sort();
    const scales = [...new Set(sources.map((src) => /@([\d.]+)x\./u.exec(src)?.[1] ?? '1'))].sort(
      (a, b) => Number(b) - Number(a),
    );
    const count = `${String(assets.length)} ${assets.length === 1 ? 'asset' : 'assets'}`;
    return [
      `${name}: ${count} (${formats.join(', ')}; ${scales.map((scale) => `${scale}x`).join(', ')})`,
    ];
  });
}
