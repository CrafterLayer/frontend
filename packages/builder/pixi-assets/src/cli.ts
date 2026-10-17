#!/usr/bin/env node
/**
 * craftkit-pixi-assets — AssetPack from the command line (Node 24 runs this file as is):
 *
 *   pnpm --filter @craftkit/builder-pixi-assets assets build --entry raw-assets --output public/assets
 *   pnpm --filter @craftkit/builder-pixi-assets assets watch --entry raw-assets --output public/assets
 *
 * Flags: --avif (also write AVIF), --no-cache-bust (stable file names), --strict (fail on any
 * asset error, for CI). After a build it prints one line per manifest bundle.
 */
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { AssetPack } from '@assetpack/core';

import { pixiAssetsConfig, type PixiAssetsOptions } from './config.ts';
import { readPixiManifest, summarizePixiManifest } from './manifest.ts';

export interface PixiAssetsCommand {
  readonly mode: 'build' | 'watch';
  readonly options: PixiAssetsOptions;
}

const USAGE =
  'Usage: craftkit-pixi-assets <build|watch> --entry <raw folder> --output <folder> [--avif] [--no-cache-bust] [--strict]';

/** The command a list of arguments asks for, or the reason it cannot be run. */
export function parsePixiAssetsArgs(
  args: readonly string[],
):
  | { readonly ok: true; readonly command: PixiAssetsCommand }
  | { readonly ok: false; readonly error: string } {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      allowPositionals: true,
      options: {
        entry: { type: 'string' },
        output: { type: 'string' },
        avif: { type: 'boolean', default: false },
        'no-cache-bust': { type: 'boolean', default: false },
        strict: { type: 'boolean', default: false },
      },
    });
  } catch (error) {
    return {
      ok: false,
      error: `${error instanceof Error ? error.message : String(error)}\n${USAGE}`,
    };
  }
  const [mode] = parsed.positionals;
  if (mode !== 'build' && mode !== 'watch') return { ok: false, error: USAGE };
  const { entry, output } = parsed.values;
  if (entry === undefined || output === undefined)
    return { ok: false, error: `--entry and --output are required.\n${USAGE}` };
  return {
    ok: true,
    command: {
      mode,
      options: {
        entry,
        output,
        cacheBust: !parsed.values['no-cache-bust'],
        strict: parsed.values.strict,
        ...(parsed.values.avif ? { formats: { avif: true } } : {}),
      },
    },
  };
}

async function main(args: readonly string[]): Promise<number> {
  const parsed = parsePixiAssetsArgs(args);
  if (!parsed.ok) {
    console.error(parsed.error);
    return 2;
  }
  const { mode, options } = parsed.command;
  const pack = new AssetPack(pixiAssetsConfig(options));
  if (mode === 'watch') {
    await pack.watch();
    return 0;
  }
  await pack.run();
  for (const line of summarizePixiManifest(await readPixiManifest(options.output)))
    console.log(line);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2));
}
