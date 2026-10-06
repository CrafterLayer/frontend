import { describe, expect, it } from 'vitest';

import { CUSTOM_CODE_SCENES, SCENE_DENSITIES, SCENE_PALETTES } from '../custom-code/media-vocabulary';
import { mediaRecipeProblems } from './checks';
import { buildSceneLayer, buildSceneSection, SCENES_NEEDING_IMAGES } from './scene';
import { isMediaRecipeError, mediaRecipeNode, type MediaLocale, type MediaRecipeResult } from './types';

const LOCALES: readonly MediaLocale[] = ['ar', 'en'];
const PHOTOS = [
  { src: 'https://images.example.com/wall-1.jpg', alt: 'جدار', width: 1920, height: 1080 },
  { src: 'https://images.example.com/wall-2.jpg', alt: 'جدار', width: 1920, height: 1080 },
];

function recipe(result: MediaRecipeResult) {
  if (isMediaRecipeError(result)) throw new Error(result.error);
  return result;
}

describe('scene recipes', () => {
  it('every scene × density × palette × locale passes the door', () => {
    for (const scene of CUSTOM_CODE_SCENES) {
      for (const density of SCENE_DENSITIES) {
        for (const palette of SCENE_PALETTES) {
          for (const locale of LOCALES) {
            const layer = recipe(buildSceneLayer({ scene, density, palette, images: PHOTOS }));
            expect(mediaRecipeProblems(layer)).toEqual([]);
            const section = recipe(
              buildSceneSection({
                scene,
                density,
                palette,
                images: PHOTOS,
                locale,
                title: locale === 'ar' ? 'جدارية المدينة' : 'City mural',
                text: locale === 'ar' ? 'حكايات على الجدران' : 'Stories on the walls',
              }),
            );
            expect(mediaRecipeProblems(section), `${scene} ${locale}`).toEqual([]);
          }
        }
      }
    }
    for (const locale of LOCALES) {
      const plain = recipe(buildSceneSection({ scene: 'particles', locale, title: 'Hello' }));
      expect(mediaRecipeProblems(plain)).toEqual([]);
    }
  });

  it('the layer is a decorative div with the marker, its params and fallback images', () => {
    const layer = mediaRecipeNode(recipe(buildSceneLayer({ scene: 'mural', images: PHOTOS })));
    expect(layer.tag).toBe('div');
    expect(layer.attributes).toEqual({
      'data-ck-scene': 'mural',
      'data-ck-density': 'medium',
      'data-ck-palette': 'theme',
      'aria-hidden': 'true',
    });
    const [cover, texture] = layer.children ?? [];
    expect(cover).toMatchObject({
      tag: 'img',
      className: 'absolute inset-0 size-full object-cover',
      attributes: { alt: '', loading: 'lazy' },
    });
    expect(texture).toMatchObject({ tag: 'img', className: 'hidden', attributes: { alt: '' } });
  });

  it('a section puts the layer first, then a shade, then the real text', () => {
    const section = mediaRecipeNode(
      recipe(buildSceneSection({ scene: 'mural', images: PHOTOS, locale: 'ar', title: 'جدارية' })),
    );
    expect(section.className).toContain('relative isolate overflow-hidden');
    expect(section.attributes).toEqual({ lang: 'ar', dir: 'rtl' });
    const [layer, shade, content] = section.children ?? [];
    expect(layer).toMatchObject({ attributes: { 'data-ck-scene': 'mural' } });
    expect(shade).toMatchObject({ attributes: { 'aria-hidden': 'true' } });
    expect(content).toMatchObject({ children: [{ tag: 'h2', text: 'جدارية' }] });
    // Above the fold by default: the fallback paints first.
    expect((layer as { children: { attributes: Record<string, string> }[] }).children[0]?.attributes).toMatchObject({
      loading: 'eager',
      fetchpriority: 'high',
    });
  });

  it('refuses an image scene without images, and names outside the vocabulary', () => {
    for (const scene of SCENES_NEEDING_IMAGES) {
      expect(buildSceneLayer({ scene })).toEqual({ error: expect.stringMatching(/at least one/u) as unknown });
    }
    expect(isMediaRecipeError(buildSceneLayer({ scene: 'particles' }))).toBe(false);
    expect(isMediaRecipeError(buildSceneLayer({ scene: 'fire' as 'mural' }))).toBe(true);
    expect(isMediaRecipeError(buildSceneLayer({ scene: 'particles', density: 'max' as 'low' }))).toBe(true);
    expect(isMediaRecipeError(buildSceneLayer({ scene: 'particles', palette: 'red' as 'mono' }))).toBe(true);
  });
});
