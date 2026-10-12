/**
 * What the chart's render helpers share: the part helper, the picture's
 * accessible name, the ground the marks sit on, and the text readers for
 * attributes. React-free; the JSX lives in the `.tsx` siblings.
 */
import type { ReactNode } from 'react';

import type { blockPartProps } from '@craftkit/builder-schema';

import type { ChartProps } from './schema';

export type Part = ReturnType<typeof blockPartProps>;

export interface SvgLabel {
  readonly role: 'img';
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
  readonly 'aria-describedby'?: string;
}

/** What every chart part needs besides its own model. */
export interface Drawing {
  readonly props: ChartProps;
  readonly part: Part;
  readonly svgLabel: SvgLabel;
  /** The marker ring and slice gap: the ground the chart sits on. */
  readonly ring: string;
  /** Secondary text (ticks, category labels, shares) that stays legible on the section's ground. */
  readonly muted: string;
}

/*
  Attributes, tooltips and the screen-reader table read committed text only:
  while a label is edited in place its value is the editor element, which must
  render once, where the person is typing.
*/
export function committed(value: ReactNode): string {
  return typeof value === 'string' ? value : '';
}

export function tooltip(category: ReactNode, series: ReactNode, value: string): string {
  const name = [committed(category), committed(series)].filter((text) => text !== '').join(' · ');
  return name === '' ? value : `${name}: ${value}`;
}
