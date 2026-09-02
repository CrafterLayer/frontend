import { describe, expect, it } from 'vitest';

import {
  alignmentIconOption,
  isSegmentOption,
  SEGMENT_LABELS,
  SEGMENT_PATHS,
  segmentKind,
} from './segment-icons';

describe('segment icons', () => {
  it('mirrors start and end under rtl only, and nothing else', () => {
    expect(alignmentIconOption('start', 'rtl')).toBe('end');
    expect(alignmentIconOption('end', 'rtl')).toBe('start');
    expect(alignmentIconOption('center', 'rtl')).toBe('center');
    expect(alignmentIconOption('left', 'rtl')).toBe('left');
    expect(alignmentIconOption('start', 'ltr')).toBe('start');
    expect(alignmentIconOption('end', 'ltr')).toBe('end');
  });

  it('classifies option sets by their members, three at least', () => {
    expect(segmentKind(['start', 'center', 'end'])).toBe('alignment');
    expect(segmentKind(['row', 'row-reverse', 'column', 'column-reverse'])).toBe('direction');
    expect(segmentKind(['start', 'end'])).toBeUndefined();
    expect(segmentKind(['start', 'center', 'row'])).toBeUndefined();
    expect(segmentKind(['start', 'center', 'unknown'])).toBeUndefined();
  });

  it('knows its own members and names every one', () => {
    expect(isSegmentOption('justify')).toBe(true);
    expect(isSegmentOption('toString')).toBe(false);
    for (const option of Object.keys(SEGMENT_PATHS)) {
      expect(isSegmentOption(option)).toBe(true);
      if (isSegmentOption(option)) {
        expect(SEGMENT_LABELS[option]).not.toHaveLength(0);
        expect(SEGMENT_PATHS[option].length).toBeGreaterThan(0);
      }
    }
  });
});
