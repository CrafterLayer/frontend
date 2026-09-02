import { describe, expect, it } from 'vitest';

import { displayPropertyLabel, normalizedKey, unitFor } from './property-label';

describe('displayPropertyLabel', () => {
  it('turns camelCase, snake_case and kebab-case into Sentence case', () => {
    expect(displayPropertyLabel('lineHeight')).toBe('Line height');
    expect(displayPropertyLabel('marginTop2')).toBe('Margin top2');
    expect(displayPropertyLabel('form_title')).toBe('Form title');
    expect(displayPropertyLabel('anchor-id')).toBe('Anchor id');
    expect(displayPropertyLabel('title')).toBe('Title');
  });

  it('hands back an unlabelable key untouched', () => {
    expect(displayPropertyLabel('_')).toBe('_');
    expect(displayPropertyLabel('')).toBe('');
  });
});

describe('unitFor', () => {
  it('reads the unit from the normalised key', () => {
    expect(normalizedKey('Padding-Top_1')).toBe('paddingtop1');
    expect(unitFor('paddingTop')).toBe('px');
    expect(unitFor('gap')).toBe('px');
    expect(unitFor('fontSize')).toBe('px');
    expect(unitFor('animationDuration')).toBe('ms');
    expect(unitFor('startDelay')).toBe('ms');
    expect(unitFor('rotation')).toBe('deg');
    expect(unitFor('tiltAngle')).toBe('deg');
    expect(unitFor('count')).toBe('—');
  });
});
