import { describe, expect, it } from 'vitest';

import { customCodeTreeProblems } from '../custom-code/custom-code-tree';
import { CUSTOM_CODE_TIMELINE_RECIPES } from '../custom-code/media-vocabulary';
import {
  applyAttributePatch,
  clearTimelineAttrs,
  depthAttrs,
  timelineAttrs,
  timelineLabel,
  type MediaAttributePatch,
} from './timeline';

function patch(result: MediaAttributePatch | { readonly error: string }): MediaAttributePatch {
  if ('error' in result && typeof result.error === 'string') throw new Error(result.error);
  return result as MediaAttributePatch;
}

describe('timeline patches', () => {
  it('puts a recipe on an element and removes the CSS preset it would fight', () => {
    expect(patch(timelineAttrs('split-reveal', { scrub: true }))).toEqual({
      'data-ck-timeline': 'split-reveal',
      'data-ck-scrub': 'true',
      'data-ck-motion': null,
      'data-ck-trigger': null,
      'data-ck-once': null,
      'data-ck-distance': null,
      'data-ck-target': null,
    });
    expect(patch(timelineAttrs('stagger-in'))['data-ck-scrub']).toBeNull();
  });

  it('every recipe, patched over an animated element, leaves a tree the door accepts', () => {
    for (const recipe of CUSTOM_CODE_TIMELINE_RECIPES) {
      for (const scrub of [undefined, true, false]) {
        const attributes = applyAttributePatch(
          {
            'data-ck-motion': 'fade-up',
            'data-ck-trigger': 'view',
            'data-ck-once': 'true',
            'data-ck-ease': 'emphasized',
            'data-ck-delay': '2',
            lang: 'ar',
          },
          patch(timelineAttrs(recipe, { scrub })),
        );
        expect(attributes['data-ck-motion']).toBeUndefined();
        expect(attributes['data-ck-ease']).toBe('emphasized');
        expect(
          customCodeTreeProblems({
            kind: 'root',
            children: [{ kind: 'element', tag: 'h2', text: 'عنوان', attributes }],
          }),
          recipe,
        ).toEqual([]);
      }
    }
  });

  it('clears a recipe, marks depth layers, labels the change, refuses unknown names', () => {
    expect(
      applyAttributePatch({ 'data-ck-timeline': 'scrub-scale', 'data-ck-scrub': 'true', id: 'x' }, clearTimelineAttrs()),
    ).toEqual({ id: 'x' });
    expect(depthAttrs('2')).toEqual({ 'data-ck-depth': '2' });
    expect('error' in depthAttrs('5' as '1')).toBe(true);
    expect(timelineLabel('split-reveal')).toEqual({
      ar: 'حركة سينمائية: كشف الكلمات',
      en: 'Cinematic motion: Split reveal',
    });
    expect('error' in timelineAttrs('fade' as 'split-reveal')).toBe(true);
  });
});
