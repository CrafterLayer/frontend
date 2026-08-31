import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Cta } from './Cta';
import { ctaSchema } from './schema';

const node: Node = { id: 'cta-story', type: 'cta', props: {} };

const meta = {
  title: 'Builder/Blocks/Cta',
  component: Cta,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Cta>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    node,
    props: ctaSchema.props.parse({ label: 'Get started', emphasis: 'primary' }),
    slots: {},
    data: {},
    isCanvas: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Get started' })).toBeEnabled();
  },
};

export const GhostWithNote: Story = {
  args: {
    ...Primary.args,
    props: ctaSchema.props.parse({
      label: 'Learn more',
      emphasis: 'ghost',
      note: 'Free 14-day trial',
    }),
  },
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    ...Primary.args,
    props: ctaSchema.props.parse({
      label: 'تسوّق الآن',
      emphasis: 'primary',
      note: 'شحن مجاني فوق ١٠٠',
    }),
  },
};

const proofElement = (canvasElement: HTMLElement, testId: string, selector: string) => {
  const element = within(canvasElement).getByTestId(testId).querySelector<HTMLElement>(selector);
  if (element === null) {
    throw new Error(`Missing ${selector} in ${testId}`);
  }
  return element;
};

export const ControlRenderingContract: Story = {
  args: Primary.args,
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div style={{ display: 'grid', gap: '2rem', inlineSize: '100%', padding: '2rem' }}>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} data-testid={`cta-size-${size}`}>
          <Cta
            node={{ ...node, id: `cta-size-${size}` }}
            props={ctaSchema.props.parse({ label: 'Same label', size, width: 'fit' })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
      {(['fit', 'full'] as const).map((width) => (
        <div key={width} data-testid={`cta-width-${width}`} style={{ inlineSize: '100%' }}>
          <Cta
            node={{ ...node, id: `cta-width-${width}` }}
            props={ctaSchema.props.parse({ label: 'Same label', size: 'md', width })}
            slots={{}}
            data={{}}
            isCanvas={false}
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement, step }) => {
    await step('size changes resolved padding and measured button height', async () => {
      const buttons = (['sm', 'md', 'lg'] as const).map((size) =>
        proofElement(canvasElement, `cta-size-${size}`, 'button'),
      );
      const heights = buttons.map((button) => button.getBoundingClientRect().height);
      await expect(heights[0] ?? 0).toBeLessThan(heights[1] ?? 0);
      await expect(heights[1] ?? 0).toBeLessThan(heights[2] ?? 0);
      const paddings = buttons.map((button) =>
        Number.parseFloat(getComputedStyle(button).paddingBlockStart),
      );
      await expect(paddings).toEqual([8, 10, 14]);
      const medium = buttons[1];
      if (medium === undefined) throw new Error('Missing medium CTA');
      await expect(getComputedStyle(medium).paddingInlineStart).toBe('20px');
    });

    await step('full width paints wider than fit inside the same available width', async () => {
      const fit = proofElement(canvasElement, 'cta-width-fit', 'button');
      const full = proofElement(canvasElement, 'cta-width-full', 'button');
      await expect(full.getBoundingClientRect().width).toBeGreaterThan(
        fit.getBoundingClientRect().width,
      );
      await expect(full.getBoundingClientRect().width).toBe(
        proofElement(canvasElement, 'cta-width-full', '[data-cta-root]').getBoundingClientRect()
          .width,
      );
    });
  },
};
