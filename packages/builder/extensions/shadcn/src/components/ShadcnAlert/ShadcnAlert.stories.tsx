import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { ShadcnAlert } from './ShadcnAlert';
import { shadcnAlertSchema } from './schema';

const node: Node = { id: 'alert', type: 'shadcnAlert', props: {} };
const body = <p style={{ margin: 0 }}>Read the migration notes before Friday.</p>;

const meta = {
  title: 'Builder/Shadcn/Alert',
  component: ShadcnAlert,
  args: { node, slots: { default: body }, data: {}, isCanvas: false },
} satisfies Meta<typeof ShadcnAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = { args: { props: shadcnAlertSchema.props.parse({}) } };

export const Attention: Story = {
  args: {
    props: shadcnAlertSchema.props.parse({ title: 'Your trial ends soon', variant: 'attention' }),
  },
};

export const Critical: Story = {
  args: {
    props: shadcnAlertSchema.props.parse({ title: 'Payment failed', variant: 'critical' }),
  },
};

/**
 * Severity reaches more than one sense.
 *
 * Upstream separates its two variants by text colour alone, which sends the
 * single most important thing about an alert through the one channel a
 * colour-blind reader does not have.
 */
export const SeverityContract: Story = {
  args: { props: shadcnAlertSchema.props.parse({ variant: 'critical' }) },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('a critical alert announces itself', async () => {
      await expect(canvas.getByRole('alert')).toBeInTheDocument();
    });

    await step('and it is still legible against its own ground', async () => {
      const alert = canvas.getByRole('alert');
      const style = getComputedStyle(alert);
      /*
        Non-vacuous: the failure this catches is a variant that sets a
        background and inherits the page's text colour, which is invisible on
        exactly the surface nobody screenshots.
      */
      await expect(style.backgroundColor).not.toBe(style.color);
      await expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    });
  },
};
