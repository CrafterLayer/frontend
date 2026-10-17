import type { StyleValue } from '@craftkit/builder-schema';

import { splitTopLevel } from './split-top-level';

/** The track sizes offered per track. */
export const TRACK_SIZES: readonly string[] = [
  '1fr',
  '2fr',
  '3fr',
  'auto',
  'min-content',
  'max-content',
  'minmax(0,1fr)',
  'minmax(200px,1fr)',
];

const REPEAT = /^repeat\(\s*(\d+)\s*,\s*(.+)\)$/u;

/** The tracks a stored value describes: `3` → three `1fr`; `1fr 2fr` → two. */
export function tracksOf(value: StyleValue | undefined): string[] {
  if (value === undefined) return [];
  if (value.kind === 'token') {
    const count = Number(value.token);
    return Number.isInteger(count) && count > 0 ? Array.from({ length: count }, () => '1fr') : [];
  }
  if (value.kind !== 'raw') return [];
  const tracks: string[] = [];
  for (const part of splitTopLevel(value.css)) {
    const repeat = REPEAT.exec(part);
    const count = repeat === null ? 1 : Number(repeat[1]);
    const size = repeat === null ? part : (repeat[2] ?? '1fr').trim();
    for (let index = 0; index < count && index < 24; index += 1) tracks.push(size);
  }
  return tracks;
}

/**
 * The value tracks are written as: N equal `1fr` tracks are the token `N`
 * (`grid-cols-3`, which Tailwind writes as `repeat(3, minmax(0, 1fr))`);
 * anything else is the exact template.
 */
export function valueOfTracks(tracks: readonly string[]): StyleValue | null {
  if (tracks.length === 0) return null;
  if (tracks.length <= 12 && tracks.every((track) => track === '1fr' || track === 'minmax(0,1fr)')) {
    return { kind: 'token', token: String(tracks.length) };
  }
  return { kind: 'raw', css: tracks.join(' ') };
}
