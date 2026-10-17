import { describe, expect, it } from 'vitest';

import {
  CUSTOM_CODE_ATTRIBUTES,
  customCodeAttributeProblem,
  customCodeAttributeSpelling,
  customCodeTreeProblems,
  customCodeTreeSchema,
  type CustomCodeNode,
} from './custom-code-tree';
import { CUSTOM_CODE_SCENE_GENERAL_HOOKS, CUSTOM_CODE_SCENE_HOOKS } from './creative-vocabulary';

/*
  The scene hooks (2026-10-12): a game's Start button, a story's title, a counter — found by a
  scene's code through a data attribute. The door refused them all, so the normalizer dropped them
  and the code found nothing. Ours to prove: the taught families and the general data-scene-*
  hooks stand on html elements with bounded values, a whole taught game tree passes, and any
  other data-* is still refused, with a refusal that names the hooks to use instead.
*/

const ok = (tag: string, name: string, value: string) => {
  expect(customCodeAttributeProblem(tag, name, value), `${tag} ${name}=${value}`).toBeUndefined();
};
const bad = (tag: string, name: string, value: string) => {
  expect(customCodeAttributeProblem(tag, name, value), `${tag} ${name}=${value}`).toEqual(
    expect.any(String),
  );
};

const el = (tag: string, attributes: Record<string, string>, text?: string) =>
  ({
    kind: 'element',
    tag,
    attributes,
    ...(text === undefined ? {} : { text }),
    children: [],
  }) as unknown as CustomCodeNode;

const GAME = {
  kind: 'root',
  children: [
    el('button', { type: 'button', 'data-game-action': 'start' }, 'Start'),
    el('button', { type: 'button', 'data-game-key': 'ArrowLeft' }, 'Left'),
    // The playbooks' <output> is not a door tag: the normalizer writes a <span>, hook and all.
    el('span', { 'data-game-status': '', role: 'status', 'aria-live': 'polite' }),
    el('h2', { 'data-story-title': '' }),
    el('b', { 'data-count': '250' }, '0'),
    el('button', { type: 'button', 'data-scene-action': 'jump' }, 'Jump'),
  ],
};

describe('scene hooks', () => {
  it('are part of the vocabulary, with their usual spellings', () => {
    for (const name of CUSTOM_CODE_SCENE_HOOKS) {
      expect(CUSTOM_CODE_ATTRIBUTES).toContain(name);
      expect(customCodeAttributeSpelling(name.replace(/-/gu, ''))).toBe(name);
    }
    expect(CUSTOM_CODE_SCENE_GENERAL_HOOKS).toEqual([
      'data-scene-action',
      'data-scene-key',
      'data-scene-status',
      'data-scene-part',
      'data-scene-value',
    ]);
  });

  it('admit a whole taught game tree', () => {
    expect(customCodeTreeProblems(GAME)).toEqual([]);
    expect(customCodeTreeSchema.safeParse(GAME).success).toBe(true);
  });

  it('carry tokens, key codes and numbers, never words, code or an address', () => {
    ok('button', 'data-game-action', 'restart');
    ok('a', 'data-story-action', 'next');
    bad('button', 'data-game-action', '');
    bad('button', 'data-game-action', 'start the game');
    bad('button', 'data-hud-act', 'javascript:alert(1)');
    ok('button', 'data-game-key', 'Space');
    ok('button', 'data-chase-key', 'KeyW');
    bad('button', 'data-game-key', 'Arrow Left');
    ok('output', 'data-game-status', '');
    ok('p', 'data-anim-status', 'pose');
    bad('p', 'data-story-copy', '<b>');
    ok('b', 'data-count', '-3.5');
    bad('b', 'data-count', '250 people');
    ok('span', 'data-scene-part', 'score');
    bad('span', 'data-scene-part', 'https://example.com/x');
  });

  it('stand on html elements, not inside a drawing', () => {
    bad('circle', 'data-scene-part', 'sun');
  });

  it('leave every other data attribute refused, naming the general hooks', () => {
    const problem = customCodeAttributeProblem('button', 'data-level', 'two');
    expect(problem).toMatch(/not an attribute the vocabulary admits/u);
    expect(problem).toContain('data-scene-action, data-scene-key');
  });
});
