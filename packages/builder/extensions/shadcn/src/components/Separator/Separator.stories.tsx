import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Separator } from './Separator';
import { separatorSchema } from './schema';

const node: Node = { id: 'separator-story', type: 'separator', props: {} };

const meta = {
  title: 'Builder/Shadcn/Separator',
  component: Separator,
  parameters: { layout: 'padded' },
  args: {
    node,
    props: separatorSchema.props.parse({}),
    slots: {},
    data: {},
    isCanvas: false,
  },
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {};

export const LabelledAccent: Story = {
  args: {
    props: separatorSchema.props.parse({
      label: 'Next chapter',
      tone: 'accent',
      spacing: 'roomy',
      thickness: 'medium',
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('separator', { name: 'Next chapter' })).toBeVisible();
  },
};

export const ArabicDashed: Story = {
  globals: { direction: 'rtl' },
  args: {
    props: separatorSchema.props.parse({
      label: 'تفاصيل إضافية',
      style: 'dashed',
      tone: 'subtle',
    }),
  },
};

export const Vertical: Story = {
  render: (args) => (
    <div className="flex min-h-48 items-stretch">
      <div className="flex-1 p-4">Primary content</div>
      <Separator
        {...args}
        props={separatorSchema.props.parse({
          label: 'Aside',
          orientation: 'vertical',
          tone: 'accent',
          thickness: 'medium',
        })}
      />
      <div className="flex-1 p-4">Secondary content</div>
    </div>
  ),
};

/**
 * Block parts on the canvas: every inner element carries its part address
 * (`data-ck-part` / `data-ck-bind`), which the canvas hit test, the outline,
 * the quick bar and inline editing read. A published render carries none.
 */
export const Parts: Story = {
  args: {
    node: { id: 'separator-parts', type: 'separator', props: {} },
    props: separatorSchema.props.parse({ label: 'Next chapter' }),
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-ck-part="label"]')).toHaveAttribute(
      'data-ck-bind',
      'label',
    );
  },
};
