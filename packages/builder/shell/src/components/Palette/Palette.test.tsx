import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { Palette } from './Palette';
import { PALETTE_LABELS_AR } from './Palette.labels';

const NullRender: BlockRenderComponent = () => null;
const block = (type: string, label: string, slots?: Record<string, { allow: string[] }>) => ({
  schema: defineBlockSchema({
    type,
    description: label,
    props: z.object({}),
    ...(slots === undefined ? {} : { slots }),
    examples: [],
  }),
  render: NullRender,
});

const VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'palette-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', 'Page', { default: { allow: ['section'] } }),
      block('section', 'Section', { default: { allow: ['text'] } }),
      block('text', 'Text'),
    ],
  },
};

const DOC: BuilderDocument = {
  schemaVersion: 1,
  surface: 'site',
  dir: 'ltr',
  rootId: 'root',
  nodes: {
    root: { id: 'root', type: 'page', props: {}, slots: { default: ['s1'] } },
    s1: { id: 's1', type: 'section', props: {}, slots: { default: ['t1'] } },
    t1: { id: 't1', type: 'text', props: {} },
  },
};

const makeKernel = () =>
  createBuilder({
    document: DOC,
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('pl') },
  });

describe('a tile is named, never described', () => {
  /*
    The regression this pins: `blockName` fell back to the schema's
    `description` for any type not in its map, so the first block anyone added
    rendered a full sentence inside a tile and shoved the column apart. The
    description here is deliberately a real one — long, with punctuation — so
    the assertion cannot pass by the fixture being a single word.
  */
  const SENTENCE =
    'A pane split in two, with a media panel on one side and a column of prose on the other.';

  /*
    Deliberately a type NOT in `KNOWN_BLOCK_NAMES` — the map is the early
    return, so a listed type would exercise the map and prove nothing about the
    fallback this test exists to pin.
  */
  const UNLISTED_TYPE = 'splitPanel';

  const UNLISTED: TrustedExtensionManifest = {
    tier: 1,
    name: 'palette-unlisted',
    version: '1.0.0',
    contributes: {
      blocks: [
        block('page', 'Page', { default: { allow: [UNLISTED_TYPE] } }),
        block(UNLISTED_TYPE, SENTENCE),
      ],
    },
  };

  const kernel = () =>
    createBuilder({
      document: {
        schemaVersion: 1,
        surface: 'site',
        dir: 'ltr',
        rootId: 'root',
        nodes: { root: { id: 'root', type: 'page', props: {}, slots: {} } },
      },
      extensions: [UNLISTED],
      ports: { clock: fixedClock(), ids: seededIds('un') },
    });

  it('titles an unlisted block from its type instead of printing its description', () => {
    render(<Palette kernel={kernel()} />);

    expect(screen.getByText('Split Panel')).toBeInTheDocument();
    expect(screen.queryByText(SENTENCE)).not.toBeInTheDocument();
  });
});

