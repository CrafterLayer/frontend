import { describe, expect, it } from 'vitest';

import { tracksOf, valueOfTracks } from './tracks';

describe('grid tracks', () => {
  it('reads a count token, a repeat and an explicit template', () => {
    expect(tracksOf({ kind: 'token', token: '3' })).toEqual(['1fr', '1fr', '1fr']);
    expect(tracksOf({ kind: 'raw', css: 'repeat(2, minmax(0, 1fr)) auto' })).toEqual([
      'minmax(0,1fr)',
      'minmax(0,1fr)',
      'auto',
    ]);
    expect(tracksOf({ kind: 'raw', css: '1fr 2fr' })).toEqual(['1fr', '2fr']);
  });

  it('writes equal tracks as a token and anything else exactly', () => {
    expect(valueOfTracks(['1fr', '1fr'])).toEqual({ kind: 'token', token: '2' });
    expect(valueOfTracks(['1fr', '2fr'])).toEqual({ kind: 'raw', css: '1fr 2fr' });
    expect(valueOfTracks([])).toBeNull();
  });
});
