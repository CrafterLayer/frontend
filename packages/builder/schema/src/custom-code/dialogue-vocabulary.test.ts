import { describe, expect, it } from 'vitest';

import {
  CUSTOM_CODE_ATTRIBUTES,
  customCodeAttributeProblem,
  customCodeTreeProblems,
  customCodeTreeSchema,
  type CustomCodeNode,
} from './custom-code-tree';
import { CUSTOM_CODE_DIALOGUE_ATTRIBUTES } from './dialogue-vocabulary';

/*
  The dialogue markers (creative engines, 2026-10-12): a story's lines live in the tree for
  `s.lib.dialogue.fromDom`, so the door admits exactly five data attributes, each on its own
  tags, each carrying an id — and every other data-* stays refused.
*/

const ok = (tag: string, name: string, value: string) => {
  expect(customCodeAttributeProblem(tag, name, value), `${tag} ${name}=${value}`).toBeUndefined();
};
const bad = (tag: string, name: string, value: string) => {
  expect(customCodeAttributeProblem(tag, name, value), `${tag} ${name}=${value}`).toEqual(
    expect.any(String),
  );
};

const el = (
  tag: string,
  attributes: Record<string, string>,
  text?: string,
  children: CustomCodeNode[] = [],
) =>
  ({
    kind: 'element',
    tag,
    attributes,
    ...(text === undefined ? {} : { text }),
    children,
  }) as unknown as CustomCodeNode;

const SCRIPT = {
  kind: 'root',
  children: [
    el('ol', { 'data-ck-dialogue': '', hidden: '' }, undefined, [
      el('li', { 'data-ck-speaker': 'layla' }, 'The lantern went out.'),
      el('li', { 'data-ck-node': 'ask', 'data-ck-speaker': 'omar' }, 'Cross the river?', [
        el('button', { type: 'button', 'data-ck-next': 'cross' }, 'Cross it'),
        el('button', { type: 'button', 'data-ck-next': 'wait' }, 'Wait for dawn'),
      ]),
      el('li', { 'data-ck-node': 'cross', 'data-ck-ending': 'brave' }, 'The water is cold.'),
      el('li', { 'data-ck-node': 'wait', 'data-ck-ending': '' }, 'Dawn comes slowly.'),
    ]),
  ],
};

describe('dialogue markers', () => {
  it('are part of the vocabulary', () => {
    for (const name of CUSTOM_CODE_DIALOGUE_ATTRIBUTES)
      expect(CUSTOM_CODE_ATTRIBUTES).toContain(name);
  });

  it('admit a whole script: list, lines, speakers, jumps, choices and endings', () => {
    expect(customCodeTreeProblems(SCRIPT)).toEqual([]);
    expect(customCodeTreeSchema.safeParse(SCRIPT).success).toBe(true);
  });

  it('stand only on their tags', () => {
    ok('ol', 'data-ck-dialogue', '');
    ok('ul', 'data-ck-dialogue', 'intro');
    bad('div', 'data-ck-dialogue', '');
    ok('li', 'data-ck-node', 'ask');
    bad('p', 'data-ck-node', 'ask');
    ok('li', 'data-ck-speaker', 'ليلى');
    bad('button', 'data-ck-speaker', 'layla');
    ok('li', 'data-ck-next', 'cross');
    ok('button', 'data-ck-next', 'line-3');
    bad('a', 'data-ck-next', 'cross');
    ok('li', 'data-ck-ending', '');
    ok('li', 'data-ck-ending', 'brave');
    bad('span', 'data-ck-ending', 'brave');
  });

  it('carry ids, never words, code or addresses', () => {
    bad('li', 'data-ck-node', '');
    bad('li', 'data-ck-node', 'two words');
    bad('li', 'data-ck-speaker', 'alert(1)');
    bad('button', 'data-ck-next', '#cross');
    bad('li', 'data-ck-next', 'https://example.com');
    bad('li', 'data-ck-ending', 'x'.repeat(65));
    expect(customCodeAttributeProblem('li', 'data-ck-node', 'a b')).toContain(
      'an id of 1-64 letters',
    );
  });

  it('leave every other data-* refused, and the refusal names the markers', () => {
    const problem = customCodeAttributeProblem('li', 'data-node', 'ask');
    expect(problem).toContain('data-ck-node');
    expect(problem).toContain('data-ck-dialogue');
    bad('li', 'data-speaker', 'layla');
  });
});
