import type { CustomCodeJsParams } from '@craftkit/builder-schema';

import type { ScenePreset } from '../scene-presets/catalog';

/*
  Variety for ready scenes (2026-11-01). The owner: every game and mural came out the same. A
  ready preset or kit placed with no params draws its built-in seed — the same picture on every
  page — and a brief that matched no ready scene was always offered the same four. Both now
  vary by what is being built, deterministically: the same inputs give the same answer (tests,
  repair rounds), a new build (new region ids) or another brief a different one.
*/

/** FNV-1a, 32-bit: a stable spread of a text, never security. */
export function varietyHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * A preset's seed for one placement — `parts` name the build and the section (its region id and
 * contract key) — or `undefined` when the preset declares no numeric `seed` param. Never the
 * preset's own default, so a placed scene never repeats the catalogue picture.
 */
export function placementSeed(
  preset: Pick<ScenePreset, 'id' | 'params'>,
  ...parts: readonly string[]
): number | undefined {
  const spec = preset.params.find(({ key }) => key === 'seed');
  if (spec?.type !== 'number') return undefined;
  const min = Math.ceil(spec.min ?? 1);
  const max = Math.floor(spec.max ?? 9_999);
  if (max <= min) return undefined;
  const span = max - min + 1;
  const seed = min + (varietyHash([preset.id, ...parts].join('\u0000')) % span);
  return seed === spec.default ? min + ((seed - min + 1) % span) : seed;
}

/** `{ seed }` for a placement when the preset declares one and the writer did not set it. */
export function withPlacementSeed(
  preset: Pick<ScenePreset, 'id' | 'params'>,
  params: CustomCodeJsParams,
  ...parts: readonly string[]
): CustomCodeJsParams {
  if (Object.hasOwn(params, 'seed')) return params;
  const seed = placementSeed(preset, ...parts);
  return seed === undefined ? params : { ...params, seed };
}
