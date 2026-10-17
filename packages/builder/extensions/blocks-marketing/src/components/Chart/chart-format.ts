/**
 * How a chart prints a number: grouped thousands, an optional prefix or suffix,
 * compact axis ticks, and shares as percentages. Pure, like the geometry.
 */

export interface ValueFormat {
  readonly prefix?: string | undefined;
  readonly suffix?: string | undefined;
}

const PLAIN = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * A value as the chart prints it: `$1,250`, `42%`, `−3.5`; `compact` shortens
 * thousands for axis ticks (`12K`). A negative number is wrapped in a
 * left-to-right isolate so its minus sign stays in front on an RTL page.
 */
export function formatValue(
  value: number,
  format: ValueFormat = {},
  style: 'plain' | 'compact' = 'plain',
): string {
  const magnitude = Math.abs(value);
  const digits = (style === 'compact' && magnitude >= 1000 ? COMPACT : PLAIN).format(magnitude);
  const number = value < 0 && digits !== '0' ? `⁦−${digits}⁩` : digits;
  return `${format.prefix ?? ''}${number}${format.suffix ?? ''}`;
}

/** A share as a percentage with at most one decimal: `0.4251` → `42.5%`. */
export function formatShare(fraction: number): string {
  return `${String(Math.round(fraction * 1000) / 10)}%`;
}
