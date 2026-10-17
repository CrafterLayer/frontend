import type { StyleBoxSide, StyleSide } from '@craftkit/builder-schema';

import type { ScrubDelta, ScrubModifiers } from './use-scrub';

export const BOX_SIDES: readonly StyleBoxSide[] = [
  'block-start',
  'inline-end',
  'block-end',
  'inline-start',
];

/** The side group a box edit addresses: Shift = all sides, Alt = the opposite pair. */
export function sideForModifiers(side: StyleBoxSide, modifiers: ScrubModifiers): StyleSide {
  if (modifiers.all) return 'all';
  if (modifiers.pair) return side.startsWith('block') ? 'block' : 'inline';
  return side;
}

/** Which sides a side group touches, for previews and Mixed checks. */
export function sidesOf(group: StyleSide): readonly StyleBoxSide[] {
  switch (group) {
    case 'all':
      return BOX_SIDES;
    case 'block':
      return ['block-start', 'block-end'];
    case 'inline':
      return ['inline-start', 'inline-end'];
    case 'block-start':
    case 'block-end':
    case 'inline-start':
    case 'inline-end':
      return [group];
    default:
      return [];
  }
}

/**
 * How far a drag grows one side, in CSS pixels: away from the box's centre is
 * bigger. The inline sides follow the PAGE direction — inline-start is on the
 * right of an RTL page, so dragging right grows it there.
 */
export function growthOf(side: StyleBoxSide, delta: ScrubDelta, dir: 'ltr' | 'rtl'): number {
  switch (side) {
    case 'block-start':
      return -delta.dy;
    case 'block-end':
      return delta.dy;
    case 'inline-start':
      return dir === 'rtl' ? delta.dx : -delta.dx;
    case 'inline-end':
      return dir === 'rtl' ? -delta.dx : delta.dx;
  }
}
