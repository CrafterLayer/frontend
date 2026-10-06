import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import type { Node } from '@craftkit/builder-schema';

import { FormSection } from './FormSection';
import { formSectionExamples } from './examples';
import { formSectionSchema } from './schema';

const node: Node = { id: 'form-section-story', type: 'formSection', props: {} };

const meta = {
  title: 'Builder/Marketing/FormSection',
  component: FormSection,
  args: {
    node,
    props: formSectionSchema.props.parse({
      eyebrow: 'Start a project',
      heading: 'Give us the shape of the challenge',
      body: 'A concise brief is enough to begin.',
      footerNote: 'Your details are used only to respond to this request.',
      action: '/enquiry',
    }),
    slots: {},
    data: {},
    isCanvas: false,
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FormSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Split: Story = {};

export const Card: Story = {
  args: {
    props: formSectionSchema.props.parse({
      eyebrow: 'Apply now',
      heading: 'Build your next chapter with us',
      body: 'Tell us what you care about and where you do your best work.',
      variant: 'card',
      buttonWidth: 'full',
    }),
  },
};

export const MinimalArabic: Story = {
  args: {
    node: { ...node, id: 'form-section-arabic' },
    props: formSectionSchema.props.parse({
      eyebrow: 'طلب استشارة',
      heading: 'أخبرنا أين تريد أن تصل',
      body: 'شاركنا الهدف وسنعود إليك بخطوة واضحة.',
      submitLabel: 'إرسال الطلب',
      variant: 'minimal',
      tone: 'transparent',
    }),
  },
  decorators: [
    (Story) => (
      <div dir="rtl">
        <Story />
      </div>
    ),
  ],
};

/* Block parts (DESIGN §4.4): each field's label, hint and choices are parts on the canvas. */
export const Parts: Story = {
  args: {
    node: { ...node, id: 'form-section-parts' },
    props: formSectionSchema.props.parse({
      ...(formSectionExamples[0]?.node as { props: Record<string, unknown> }).props,
      partStyles: {
        'field.label': { className: 'text-accent' },
        'field.label@0': { className: 'underline' },
      },
    }),
    isCanvas: true,
  },
  play: async ({ canvasElement }) => {
    const labels = canvasElement.querySelectorAll('[data-ck-part="field.label"]');
    await expect(labels[1]).toHaveAttribute('data-ck-bind', 'fields.1.label');
    await expect(labels[1]).toHaveClass('text-accent');
    await expect(labels[0]).toHaveClass('underline');
    await expect(canvasElement.querySelector('[data-ck-part="submitLabel"]')).toHaveAttribute(
      'data-ck-bind',
      'submitLabel',
    );
  },
};
