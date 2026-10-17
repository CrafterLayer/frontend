import { describe, expect, it } from 'vitest';

import { formatAverage, ratingName, starFills } from './review-stars';

describe('review stars', () => {
  it('fills whole stars and the partial one in tenths', () => {
    expect(starFills(4.7)).toEqual([1, 1, 1, 1, 0.7]);
    expect(starFills(0)).toEqual([0, 0, 0, 0, 0]);
    expect(starFills(5)).toEqual([1, 1, 1, 1, 1]);
    expect(starFills(2.04)).toEqual([1, 1, 0, 0, 0]);
  });

  it('prints the average with one decimal in the page digits', () => {
    expect(formatAverage(4.69, 'en')).toBe('4.7');
    expect(formatAverage(5, 'en')).toBe('5.0');
    expect(formatAverage(4.6, 'ar')).toBe('٤٫٦');
  });

  it('names a row of stars from its template', () => {
    expect(ratingName('{rating} out of 5 stars', '4.7')).toBe('4.7 out of 5 stars');
    expect(ratingName('{rating} من ٥ نجوم', '٤٫٦')).toBe('٤٫٦ من ٥ نجوم');
    expect(ratingName('Rating', '4')).toBe('Rating');
  });
});
