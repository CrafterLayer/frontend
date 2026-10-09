import { expect, fn, userEvent, within } from 'storybook/test';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';

import { TemplateCard } from './TemplateCard';
import { TEMPLATE_CARD_LABELS_AR } from './TemplateCard.labels';
import type { TemplateCardInfo } from './template-order';

/*
  Story data in the catalog's own shape (blocks-marketing `MarketingTemplateCard`).
  The photos are from the verified template list (TEMPLATE_PHOTOS, 2026-10-08).
*/
const SAAS_EN: TemplateCardInfo = {
  id: 'saas-launch',
  templateKey: 'saas',
  lang: 'en',
  category: 'saas',
  name: { en: 'SaaS launch', ar: 'إطلاق منصة برمجية' },
  description: {
    en: 'A product launch page with pricing, proof, comparison and FAQ.',
    ar: 'صفحة إطلاق منتج رقمي بالأسعار وآراء العملاء والمقارنة والأسئلة الشائعة.',
  },
  sections: 12,
  thumbnail: {
    src: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=640&q=80',
    alt: 'Analytics dashboard with bar and line charts on a dark screen',
  },
};

const SAAS_AR: TemplateCardInfo = {
  ...SAAS_EN,
  id: 'saas-launch-ar',
  lang: 'ar',
  thumbnail: { src: SAAS_EN.thumbnail.src, alt: 'لوحة تحليلات بأعمدة وخطوط بيانية على شاشة داكنة' },
};

function frame(dir: 'ltr' | 'rtl', lang: 'en' | 'ar', theme?: 'dark'): Decorator {
  return (Story) => (
    <div
      dir={dir}
      lang={lang}
      data-bldr-theme={theme}
      style={{ background: 'var(--bldr-panel)', inlineSize: '280px', padding: 'var(--bldr-space-md)' }}
    >
      <Story />
    </div>
  );
}

const meta = {
  title: 'Shell/TemplateCard',
  component: TemplateCard,
  args: { card: SAAS_EN, onInsert: fn() },
  decorators: [frame('ltr', 'en')],
} satisfies Meta<typeof TemplateCard>;
export default meta;

type Story = StoryObj<typeof meta>;

/** An English template in the English editor. */
export const English: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Insert template SaaS launch' }));
    await expect(args.onInsert).toHaveBeenCalledWith(SAAS_EN);
  },
};

/** An Arabic template in the Arabic editor: the name and description follow the editor. */
export const Arabic: Story = {
  args: { card: SAAS_AR, labels: TEMPLATE_CARD_LABELS_AR },
  decorators: [frame('rtl', 'ar')],
};

/** An English template seen from the Arabic editor: Arabic copy, an `EN` badge. */
export const RightToLeft: Story = {
  args: { card: SAAS_EN, labels: TEMPLATE_CARD_LABELS_AR },
  decorators: [frame('rtl', 'ar')],
};

/** Dark chrome: the card, the skeleton strip and the badge come from the dark tokens. */
export const Dark: Story = {
  decorators: [frame('ltr', 'en', 'dark')],
};

/** A thumbnail that fails to load keeps the skeleton ground, never a broken-image glyph. */
export const MissingPhoto: Story = {
  args: { card: { ...SAAS_EN, thumbnail: { src: 'https://invalid.example/missing.jpg', alt: 'Missing photo' } } },
};
