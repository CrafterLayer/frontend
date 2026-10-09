import { describe, expect, it } from 'vitest';

import {
  CUSTOM_CODE_ATTRIBUTES,
  CUSTOM_CODE_BEHAVIOR_PARAMS,
  CUSTOM_CODE_BEHAVIORS,
  customCodeAttributeSpelling,
} from './custom-code-tree';
import {
  CAROUSEL_INDICATORS,
  CUSTOM_CODE_ENGINE_KINDS,
  CUSTOM_CODE_ENGINE_MARKERS,
  CUSTOM_CODE_ENGINE_OF_MARKER,
  CUSTOM_CODE_ENGINE_PARAM_OWNERS,
  CUSTOM_CODE_ENGINE_PARAMS,
  CUSTOM_CODE_MEDIA_ATTRIBUTES,
  CUSTOM_CODE_MEDIA_BEHAVIOR_PARAMS,
  CUSTOM_CODE_MEDIA_BEHAVIORS,
  CUSTOM_CODE_MEDIA_PARAMS,
  CUSTOM_CODE_MEDIA_PART_ATTRIBUTES,
  CUSTOM_CODE_SCENE_INFO,
  CUSTOM_CODE_SCENES,
  CUSTOM_CODE_TIMELINE_RECIPE_INFO,
  CUSTOM_CODE_TIMELINE_RECIPES,
  customCodeEnginesOf,
  isCustomCodeEngineMarker,
  isCustomCodeMediaBehavior,
  isCustomCodeScene,
  isCustomCodeTimelineRecipe,
  SCENE_DENSITIES,
  SCENE_PALETTES,
} from './media-vocabulary';

