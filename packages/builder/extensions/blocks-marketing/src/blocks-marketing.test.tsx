import { render, screen } from '@testing-library/react';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder, insertedNodeId } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { defineBlockSchema, type TrustedExtensionManifest } from '@craftkit/builder-schema';

import { blocksMarketing } from './index';

/** A minimal structural host for the marketing vocabulary (US2 acceptance). */
const hostPage: TrustedExtensionManifest = {
  tier: 1,
  name: 'test-page-host',
  version: '0.0.1',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Test host page for the marketing vocabulary.',
          props: z.object({}),
          slots: {
            default: { allow: ['hero', 'features', 'pricing', 'testimonials', 'cta'] },
          },
          examples: [],
        }),
        // Pass-through: the host must actually render its slot for end-to-end tests.
        render: ({ slots }) => <div>{slots['default']}</div>,
      },
    ],
  },
};

function marketingKernel() {
  return createBuilder({
    extensions: [hostPage, blocksMarketing],
    ports: { clock: fixedClock(), ids: seededIds('mk') },
  });
}

describe('US2 — blocks-marketing extension', () => {
  it('scenario 1: all five block types are discoverable with model-facing descriptions and examples', () => {
    const kernel = marketingKernel();
    for (const type of ['hero', 'features', 'pricing', 'testimonials', 'cta']) {
      const entry = kernel.context.registry.block(type);
      expect(entry, type).toBeDefined();
      expect(entry?.schema.description.length ?? 0).toBeGreaterThan(20);
      expect(entry?.schema.examples.length ?? 0).toBeGreaterThan(0);
    }
    expect(kernel.context.registry.blocks('site').length).toBeGreaterThanOrEqual(5);
  });

  it('scenario 2+4: a document built from all five blocks renders values and enforces slot rules', () => {
    const kernel = marketingKernel();
    const heroTx = kernel.dispatch('insertNode', {
      type: 'hero',
      parentId: 'root',
      props: { heading: 'Build faster', tone: 'dark' },
    });
    const heroId = insertedNodeId(heroTx.patches);
    if (heroId === undefined) {
      throw new Error('hero insert failed');
    }
    kernel.dispatch('insertNode', {
      type: 'cta',
      parentId: heroId,
      slot: 'actions',
      props: { label: 'Start now' },
    });
    kernel.dispatch('insertNode', {
      type: 'features',
      parentId: 'root',
      props: { items: [{ title: 'Fast', body: 'Very.' }] },
    });
    kernel.dispatch('insertNode', {
      type: 'pricing',
      parentId: 'root',
      props: { plans: [{ name: 'Solo', price: '$9', period: 'month', features: [] }] },
    });
    kernel.dispatch('insertNode', {
      type: 'testimonials',
      parentId: 'root',
      props: { items: [{ quote: 'Great.', author: 'Rana' }] },
    });
    expect(kernel.validate()).toEqual([]);

    // Slot law holds through the real vocabulary: a third action is rejected,
    // and features inside hero actions are rejected.
    kernel.dispatch('insertNode', { type: 'cta', parentId: heroId, slot: 'actions' });
    expect(() =>
      kernel.dispatch('insertNode', { type: 'cta', parentId: heroId, slot: 'actions' }),
    ).toThrow(/at most 2/);
    expect(() =>
      kernel.dispatch('insertNode', { type: 'features', parentId: heroId, slot: 'actions' }),
    ).toThrow(/accepts \[cta\]/);
  });

  it('renders a marketing document end-to-end through the registered renderers', async () => {
    const { DocumentView } = await import('@craftkit/builder-renderer');
    const kernel = marketingKernel();
    const heroId = insertedNodeId(
      kernel.dispatch('insertNode', {
        type: 'hero',
        parentId: 'root',
        props: { heading: 'مرحبا بالعالم' },
      }).patches,
    );
    if (heroId === undefined) {
      throw new Error('hero insert failed');
    }
    kernel.dispatch('insertNode', {
      type: 'cta',
      parentId: heroId,
      slot: 'actions',
      props: { label: 'ابدأ الآن' },
    });

    render(<DocumentView kernel={kernel} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('مرحبا بالعالم');
    expect(screen.getByRole('button', { name: 'ابدأ الآن' })).toBeInTheDocument();
  });
});
