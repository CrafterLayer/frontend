import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { Card } from './Card';
import { cardSchema } from './schema';

const node: Node = { id: 'card', type: 'card', props: {} };

const body = <p style={{ margin: 0 }}>Everything you need to publish, in one place.</p>;
const header = <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Starter</h3>;
const footer = (
  <button type="button" style={{ alignSelf: 'start' }}>
    Choose Starter
  </button>
);

const meta = {
  title: 'Builder/Shadcn/Card',
  component: Card,
  /*
    No `tags: ['autodocs']`: an authored docs page is attached with
    <Meta of={...}>, and Storybook refuses both for one component.
  */
  args: { node, slots: { default: body }, data: {}, isCanvas: false },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Bordered: Story = { args: { props: cardSchema.props.parse({}) } };

export const WithHeaderAndFooter: Story = {
  args: { props: cardSchema.props.parse({}), slots: { header, default: body, footer } },
};

export const Inverse: Story = {
  args: {
    props: cardSchema.props.parse({
      tone: 'inverse',
      radius: 'large',
      padding: 'roomy',
      bordered: false,
      elevation: 'strong',
    }),
  },
};
