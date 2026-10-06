import type { Meta, StoryObj } from '@storybook/react-vite';
import * as RadixAccordion from '@radix-ui/react-accordion';

import type { Node } from '@craftkit/builder-schema';

import { AccordionItem } from './AccordionItem';
import { accordionItemSchema } from './schema';

const node: Node = { id: 'q1', type: 'accordionItem', props: {} };

const meta = {
  title: 'Builder/Primitives/AccordionItem',
  component: AccordionItem,
  /*
    No `tags: ['autodocs']`: an authored AccordionItem.docs.mdx is attached with
    <Meta of={...}>, and Storybook refuses both for one component.
  */
  args: {
    node,
    slots: { default: <p style={{ margin: 0 }}>Two to five working days across the region.</p> },
    data: {},
    isCanvas: false,
  },
  /*
    An item is only meaningful inside a Radix root — it reads its open state and
    its keyboard position from there. Rendering one bare would show a control
    that cannot be operated, which is a misleading catalog entry rather than a
    minimal one.
  */
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '32rem', maxInlineSize: '100%' }}>
        <RadixAccordion.Root type="single" collapsible className="pri-accordion">
          <Story />
        </RadixAccordion.Root>
      </div>
    ),
  ],
} satisfies Meta<typeof AccordionItem>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: a closed section with a question for a heading. */
export const Default: Story = {
  args: { props: accordionItemSchema.props.parse({ title: 'How long does delivery take?' }) },
};

/** A long title. The trigger wraps rather than truncating meaning away. */
export const LongTitle: Story = {
  args: {
    props: accordionItemSchema.props.parse({
      title: 'What happens if the item arrives damaged, and who pays for the return shipping?',
    }),
  },
};

/** Rich content inside the slot: the item has no opinion about what it holds. */
export const RichContent: Story = {
  args: {
    props: accordionItemSchema.props.parse({ title: 'What is included?' }),
    slots: {
      default: (
        <ul style={{ margin: 0, paddingInlineStart: '1.2em' }}>
          <li>Unlimited pages</li>
          <li>Custom domain</li>
          <li>Priority support</li>
        </ul>
      ),
    },
  },
};

/** Right-to-left. The chevron and padding mirror through logical properties. */
export const RightToLeft: Story = {
  args: { props: accordionItemSchema.props.parse({ title: 'كم يستغرق التوصيل؟' }) },
  decorators: [
    (Story) => (
      <div dir="rtl" style={{ inlineSize: '32rem', maxInlineSize: '100%' }}>
        <RadixAccordion.Root type="single" collapsible className="pri-accordion">
          <Story />
        </RadixAccordion.Root>
      </div>
    ),
  ],
};

/**
 * Block parts on the canvas: every inner element carries its part address
 * (`data-ck-part` / `data-ck-bind`), which the canvas hit test, the outline,
 * the quick bar and inline editing read. A published render carries none.
 */
export const Parts: Story = {
  args: {
    node: { id: 'accordionItem-parts', type: 'accordionItem', props: {} },
    props: accordionItemSchema.props.parse({ title: 'How long does delivery take?' }),
    slots: { default: <p>Two working days.</p> },
    data: {},
    isCanvas: true,
  },
};
