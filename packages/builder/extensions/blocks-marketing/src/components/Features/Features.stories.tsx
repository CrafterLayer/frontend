import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { featuresExamples } from './examples';
import { Features } from './Features';
import { featuresSchema } from './schema';

const node: Node = { id: 'features-story', type: 'features', props: {} };
const exampleProps = (index: number) =>
  featuresSchema.props.parse((featuresExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Features',
  component: Features,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Features>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoColumns: Story = {
  args: { node, props: exampleProps(1), slots: {}, data: {}, isCanvas: false },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
};

export const Empty: Story = {
  args: { node, props: featuresSchema.props.parse({}), slots: {}, data: {}, isCanvas: false },
};

const proofItems = [
  { title: 'Fast', body: 'Pages respond immediately.' },
  { title: 'Safe', body: 'Contracts guard every boundary.' },
  { title: 'Clear', body: 'Controls say exactly what they change.' },
  { title: 'Flexible', body: 'Layouts adapt to the content.' },
];

const proofProps = (overrides: Record<string, unknown>) =>
  featuresSchema.props.parse({ heading: 'Feature controls', items: proofItems, ...overrides });

const proofElement = (canvasElement: HTMLElement, testId: string, selector: string) => {
  const element = within(canvasElement).getByTestId(testId).querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`Missing ${selector} in ${testId}`);
  }
  return element;
};

export const ControlRenderingContract: Story = {
  args: TwoColumns.args,
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div style={{ display: 'grid', gap: '2rem', inlineSize: '100%' }}>
      <div data-testid="features-body-absent">
        <Features
          node={{ ...node, id: 'features-body-absent' }}
          props={proofProps({ heading: 'Supporting copy absent' })}
          slots={{}}
          data={{}}
          isCanvas={false}
        />
      </div>
      <div data-testid="features-body-present">
        <Features
          node={{ ...node, id: 'features-body-present' }}
          props={proofProps({
            body: 'Everything the team needs.',
            heading: 'Supporting copy present',
          })}
          slots={{}}
          data={{}}
          isCanvas={false}
        />
      </div>
      {(['start', 'center', 'end'] as const).map((align) => (
        <div key={align} data-testid={`features-align-${align}`}>
          <Features
            node={{ ...node, id: `features-align-${align}` }}
            props={proofProps({ align, heading: `Alignment ${align}` })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['transparent', 'light', 'dark'] as const).map((tone) => (
        <div key={tone} data-testid={`features-tone-${tone}`}>
          <Features
            node={{ ...node, id: `features-tone-${tone}` }}
            props={proofProps({ heading: `Tone ${tone}`, tone })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['none', 'sm', 'md', 'lg'] as const).map((spacing) => (
        <div key={spacing} data-testid={`features-spacing-${spacing}`}>
          <Features
            node={{ ...node, id: `features-spacing-${spacing}` }}
            props={proofProps({ heading: `Spacing ${spacing}`, spacing })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['narrow', 'standard', 'wide', 'full'] as const).map((width) => (
        <div key={width} data-testid={`features-width-${width}`}>
          <Features
            node={{ ...node, id: `features-width-${width}` }}
            props={proofProps({ heading: `Width ${width}`, width })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['1', '2', '3', '4'] as const).map((columns) => (
        <div key={columns} data-testid={`features-columns-${columns}`}>
          <Features
            node={{ ...node, id: `features-columns-${columns}` }}
            props={proofProps({ columns, heading: `Columns ${columns}`, width: 'full' })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    await step('supporting copy paints and changes measured content', async () => {
      const absent = proofElement(canvasElement, 'features-body-absent', '.mkt-features__content');
      const present = proofElement(
        canvasElement,
        'features-body-present',
        '.mkt-features__content',
      );
      const body = proofElement(canvasElement, 'features-body-present', '.mkt-features__intro');
      await expect(body.getBoundingClientRect().height).toBeGreaterThan(0);
      await expect(present.getBoundingClientRect().height).toBeGreaterThan(
        absent.getBoundingClientRect().height,
      );
    });

    await step('alignment and tone resolve to distinct painted values', async () => {
      const alignments = (['start', 'center', 'end'] as const).map(
        (align) =>
          getComputedStyle(
            proofElement(canvasElement, `features-align-${align}`, '.mkt-features__content'),
          ).textAlign,
      );
      await expect(alignments).toEqual(['start', 'center', 'end']);
      const tones = (['transparent', 'light', 'dark'] as const).map((tone) =>
        getComputedStyle(proofElement(canvasElement, `features-tone-${tone}`, 'section')),
      );
      await expect(new Set(tones.map((style) => style.backgroundColor)).size).toBe(3);
      await expect(tones[1]?.color).not.toBe(tones[2]?.color);
    });

    await step('spacing resolves every scale member and preserves the legacy default', async () => {
      const paddings = (['none', 'sm', 'md', 'lg'] as const).map((spacing) =>
        Number.parseFloat(
          getComputedStyle(proofElement(canvasElement, `features-spacing-${spacing}`, 'section'))
            .paddingBlockStart,
        ),
      );
      await expect(paddings).toEqual([0, 16, 32, 64]);
    });

    await step('width changes the content box while the painted surface remains full', async () => {
      const roots = (['narrow', 'standard', 'wide', 'full'] as const).map(
        (width) =>
          proofElement(canvasElement, `features-width-${width}`, 'section').getBoundingClientRect()
            .width,
      );
      const contents = (['narrow', 'standard', 'wide', 'full'] as const).map(
        (width) =>
          proofElement(
            canvasElement,
            `features-width-${width}`,
            '.mkt-features__content',
          ).getBoundingClientRect().width,
      );
      await expect(new Set(roots).size).toBe(1);
      await expect(contents[0] ?? 0).toBeLessThan(contents[3] ?? 0);
      const maxWidths = (['narrow', 'standard', 'wide', 'full'] as const).map(
        (width) =>
          getComputedStyle(
            proofElement(canvasElement, `features-width-${width}`, '.mkt-features__content'),
          ).maxInlineSize,
      );
      await expect(new Set(maxWidths).size).toBe(4);
    });

    await step('every column choice changes resolved tracks and measured cards', async () => {
      const grids = (['1', '2', '3', '4'] as const).map((columns) =>
        proofElement(canvasElement, `features-columns-${columns}`, '.mkt-features__grid'),
      );
      const templates = grids.map((grid) => getComputedStyle(grid).gridTemplateColumns);
      await expect(new Set(templates).size).toBe(4);
      const cardWidths = grids.map((grid) => {
        const card = grid.querySelector<HTMLElement>('.mkt-features__card');
        if (card === null) throw new Error('Missing feature card');
        return card.getBoundingClientRect().width;
      });
      await expect(cardWidths[0] ?? 0).toBeGreaterThan(cardWidths[3] ?? 0);
    });
  },
};
