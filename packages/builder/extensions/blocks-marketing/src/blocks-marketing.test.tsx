import type { ReactElement } from 'react';

import { render, screen } from '@testing-library/react';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder, insertedNodeId } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { defineBlockSchema, type TrustedExtensionManifest } from '@craftkit/builder-schema';

import { blocksMarketing } from './index';
import { ctaExamples, ctaSchema } from './components/Cta';
import { Features, featuresExamples, featuresSchema } from './components/Features';
import { Hero, heroExamples, heroSchema } from './components/Hero';
import { Pricing, pricingExamples, pricingSchema } from './components/Pricing';
import { RichTextBlock } from './components/RichTextBlock';
import { Testimonials, testimonialsExamples, testimonialsSchema } from './components/Testimonials';

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
  it('scenario 1: the complete professional vocabulary is discoverable with model-facing descriptions and examples', () => {
    const kernel = marketingKernel();
    const professionalTypes = [
      'announcementBar',
      'promoBanner',
      'hero',
      'carousel',
      'videoSection',
      'gallery',
      'logoCloud',
      'features',
      'bento-grid',
      'content-section',
      'stats',
      'processSteps',
      'team',
      'portfolioGrid',
      'productGrid',
      'pricing',
      'testimonials',
      'comparisonTable',
      'faq',
      'blogGrid',
      'contact',
      'formSection',
      'newsletter',
      'cta',
    ];
    for (const type of professionalTypes) {
      const entry = kernel.context.registry.block(type);
      expect(entry, type).toBeDefined();
      expect(entry?.schema.description.length ?? 0).toBeGreaterThan(20);
      expect(entry?.schema.examples.length ?? 0).toBeGreaterThan(0);
    }
    expect(kernel.context.registry.blocks('site').length).toBeGreaterThanOrEqual(32);
  });

  it('every registered model-facing example parses through its live block contract', () => {
    const kernel = marketingKernel();

    for (const entry of kernel.context.registry.blocks('site')) {
      for (const example of entry.schema.examples) {
        const exampleNode = example.node as { props?: unknown; type?: unknown };
        expect(exampleNode.type, `${entry.schema.type}: ${example.prompt}`).toBe(entry.schema.type);
        expect(
          entry.schema.props.safeParse(exampleNode.props ?? {}).success,
          `${entry.schema.type}: ${example.prompt}`,
        ).toBe(true);
      }
    }
  });

  it('model-facing examples parse and exercise every expanded control', () => {
    const contracts = [
      {
        type: 'hero',
        schema: heroSchema,
        examples: heroExamples,
        keys: [
          'eyebrow',
          'align',
          'tone',
          'spacing',
          'width',
          'layoutDirection',
          'layoutJustify',
          'layoutAlign',
          'layoutGap',
          'layoutWrap',
        ],
      },
      {
        type: 'features',
        schema: featuresSchema,
        examples: featuresExamples,
        keys: ['body', 'align', 'tone', 'spacing', 'width', 'columns'],
      },
      {
        type: 'pricing',
        schema: pricingSchema,
        examples: pricingExamples,
        keys: ['body', 'align', 'tone', 'spacing', 'width', 'columns'],
      },
      {
        type: 'testimonials',
        schema: testimonialsSchema,
        examples: testimonialsExamples,
        keys: ['body', 'align', 'tone', 'spacing', 'width', 'columns'],
      },
      {
        type: 'cta',
        schema: ctaSchema,
        examples: ctaExamples,
        keys: ['size', 'width'],
      },
    ] as const;

    for (const contract of contracts) {
      const exercised = new Set<string>();
      for (const example of contract.examples) {
        const props = (example.node as { props?: unknown }).props;
        expect(
          contract.schema.props.safeParse(props).success,
          `${contract.type}: ${example.prompt}`,
        ).toBe(true);
        if (typeof props === 'object' && props !== null) {
          for (const key of Object.keys(props)) {
            exercised.add(key);
          }
        }
      }
      for (const key of contract.keys) {
        expect(exercised.has(key), `${contract.type}.${key}`).toBe(true);
      }
    }
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
    ).toThrow(/accepts \[cta, button\]/);
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

describe('B3c — inline editing readiness (009 §12)', () => {
  it('every block declares the property that IS its visible text', () => {
    const kernel = marketingKernel();
    const declared = Object.fromEntries(
      kernel.context.registry
        .blocks()
        .map((entry) => [entry.schema.type, entry.schema.inlineEditable]),
    );
    // Declaring this is what makes a block editable on the canvas at all. A
    // block that renders text and declares nothing is inert to the gesture.
    expect(declared).toMatchObject({
      hero: 'heading',
      features: 'heading',
      pricing: 'heading',
      testimonials: 'heading',
      richText: 'content',
    });
    // The CTA's label is the CONTENT OF A BUTTON, and a button is not a text
    // container — Chromium will not place a caret inside one. Declaring it
    // would ship a gesture that silently does nothing, so it stays an
    // inspector property.
    expect(declared['cta']).toBeUndefined();
  });

  it('names sections from the VISIBLE heading, never a second copy of its text', () => {
    // THE DEFECT THIS GUARDS: inline editing swaps the declared property for a
    // React element. A section that named itself `aria-label={props.heading}`
    // would then announce "[object Object]" the moment the editor opened —
    // invisible in every test that only edits through the inspector.
    const namedByItsHeading = (element: ReactElement, nodeId: string, heading: string) => {
      const { container, unmount } = render(element);
      const section = container.querySelector('section');
      expect(section?.getAttribute('aria-label')).toBeNull();
      expect(section?.getAttribute('aria-labelledby')).toBe(`${nodeId}-heading`);
      expect(container.querySelector(`#${nodeId}-heading`)?.textContent).toBe(heading);
      unmount();
    };
    const node = (id: string, type: string) => ({ id, type, props: {} });
    const inert = { data: {}, isCanvas: false } as const;

    namedByItsHeading(
      <Hero
        node={node('n-hero', 'hero')}
        props={heroSchema.props.parse({ tone: 'light', align: 'center', heading: 'Named hero' })}
        slots={{}}
        {...inert}
      />,
      'n-hero',
      'Named hero',
    );
    namedByItsHeading(
      <Features
        node={node('n-features', 'features')}
        props={featuresSchema.props.parse({ heading: 'Named features', columns: '3', items: [] })}
        slots={{}}
        {...inert}
      />,
      'n-features',
      'Named features',
    );
    namedByItsHeading(
      <Pricing
        node={node('n-pricing', 'pricing')}
        props={pricingSchema.props.parse({ heading: 'Named pricing', plans: [] })}
        slots={{}}
        {...inert}
      />,
      'n-pricing',
      'Named pricing',
    );
    namedByItsHeading(
      <Testimonials
        node={node('n-quotes', 'testimonials')}
        props={testimonialsSchema.props.parse({
          heading: 'Named quotes',
          // One with a role and one without: the naming fixture doubles as the
          // cover for the optional-role branch.
          items: [
            { quote: 'q', author: 'a', role: 'CTO' },
            { quote: 'q2', author: 'b' },
          ],
        })}
        slots={{}}
        {...inert}
      />,
      'n-quotes',
      'Named quotes',
    );
  });

  it('renders the EDITOR itself when the declared prop is an element (rich text)', () => {
    const inert = { data: {}, isCanvas: false } as const;
    // RichTextBlock passes its declared property to a component rather than
    // rendering it, so the seam's element would never reach the DOM without
    // this branch — the editor would open into nothing.
    const { container } = render(
      <RichTextBlock
        node={{ id: 'n-rich', type: 'richText', props: {} }}
        props={{ content: <mark data-testid="the-editor">editing</mark> }}
        slots={{}}
        {...inert}
      />,
    );
    expect(container.querySelector('[data-testid="the-editor"]')?.textContent).toBe('editing');
  });
});