describe('Palette (006 contract §4)', () => {
  it('p1: lists the registered vocabulary with display names, live under runtime changes', () => {
    const kernel = makeKernel();
    render(<Palette kernel={kernel} />);
    expect(screen.getByRole('button', { name: 'Page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Section' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Text' })).toBeInTheDocument();

    act(() => {
      kernel.extensions.register({
        tier: 1,
        name: 'late',
        version: '1.0.0',
        contributes: { blocks: [block('banner', 'Banner')] },
      });
    });
    expect(screen.getByRole('button', { name: 'Banner' })).toBeInTheDocument();

    act(() => {
      kernel.extensions.dispose('late');
    });
    expect(screen.queryByRole('button', { name: 'Banner' })).not.toBeInTheDocument();
  });

  it('filters visible block cards as the author types', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    render(<Palette kernel={kernel} />);

    await user.type(screen.getByRole('searchbox', { name: 'Search blocks' }), 'section');

    expect(screen.getByRole('button', { name: 'Section' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Text' })).not.toBeInTheDocument();
  });

  it('lists registered templates and inserts a complete composition as one undoable change', async () => {
    const kernel = makeKernel();
    kernel.extensions.hydrateDeclarative({
      tier: 2,
      name: 'palette-templates',
      version: '1.0.0',
      contributes: {
        compositions: [
          {
            id: 'saas-launch',
            name: 'SaaS launch',
            version: 1,
            surfaces: ['site'],
            rootId: 'template-section',
            nodes: {
              'template-section': {
                id: 'template-section',
                type: 'section',
                props: {},
                slots: { default: ['template-copy'] },
              },
              'template-copy': { id: 'template-copy', type: 'text', props: {} },
            },
          },
        ],
      },
    });
    const before = structuredClone(kernel.getDocument());
    const user = userEvent.setup();
    render(<Palette kernel={kernel} />);

    await user.click(screen.getByRole('tab', { name: 'Templates 1' }));
    expect(screen.getByRole('searchbox', { name: 'Search templates' })).toBeInTheDocument();
    const templateButton = screen.getByRole('button', { name: /SaaS launch/ });
    expect(templateButton).toHaveTextContent('1 responsive section');
    expect(templateButton.querySelector('.bldr-palette__template-preview')).toHaveAttribute(
      'data-preview-kind',
      'saas',
    );
    await user.click(templateButton);

    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(2);
    expect(kernel.context.store.getState().selection).toEqual(['pl-0001']);
    expect(screen.getByRole('status', { name: 'Palette' })).toHaveTextContent(
      'Inserted template saas-launch',
    );
    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument()).toEqual(before);
  });

  it('collapses one category without hiding the others and exposes its expanded state', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    render(<Palette kernel={kernel} />);

    const layoutToggle = screen.getByRole('button', { name: 'Layout' });
    const layoutRegionId = layoutToggle.getAttribute('aria-controls');
    const layoutRegion = document.getElementById(layoutRegionId ?? '');
    expect(layoutToggle).toHaveAttribute('aria-expanded', 'true');
    expect(layoutRegion).toHaveAttribute('role', 'region');
    expect(layoutRegion).not.toHaveAttribute('hidden');

    await user.click(layoutToggle);

    expect(layoutToggle).toHaveAttribute('aria-expanded', 'false');
    expect(layoutRegion).toHaveAttribute('hidden');
    expect(screen.queryByRole('button', { name: 'Page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Section' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Text' })).toBeInTheDocument();

    await user.click(layoutToggle);
    expect(layoutToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Page' })).toBeInTheDocument();
  });

  it('shows actionable guidance when the search has no matches', async () => {
    const kernel = makeKernel();
    const user = userEvent.setup();
    render(<Palette kernel={kernel} />);

    await user.type(screen.getByRole('searchbox', { name: 'Search blocks' }), 'carousel');

    expect(screen.getByText('No blocks found. Try another block name.')).toBeInTheDocument();
  });

  it('draws each known block family with its semantic miniature', () => {
    const kernel = makeKernel();
    kernel.extensions.register({
      tier: 1,
      name: 'diagram-vocabulary',
      version: '1.0.0',
      contributes: {
        blocks: [
          block('hero', 'Opening section'),
          block('columns', 'Multi-column layout'),
          block('grid', 'Repeated layout'),
          block('pricing', 'Plan comparison'),
          block('testimonials', 'Customer quotes'),
          block('cta', 'Call to action'),
          block('image', 'Responsive media'),
          block('button', 'Button'),
          block('separator', 'Separator'),
          block('avatarGroup', 'Avatar group'),
          block('progress', 'Progress'),
          block('breadcrumbs', 'Breadcrumbs'),
          block('dialog', 'Dialog'),
          block('pagination', 'Pagination'),
          block('card', 'Card'),
          block('badge', 'Badge'),
          block('shadcnAlert', 'Alert'),
          block('tabs', 'Tabs'),
          block('tabPanel', 'Tab panel'),
          block('accordion', 'Accordion'),
          block('accordionItem', 'Accordion item'),
          block('auroraBackground', 'Aurora background'),
          block('cloudShader', 'Cloud shader'),
          block('spotlightSurface', 'Spotlight surface'),
          block('shineBorder', 'Shine border'),
          block('marquee', 'Marquee'),
          block('shimmerButton', 'Shimmer button'),
          block('dotPatternSurface', 'Dot pattern surface'),
          block('table', 'Data table'),
          block('chart', 'Data chart'),
          block('comparisonTable', 'Plan comparison table'),
        ],
      },
    });
    render(<Palette kernel={kernel} />);

    const expectedDiagrams = [
      ['Page', 'section'],
      ['Text', 'text'],
      ['Hero', 'hero'],
      ['Columns', 'columns'],
      ['Grid', 'grid'],
      ['Pricing', 'pricing'],
      ['Testimonials', 'testimonial'],
      ['CTA', 'action'],
      ['Image', 'media'],
      ['Button', 'action'],
      ['Separator', 'section'],
      ['Avatar Group', 'grid'],
      ['Progress', 'action'],
      ['Breadcrumbs', 'columns'],
      ['Dialog', 'action'],
      ['Pagination', 'columns'],
      ['Card', 'section'],
      ['Badge', 'section'],
      ['Alert', 'section'],
      ['Tabs', 'columns'],
      ['Tab Panel', 'section'],
      ['Accordion', 'text'],
      ['Accordion Item', 'text'],
      ['Aurora Background', 'hero'],
      ['Cloud Shader', 'hero'],
      ['Spotlight Surface', 'hero'],
      ['Shine Border', 'section'],
      ['Marquee', 'grid'],
      ['Shimmer Button', 'action'],
      ['Dot Pattern Surface', 'hero'],
      ['Table', 'table'],
      ['Chart', 'chart'],
      // A comparison table keeps its plan-columns miniature, checked before `table`.
      ['Comparison Table', 'pricing'],
    ] as const;

    for (const [name, diagram] of expectedDiagrams) {
      const miniature = screen.getByRole('button', { name }).querySelector('svg[data-diagram]');
      expect(miniature).toHaveAttribute('data-diagram', diagram);
      expect(miniature).not.toHaveAttribute('data-diagram', 'generic');
    }

    const primaryToggle = screen.getByRole('button', { name: 'Primary' });
    const primaryRegion = document.getElementById(
      primaryToggle.getAttribute('aria-controls') ?? '',
    );
    expect(primaryRegion).not.toBeNull();
    for (const name of [
      'Button',
      'Separator',
      'Avatar Group',
      'Progress',
      'Breadcrumbs',
      'Dialog',
      'Pagination',
      'Card',
      'Badge',
      'Alert',
      'Tabs',
      'Tab Panel',
      'Accordion',
      'Accordion Item',
      'Aurora Background',
      'Cloud Shader',
      'Spotlight Surface',
      'Shine Border',
      'Marquee',
      'Shimmer Button',
      'Dot Pattern Surface',
    ]) {
      expect(within(primaryRegion!).getByRole('button', { name })).toBeInTheDocument();
    }

    // Data blocks are content a person writes; the comparison table stays a marketing section.
    const regionOf = (category: string) =>
      document.getElementById(
        screen.getByRole('button', { name: category }).getAttribute('aria-controls') ?? '',
      )!;
    for (const name of ['Table', 'Chart']) {
      expect(within(regionOf('Content')).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(
      within(regionOf('Marketing')).getByRole('button', { name: 'Comparison Table' }),
    ).toBeInTheDocument();
  });

  it('a selected CONTAINER receives the block inside it, not beside it', async () => {
    /*
      Measured in a browser: selecting an empty Grid and pressing a palette tile
      put the block BESIDE the grid. The condition that produces it is precise —
      the PARENT must also accept the type, so the sibling rule fires first and
      wins. With a parent that refuses, the walk-up already lands inside and the
      bug is invisible, which is why this fixture gives BOTH the container and
      its parent the same vocabulary.
    */
    const BOTH_ACCEPT: TrustedExtensionManifest = {
      tier: 1,
      name: 'palette-both-accept',
      version: '1.0.0',
      contributes: {
        blocks: [
          block('page', 'Page', { default: { allow: ['section', 'text'] } }),
          block('section', 'Section', { default: { allow: ['text'] } }),
          block('text', 'Text'),
        ],
      },
    };
    const kernel = createBuilder({
      document: DOC,
      extensions: [BOTH_ACCEPT],
      ports: { clock: fixedClock(), ids: seededIds('into') },
    });
    kernel.setSelection(['s1']);
    const user = userEvent.setup();
    render(<Palette kernel={kernel} />);

    await user.click(screen.getByRole('button', { name: 'Text' }));

    expect(kernel.getDocument().nodes['s1']?.slots?.['default']).toHaveLength(2);
    // And NOT beside it: the page keeps its single child.
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(1);
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('p2: keyboard activation inserts AFTER the selected node when its slot accepts', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['t1']);
    const user = userEvent.setup();
    render(<Palette kernel={kernel} />);

    await user.click(screen.getByRole('button', { name: 'Text' }));
    const children = kernel.getDocument().nodes['s1']?.slots?.['default'];
    expect(children).toHaveLength(2);
    expect(children?.[0]).toBe('t1'); // inserted AFTER the selection
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.context.store.getState().selection).toEqual([children?.[1]]);
    expect(screen.getByRole('status', { name: 'Palette' })).toHaveTextContent('Inserted text');
  });

  it('p2: falls back to the walk-up rule when the sibling slot rejects the type', async () => {
    const kernel = makeKernel();
    kernel.setSelection(['t1']); // t1's slot accepts only text — a SECTION must walk up
    const user = userEvent.setup();
    render(<Palette kernel={kernel} />);

    await user.click(screen.getByRole('button', { name: 'Section' }));
    // s1.default rejects sections too, so it lands appended in root.default.
    expect(kernel.getDocument().nodes['root']?.slots?.['default']).toHaveLength(2);
    expect(kernel.transactions()).toHaveLength(1);
  });

  it('p2: announces and dispatches nothing when no slot accepts the type', async () => {
    const kernel = makeKernel();
    // A vocabulary entry nothing in this document can host:
    act(() => {
      kernel.extensions.register({
        tier: 1,
        name: 'orphan',
        version: '1.0.0',
        contributes: { blocks: [block('widget', 'Widget')] },
      });
    });
    const user = userEvent.setup();
    render(<Palette kernel={kernel} />);
    await user.click(screen.getByRole('button', { name: 'Widget' }));
    expect(kernel.transactions()).toHaveLength(0);
    expect(screen.getByRole('status', { name: 'Palette' })).toHaveTextContent(
      'No slot accepts widget here',
    );
  });

  it('p3: pointerdown hands the payload to the canvas drag handle', () => {
    const kernel = makeKernel();
    const beginInsert = vi.fn();
    render(<Palette kernel={kernel} dragHandle={{ beginInsert }} />);
    const entry = screen.getByRole('button', { name: 'Section' });
    entry.dispatchEvent(new MouseEvent('pointerdown', { clientX: 40, clientY: 50, bubbles: true }));
    expect(beginInsert).toHaveBeenCalledWith('section', 40, 50);
    expect(kernel.transactions()).toHaveLength(0); // the palette dispatched nothing
  });
});

describe('convergence: an aborted drag never becomes a click-insert (US2/AC5)', () => {
  it('suppresses the entry click when the press turned into a REAL drag', async () => {
    const kernel = makeKernel();
    let activated = false;
    render(
      <Palette
        kernel={kernel}
        dragHandle={{
          beginInsert: () => ({ didActivate: () => activated }),
        }}
      />,
    );
    const user = userEvent.setup();
    const entry = screen.getByRole('button', { name: 'Section' });

    // Gesture 1: press → the session ACTIVATED (threshold crossed) → the drag
    // was cancelled elsewhere → the trailing click must insert NOTHING.
    entry.dispatchEvent(new MouseEvent('pointerdown', { clientX: 4, clientY: 5, bubbles: true }));
    activated = true;
    await user.click(entry);
    expect(kernel.transactions()).toHaveLength(0);

    // Gesture 2: a plain click (no activation) still inserts normally.
    entry.dispatchEvent(new MouseEvent('pointerdown', { clientX: 4, clientY: 5, bubbles: true }));
    activated = false;
    await user.click(entry);
    expect(kernel.transactions()).toHaveLength(1);
  });
});

describe('the Arabic palette (arabic-editor)', () => {
  it('speaks Arabic: tabs, groups, block names, search and the insert announcement', async () => {
    const user = userEvent.setup();
    const kernel = makeKernel();
    kernel.setSelection(['s1']);
    render(<Palette kernel={kernel} labels={PALETTE_LABELS_AR} />);

    const palette = screen.getByRole('navigation', { name: 'لوحة الكتل' });
    expect(within(palette).getByRole('tab', { name: 'الكتل' })).toHaveAttribute('aria-selected', 'true');
    expect(within(palette).getByRole('tab', { name: 'القوالب' })).toBeInTheDocument();
    expect(within(palette).getByRole('button', { name: 'التخطيط' })).toBeInTheDocument();
    // Arabic names from the catalogue, not the humanised English type.
    expect(within(palette).getByRole('button', { name: 'نص' })).toBeInTheDocument();
    expect(within(palette).queryByRole('button', { name: 'Text' })).not.toBeInTheDocument();

    // Search finds a block by its Arabic name AND by its English one.
    const search = within(palette).getByRole('searchbox', { name: 'ابحث في الكتل' });
    await user.type(search, 'قسم');
    expect(within(palette).getByRole('button', { name: 'قسم' })).toBeInTheDocument();
    expect(within(palette).queryByRole('button', { name: 'نص' })).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'text');
    expect(within(palette).getByRole('button', { name: 'نص' })).toBeInTheDocument();

    // One transaction, announced in Arabic with the Arabic name.
    const before = kernel.transactions().length;
    await user.click(within(palette).getByRole('button', { name: 'نص' }));
    expect(kernel.transactions()).toHaveLength(before + 1);
    expect(screen.getByRole('status', { name: 'لوحة الكتل' })).toHaveTextContent('أُدرج نص');
  });
});
