import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineBlockSchema } from '../blocks/define-block-schema';
import { customCodeTree, customCss, emptyCustomCodeTree } from '../custom-code/custom-code-tree';
import type { BuilderDocument } from './types';
import { validateDocument } from './validate';

/**
 * The intent-only law and the two props it must not govern.
 *
 * Found on the first live run: the assistant wrote a stylesheet with a hex
 * colour in it, the kernel door refused the whole plan as a raw literal, and
 * the assistant retreated to tokens the person had not asked for. A
 * stylesheet with no colour codes cannot say anything; the law was never
 * meant for it.
 */
const region = defineBlockSchema({
  type: 'region',
  description: 'A composed region.',
  props: z.object({
    css: customCss(),
    styles: customCss(), // exempt by DECLARATION, whatever the prop is called
    tree: customCodeTree().default(emptyCustomCodeTree()),
    caption: z.string().default(''), // a plain string: still governed
  }),
  examples: [],
});

function documentWith(props: Record<string, unknown>): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'r',
    nodes: { r: { id: 'r', type: 'region', props: props as never } },
  };
}

const lookup = (type: string) => (type === 'region' ? region : undefined);
const rawLiteralErrors = (props: Record<string, unknown>) =>
  validateDocument(documentWith(props), lookup).filter(
    (error) => error.code === 'doc/raw-style-literal',
  );

describe('the raw-literal law and composed regions', () => {
  it('lets a stylesheet carry colour codes and pixel lengths', () => {
    expect(
      rawLiteralErrors({ css: '.ck-a { color: #1e3a8a; padding: 16px; background: #fff }' }),
    ).toEqual([]);
  });

  it('exempts by the customCss() marker, not by the prop being named css', () => {
    expect(rawLiteralErrors({ styles: '.ck-b { border: 1px solid #000 }' })).toEqual([]);
  });

  it('lets a composed region mention a colour code in its text', () => {
    const tree = {
      kind: 'root',
      children: [{ kind: 'element', tag: 'p', text: 'Ticket #ff0 — 16px tall' }],
    };

    expect(rawLiteralErrors({ tree })).toEqual([]);
  });

  it('still governs every other prop — the law did not move, only its edge did', () => {
    const errors = rawLiteralErrors({ caption: 'Use #ff0000 for the badge' });

    expect(errors).toHaveLength(1);
    expect(errors[0]?.path).toEqual(['nodes', 'r', 'props', 'caption']);
  });

  it('applies the exemption to responsive overrides of the same props', () => {
    const doc = documentWith({ css: '' });
    doc.nodes['r'] = {
      ...doc.nodes['r'],
      responsive: { mobile: { css: '.ck-m { padding: 8px }' } },
    } as never;

    expect(
      validateDocument(doc, lookup).filter((error) => error.code === 'doc/raw-style-literal'),
    ).toEqual([]);
  });

  it('reports an unknown block instead of scanning it — nothing can be declared exempt there', () => {
    // The style law runs only on a block the registry knows; for an unknown
    // type the door already reports the real problem, and an exemption set
    // built from no schema is simply empty.
    const errors = validateDocument(documentWith({ css: '#fff' }), () => undefined);

    expect(errors.some((error) => error.code === 'doc/unknown-type')).toBe(true);
    expect(errors.filter((error) => error.code === 'doc/raw-style-literal')).toEqual([]);
  });
});
