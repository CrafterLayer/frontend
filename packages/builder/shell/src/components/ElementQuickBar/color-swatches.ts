import { paletteOf, type Theme } from '@craftkit/builder-renderer';
import type { ColorToken, PaletteColor } from '@craftkit/builder-schema';

import type { ColorSwatch } from '../../style-manager/controls/StyleColorControl';

/** `textMuted` → `text-muted`: the role as the token utility names it (`bg-text-muted`). */
function kebab(role: string): string {
  return role.replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase();
}

/**
 * The theme's colour roles as swatches for the colour control (token utilities).
 * `names` is the editor catalogue's role names (`designSystem.colorRoles`), so an
 * Arabic editor reads "الخلفية المعكوسة", not "Inverse surface"; without it the
 * renderer's English names apply.
 */
export function themeColorSwatches(
  theme: Theme,
  names?: Readonly<Record<ColorToken, string>>,
): ColorSwatch[] {
  return paletteOf(theme).map((entry) => ({
    id: kebab(entry.role),
    name: names?.[entry.role] ?? entry.name,
    css: entry.value,
  }));
}

/** The site library palette as swatches (free mode: written as `(--ck-c-<id>)`). */
export function paletteSwatches(palette: readonly PaletteColor[] | undefined): ColorSwatch[] {
  return (palette ?? []).map((color) => ({
    id: color.id,
    name: color.name,
    css: color.value,
  }));
}

