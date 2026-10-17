import { describe, expect, it } from 'vitest';

import { normalize } from './spec';
import { ITEMS, lookup, vocabulary } from './registry';

/*
  mural kit (2026-10-14): the spec a model writes is read defensively — nothing throws, every
  problem is a warning that names the fix, and what is valid is kept.
*/

function read(spec: unknown) {
  const warnings: string[] = [];
  const n = normalize(spec, warnings);
  return { n, warnings };
}

describe('mural spec validation', () => {
  it.each([
    null,
    undefined,
    42,
    'mural',
    [],
    { layers: 5 },
    { beats: 'x' },
    { layers: { near: 'tree' } },
  ])('never throws on %j', (spec) => {
    expect(() => read(spec)).not.toThrow();
  });

  it('reads a full spec into its normalised form with no warnings', () => {
    const { n, warnings } = read({
      width: 2400,
      seed: 7,
      mood: 'desert',
      time: ['dusk', 'night'],
      layers: {
        sky: ['stars', { item: 'moon', kind: 'crescent', x: 900 }],
        far: [{ item: 'dunes', size: 80 }],
        near: [
          { item: 'camel', id: 'c', x: 300 },
          { item: 'palm', count: 3 },
        ],
      },
      cast: [{ item: 'person', id: 'p', x: 200, staff: true }],
      beats: [
        { label: 'a', dur: 4 },
        { label: 'b', camera: 0.5, walk: { c: 1200, p: 1100 } },
        { label: 'c', time: 'night', lights: 'on', state: { p: 'wave' }, still: true },
      ],
      mode: 'scrub',
    });
    expect(warnings).toEqual([]);
    expect(n).toMatchObject({
      width: 2400,
      seed: 7,
      mood: 'desert',
      times: ['dusk', 'night'],
      mode: 'scrub',
    });
    expect(n.items.map((item) => `${item.depth}:${item.name}:${item.kind}`)).toEqual([
      'sky:stars:',
      'sky:moon:crescent',
      'far:dunes:',
      'near:camel:',
      'near:tree:palm',
      'near:person:robe',
    ]);
    expect(n.items[5]?.flag).toEqual({ staff: true });
    expect(n.beats[1]?.move).toEqual({ c: { x: 1200, walk: true }, p: { x: 1100, walk: true } });
    expect(n.beats[2]).toMatchObject({
      time: 'night',
      lights: true,
      state: { p: 'wave' },
      still: true,
    });
  });

  it('skips unknown items with the closest real name, and reports unknown keys', () => {
    const { n, warnings } = read({
      layers: {
        near: ['tre', { item: 'houze' }, { item: 'tree', colour: '#fff' }],
        back: ['hills'],
      },
      sky: true,
      colour: 1,
    });
    expect(n.items.map((item) => item.name)).toEqual(['tree']);
    expect(warnings).toEqual(
      expect.arrayContaining([
        'spec: unknown key "colour" ignored',
        'near: unknown item "tre" skipped — did you mean "tree"?',
        'near: unknown item "houze" skipped — did you mean "house"?',
        'tree: unknown key "colour" ignored',
        'layers: unknown layer "back" (use sky, far, mid, near, front)',
      ]),
    );
  });

  it('falls back on a bad kind, mood, time or colour and clamps numbers', () => {
    const { n, warnings } = read({
      width: 99_999,
      mood: 'cyberpunk',
      time: 'midnight',
      layers: { near: [{ item: 'tree', kind: 'banana', size: 1e9, color: 'red', count: '3' }] },
    });
    expect(n.width).toBe(8000);
    expect(n.mood).toBe('meadow');
    expect(n.times).toEqual(['day']);
    expect(n.items[0]).toMatchObject({ kind: 'round', size: 1200, count: 3 });
    expect(n.items[0]?.color).toBeUndefined();
    expect(warnings.join('\n')).toMatch(/kind "banana" is not one of round, pine/u);
    expect(warnings.join('\n')).toMatch(/mood "cyberpunk"/u);
    expect(warnings.join('\n')).toMatch(/time "midnight"/u);
    expect(warnings.join('\n')).toMatch(/color must be/u);
  });

  it('checks beats: ids that exist, rig states, 3-5 beats, camera forms', () => {
    const { n, warnings } = read({
      layers: { near: [{ item: 'dog', id: 'd' }] },
      beats: [
        { walk: { d: 900, cat: 100 }, state: { d: 'dance' }, camera: { x: 1500 } },
        { camera: 2000, show: ['ghost'], zoom: 2 },
      ],
    });
    expect(n.beats.map((beat) => beat.label)).toEqual(['b1', 'b2']);
    expect(n.beats[0]?.camera).toEqual({ x: 1500 });
    expect(n.beats[1]?.camera).toEqual({ x: 2000 });
    expect(n.beats[0]?.move).toEqual({ d: { x: 900, walk: true } });
    expect(warnings).toEqual(
      expect.arrayContaining([
        'beat "b1": walk "cat" has no item with that id',
        'beat "b1": state "dance" is not a rig state',
        'beat 2: unknown key "zoom" ignored',
        'beat "b2": show "ghost" has no item with that id',
        'a story reads best in 3-5 beats (got 2)',
      ]),
    );
  });

  it('caps warnings, beats and items so a runaway spec stays bounded', () => {
    const { n, warnings } = read({
      layers: { near: Array.from({ length: 400 }, () => 'tree') },
      beats: Array.from({ length: 12 }, () => ({ nope: 1 })),
    });
    expect(n.items).toHaveLength(300);
    expect(n.beats).toHaveLength(8);
    expect(warnings.length).toBeLessThanOrEqual(40);
  });

  it('knows its vocabulary: groups, aliases and plurals', () => {
    const groups = vocabulary();
    expect(Object.keys(groups)).toEqual([
      'sky',
      'land',
      'water',
      'plants',
      'built',
      'creatures',
      'people',
      'space',
      'fantasy',
    ]);
    for (const name of ['camel', 'horse', 'cat', 'dog', 'butterfly', 'bird', 'fish']) {
      expect(groups['creatures']).toContain(name);
    }
    expect(lookup('Palm')).toEqual({ name: 'tree', kind: 'palm' });
    expect(lookup('birds')).toEqual({ name: 'bird' });
    expect(lookup('koi')).toEqual({ name: 'fish', kind: 'koi' });
    expect(lookup('castles')).toEqual({ name: 'castle' });
    expect(lookup('zzzzzz')).toEqual({});
    expect(Object.keys(ITEMS).length).toBeGreaterThanOrEqual(55);
  });
});
