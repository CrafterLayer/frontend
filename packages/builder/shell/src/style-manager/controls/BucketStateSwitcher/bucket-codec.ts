import type { StyleBucket } from '@craftkit/builder-schema';

/** The widths the device presets render at; a free width elsewhere offers a custom bucket. */
export const PRESET_DEVICE_WIDTHS: readonly number[] = [1280, 834, 390];

/** A bucket as one string, for radio values: `base`, `tablet`, `mobile`, `max-600`. */
export function encodeBucket(bucket: StyleBucket): string {
  return typeof bucket === 'string' ? bucket : `max-${String(bucket.maxWidth)}`;
}

export function decodeBucket(value: string): StyleBucket {
  if (value === 'base' || value === 'tablet' || value === 'mobile') return value;
  const width = Number(value.slice('max-'.length));
  return Number.isInteger(width) && width > 0 ? { maxWidth: width } : 'base';
}
