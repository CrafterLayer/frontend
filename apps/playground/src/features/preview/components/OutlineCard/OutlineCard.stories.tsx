import type { Meta, StoryObj } from '@storybook/react-vite';

import '../../../../app/App.css';
import { OutlineCard } from './OutlineCard';

const ARABIC = `GOAL: صفحة عيادة أسنان لعائلات الحيّ، والافتراض الوحيد أنها عيادة عامّة لا تخصّصية.
OUTLINE: قسم افتتاحي باسم العيادة وموعد أوّل مجاني · الخدمات الستّ · الفريق بثلاثة أطبّاء · شهادات مرضى · الأسعار · تواصل بخريطة.
ALTERNATIVES: صفحة واحدة طويلة بلا أقسام — لم تُختَر لأن الخدمات وحدها تحتاج مساحة تصفّح. أو صفحة حجز مباشرة — لم تُختَر لأن الطلب ذكر «تعريف بالعيادة».
RISK: لا صور حقيقية للعيادة، فالنصّ سيصف ما لا يراه الزائر. أسماء الأطبّاء وساعات العمل غير معروفة.`;

const ENGLISH = `GOAL: a landing page for a SaaS analytics product, assuming a self-serve trial.
OUTLINE: hero with the one-line promise · three proof logos · the four features · pricing with two tiers · a closing call to action.
ALTERNATIVES: a long-form story page — not chosen because the request asked to convert, not to explain.
RISK: the pricing numbers are invented; the logos need permission.`;

const meta = {
  title: 'Playground/OutlineCard',
  component: OutlineCard,
  parameters: { layout: 'centered' },
  args: { text: ARABIC, dropped: 0 },
  decorators: [
    (Story) => (
      <div style={{ inlineSize: '22.5rem', background: 'var(--bldr-panel)', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OutlineCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The ordinary case: a plan in the requester's language, with nothing to apply. */
export const Default: Story = {};

/** English, to show the four parts hold their shape in either script. */
export const English: Story = { args: { text: ENGLISH } };

/** The model proposed edits anyway. They were dropped, counted, and reported. */
export const DroppedCommands: Story = { args: { dropped: 3 } };

/** One is one: "1 changes were" is a bug a reader sees. */
export const OneDroppedCommand: Story = { args: { dropped: 1 } };

/** A single unbroken token: the card wraps rather than pushing the panel sideways. */
export const UnbrokenToken: Story = {
  args: {
    text: `GOAL: a page.\nOUTLINE: ${'x'.repeat(220)}`,
  },
};

/**
 * A PLANNED PAGE: Plan mode reached the build path and stopped at the skeleton.
 * The page's shape, and one action to build it for real.
 */
export const PlannedPage: Story = {
  args: {
    text: 'صفحة استوديو خزف: تعريف، ثم أعمال، ثم تواصل. الألوان فاتحة والخط واحد.',
    dropped: 0,
    sections: ['قسم التعريف', 'معرض الأعمال', 'الأسعار', 'تواصل معنا'],
    onBuild: () => undefined,
  },
};

/** The same page while another run owns the panel. */
export const PlannedPageBusy: Story = {
  args: { ...PlannedPage.args, busy: true },
};
