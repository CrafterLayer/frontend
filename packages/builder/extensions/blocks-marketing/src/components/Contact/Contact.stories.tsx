import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { Contact } from './Contact';
import { contactExamples } from './examples';
import { contactSchema } from './schema';

const node: Node = { id: 'contact-story', type: 'contact', props: {} };
const exampleProps = (index: number) =>
  contactSchema.props.parse((contactExamples[index]?.node as { props: unknown }).props);

const meta = {
  title: 'Builder/Blocks/Contact',
  component: Contact,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Contact>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StudioContact: Story = {
  args: { node, props: exampleProps(0), slots: {}, data: {}, isCanvas: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Your name'), 'Sam Rivera');
    await userEvent.type(canvas.getByLabelText('Work email'), 'sam@example.com');
    await userEvent.type(
      canvas.getByLabelText('Project brief'),
      'We need a focused product launch.',
    );
    await expect(canvas.getByLabelText('Your name')).toHaveValue('Sam Rivera');
    await expect(canvas.getByRole('button', { name: 'Start the conversation' })).toBeVisible();
  },
};

export const ArabicSplit: Story = {
  globals: { direction: 'rtl' },
  args: {
    node: { ...node, id: 'contact-arabic' },
    props: exampleProps(1),
    slots: {},
    data: {},
    isCanvas: true,
  },
};

export const DetailsOnly: Story = {
  args: {
    node: { ...node, id: 'contact-details' },
    props: contactSchema.props.parse({
      heading: 'Visit the studio',
      body: 'Come by for coffee and a working session.',
      address: '180 Franklin Street\nBrooklyn, New York',
      showForm: false,
      variant: 'centered',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
};

/* Block parts (DESIGN §4.4): every contact detail and form label is a part on the canvas. */
export const Parts: Story = {
  args: {
    node: { ...node, id: 'contact-parts' },
    props: contactSchema.props.parse({
      ...(contactExamples[0]?.node as { props: Record<string, unknown> }).props,
      partStyles: { email: { className: 'underline' }, submitLabel: { className: 'w-full' } },
    }),
    slots: {},
    data: {},
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const email = canvasElement.querySelector('[data-ck-part="email"]');
    await expect(email).toHaveAttribute('data-ck-bind', 'email');
    await expect(email).toHaveClass('underline');
    await expect(canvasElement.querySelector('[data-ck-part="nameLabel"]')).toHaveAttribute(
      'data-ck-bind',
      'nameLabel',
    );
    await expect(canvasElement.querySelector('[data-ck-part="submitLabel"]')).toHaveClass('w-full');
  },
};
