import type { Meta, StoryObj } from '@storybook/react-vite';

import type { Node } from '@craftkit/builder-schema';

import { FormSection } from './FormSection';
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
