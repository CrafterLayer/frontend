import { describe, expect, it } from 'vitest';

import { STYLE_PROPERTIES } from '@craftkit/builder-schema';

import { appliesToTag, isTokenCapable, keywordsFor, modelFor } from './property-models';
import { viewStyles } from './style-view';

describe('viewStyles', () => {
  it('reads a value set here and one inherited from a larger bucket', () => {
    const views = viewStyles(['p-4 max-md:text-lg text-sm'], { bucket: 'mobile', state: 'default' });
    expect(views.get('fontSize')).toMatchObject({
      value: { kind: 'token', token: 'lg' },
      origin: 'here',
      className: 'max-md:text-lg',
    });
    expect(views.get('padding')?.sides['inline-start']).toMatchObject({
      value: { kind: 'token', token: '4' },
      origin: 'larger-bucket',
    });
  });

  it('reports Mixed when targets disagree and agrees when they match', () => {
    const views = viewStyles(['text-sm', 'text-lg'], { bucket: 'base', state: 'default' });
    expect(views.get('fontSize')).toMatchObject({ mixed: true, value: undefined });
    const same = viewStyles(['font-bold', 'font-bold'], { bucket: 'base', state: 'default' });
    expect(same.get('fontWeight')).toMatchObject({ mixed: false, origin: 'here' });
  });

  it('reads named styles as their own origin', () => {
    const views = viewStyles(['ck-s-card'], { bucket: 'base', state: 'default' }, { card: 'rounded-lg' });
    expect(views.get('borderRadius')?.origin).toBe('named-style');
  });
});

describe('property models', () => {
  it('spacing reads steps as pixels; z-index accepts any integer token', () => {
    expect(modelFor(STYLE_PROPERTIES.padding).amountOf('4')).toEqual({ amount: 16, unit: 'px' });
    expect(modelFor(STYLE_PROPERTIES.zIndex).tokenFor({ amount: 37, unit: '' })).toBe('37');
    expect(keywordsFor(STYLE_PROPERTIES.inlineSize, modelFor(STYLE_PROPERTIES.inlineSize))).toContain('full');
  });

  it('tokens mode hides raw-only and hook-class properties', () => {
    expect(isTokenCapable(STYLE_PROPERTIES.backgroundColor)).toBe(true);
    expect(isTokenCapable(STYLE_PROPERTIES.backgroundImage)).toBe(false);
    expect(isTokenCapable(STYLE_PROPERTIES.effects)).toBe(false);
    expect(isTokenCapable(STYLE_PROPERTIES.direction)).toBe(false);
  });

  it('media-only rows apply to media tags', () => {
    expect(appliesToTag(STYLE_PROPERTIES.objectFit, 'img')).toBe(true);
    expect(appliesToTag(STYLE_PROPERTIES.objectFit, 'h2')).toBe(false);
    expect(appliesToTag(STYLE_PROPERTIES.objectFit, undefined)).toBe(true);
  });
});
