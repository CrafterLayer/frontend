import { describe, expect, it } from 'vitest';

import { getAtPropPath, setAtPropPath } from './prop-path';

const props = {
  heading: 'Hello',
  items: [
    { title: 'One', body: 'First' },
    { title: 'Two', body: 'Second' },
  ],
  link: { label: 'Read', href: '/docs' },
};

describe('getAtPropPath', () => {
  it('reads top-level, nested object and array paths', () => {
    expect(getAtPropPath(props, ['heading'])).toBe('Hello');
    expect(getAtPropPath(props, ['items', 1, 'title'])).toBe('Two');
    expect(getAtPropPath(props, ['link', 'href'])).toBe('/docs');
    expect(getAtPropPath(props, [])).toBe(props);
  });

  it('returns undefined for a missing step, a wrong container or a reserved key', () => {
    expect(getAtPropPath(props, ['items', 5, 'title'])).toBeUndefined();
    expect(getAtPropPath(props, ['items', 'title'])).toBeUndefined();
    expect(getAtPropPath(props, ['heading', 0])).toBeUndefined();
    expect(getAtPropPath(props, ['__proto__'])).toBeUndefined();
    expect(getAtPropPath(props, ['items', -1])).toBeUndefined();
  });
});

describe('setAtPropPath', () => {
  it('replaces a nested value without mutating the input and shares untouched branches', () => {
    const next = setAtPropPath(props, ['items', 1, 'title'], 'Deux');
    expect(next.items[1]?.title).toBe('Deux');
    expect(props.items[1]?.title).toBe('Two');
    expect(next).not.toBe(props);
    expect(next.items).not.toBe(props.items);
    expect(next.items[0]).toBe(props.items[0]);
    expect(next.link).toBe(props.link);
  });

  it('returns the input by reference when the value is already there', () => {
    expect(setAtPropPath(props, ['items', 0, 'title'], 'One')).toBe(props);
  });

  it('creates missing containers by the next segment kind', () => {
    expect(setAtPropPath({}, ['link', 'label'], 'Go')).toEqual({ link: { label: 'Go' } });
    expect(setAtPropPath({}, ['rows', 0, 'feature'], 'Fast')).toEqual({
      rows: [{ feature: 'Fast' }],
    });
  });

  it('replaces the whole value for an empty path', () => {
    expect(setAtPropPath(props, [], 'x')).toBe('x');
  });

  it('refuses a reserved key or a bad index', () => {
    expect(() => setAtPropPath({}, ['__proto__', 'x'], 1)).toThrow(RangeError);
    expect(() => setAtPropPath([], [-1], 1)).toThrow(RangeError);
    expect(() => setAtPropPath([], [1.5], 1)).toThrow(RangeError);
  });
});
