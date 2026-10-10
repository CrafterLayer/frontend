/*
  pixi-studio:sound-engine (2026-10-10): `data-ck-sound` in the custom-code
  vocabulary (DESIGN §C.2). The grammar itself is covered in sound/sound.test.ts;
  this file holds the door's side: which tags carry it and what a refusal says.
*/
import { describe, expect, it } from 'vitest';

import {
  CUSTOM_CODE_ATTRIBUTES,
  customCodeAttributeProblem,
  customCodeAttributeSpelling,
  customCodeTreeProblems,
  customCodeTreeSchema,
} from './custom-code-tree';

const tree = (value: string) => ({
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'button',
      text: 'Play',
      attributes: { type: 'button', 'data-ck-sound': value },
    },
  ],
});

describe('data-ck-sound in a custom-code tree', () => {
  it('is in the vocabulary and folds React spelling back', () => {
    expect(CUSTOM_CODE_ATTRIBUTES).toContain('data-ck-sound');
    expect(customCodeAttributeSpelling('dataCkSound')).toBe('data-ck-sound');
  });

  it('validates a tree that attaches sounds to a button', () => {
    const value = tree('click:pop hover:hover-tick@0.4');
    expect(customCodeTreeProblems(value)).toEqual([]);
    expect(customCodeTreeSchema.safeParse(value).success).toBe(true);
  });

  it('refuses a bad value with a sentence that names the tag and the fix', () => {
    const problems = customCodeTreeProblems(tree('click:boom'));
    expect(problems.map((problem) => problem.path)).toEqual([
      ['children', 0, 'attributes', 'data-ck-sound'],
    ]);
    expect(problems[0]?.message).toMatch(/^<button> data-ck-sound: 'boom' is not a sound/u);
    expect(problems[0]?.message).toMatch(/lib:<id>/u);
  });

  it('sits on html elements, never inside an svg drawing', () => {
    expect(customCodeAttributeProblem('div', 'data-ck-sound', 'ambient:wind')).toBeUndefined();
    expect(customCodeAttributeProblem('section', 'data-ck-sound', 'enter:sparkle')).toBeUndefined();
    expect(customCodeAttributeProblem('path', 'data-ck-sound', 'click:pop')).toMatch(
      /html element/u,
    );
  });
});
