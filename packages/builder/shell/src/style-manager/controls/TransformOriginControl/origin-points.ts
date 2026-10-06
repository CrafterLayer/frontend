/** One of the nine logical origin points: block row × inline column. */
export interface OriginPoint {
  readonly block: 'start' | 'center' | 'end';
  readonly inline: 'start' | 'center' | 'end';
}

const AXIS: readonly OriginPoint['block'][] = ['start', 'center', 'end'];

/** The nine points in reading order of the page (row by row, inline-start first). */
export const ORIGIN_POINTS: readonly OriginPoint[] = AXIS.flatMap((block) =>
  AXIS.map((inline) => ({ block, inline })),
);

/**
 * The physical keyword a logical point is written as on a page of `dir`.
 * `transform-origin` has no logical keywords, so inline-start is `left` on an
 * LTR page and `right` on an RTL page.
 */
export function originKeyword(point: OriginPoint, dir: 'ltr' | 'rtl'): string {
  const vertical = point.block === 'start' ? 'top' : point.block === 'end' ? 'bottom' : '';
  const startSide = dir === 'rtl' ? 'right' : 'left';
  const endSide = dir === 'rtl' ? 'left' : 'right';
  const horizontal = point.inline === 'start' ? startSide : point.inline === 'end' ? endSide : '';
  if (vertical === '' && horizontal === '') return 'center';
  if (vertical === '') return horizontal;
  if (horizontal === '') return vertical;
  return `${vertical}-${horizontal}`;
}

/** The logical point a stored keyword means on a page of `dir`, if it is one of the nine. */
export function pointOfKeyword(keyword: string, dir: 'ltr' | 'rtl'): OriginPoint | undefined {
  return ORIGIN_POINTS.find((point) => originKeyword(point, dir) === keyword);
}
