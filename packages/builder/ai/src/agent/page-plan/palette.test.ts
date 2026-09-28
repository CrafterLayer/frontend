import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { DIRECTION_DECK_ROWS } from '../../skills/direction-deck';
import { PAGE_PLAN_PALETTE_HEX } from './palette';

/*
  The deck's rows are written in palette NAMES and a planner copies them; a
  name this table lacks is refused, and each refusal is a paid repair round.
  That happened: the deck re-inked wedding and auto to yellow-800 and red-400
  at 07:58, this table (07:44) named 71 of the 73 shades, and a live Arabic
  wedding plan was refused for its own row's accent ink (engine wave-2
  verifier, 2026-09-28). These tests make the next such drift a red test
  instead of a slow page.
*/

/** Every shade any row names, across all ten palette roles. */
function deckShades(): ReadonlySet<string> {
  return new Set(DIRECTION_DECK_ROWS.flatMap(({ palette }) => Object.values(palette)));
}

/** The Tailwind v3 table page-power.test.ts computes the deck's contrast on, read as text. */
function measuredHex(): ReadonlyMap<string, string> {
  const source = readFileSync(new URL('../../skills/page-power.test.ts', import.meta.url), 'utf8');
  const table = source.slice(source.indexOf('const HEX'), source.indexOf('};', source.indexOf('const HEX')));
  return new Map(
    [...table.matchAll(/^ {2}(?:'([a-z]+-\d+)'|([a-z]+)): '(#[0-9a-f]{6})',$/gmu)].map((match) => [
      match[1] ?? match[2] ?? '',
      match[3] ?? '',
    ]),
  );
}

describe('PAGE_PLAN_PALETTE_HEX — the names a plan may use for colour', () => {
  it('resolves every shade every direction-deck row names', () => {
    const missing = [...deckShades()].filter((shade) => !Object.hasOwn(PAGE_PLAN_PALETTE_HEX, shade));
    expect(missing).toEqual([]);
  });

  it('is the deck’s shades plus stone-100 and stone-200, and nothing else', () => {
    const expected = new Set([...deckShades(), 'stone-100', 'stone-200']);
    expect(new Set(Object.keys(PAGE_PLAN_PALETTE_HEX))).toEqual(expected);
  });

  it('holds exactly the value each shade’s contrast was measured on', () => {
    const measured = measuredHex();
    expect(measured.size).toBeGreaterThan(40);
    for (const [shade, hex] of Object.entries(PAGE_PLAN_PALETTE_HEX)) {
      expect([shade, hex]).toEqual([shade, measured.get(shade)]);
    }
    // The two the verifier found missing, by value.
    expect(PAGE_PLAN_PALETTE_HEX['yellow-800']).toBe('#854d0e');
    expect(PAGE_PLAN_PALETTE_HEX['red-400']).toBe('#f87171');
  });
});
