import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Dialog } from './Dialog';
import { dialogExamples } from './examples';
import { dialogSchema } from './schema';

const node: Node = { id: 'dialog-story', type: 'dialog', props: {} };
const exampleProps = (index: number) =>
  dialogSchema.props.parse((dialogExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/shadcn/Dialog',
  component: Dialog,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PublishConfirmation: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Publish changes' }));
    await expect(
      canvas.getByRole('dialog', { name: 'Ready to publish this version?' }),
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Close publish dialog' })).toHaveFocus();
  },
};

export const ArabicInverseRtl: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'dialog-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

export const AccentDialog: Story = {
  args: {
    node: { ...node, id: 'dialog-accent' },
    props: dialogSchema.props.parse({
      triggerLabel: 'See launch offer',
      title: 'Three months, on us',
      body: 'Move to the team plan today and invite every collaborator at no extra cost.',
      primaryAction: { label: 'Claim offer', href: '/upgrade' },
      secondaryAction: { label: 'Compare plans', href: '/pricing' },
      tone: 'accent',
      triggerVariant: 'ghost',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};
