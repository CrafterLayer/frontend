import { describe, expect, it } from 'vitest';

import {
  CUSTOM_CODE_ATTRIBUTES,
  CUSTOM_CODE_BEHAVIOR_PARAMS,
  CUSTOM_CODE_BEHAVIORS,
  customCodeAttributeProblem,
  customCodeAttributeSpelling,
  customCodeTreeProblems,
  customCodeTreeSchema,
  type CustomCodeNode,
} from './custom-code-tree';
import {
  CUSTOM_CODE_SITE_BEHAVIORS,
  CUSTOM_CODE_SITE_PART_ATTRIBUTES,
} from './site-behavior-vocabulary';

/*
  The everyday site behaviours (2026-10-13): back-to-top, read-more, scroll-spy, typed-words,
  filter and dismiss are NAMED by a tree and run by a renderer pack. Ours to prove: the door admits
  exactly these names and the one part attribute, binds two of them to their tags, judges the
  filter grammar and each behaviour's shape, and still refuses every other data-* attribute.
*/

const ok = (tag: string, name: string, value: string) => {
  expect(customCodeAttributeProblem(tag, name, value), `${tag} ${name}=${value}`).toBeUndefined();
};
const bad = (tag: string, name: string, value: string) => {
  expect(customCodeAttributeProblem(tag, name, value), `${tag} ${name}=${value}`).toEqual(
    expect.any(String),
  );
};

type Node = Record<string, unknown>;
const el = (
  tag: string,
  attributes: Record<string, string> = {},
  text?: string,
  children: Node[] = [],
): Node => ({
  kind: 'element',
  tag,
  attributes,
  ...(text === undefined ? {} : { text }),
  children,
});
const root = (...children: Node[]) => ({
  kind: 'root',
  children: children as unknown as CustomCodeNode[],
});
const messages = (tree: unknown) => customCodeTreeProblems(tree).map((problem) => problem.message);

/** The shapes the design-code skill teaches, written as a section writer lands them. */
const TAUGHT = root(
  el('header', {}, undefined, [
    el('nav', { 'data-ck-behavior': 'scroll-spy', 'aria-label': 'Sections' }, undefined, [
      el('a', { href: '#services' }, 'Services'),
      el('a', { href: '#prices' }, 'Prices'),
    ]),
  ]),
  el(
    'div',
    { 'data-ck-behavior': 'dismiss', role: 'region', 'aria-label': 'Announcement' },
    undefined,
    [
      el('p', {}, 'Free delivery this week'),
      el('button', { type: 'button', 'aria-label': 'Close', hidden: '' }, '×'),
    ],
  ),
  el('h1', {}, 'We build ', [
    el('span', { 'data-ck-behavior': 'typed-words', 'data-ck-speed': 'slow' }, undefined, [
      el('span', {}, 'websites'),
      el('span', { hidden: '' }, 'shops'),
      el('span', { hidden: '' }, 'brands'),
    ]),
  ]),
  el('section', { id: 'services' }, undefined, [
    el('div', { 'data-ck-behavior': 'read-more', 'data-ck-text': 'Show less' }, undefined, [
      el('p', {}, 'A long story.'),
      el('button', { type: 'button', hidden: '' }, 'Read more'),
    ]),
  ]),
  el('section', { id: 'prices' }, undefined, [
    el('div', { 'data-ck-behavior': 'filter' }, undefined, [
      el('button', { type: 'button', 'data-ck-filter': 'all', 'aria-pressed': 'true' }, 'All'),
      el('button', { type: 'button', 'data-ck-filter': 'web' }, 'Web'),
      el('article', { 'data-ck-filter': 'web print' }, 'Menu redesign'),
    ]),
  ]),
  el('a', { href: '#top', 'data-ck-behavior': 'back-to-top', 'aria-label': 'Back to top' }, '↑'),
);

