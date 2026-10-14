import type { Palette, Time } from './types';

/*
  Moods and times of day (mural kit, 2026-10-14). A mood is a painted palette — land far to near,
  water, foliage, walls, roofs, cloth, a warm light — generalised from the set-F stories; a time
  of day is a sky gradient, the tint every layer takes, how dark the night is and where the sun
  stands. Colours stay 0xRRGGBB for Pixi; `tones: 'theme'` mixes them with the page palette.
*/

export const TIMES: readonly Time[] = ['dawn', 'day', 'golden', 'dusk', 'night'];

/** Per time: layer tint, night amount (0 day … 1 night) and the sun's height (y, design units). */
export const LIGHT: Record<Time, { tint: number; night: number; sun: number }> = {
  dawn: { tint: 0xf2d4d4, night: 0.2, sun: 440 },
  day: { tint: 0xffffff, night: 0, sun: 130 },
  golden: { tint: 0xffe0b0, night: 0, sun: 330 },
  dusk: { tint: 0xd8a2b0, night: 0.55, sun: 480 },
  night: { tint: 0x5a6aa2, night: 1, sun: 900 },
};

const SKY: Record<Time, [number, number]> = {
  dawn: [0x5a6b9a, 0xf6c79a],
  day: [0x6fb6e2, 0xe6f3f4],
  golden: [0x5d8cc8, 0xffd29a],
  dusk: [0x3a2e5c, 0xf2905e],
  night: [0x0c1431, 0x2c3d6b],
};

const BASE: Omit<Palette, 'sky'> = {
  land: [0x9dbfae, 0x6aa070, 0x3f7a48],
  water: [0x7cc4d8, 0x24688c],
  leaf: [0x4f8f4a, 0x2d6236],
  trunk: 0x6b4a32,
  wall: 0xf1e6d2,
  roof: 0xc0583e,
  stone: 0xb9a68a,
  wood: 0x8a5a3a,
  ink: 0x1c2633,
  skin: 0xc68a5e,
  cloth: [0xd0584a, 0x3f6fb0, 0xe8b84a],
  accent: 0xe8b84a,
  light: 0xffc86a,
  snow: 0xf5f8ff,
  sand: 0xe8cf9a,
  bloom: 0xf3a6c0,
};

type Mood = Partial<Omit<Palette, 'sky'>> & { sky?: Partial<Record<Time, [number, number]>> };

