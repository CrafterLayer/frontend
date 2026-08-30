import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { AccordionItem } from '../AccordionItem/AccordionItem';
import { accordionItemSchema } from '../AccordionItem/schema';
import { Accordion } from './Accordion';
import { accordionSchema } from './schema';

const QUESTIONS = [
  ['q1', 'How long does delivery take?', 'Two to five working days across the region.'],
  ['q2', 'Can I get a refund?', 'Within thirty days, for any reason, no questions asked.'],
  ['q3', 'Do you ship internationally?', 'To twenty-two countries, with duties included.'],
] as const;

function items() {
  return QUESTIONS.map(([id, title, answer]) => {
    const node: Node = { id, type: 'accordionItem', props: { title } };
    return (
      <AccordionItem
        key={id}
        node={node}
        props={accordionItemSchema.props.parse({ title })}
        slots={{ default: <p style={{ margin: 0 }}>{answer}</p> }}
        data={{}}
        isCanvas={false}
      />
    );
  });
}

const containerNode: Node = {
  id: 'faq',
  type: 'accordion',
  props: {},
  slots: { default: QUESTIONS.map(([id]) => id) },
};

const meta = {
  title: 'Builder/Primitives/Accordion',
  component: Accordion,
  /*
    No `tags: ['autodocs']`: this component ships an authored Accordion.docs.mdx
    attached with <Meta of={...}>, and Storybook refuses a generated and an
    authored docs page for the same component.
  */
  args: {
    node: containerNode,
    slots: { default: items() },
    data: {},
    isCanvas: false,
  },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '32rem', maxInlineSize: '100%' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default: everything closed, one open at a time. */
export const Default: Story = {
  args: { props: accordionSchema.props.parse({}) },
};

/** An FAQ that shows its first answer immediately. */
export const FirstOpen: Story = {
  args: { props: accordionSchema.props.parse({ defaultOpen: 'first' }) },
};

/** A specification list, where comparing two sections at once is the point. */
export const Multiple: Story = {
  args: { props: accordionSchema.props.parse({ mode: 'multiple' }) },
};

/** Single mode that refuses to close completely: something is always showing. */
export const NotCollapsible: Story = {
  args: {
    props: accordionSchema.props.parse({ collapsible: false, defaultOpen: 'first' }),
  },
};

/** With motion. The reveal is CSS on a scroll timeline; no engine is loaded. */
export const WithMotion: Story = {
  args: {
    props: accordionSchema.props.parse({
      defaultOpen: 'first',
      motion: { reveal: 'fade-up', duration: 'normal' },
    }),
  },
};

/** Empty. A container with nothing in it must not look broken on the canvas. */
export const Empty: Story = {
  args: {
    props: accordionSchema.props.parse({}),
    node: { id: 'faq', type: 'accordion', props: {} },
    slots: { default: null },
  },
};

/** Right-to-left. Logical properties mirror the chevron and the padding. */
export const RightToLeft: Story = {
  args: { props: accordionSchema.props.parse({ defaultOpen: 'first' }) },
  decorators: [
    (Story) => (
      <div dir="rtl" style={{ inlineSize: '32rem', maxInlineSize: '100%' }}>
        <Story />
      </div>
    ),
  ],
};
