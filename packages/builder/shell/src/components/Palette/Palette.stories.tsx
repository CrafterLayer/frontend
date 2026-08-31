import { expect, userEvent, waitFor, within } from 'storybook/test';
import { z } from 'zod';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type BuilderDocument,
  type DeclarativeExtensionManifest,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { Palette } from './Palette';

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
  name: 'palette-story-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', 'The page root.', {
        default: { allow: ['hero', 'section', 'columns', 'grid', 'features', 'cta'] },
      }),
      block('section', 'A structural page section.', { default: { allow: ['text', 'image'] } }),
      block('columns', 'A flexible multi-column layout.'),
      block('grid', 'A repeated grid layout.'),
      block('text', 'A paragraph of editable text.'),
      block('image', 'A responsive image.'),
      block('hero', 'A lead section with a headline, action, and media.'),
      block('features', 'A grid of product feature cards.'),
      block('cta', 'A focused call to action.'),
    ],
  },
};

const doc = (dir: 'ltr' | 'rtl'): BuilderDocument => ({
  schemaVersion: 1,
  surface: 'site',
  dir,
  rootId: 'root',
  nodes: { root: { id: 'root', type: 'page', props: {}, slots: { default: [] } } },
});

const TEMPLATE_FIXTURE: DeclarativeExtensionManifest = {
  tier: 2,
  name: 'palette-story-templates',
  version: '1.0.0',
  contributes: {
    compositions: [
      {
        id: 'starter-landing-page',
        name: 'Starter landing page',
        version: 1,
        surfaces: ['site'],
        rootId: 'starter-hero',
        nodes: { 'starter-hero': { id: 'starter-hero', type: 'hero', props: {} } },
      },
    ],
  },
};

const makeKernel = (dir: 'ltr' | 'rtl' = 'ltr') => {
  const kernel = createBuilder({
    document: doc(dir),
    extensions: [VOCAB],
    ports: { clock: fixedClock(), ids: seededIds('ps') },
  });
  kernel.extensions.hydrateDeclarative(TEMPLATE_FIXTURE);
  return kernel;
};

