import { describe, expect, it } from 'vitest';

import { BUCKET_THRESHOLDS, bucketForWidth } from './buckets';

describe('bucketForWidth (007 contract §3 b1)', () => {
  it('maps widths through the declared half-open ranges, boundaries included', () => {
    const table: [number, ReturnType<typeof bucketForWidth>][] = [
      [0, 'mobile'],
      [390, 'mobile'],
      [500, 'mobile'],
      [767, 'mobile'],
      [768, 'tablet'], // boundary IS tablet (half-open)
      [800, 'tablet'],
      [834, 'tablet'],
      [1023, 'tablet'],
      [1024, 'base'], // boundary IS base (half-open)
      [1200, 'base'],
      [1280, 'base'],
      [10_000, 'base'],
    ];
    for (const [width, bucket] of table) {
      expect(bucketForWidth(width), `width ${String(width)}`).toBe(bucket);
    }
  });

  it('declares the thresholds as the single exported constant', () => {
    expect(BUCKET_THRESHOLDS).toEqual({ tablet: 768, desktop: 1024 });
  });
});
