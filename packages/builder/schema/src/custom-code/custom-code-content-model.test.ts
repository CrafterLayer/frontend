import { describe, expect, it } from 'vitest';

import {
  customCodeTagAccepts,
  customCodeTreeProblems,
  customCodeTreeSchema,
  type CustomCodeNode,
} from './custom-code-tree';

/*
  Fix pass 2026-10-06: the Library Heading tile dropped on a paragraph put an
  <h2> inside the <p> (React: "<h2> cannot be a descendant of <p>"), and the
  tree-markup property test stored a <track> holding the text "a".
*/

const root = (children: CustomCodeNode[]) => ({ kind: 'root' as const, children });
const messages = (tree: unknown) => customCodeTreeProblems(tree).map(({ message }) => message);

describe('the tree door: HTML content model', () => {
  it('refuses a heading or a block inside a paragraph, at any depth of phrasing', () => {
    expect(
      customCodeTreeSchema.safeParse(
        root([{ kind: 'element', tag: 'p', children: [{ kind: 'element', tag: 'h2', text: 'x' }] }]),
      ).success,
    ).toBe(false);
    expect(
      messages(
        root([
          {
            kind: 'element',
            tag: 'h1',
            children: [
              { kind: 'element', tag: 'strong', children: [{ kind: 'element', tag: 'div', text: 'x' }] },
            ],
          },
        ]),
      ).join(' '),
    ).toMatch(/<div> cannot stand inside <strong>/u);
  });

  it('admits phrasing inside phrasing, and a block inside a link card', () => {
    expect(
      customCodeTreeSchema.safeParse(
        root([
          {
            kind: 'element',
            tag: 'p',
            children: [
              { kind: 'element', tag: 'span', text: 'Hi ' },
              { kind: 'element', tag: 'strong', text: 'there' },
              { kind: 'element', tag: 'a', text: 'link', attributes: { href: '#x' } },
              { kind: 'icon', name: 'mail' },
            ],
          },
          {
            kind: 'element',
            tag: 'a',
            attributes: { href: '#card' },
            children: [{ kind: 'element', tag: 'div', children: [{ kind: 'element', tag: 'h3', text: 'Card' }] }],
          },
        ]),
      ).success,
    ).toBe(true);
  });

  it('refuses text and children on void tags', () => {
    expect(
      messages(
        root([
          {
            kind: 'element',
            tag: 'video',
            attributes: { src: '/a.mp4' },
            children: [{ kind: 'element', tag: 'track', text: 'a' }],
          },
        ]),
      ).join(' '),
    ).toMatch(/<track> is a void element and holds no text/u);
    expect(
      messages(root([{ kind: 'element', tag: 'img', attributes: { src: '/a.jpg', alt: '' }, children: [{ kind: 'element', tag: 'span' }] }])).join(' '),
    ).toMatch(/<img> is a void element and holds no children/u);
  });

  it('refuses a link inside a link and a button inside a button', () => {
    expect(
      messages(
        root([
          {
            kind: 'element',
            tag: 'button',
            children: [{ kind: 'element', tag: 'button', text: 'x' }],
          },
        ]),
      ).join(' '),
    ).toMatch(/<button> is interactive and cannot sit inside <button>/u);
  });

  it('answers drop questions the same way', () => {
    expect(customCodeTagAccepts('p', 'h2')).toBe(false);
    expect(customCodeTagAccepts('p', 'span')).toBe(true);
    expect(customCodeTagAccepts('div', 'h2')).toBe(true);
    expect(customCodeTagAccepts('img', 'span')).toBe(false);
    expect(customCodeTagAccepts('a', 'a')).toBe(false);
    expect(customCodeTagAccepts('a', 'div')).toBe(true);
  });
});
