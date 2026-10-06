import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { PricingPlan } from '../PricingPlan/PricingPlan';
import { pricingPlanSchema } from '../PricingPlan/schema';

import { pricingExamples } from './examples';
import { Pricing } from './Pricing';
import { pricingSchema } from './schema';

const node: Node = { id: 'pricing-story', type: 'pricing', props: {} };
const exampleProps = (index: number) =>
  pricingSchema.props.parse((pricingExamples[index]?.node as { props: unknown }).props);

/*
  The plans are CHILDREN, not data.

  This block used to take a `plans` array and render the cards itself, and
  these stories still passed one alongside `slots={{}}` — so after the section
  became a container they rendered an empty grid while every assertion about
  the grid went on passing. The composed shape is the thing under test now, so
  the stories build it: a `pricingPlan` node per column, exactly as a document
  holds them.
*/
const planSpecs = [
  { name: 'Starter', price: '$9', period: 'month' as const },
  { name: 'Professional', price: '$29', period: 'month' as const, emphasis: 'featured' as const },
  { name: 'Business', price: '$79', period: 'month' as const },
  { name: 'Enterprise', price: 'Custom', period: 'year' as const },
];

const planSlot = (count = planSpecs.length) => ({
  default: planSpecs
    .slice(0, count)
    .map((spec) => (
      <PricingPlan
        key={spec.name}
        node={{ id: `plan-${spec.name}`, type: 'pricingPlan', props: {} }}
        props={pricingPlanSchema.props.parse(spec)}
        slots={{}}
        data={{}}
        isCanvas={false}
      />
    )),
});

const meta = {
  title: 'Builder/Blocks/Pricing',
  component: Pricing,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Pricing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoPlans: Story = {
  args: { node, props: exampleProps(1), slots: planSlot(2), data: {}, isCanvas: false },
};

export const ArabicRtlHighlighted: Story = {
  globals: { direction: 'rtl' },
  args: { node, props: exampleProps(0), slots: planSlot(3), data: {}, isCanvas: false },
};

export const Empty: Story = {
  args: { node, props: pricingSchema.props.parse({}), slots: {}, data: {}, isCanvas: false },
};

const proofProps = (overrides: Record<string, unknown>) =>
  pricingSchema.props.parse({ heading: 'Pricing controls', ...overrides });

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
          slots={planSlot()}
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
          slots={planSlot()}
          data={{}}
          isCanvas={false}
        />
      </div>
      {(['start', 'center', 'end'] as const).map((align) => (
        <div key={align} data-testid={`pricing-align-${align}`}>
          <Pricing
            node={{ ...node, id: `pricing-align-${align}` }}
            props={proofProps({ align, heading: `Alignment ${align}` })}
            slots={planSlot()}
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
            slots={planSlot()}
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
            slots={planSlot()}
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
            slots={planSlot()}
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
            slots={planSlot()}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    await step('supporting copy paints and changes measured content', async () => {
      const absent = proofElement(
        canvasElement,
        'pricing-body-absent',
        '[data-mkt-part="content"]',
      );
      const present = proofElement(
        canvasElement,
        'pricing-body-present',
        '[data-mkt-part="content"]',
      );
      const body = proofElement(canvasElement, 'pricing-body-present', '[data-mkt-part="intro"]');
      await expect(body.getBoundingClientRect().height).toBeGreaterThan(0);
      await expect(present.getBoundingClientRect().height).toBeGreaterThan(
        absent.getBoundingClientRect().height,
      );
    });

    await step('alignment and tone resolve to distinct painted values', async () => {
      const alignments = (['start', 'center', 'end'] as const).map(
        (align) =>
          getComputedStyle(
            proofElement(canvasElement, `pricing-align-${align}`, '[data-mkt-part="content"]'),
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
            '[data-mkt-part="content"]',
          ).getBoundingClientRect().width,
      );
      await expect(new Set(roots).size).toBe(1);
      await expect(contents[0] ?? 0).toBeLessThan(contents[3] ?? 0);
      const maxWidths = (['narrow', 'standard', 'wide', 'full'] as const).map(
        (width) =>
          getComputedStyle(
            proofElement(canvasElement, `pricing-width-${width}`, '[data-mkt-part="content"]'),
          ).maxInlineSize,
      );
      await expect(new Set(maxWidths).size).toBe(4);
    });

    await step(
      'two and four columns resolve distinct tracks and measured plan widths',
      async () => {
        const grids = (['auto', '2', '3', '4'] as const).map((columns) =>
          proofElement(canvasElement, `pricing-columns-${columns}`, '[data-mkt-part="grid"]'),
        );
        const templates = grids.map((grid) => getComputedStyle(grid).gridTemplateColumns);
        await expect(new Set(templates).size).toBe(4);
        const planWidths = grids.map((grid) => {
          const plan = grid.querySelector<HTMLElement>('[data-mkt-part="plan"]');
          if (plan === null) throw new Error('Missing pricing plan');
          return plan.getBoundingClientRect().width;
        });
        await expect(planWidths[1] ?? 0).toBeGreaterThan(planWidths[3] ?? 0);
      },
    );
  },
};

/**
 * Block parts on the canvas: every inner element carries its part address
 * (`data-ck-part` / `data-ck-bind`), which the canvas hit test, the outline,
 * the quick bar and inline editing read. A published render carries none.
 */
export const Parts: Story = {
  args: {
    node: { id: 'pricing-parts', type: 'pricing', props: {} },
    props: pricingSchema.props.parse({
      heading: 'Simple pricing.',
      body: 'Pick the plan that fits.',
    }),
    slots: { default: <article className="rounded-xl border p-6">Plan</article> },
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ck-part="heading"]')).toHaveAttribute(
      'data-ck-bind',
      'heading',
    );
  },
};