describe('everyday site behaviours at the door', () => {
  it('admits exactly the six names and the one part attribute', () => {
    expect(CUSTOM_CODE_SITE_BEHAVIORS).toEqual([
      'back-to-top',
      'read-more',
      'scroll-spy',
      'typed-words',
      'filter',
      'dismiss',
    ]);
    for (const name of CUSTOM_CODE_SITE_BEHAVIORS) expect(CUSTOM_CODE_BEHAVIORS).toContain(name);
    expect(CUSTOM_CODE_SITE_PART_ATTRIBUTES).toEqual(['data-ck-filter']);
    expect(CUSTOM_CODE_ATTRIBUTES).toContain('data-ck-filter');
    expect(CUSTOM_CODE_BEHAVIOR_PARAMS).not.toContain('data-ck-filter');
    expect(customCodeAttributeSpelling('dataCkFilter')).toBe('data-ck-filter');
    bad('div', 'data-ck-behavior', 'back-to-bottom');
    bad('div', 'data-ck-behavior', 'theme-toggle');
    bad('div', 'data-ck-behavior', 'scrollspy');
  });

  it('binds back-to-top to a link or button and typed-words to a span', () => {
    ok('a', 'data-ck-behavior', 'back-to-top');
    ok('button', 'data-ck-behavior', 'back-to-top');
    expect(customCodeAttributeProblem('div', 'data-ck-behavior', 'back-to-top')).toMatch(
      /<a> or <button>/u,
    );
    ok('span', 'data-ck-behavior', 'typed-words');
    expect(customCodeAttributeProblem('h1', 'data-ck-behavior', 'typed-words')).toMatch(/<span>/u);
    for (const name of ['read-more', 'scroll-spy', 'filter', 'dismiss']) {
      ok('div', 'data-ck-behavior', name);
      ok('section', 'data-ck-behavior', name);
    }
    ok('nav', 'data-ck-behavior', 'scroll-spy');
  });

  it('judges data-ck-filter: one group on a button, one to six on an item', () => {
    ok('button', 'data-ck-filter', 'all');
    ok('button', 'data-ck-filter', 'web');
    ok('button', 'data-ck-filter', 'تصميم');
    bad('button', 'data-ck-filter', 'web print');
    bad('button', 'data-ck-filter', '');
    ok('article', 'data-ck-filter', 'web');
    ok('li', 'data-ck-filter', 'web print brand-identity');
    bad('li', 'data-ck-filter', 'web  print');
    bad('li', 'data-ck-filter', 'a b c d e f g');
    bad('li', 'data-ck-filter', 'web,print');
    bad('li', 'data-ck-filter', "web'><script>");
    bad('li', 'data-ck-filter', 'x'.repeat(33));
    bad('circle', 'data-ck-filter', 'web');
  });

  it('admits the whole taught page', () => {
    expect(messages(TAUGHT)).toEqual([]);
    expect(customCodeTreeSchema.safeParse(TAUGHT).success).toBe(true);
  });

  it('names the fix for a shape its pack cannot read', () => {
    expect(
      messages(root(el('a', { href: '/', 'data-ck-behavior': 'back-to-top' }, 'Top'))),
    ).toEqual(["<a> data-ck-behavior='back-to-top' points at the page's start: write href='#top'"]);
    expect(
      messages(root(el('button', { type: 'button', 'data-ck-behavior': 'back-to-top' }, 'Top'))),
    ).toEqual([]);
    expect(
      messages(
        root(el('div', { 'data-ck-behavior': 'read-more' }, undefined, [el('p', {}, 'Text only')])),
      ),
    ).toEqual([expect.stringMatching(/holds the text first and its button last/u)]);
    expect(
      messages(
        root(
          el('span', { 'data-ck-behavior': 'typed-words' }, undefined, [
            el('span', {}, 'websites'),
            el('span', {}, 'shops'),
          ]),
        ),
      ),
    ).toEqual([expect.stringMatching(/every one after the first hidden/u)]);
    expect(
      messages(
        root(el('span', { 'data-ck-behavior': 'typed-words' }, undefined, [el('span', {}, 'one')])),
      ),
    ).toEqual([expect.stringMatching(/two or more word spans/u)]);
  });

  it('still refuses every other data attribute, naming the part markers', () => {
    const problem = customCodeAttributeProblem('div', 'data-ck-typewriter', '');
    expect(problem).toMatch(/not an attribute the vocabulary admits/u);
    expect(problem).toContain('data-ck-filter');
    bad('button', 'data-ck-lines', '3');
    bad('button', 'onclick', 'scrollTo(0,0)');
  });
});
