/*
  Colouring-book palettes for the `paint` Studio library (2026-11-05). Twelve colours each,
  saturated enough to read on white paper and far enough apart that a 4-year-old sees the
  difference between neighbours. Each colour carries a plain English name the swatch helper uses
  as its accessible label when the button has none.
*/

type Entry = readonly [hex: string, name: string];

const TABLE = {
  bright: [
    ['#e53935', 'red'],
    ['#fb8c00', 'orange'],
    ['#fdd835', 'yellow'],
    ['#7cb342', 'green'],
    ['#00897b', 'teal'],
    ['#29b6f6', 'sky blue'],
    ['#1e88e5', 'blue'],
    ['#5e35b1', 'purple'],
    ['#ec407a', 'pink'],
    ['#8d6e63', 'brown'],
    ['#212121', 'black'],
    ['#ffffff', 'white'],
  ],
  pastel: [
    ['#f8bbd0', 'pastel pink'],
    ['#ffccbc', 'peach'],
    ['#fff59d', 'lemon'],
    ['#c5e1a5', 'mint green'],
    ['#b2dfdb', 'seafoam'],
    ['#b3e5fc', 'baby blue'],
    ['#c5cae9', 'periwinkle'],
    ['#d1c4e9', 'lavender'],
    ['#f3e5f5', 'lilac'],
    ['#ffe0b2', 'apricot'],
    ['#d7ccc8', 'sand'],
    ['#eceff1', 'cloud'],
  ],
  earth: [
    ['#6d4c41', 'bark'],
    ['#8d6e63', 'clay'],
    ['#a1887f', 'mushroom'],
    ['#c49a6c', 'wheat'],
    ['#e0c097', 'sand'],
    ['#827717', 'olive'],
    ['#558b2f', 'moss'],
    ['#33691e', 'forest'],
    ['#4e7f8a', 'river'],
    ['#b85c38', 'terracotta'],
    ['#d4a017', 'mustard'],
    ['#5d5d5d', 'stone'],
  ],
  skin: [
    ['#ffe0c7', 'porcelain'],
    ['#f9d3b4', 'cream'],
    ['#f1c27d', 'golden'],
    ['#e0ac69', 'honey'],
    ['#d29b6c', 'caramel'],
    ['#c68642', 'amber'],
    ['#a86b3c', 'chestnut'],
    ['#8d5524', 'bronze'],
    ['#6f4320', 'cocoa'],
    ['#5a3519', 'mahogany'],
    ['#45260f', 'espresso'],
    ['#2f1a0b', 'ebony'],
  ],
  ocean: [
    ['#01579b', 'deep sea'],
    ['#0277bd', 'ocean'],
    ['#0288d1', 'wave'],
    ['#4fc3f7', 'lagoon'],
    ['#80deea', 'aqua'],
    ['#26a69a', 'kelp'],
    ['#ffcc80', 'sand'],
    ['#ff8a65', 'coral'],
    ['#f06292', 'anemone'],
    ['#ffd54f', 'starfish'],
    ['#9575cd', 'jellyfish'],
    ['#ffffff', 'foam'],
  ],
  garden: [
    ['#d81b60', 'rose'],
    ['#f4511e', 'poppy'],
    ['#ffb300', 'sunflower'],
    ['#fff176', 'buttercup'],
    ['#9ccc65', 'leaf'],
    ['#43a047', 'grass'],
    ['#2e7d32', 'ivy'],
    ['#7e57c2', 'violet'],
    ['#ba68c8', 'lilac'],
    ['#4fc3f7', 'sky'],
    ['#795548', 'soil'],
    ['#ffffff', 'daisy'],
  ],
  night: [
    ['#0d1b3e', 'midnight'],
    ['#1a237e', 'indigo'],
    ['#303f9f', 'dusk'],
    ['#5c6bc0', 'twilight'],
    ['#7e57c2', 'nebula'],
    ['#ab47bc', 'aurora'],
    ['#26c6da', 'comet'],
    ['#fff176', 'star'],
    ['#ffe082', 'moon'],
    ['#ff8a65', 'mars'],
    ['#b0bec5', 'silver'],
    ['#212121', 'space'],
  ],
} as const satisfies Record<string, readonly Entry[]>;

export type PaletteName = keyof typeof TABLE;
export const PALETTES = Object.freeze(Object.keys(TABLE) as PaletteName[]);

const NAMES = new Map<string, string>();
for (const list of Object.values(TABLE)) {
  for (const [hex, name] of list) if (!NAMES.has(hex)) NAMES.set(hex, name);
}

const FROZEN = new Map<string, readonly string[]>();

/** A palette's colours as '#rrggbb' strings; 'bright' for an unknown name. */
export function palette(name?: unknown): readonly string[] {
  const key = typeof name === 'string' && name in TABLE ? (name as PaletteName) : 'bright';
  let list = FROZEN.get(key);
  if (list === undefined) {
    list = Object.freeze(TABLE[key].map(([hex]) => hex));
    FROZEN.set(key, list);
  }
  return list;
}

/** The English name of a palette colour, for an accessible label. */
export function colorName(hex: string): string | undefined {
  return NAMES.get(hex.toLowerCase());
}