describe('media vocabulary (media-motion 2026-10-06)', () => {
  it('holds the closed lists the DESIGN names', () => {
    expect(CUSTOM_CODE_MEDIA_BEHAVIORS).toEqual([
      'gallery',
      'video-player',
      'bg-video',
      'embed-facade',
      'compare',
      'toggle-group',
      'mailto-form',
    ]);
    expect(CUSTOM_CODE_TIMELINE_RECIPES).toEqual([
      'split-reveal',
      'stagger-in',
      'pin-sequence',
      'horizontal-scroll',
      'parallax-depth',
      'scrub-scale',
      'velocity-marquee',
      'fade-in',
      'slide-in',
    ]);
    expect(CUSTOM_CODE_SCENES).toEqual(['particles', 'mesh-gradient', 'parallax-layers', 'mural', 'ripple']);
    expect(SCENE_DENSITIES).toEqual(['low', 'medium', 'high']);
    expect(SCENE_PALETTES).toEqual(['theme', 'accent', 'mono']);
    expect(CAROUSEL_INDICATORS).toEqual(['dots', 'counter', 'none']);
    expect(CUSTOM_CODE_MEDIA_PARAMS).toEqual([
      'data-ck-indicator',
      'data-ck-autoplay',
      'data-ck-option',
      'data-ck-email',
      'data-ck-scrub',
      'data-ck-depth',
      'data-ck-density',
      'data-ck-palette',
      'data-ck-src',
    ]);
  });

  it('splits the params into behaviour params, engine params and part markers, with no overlap', () => {
    const parts = [
      ...CUSTOM_CODE_MEDIA_BEHAVIOR_PARAMS,
      ...CUSTOM_CODE_ENGINE_PARAMS,
      ...CUSTOM_CODE_MEDIA_PART_ATTRIBUTES,
    ];
    expect(new Set(parts).size).toBe(parts.length);
    expect([...parts].sort()).toEqual([...CUSTOM_CODE_MEDIA_PARAMS].sort());
    for (const param of CUSTOM_CODE_ENGINE_PARAMS) {
      expect(CUSTOM_CODE_ENGINE_MARKERS).toContain(CUSTOM_CODE_ENGINE_PARAM_OWNERS[param]);
    }
  });

  it('enters the tree vocabulary: behaviours appended, lightbox and carousel kept', () => {
    for (const behavior of CUSTOM_CODE_MEDIA_BEHAVIORS) expect(CUSTOM_CODE_BEHAVIORS).toContain(behavior);
    expect(CUSTOM_CODE_BEHAVIORS).toContain('lightbox');
    expect(CUSTOM_CODE_BEHAVIORS).toContain('carousel');
    expect(new Set(CUSTOM_CODE_BEHAVIORS).size).toBe(CUSTOM_CODE_BEHAVIORS.length);
    for (const name of CUSTOM_CODE_MEDIA_ATTRIBUTES) expect(CUSTOM_CODE_ATTRIBUTES).toContain(name);
    expect(CUSTOM_CODE_ATTRIBUTES).toContain('hidden');
    for (const param of CUSTOM_CODE_MEDIA_BEHAVIOR_PARAMS) {
      expect(CUSTOM_CODE_BEHAVIOR_PARAMS).toContain(param);
    }
    for (const param of [...CUSTOM_CODE_ENGINE_PARAMS, ...CUSTOM_CODE_MEDIA_PART_ATTRIBUTES]) {
      expect(CUSTOM_CODE_BEHAVIOR_PARAMS as readonly string[]).not.toContain(param);
    }
  });

  it('folds React and lower-case spellings of the new attributes', () => {
    expect(customCodeAttributeSpelling('dataCkTimeline')).toBe('data-ck-timeline');
    expect(customCodeAttributeSpelling('data-ck-SCENE')).toBe('data-ck-scene');
    expect(customCodeAttributeSpelling('dataCkIndicator')).toBe('data-ck-indicator');
  });

  it('labels and describes every recipe and scene in Arabic and English', () => {
    for (const recipe of CUSTOM_CODE_TIMELINE_RECIPES) {
      const info = CUSTOM_CODE_TIMELINE_RECIPE_INFO[recipe];
      for (const text of [info.label.ar, info.label.en, info.description.ar, info.description.en]) {
        expect(text.trim()).not.toBe('');
      }
      expect(info.label.ar).toMatch(/[؀-ۿ]/u);
    }
    for (const scene of CUSTOM_CODE_SCENES) {
      const info = CUSTOM_CODE_SCENE_INFO[scene];
      expect(info.label.ar).toMatch(/[؀-ۿ]/u);
      expect(info.description.en.trim()).not.toBe('');
    }
    expect(CUSTOM_CODE_SCENE_INFO.mural.label.ar).toBe('جدارية');
  });

  it('answers the guards', () => {
    expect(isCustomCodeMediaBehavior('gallery')).toBe(true);
    expect(isCustomCodeMediaBehavior('lightbox')).toBe(false);
    expect(isCustomCodeTimelineRecipe('split-reveal')).toBe(true);
    expect(isCustomCodeTimelineRecipe('fade-up')).toBe(false);
    expect(isCustomCodeScene('mural')).toBe(true);
    expect(isCustomCodeScene('canvas')).toBe(false);
    expect(isCustomCodeEngineMarker('data-ck-lottie')).toBe(true);
    expect(isCustomCodeEngineMarker('data-ck-motion')).toBe(false);
  });

  it('names the engines an element asks for', () => {
    expect(CUSTOM_CODE_ENGINE_KINDS).toEqual(
      CUSTOM_CODE_ENGINE_MARKERS.map((marker) => CUSTOM_CODE_ENGINE_OF_MARKER[marker]),
    );
    expect(customCodeEnginesOf(undefined)).toEqual([]);
    expect(customCodeEnginesOf({ 'data-ck-scene': 'mural', class: undefined })).toEqual(['scene']);
    expect(
      customCodeEnginesOf({ 'data-ck-timeline': 'stagger-in', 'data-ck-lottie': '', 'data-ck-src': 'x' }),
    ).toEqual(['timeline', 'lottie']);
  });
});
