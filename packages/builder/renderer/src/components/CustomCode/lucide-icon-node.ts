import { icons as LUCIDE_ICONS, type IconNode } from 'lucide';

/**
 * Kebab → the export key lucide uses: capitalise every segment.
 *
 * This direction is unambiguous (`grid-2x2` → `Grid2x2`, `arrow-down-0-1` →
 * `ArrowDown01`); the reverse is not, which is why the layer-0 name list is
 * generated from lucide's per-icon FILES rather than derived from these keys.
 */
function lucideKey(name: string): string {
  return name
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

/** The icon's path data, or undefined for a name the set does not have. */
export function lucideIconNode(name: string): IconNode | undefined {
  return (LUCIDE_ICONS as Record<string, IconNode | undefined>)[lucideKey(name)];
}
