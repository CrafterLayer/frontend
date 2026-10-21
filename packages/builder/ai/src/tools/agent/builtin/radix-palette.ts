import {
  amber,
  amberDark,
  blue,
  blueDark,
  bronze,
  bronzeDark,
  crimson,
  crimsonDark,
  grass,
  grassDark,
  jade,
  jadeDark,
  orange,
  orangeDark,
  plum,
  plumDark,
  teal,
  tealDark,
  violet,
  violetDark,
} from '@radix-ui/colors';

import { readable, type KitColours } from '../page-kit';

/** MIT @radix-ui/colors: only the selected opaque sRGB scales, no CSS or P3/alpha bundle. */
const SCALES = {
  blue: { light: blue, dark: blueDark },
  teal: { light: teal, dark: tealDark },
  jade: { light: jade, dark: jadeDark },
  grass: { light: grass, dark: grassDark },
  amber: { light: amber, dark: amberDark },
  orange: { light: orange, dark: orangeDark },
  crimson: { light: crimson, dark: crimsonDark },
  plum: { light: plum, dark: plumDark },
  violet: { light: violet, dark: violetDark },
  bronze: { light: bronze, dark: bronzeDark },
} as const;

export type RadixScale = keyof typeof SCALES;
export type RadixAppearance = 'light' | 'dark';

export const RADIX_SCALES: readonly RadixScale[] = Object.freeze([
  'blue',
  'teal',
  'jade',
  'grass',
  'amber',
  'orange',
  'crimson',
  'plum',
  'violet',
  'bronze',
]);

/** Bounded guidance for the existing declarative theme tool, not arbitrary runtime imports. */
export const RADIX_PALETTE_TEACHING =
  'Optional theme.apply {radixScale:"blue"|"teal"|"jade"|"grass"|"amber"|"orange"|"crimson"|"plum"|"violet"|"bronze",appearance:"light"|"dark"} selects an opaque Radix color scale (appearance defaults to light). Explicit accent/bg/ink/surface overrides win and must pass the existing measured WCAG AA text checks. appearance requires radixScale; do not combine radixScale with deckRow. A scale changes page-kit colors only: no automatic geometry or font changes, no imposed header/navbar/footer composition. Existing elements must read the kit tokens for the change to be visible; preserve authored brand colors when requested. No Radix imports inside declarative customCode regions.';

/** Semantic roles follow Radix steps; contrast is re-measured by theme.apply after overrides. */
export function radixPalette(scale: RadixScale, appearance: RadixAppearance): KitColours {
  const shades: Readonly<Record<string, string>> = SCALES[scale][appearance];
  const step = (number: 1 | 2 | 6 | 9 | 11 | 12): string => {
    const value = shades[`${scale}${String(number)}`];
    if (value === undefined) throw new Error('Missing step in the pinned Radix color scale.');
    return value;
  };
  const bg = step(1);
  const surface = step(2);
  const ink = step(12);
  const accent = step(9);
  return {
    bg,
    surface,
    ink,
    muted: step(11),
    accent,
    onAccent: readable(['#ffffff', '#000000'], [accent]),
    accentInk: step(11),
    border: step(6),
  };
}