const meta = {
  title: 'Builder/Shell/Palette',
  component: Palette,
  decorators: [
    (Story) => (
      <div className="bldr-root">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Palette>;
export default meta;

type Story = StoryObj<typeof meta>;

interface ResolvedAccentColors {
  readonly accent: string;
  readonly soft: string;
}

function resolveAccentColors(themeRoot: HTMLElement): ResolvedAccentColors {
  const view = themeRoot.ownerDocument.defaultView;
  if (view === null) {
    throw new Error('The palette theme has no rendering window');
  }

  const probe = themeRoot.ownerDocument.createElement('span');
  probe.style.backgroundColor = 'var(--bldr-accent-soft)';
  probe.style.color = 'var(--bldr-accent)';
  themeRoot.append(probe);
  const painted = view.getComputedStyle(probe);
  const resolved = { accent: painted.color, soft: painted.backgroundColor };
  probe.remove();
  return resolved;
}

export const Default: Story = {
  name: 'Grouped default',
  args: { kernel: makeKernel() },
};

export const SearchMatches: Story = {
  args: { kernel: makeKernel() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole('searchbox', { name: 'Search blocks' });
    await userEvent.clear(search);
    await userEvent.type(search, 'hero');
    await expect(canvas.getByRole('button', { name: 'Hero' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Grid' })).not.toBeInTheDocument();
  },
};

export const SearchMatchesNothing: Story = {
  args: { kernel: makeKernel() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole('searchbox', { name: 'Search blocks' });
    await userEvent.clear(search);
    await userEvent.type(search, 'carousel');
    await expect(canvas.getByText('No blocks found. Try another block name.')).toBeVisible();
  },
};

export const CollapsedGroup: Story = {
  args: { kernel: makeKernel() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const layout = canvas.getByRole('button', { name: 'Layout' });
    if (layout.getAttribute('aria-expanded') === 'true') {
      await userEvent.click(layout);
    }
    await expect(layout).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryByRole('button', { name: 'Page' })).not.toBeInTheDocument();
  },
};

export const RightToLeft: Story = {
  args: { kernel: makeKernel('rtl') },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.ownerDocument.documentElement).toHaveAttribute('dir', 'rtl');
  },
};

export const AccentTileThemeContract: Story = {
  name: 'Accent tile resolves accent tokens in both themes',
  args: { kernel: makeKernel() },
  render: (args) => (
    <>
      <div data-palette-theme="light" data-bldr-theme="light">
        <Palette {...args} />
      </div>
      <div data-palette-theme="dark" data-bldr-theme="dark">
        <Palette {...args} />
      </div>
    </>
  ),
  play: async ({ canvasElement }) => {
    const lightRoot = canvasElement.querySelector<HTMLElement>('[data-palette-theme="light"]');
    const darkRoot = canvasElement.querySelector<HTMLElement>('[data-palette-theme="dark"]');
    if (lightRoot === null || darkRoot === null) {
      throw new Error('Both palette themes must render');
    }

    const lightAccent = resolveAccentColors(lightRoot);
    const darkAccent = resolveAccentColors(darkRoot);

    // Non-vacuous first: a shared fallback cannot satisfy a two-theme contract.
    await expect(lightAccent.soft).not.toBe(darkAccent.soft);
    await expect(lightAccent.accent).not.toBe(darkAccent.accent);
    await expect(lightAccent.soft).not.toBe('rgba(0, 0, 0, 0)');
    await expect(darkAccent.soft).not.toBe('rgba(0, 0, 0, 0)');

    for (const [themeRoot, expected] of [
      [lightRoot, lightAccent],
      [darkRoot, darkAccent],
    ] as const) {
      const tile = themeRoot.querySelector<HTMLElement>('.bldr-palette__tile');
      if (tile === null) {
        throw new Error('The palette accent tile must render');
      }
      const glyph = tile.querySelector<SVGElement>('.bldr-palette__diagram');
      if (glyph === null) {
        throw new Error('The palette accent tile and glyph must render');
      }

      const view = themeRoot.ownerDocument.defaultView;
      if (view === null) {
        throw new Error('The palette theme has no rendering window');
      }

      await expect(view.getComputedStyle(tile).backgroundColor).toBe(expected.soft);
      const paintedGlyph = view.getComputedStyle(glyph);
      await expect(paintedGlyph.color).toBe(expected.accent);
      await expect(paintedGlyph.fill).toBe(expected.accent);
    }
  },
};

const insertKernel = makeKernel();
export const KeyboardInsert: Story = {
  args: { kernel: insertKernel },
  play: async ({ canvasElement }) => {
    // Idempotent: each rerun appends one more hero — we assert GROWTH, not an
    // absolute count.
    const before = insertKernel.getDocument().nodes['root']?.slots?.['default']?.length ?? 0;
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Hero' }));
    await waitFor(async () => {
      const after = insertKernel.getDocument().nodes['root']?.slots?.['default']?.length ?? 0;
      await expect(after).toBe(before + 1);
    });
  },
};

const templateInsertKernel = makeKernel();
export const TemplateInsert: Story = {
  name: 'Atomic template insert',
  args: { kernel: templateInsertKernel },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const before = templateInsertKernel.transactions().length;
    await userEvent.click(canvas.getByRole('tab', { name: /Templates/u }));
    await userEvent.click(canvas.getByRole('button', { name: /Starter landing page/u }));
    await waitFor(async () => {
      await expect(templateInsertKernel.transactions()).toHaveLength(before + 1);
    });
    await expect(templateInsertKernel.validate()).toEqual([]);
  },
};

/**
 * The palette inside a container TALLER and WIDER than its content. A panel
 * that sizes itself is only ever right in one place.
 */
export const FillsItsContainer: Story = {
  args: { kernel: makeKernel() },
  render: (args) => (
    <div
      data-testid="panel-region"
      style={{ background: '#ff00ff', blockSize: '520px', inlineSize: '340px' }}
    >
      <Palette {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    /*
      Measured, because this is what the browser showed and no test did: the
      palette named the left panel's width token and left its block size to
      content, so in a 312px column it drew itself 288px wide and stopped short
      of the bottom — the region's own ground appeared below the last card as a
      band of a different shade. The magenta container makes any gap obvious to
      a human too.
    */
    const region = canvasElement.querySelector('[data-testid="panel-region"]');
    const palette = canvasElement.querySelector('.bldr-palette');
    if (region === null || palette === null) {
      throw new Error('The palette did not render inside its region');
    }
    const regionBox = region.getBoundingClientRect();
    const paletteBox = palette.getBoundingClientRect();

    // Non-vacuous: a zero-sized region would satisfy an equality check.
    await expect(regionBox.height).toBeGreaterThan(400);
    await expect(regionBox.width).toBeGreaterThan(300);

    await expect(Math.round(paletteBox.height)).toBe(Math.round(regionBox.height));
    await expect(Math.round(paletteBox.width)).toBe(Math.round(regionBox.width));

    /*
      And it draws no separator of its own. The shell region that places a panel
      already draws the line between itself and the canvas; measured in the real
      product, this component drew a second one in exactly the same place, so
      the seam was 2px where the design says 1.
    */
    const painted = getComputedStyle(palette);
    await expect(painted.borderInlineStartWidth).toBe('0px');
    await expect(painted.borderInlineEndWidth).toBe('0px');
  },
};

/*
  Its own vocabulary, because the wrap IS the fixture. The shared VOCAB is all
  short single words, so a row of it can never reproduce the defect; `pageHeader`
  titles to "Page Header", which wraps in a rail-width column and makes its row
  taller than the cards beside it.
*/
const WRAPPING_VOCAB: TrustedExtensionManifest = {
  tier: 1,
  name: 'palette-story-wrapping-vocab',
  version: '1.0.0',
  contributes: {
    blocks: [
      block('page', 'The page root.', {
        default: { allow: ['pageHeader', 'hero', 'grid'] },
      }),
      block('pageHeader', 'A masthead with navigation.'),
      block('hero', 'A lead section.'),
      block('grid', 'A repeated grid layout.'),
    ],
  },
};

const wrappingKernel = createBuilder({
  document: doc('ltr'),
  extensions: [WRAPPING_VOCAB],
  ports: { clock: fixedClock(), ids: seededIds('pw') },
});

/**
 * Every card on a row is the same height, including the row that holds a name
 * long enough to wrap. Narrow on purpose: the wrap is the whole point, and a
 * wide container would never produce one.
 */
export const CardsOnARowMatchHeight: Story = {
  args: { kernel: wrappingKernel },
  render: (args) => (
    <div data-testid="narrow-panel" style={{ blockSize: '520px', inlineSize: '288px' }}>
      <Palette {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    /*
      Measured, because this is what the browser showed and no test did: the
      grid stretches each CELL to the tallest card on its row, but the card
      itself kept its own content height and sat short inside that cell. A row
      carrying a wrapped name rendered cells at 102px with 86px cards beside it
      — three cards, two sizes, one row, which reads as a rendering fault.
    */
    const entries = [...canvasElement.querySelectorAll<HTMLElement>('.bldr-palette__entry')];

    // Non-vacuous: without a wrapped label every row is trivially uniform, so
    // this contract would pass on a palette that never exercises it.
    const wrapped = entries.filter((entry) => {
      const name = entry.querySelector<HTMLElement>('.bldr-palette__entry-name');
      if (name === null) {
        throw new Error('Every palette entry must render its name');
      }
      const lineHeight = Number.parseFloat(getComputedStyle(name).lineHeight);
      return name.getBoundingClientRect().height > lineHeight * 1.5;
    });
    await expect(entries.length).toBeGreaterThan(3);
    await expect(wrapped.length).toBeGreaterThan(0);

    // Group by row: same top edge ⇒ same row, whatever the column count is.
    const rows = new Map<number, HTMLElement[]>();
    for (const entry of entries) {
      const top = Math.round(entry.getBoundingClientRect().top);
      rows.set(top, [...(rows.get(top) ?? []), entry]);
    }
    const sharedRows = [...rows.values()].filter((row) => row.length > 1);
    await expect(sharedRows.length).toBeGreaterThan(0);

    for (const row of sharedRows) {
      const heights = row.map((entry) => Math.round(entry.getBoundingClientRect().height));
      await expect(new Set(heights).size).toBe(1);
    }

    // And the card fills the cell it was given, which is what makes that true.
    for (const entry of entries) {
      const cell = entry.parentElement;
      if (cell === null) {
        throw new Error('Every palette entry must sit in a grid cell');
      }
      await expect(Math.round(entry.getBoundingClientRect().height)).toBe(
        Math.round(cell.getBoundingClientRect().height),
      );
    }
  },
};
