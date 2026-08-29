import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { pricingExamples } from './examples';
import { Pricing } from './Pricing';
import { pricingSchema } from './schema';

const node: Node = { id: 'pricing-story', type: 'pricing', props: {} };
const exampleProps = (index: number) =>
  pricingSchema.props.parse((pricingExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Pricing',
  component: Pricing,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Pricing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoPlans: Story = {
  args: { node, props: exampleProps(1), slots: {}, data: {}, isCanvas: false },
};

export const ArabicRtlHighlighted: Story = {
  globals: { direction: 'rtl' },
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
};

export const Empty: Story = {
  args: { node, props: pricingSchema.props.parse({}), slots: {}, data: {}, isCanvas: false },
};

const proofPlans = [
  {
    name: 'Starter',
    price: '$9',
    period: 'month' as const,
    features: ['One project', 'Email support'],
  },
  {
    name: 'Professional',
    price: '$29',
    period: 'month' as const,
    features: ['Unlimited projects', 'Priority support'],
    highlighted: true,
  },
  {
    name: 'Business',
    price: '$79',
    period: 'month' as const,
    features: ['Team workspaces', 'Priority support'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'year' as const,
    features: ['Custom terms', 'Dedicated support'],
  },
];

const proofProps = (overrides: Record<string, unknown>) =>
  pricingSchema.props.parse({ heading: 'Pricing controls', plans: proofPlans, ...overrides });

const proofElement = (canvasElement: HTMLElement, testId: string, selector: string) => {
  const element = within(canvasElement).getByTestId(testId).querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`Missing ${selector} in ${testId}`);
  }
  return element;
};

export const ControlRenderingContract: Story = {
  args: TwoPlans.args,
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div style={{ display: 'grid', gap: '2rem', inlineSize: '100%' }}>
      <div data-testid="pricing-body-absent">
        <Pricing
          node={{ ...node, id: 'pricing-body-absent' }}
          props={proofProps({ heading: 'Supporting copy absent' })}
          slots={{}}
          data={{}}
          isCanvas={false}
        />
      </div>
      <div data-testid="pricing-body-present">
        <Pricing
          node={{ ...node, id: 'pricing-body-present' }}
          props={proofProps({
            body: 'Choose what fits today.',
            heading: 'Supporting copy present',
          })}
          slots={{}}
          data={{}}
          isCanvas={false}
        />
      </div>
      {(['start', 'center', 'end'] as const).map((align) => (
        <div key={align} data-testid={`pricing-align-${align}`}>
          <Pricing
            node={{ ...node, id: `pricing-align-${align}` }}
            props={proofProps({ align, heading: `Alignment ${align}` })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['transparent', 'light', 'dark'] as const).map((tone) => (
        <div key={tone} data-testid={`pricing-tone-${tone}`}>
          <Pricing
            node={{ ...node, id: `pricing-tone-${tone}` }}
            props={proofProps({ heading: `Tone ${tone}`, tone })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['none', 'sm', 'md', 'lg'] as const).map((spacing) => (
        <div key={spacing} data-testid={`pricing-spacing-${spacing}`}>
          <Pricing
            node={{ ...node, id: `pricing-spacing-${spacing}` }}
            props={proofProps({ heading: `Spacing ${spacing}`, spacing })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['narrow', 'standard', 'wide', 'full'] as const).map((width) => (
        <div key={width} data-testid={`pricing-width-${width}`}>
          <Pricing
            node={{ ...node, id: `pricing-width-${width}` }}
            props={proofProps({ heading: `Width ${width}`, width })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['auto', '2', '3', '4'] as const).map((columns) => (
        <div key={columns} data-testid={`pricing-columns-${columns}`}>
          <Pricing
            node={{ ...node, id: `pricing-columns-${columns}` }}
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
      const absent = proofElement(canvasElement, 'pricing-body-absent', '.mkt-pricing__content');
      const present = proofElement(canvasElement, 'pricing-body-present', '.mkt-pricing__content');
      const body = proofElement(canvasElement, 'pricing-body-present', '.mkt-pricing__intro');
      await expect(body.getBoundingClientRect().height).toBeGreaterThan(0);
      await expect(present.getBoundingClientRect().height).toBeGreaterThan(
        absent.getBoundingClientRect().height,
      );
    });

    await step('alignment and tone resolve to distinct painted values', async () => {
      const alignments = (['start', 'center', 'end'] as const).map(
        (align) =>
          getComputedStyle(
            proofElement(canvasElement, `pricing-align-${align}`, '.mkt-pricing__content'),
          ).textAlign,
      );
      await expect(alignments).toEqual(['start', 'center', 'end']);
      const tones = (['transparent', 'light', 'dark'] as const).map((tone) =>
        getComputedStyle(proofElement(canvasElement, `pricing-tone-${tone}`, 'section')),
      );
      await expect(new Set(tones.map((style) => style.backgroundColor)).size).toBe(3);
      await expect(tones[1]?.color).not.toBe(tones[2]?.color);
    });

    await step('spacing resolves every scale member and preserves the legacy default', async () => {
      const paddings = (['none', 'sm', 'md', 'lg'] as const).map((spacing) =>
        Number.parseFloat(
          getComputedStyle(proofElement(canvasElement, `pricing-spacing-${spacing}`, 'section'))
            .paddingBlockStart,
        ),
      );
      await expect(paddings).toEqual([0, 16, 32, 64]);
    });

    await step('width changes the content box while the painted surface remains full', async () => {
      const roots = (['narrow', 'standard', 'wide', 'full'] as const).map(
        (width) =>
          proofElement(canvasElement, `pricing-width-${width}`, 'section').getBoundingClientRect()
            .width,
      );
      const contents = (['narrow', 'standard', 'wide', 'full'] as const).map(
        (width) =>
          proofElement(
            canvasElement,
            `pricing-width-${width}`,
            '.mkt-pricing__content',
          ).getBoundingClientRect().width,
      );
      await expect(new Set(roots).size).toBe(1);
      await expect(contents[0] ?? 0).toBeLessThan(contents[3] ?? 0);
      const maxWidths = (['narrow', 'standard', 'wide', 'full'] as const).map(
        (width) =>
          getComputedStyle(
            proofElement(canvasElement, `pricing-width-${width}`, '.mkt-pricing__content'),
          ).maxInlineSize,
      );
      await expect(new Set(maxWidths).size).toBe(4);
    });

    await step(
      'two and four columns resolve distinct tracks and measured plan widths',
      async () => {
        const grids = (['auto', '2', '3', '4'] as const).map((columns) =>
          proofElement(canvasElement, `pricing-columns-${columns}`, '.mkt-pricing__grid'),
        );
        const templates = grids.map((grid) => getComputedStyle(grid).gridTemplateColumns);
        await expect(new Set(templates).size).toBe(4);
        const planWidths = grids.map((grid) => {
          const plan = grid.querySelector<HTMLElement>('.mkt-pricing__plan');
          if (plan === null) throw new Error('Missing pricing plan');
          return plan.getBoundingClientRect().width;
        });
        await expect(planWidths[1] ?? 0).toBeGreaterThan(planWidths[3] ?? 0);
      },
    );
  },
};