export const MOODS: Readonly<Record<string, Mood>> = {
  meadow: {},
  farm: { land: [0xa9c49a, 0x9cbf5e, 0x6e9a3e], roof: 0xb4442e, wall: 0xf3e2c4, accent: 0xf0c64e },
  desert: {
    land: [0xe3b98e, 0xd69b62, 0xb67644],
    sky: { day: [0x5ea8e0, 0xf6e4c2], golden: [0x6a86c4, 0xffc884] },
    leaf: [0x6f8f4a, 0x4d6a32],
    wall: 0xe9d3ae,
    cloth: [0x9c3b2e, 0x2e4d74, 0xe0a83e],
  },
  sea: {
    land: [0x8fb3b0, 0x6f9a86, 0xd9c79a],
    water: [0x5fc3cf, 0x15587e],
    wall: 0xf4efe4,
    roof: 0x3f7fb0,
  },
  winter: {
    land: [0xc9d6e6, 0xdfe7f1, 0xf4f7fb],
    sky: { day: [0x8fb2d6, 0xeaf1f8], dusk: [0x2e3560, 0xd88a8a], night: [0x0b1230, 0x2a3c6e] },
    leaf: [0x2f6a52, 0x1d4a3a],
    roof: 0x8e3b36,
    wall: 0xe8dcc8,
    water: [0xb6d6e8, 0x5a86a8],
  },
  forest: {
    land: [0x7aa596, 0x467d58, 0x2a5a36],
    leaf: [0x3d7a40, 0x1f4e2c],
    sky: { day: [0x7db8d6, 0xe4f0dc] },
  },
  city: {
    land: [0x9aa6b8, 0x7d8899, 0x4a5262],
    wall: 0xd9d2c6,
    stone: 0xc8b89a,
    sky: { dusk: [0x2c2a58, 0xe98a6a] },
  },
  oldcity: {
    land: [0xc9b08a, 0xb79668, 0x8a6a46],
    wall: 0xe6d2ae,
    stone: 0xd4bb8e,
    roof: 0x2f7d7a,
    accent: 0xe0b04a,
    light: 0xffbf5e,
    sky: { night: [0x081028, 0x22305e], dusk: [0x2f2a5c, 0xe7845a] },
  },
  garden: {
    land: [0xa8c0a4, 0x7ea878, 0x55864e],
    leaf: [0x5e9a52, 0x3b6e3a],
    roof: 0x37404a,
    wood: 0xb83a2e,
    water: [0x8fcfc8, 0x3a7f86],
    bloom: 0xf7b8cc,
  },
  fairy: {
    land: [0x8a8fc0, 0x58709a, 0x2f4a62],
    leaf: [0x3e6e66, 0x24484a],
    stone: 0xbab2d6,
    roof: 0x6a4aa0,
    light: 0xfff0a0,
    sky: { dusk: [0x2a2458, 0xd27aa8], night: [0x0d0b2a, 0x2b2f6a] },
  },
  space: {
    land: [0x8c8fa6, 0x6c7088, 0x4c5068],
    stone: 0xa7a9b8,
    sky: { night: [0x03040e, 0x121a3e], day: [0x0a1030, 0x24306a] },
  },
  reef: {
    water: [0x3ec5d6, 0x0a2f63],
    sand: 0xe9d8a8,
    leaf: [0x3f9a6e, 0x1f6a52],
    cloth: [0xff7a5c, 0xffc94a, 0x9a6ad8],
    bloom: 0xff8fa8,
  },
};

const toNumber = (v: unknown): number | undefined => {
  if (typeof v === 'number' && Number.isFinite(v)) return v & 0xffffff;
  if (typeof v === 'string' && /^#?[0-9a-f]{6}$/iu.test(v.trim())) {
    return Number.parseInt(v.trim().replace('#', ''), 16);
  }
  return undefined;
};

/** A colour or a list of colours from spec text ('#rrggbb' or 0xRRGGBB); undefined when bad. */
export function readColors(v: unknown): number[] | undefined {
  const list = (Array.isArray(v) ? v : [v]).map(toNumber);
  return list.length > 0 && list.every((c) => c !== undefined) ? list : undefined;
}

/**
 * A mood's palette with the spec's own colours over it (`colors: { wall: '#fff', … }`), mixed
 * with the page palette when `theme` (accent for the lit roles, surface for the rest).
 */
export function resolvePalette(
  mood: string,
  colors: Readonly<Record<string, unknown>>,
  mix: (a: number, b: number, t: number) => number,
  theme?: { accent: number; surface: number },
): Palette {
  const m = MOODS[mood] ?? {};
  const out = { ...BASE, ...m, sky: { ...SKY, ...m.sky } };
  const record = out as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(colors)) {
    const list = readColors(value);
    const now = record[key];
    if (list === undefined || now === undefined || key === 'sky') continue;
    record[key] = Array.isArray(now)
      ? (now as number[]).map((c, i) => list[i] ?? list[list.length - 1] ?? c)
      : list[0];
  }
  if (theme === undefined) return out;
  const tone = (c: number, warm: boolean) =>
    mix(c, warm ? theme.accent : theme.surface, warm ? 0.3 : 0.25);
  for (const key of Object.keys(record)) {
    const value = record[key];
    const warm = key === 'accent' || key === 'light' || key === 'cloth' || key === 'bloom';
    if (typeof value === 'number') record[key] = tone(value, warm);
    else if (Array.isArray(value)) record[key] = (value as number[]).map((c) => tone(c, warm));
  }
  for (const t of TIMES) out.sky[t] = [tone(out.sky[t][0], false), tone(out.sky[t][1], false)];
  return out;
}
