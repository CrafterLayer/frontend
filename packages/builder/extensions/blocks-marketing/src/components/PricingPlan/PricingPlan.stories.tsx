import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { PricingPlan } from './PricingPlan';
import { pricingPlanSchema } from './schema';

const node: Node = { id: 'plan', type: 'pricingPlan', props: {} };

const body = (
  <>
    <ul style={{ margin: 0, paddingInlineStart: '1.2em' }}>
      <li>Unlimited projects</li>
      <li>Priority support</li>
    </ul>
    <button type="button" style={{ marginBlockStart: 'auto' }}>
      Choose this plan
    </button>
  </>
);

const meta = {
  title: 'Builder/Blocks/PricingPlan',
  component: PricingPlan,
  /*
    No `tags: ['autodocs']`: an authored PricingPlan.docs.mdx is attached with
    <Meta of={...}>, and Storybook refuses both for one component.
  */
  args: { node, slots: { default: body }, data: {}, isCanvas: false },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '20rem', maxInlineSize: '100%' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PricingPlan>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An ordinary plan. */
export const Default: Story = {
  args: { props: pricingPlanSchema.props.parse({ name: 'Solo', price: '$9', period: 'month' }) },
};

/** The recommended plan: outlined and raised, never repainted. */
export const Featured: Story = {
  args: {
    props: pricingPlanSchema.props.parse({
      name: 'Team',
      price: '$29',
      period: 'month',
      emphasis: 'featured',
    }),
  },
};

/** A one-time price. The period label changes with it. */
export const OneTime: Story = {
  args: {
    props: pricingPlanSchema.props.parse({ name: 'Lifetime', price: '$299', period: 'once' }),
  },
};

/** A price that is not a number at all — which is why the field is text. */
export const ContactPricing: Story = {
  args: {
    props: pricingPlanSchema.props.parse({
      name: 'Enterprise',
      price: 'Contact us',
      period: 'year',
    }),
  },
};

/** An empty card. A plan with nothing in it must still look like a card. */
export const EmptyBody: Story = {
  args: {
    props: pricingPlanSchema.props.parse({ name: 'Solo', price: '$9' }),
    slots: { default: null },
  },
};

/** With motion. CSS on a scroll timeline; no engine is loaded. */
export const WithMotion: Story = {
  args: {
    props: pricingPlanSchema.props.parse({
      name: 'Team',
      price: '$29',
      motion: { reveal: 'fade-up', duration: 'normal' },
    }),
  },
};

/** Right-to-left. Logical properties mirror the padding and the alignment. */
export const RightToLeft: Story = {
  args: {
    props: pricingPlanSchema.props.parse({ name: 'الاحترافية', price: '٢٩ د.أ', period: 'month' }),
  },
  decorators: [
    (Story) => (
      <div dir="rtl" style={{ inlineSize: '20rem', maxInlineSize: '100%' }}>
        <Story />
      </div>
    ),
  ],
};
