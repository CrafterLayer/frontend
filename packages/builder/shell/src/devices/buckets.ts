/**
 * Device → editing-bucket mapping (007 contract §3).
 *
 * The ONE declared threshold constant (FR-006): widths below `tablet` edit the
 * mobile override bucket, widths below `desktop` edit tablet, everything else
 * edits the base props. Half-open ranges — 768 is tablet, 1024 is base.
 * Device/preview state is VIEW state only (b2): never document, never kernel.
 */
export const BUCKET_THRESHOLDS = { tablet: 768, desktop: 1024 } as const;

export type EditingBucket = 'base' | 'tablet' | 'mobile';

export function bucketForWidth(width: number): EditingBucket {
  if (width < BUCKET_THRESHOLDS.tablet) {
    return 'mobile';
  }
  if (width < BUCKET_THRESHOLDS.desktop) {
    return 'tablet';
  }
  return 'base';
}
