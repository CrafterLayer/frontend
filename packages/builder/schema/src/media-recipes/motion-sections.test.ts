import { describe, expect, it } from 'vitest';

import { customCodeTreeProblems, type CustomCodeElement, type CustomCodeNode } from '../custom-code/custom-code-tree';
import { HOSTED_SCENES, SCENE_DENSITIES, SCENE_PALETTES } from '../custom-code/media-vocabulary';
import { mediaRecipeProblems } from './checks';
import { buildAnimatedHero, buildScrollRevealFeatures, buildScrollRevealSection } from './motion-sections';
import { isMediaRecipeError, mediaRecipeNode, type MediaLocale, type MediaRecipeResult } from './types';

/*
  gsap-pixi (2026-10-08): the motion sections the Library inserts and the
  agent may reuse. Each passes the door, carries its engine markers on the
  right elements, and writes nothing but theme tokens and logical classes.
*/

const LOCALES: readonly MediaLocale[] = ['ar', 'en'];

function recipe(result: MediaRecipeResult) {
  if (isMediaRecipeError(result)) throw new Error(result.error);
  return result;
}

function elements(node: CustomCodeNode): CustomCodeElement[] {
  if (node.kind !== 'element') return [];
  return [node, ...(node.children ?? []).flatMap(elements)];
}

function timelines(node: CustomCodeNode): Record<string, string> {
  return Object.fromEntries(
    elements(node).flatMap((entry) => {
      const value = entry.attributes?.['data-ck-timeline'];
      return value === undefined ? [] : [[entry.tag === 'div' ? `div:${entry.className ?? ''}` : entry.tag, value]];
    }),
  );
}

describe('buildAnimatedHero', () => {
  it('every hosted scene × density × palette × locale, host mode and layer mode, passes the door', () => {
    for (const scene of HOSTED_SCENES) {
      for (const density of SCENE_DENSITIES) {
        for (const palette of SCENE_PALETTES) {
          for (const locale of LOCALES) {
            for (const layer of [false, true]) {
              const built = recipe(
                buildAnimatedHero({
                  locale,
                  scene,
                  density,
                  palette,
                  layer,
                  title: locale === 'ar' ? 'عنوان واضح' : 'A clear headline',
                  text: locale === 'ar' ? 'سطر واحد يقول ما تقدمه.' : 'One line that says what you offer.',
                  action: { label: locale === 'ar' ? 'ابدأ الآن' : 'Get started' },
                }),
              );
              expect(mediaRecipeProblems(built), `${scene} ${density} ${palette} ${locale} ${String(layer)}`).toEqual([]);
              expect(customCodeTreeProblems(built.tree)).toEqual([]);
            }
          }
        }
      }
    }
  });

  it('puts the scene on the section itself (host mode), the heading split-reveal, text and CTA fade-in', () => {
    const section = mediaRecipeNode(
      recipe(buildAnimatedHero({ locale: 'ar', title: 'قهوة كل صباح', text: 'من المزرعة إلى فنجانك.', action: { label: 'اطلب الآن', href: '#menu' } })),
    );
    expect(section.tag).toBe('section');
    expect(section.attributes).toMatchObject({
      lang: 'ar',
      dir: 'rtl',
      'data-ck-scene': 'particles',
      'data-ck-density': 'medium',
      'data-ck-palette': 'theme',
    });
    expect(section.className).toContain('relative isolate overflow-hidden');
    expect(timelines(section)).toEqual({
      h1: 'split-reveal',
      p: 'fade-in',
      'div:mt-8 flex justify-center': 'fade-in',
    });
    const link = elements(section).find((entry) => entry.tag === 'a');
    expect(link).toMatchObject({ text: 'اطلب الآن', attributes: { href: '#menu' } });
    // Arabic text stays one text node: the engine splits words at runtime, never the tree.
    expect(elements(section).find((entry) => entry.tag === 'h1')?.text).toBe('قهوة كل صباح');
  });

  it('layer mode keeps the classic decorative div as the first child', () => {
    const section = mediaRecipeNode(recipe(buildAnimatedHero({ locale: 'en', title: 'Hello', scene: 'mesh-gradient', layer: true })));
    expect(section.attributes?.['data-ck-scene']).toBeUndefined();
    const [first] = section.children ?? [];
    expect(first).toMatchObject({
      tag: 'div',
      attributes: { 'data-ck-scene': 'mesh-gradient', 'aria-hidden': 'true' },
    });
  });

  it('refuses an image scene, an empty title and an unknown density with repair text', () => {
    expect(buildAnimatedHero({ locale: 'en', title: 'x', scene: 'mural' as never })).toEqual({
      error: 'scene is one of particles, mesh-gradient',
    });
    expect(buildAnimatedHero({ locale: 'en', title: '  ' })).toEqual({ error: 'an animated hero needs a title' });
    expect(isMediaRecipeError(buildAnimatedHero({ locale: 'en', title: 'x', density: 'huge' as never }))).toBe(true);
  });
});

describe('buildScrollRevealFeatures', () => {
  it.each(LOCALES)('passes the door with the default cards and staggers the grid (%s)', (locale) => {
    const built = recipe(
      buildScrollRevealFeatures({ locale, title: locale === 'ar' ? 'لماذا نحن' : 'Why us', text: locale === 'ar' ? 'ثلاثة أسباب.' : 'Three reasons.' }),
    );
    expect(mediaRecipeProblems(built)).toEqual([]);
    const section = mediaRecipeNode(built);
    const grid = elements(section).find((entry) => entry.attributes?.['data-ck-timeline'] === 'stagger-in');
    expect(grid?.children).toHaveLength(3);
    expect(grid?.children?.every((child) => child.kind === 'element' && child.tag === 'article')).toBe(true);
    expect(elements(section).find((entry) => entry.tag === 'h2')?.attributes?.['data-ck-timeline']).toBe('fade-in');
    expect(section.attributes).toMatchObject(locale === 'ar' ? { lang: 'ar', dir: 'rtl' } : { lang: 'en', dir: 'ltr' });
  });

  it('takes given cards and refuses fewer than two', () => {
    const built = recipe(
      buildScrollRevealFeatures({
        locale: 'en',
        title: 'Why us',
        cards: [{ title: 'Fast' }, { title: 'Safe', text: 'One door.', icon: 'star' }],
      }),
    );
    expect(mediaRecipeProblems(built)).toEqual([]);
    expect(buildScrollRevealFeatures({ locale: 'en', title: 'Why us', cards: [{ title: 'Only' }] })).toEqual({
      error: 'a scroll reveal grid holds 2-6 cards with a title',
    });
  });
});

describe('buildScrollRevealSection', () => {
  it.each(LOCALES)('passes the door and staggers its heading, text and call to action (%s)', (locale) => {
    const built = recipe(
      buildScrollRevealSection({
        locale,
        title: locale === 'ar' ? 'قصتنا' : 'Our story',
        text: locale === 'ar' ? 'منذ ١٩٩٨.' : 'Since 1998.',
        action: { label: locale === 'ar' ? 'اعرف المزيد' : 'Learn more' },
      }),
    );
    expect(mediaRecipeProblems(built)).toEqual([]);
    const container = elements(mediaRecipeNode(built)).find((entry) => entry.attributes?.['data-ck-timeline'] === 'stagger-in');
    expect(container?.children?.map((child) => (child.kind === 'element' ? child.tag : child.kind))).toEqual(['h2', 'p', 'div']);
    expect(buildScrollRevealSection({ locale, title: '' })).toEqual({ error: 'a scroll reveal section needs a title' });
  });
});
