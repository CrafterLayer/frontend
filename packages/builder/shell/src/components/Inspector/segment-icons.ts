import type { DocumentDirection, SegmentKind } from './types';

/*
  Four lines, and the TWO SHORT ONES carry the alignment.

  The previous set was geometrically correct and visually useless: all three
  options shared an identical full-width top line and a near-identical bottom
  one, so only a single middle line moved by a couple of pixels. At the compact
  icon scale, start / center / end were indistinguishable — which is
  exactly what a person reports as "the icons are scattered, I can't tell them
  apart". Two short lines moving together is unmistakable at a glance.

  The arrows were worse than unclear, they were malformed: `m10 0-3-3` is a
  RELATIVE moveto with no absolute anchor, so after `M3 8h10` left the pen at
  (13,8) it jumped to (23,8) — outside a 16-unit viewBox entirely — and drew
  from there. Every arrowhead is now anchored absolutely at the line's own end.
*/
export const SEGMENT_PATHS = {
  start: ['M3 3.5h10', 'M3 7h6', 'M3 10.5h10', 'M3 14h6'],
  left: ['M3 3.5h10', 'M3 7h6', 'M3 10.5h10', 'M3 14h6'],
  center: ['M3 3.5h10', 'M5 7h6', 'M3 10.5h10', 'M5 14h6'],
  end: ['M3 3.5h10', 'M7 7h6', 'M3 10.5h10', 'M7 14h6'],
  right: ['M3 3.5h10', 'M7 7h6', 'M3 10.5h10', 'M7 14h6'],
  justify: ['M3 3.5h10', 'M3 7h10', 'M3 10.5h10', 'M3 14h10'],
  top: ['M3 3h10', 'M4 6v7', 'M8 6v5', 'M12 6v6'],
  middle: ['M3 8h10', 'M4 3v10', 'M8 4v8', 'M12 3.5v9'],
  bottom: ['M3 13h10', 'M4 3v7', 'M8 5v5', 'M12 4v6'],
  row: ['M3 8h10', 'M9.5 4.5 13 8l-3.5 3.5'],
  'row-reverse': ['M13 8H3', 'M6.5 4.5 3 8l3.5 3.5'],
  column: ['M8 3v10', 'M4.5 9.5 8 13l3.5-3.5'],
  'column-reverse': ['M8 13V3', 'M4.5 6.5 8 3l3.5-3.5'],
} as const;

export type SegmentOption = keyof typeof SEGMENT_PATHS;

export const SEGMENT_LABELS: Readonly<Record<SegmentOption, string>> = {
  start: 'Start',
  left: 'Left',
  center: 'Center',
  end: 'End',
  right: 'Right',
  justify: 'Justify',
  top: 'Top',
  middle: 'Middle',
  bottom: 'Bottom',
  row: 'Row',
  'row-reverse': 'Reverse row',
  column: 'Column',
  'column-reverse': 'Reverse column',
};

export const ALIGNMENT_OPTIONS = new Set<SegmentOption>([
  'start',
  'left',
  'center',
  'end',
  'right',
  'justify',
  'top',
  'middle',
  'bottom',
]);
export const DIRECTION_OPTIONS = new Set<SegmentOption>([
  'row',
  'row-reverse',
  'column',
  'column-reverse',
]);

export function isSegmentOption(value: string): value is SegmentOption {
  return Object.hasOwn(SEGMENT_PATHS, value);
}

export function segmentKind(options: readonly string[]): SegmentKind | undefined {
  if (options.length < 3 || !options.every(isSegmentOption)) {
    return undefined;
  }
  if (options.every((option) => ALIGNMENT_OPTIONS.has(option))) {
    return 'alignment';
  }
  return options.every((option) => DIRECTION_OPTIONS.has(option)) ? 'direction' : undefined;
}

export function alignmentIconOption(
  option: SegmentOption,
  direction: DocumentDirection,
): SegmentOption {
  if (direction !== 'rtl') {
    return option;
  }
  if (option === 'start') {
    return 'end';
  }
  if (option === 'end') {
    return 'start';
  }
  return option;
}
