import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';
import { CAST_BRIEFS, plannedBrief } from '../../testing/creative-fixtures';

import { CreativeBriefCard } from './CreativeBriefCard';

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/** A thread column as AgentPanel draws it: theme, language, direction, width. */
const inThread: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light', width = 360 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: width,
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
        padding: 'var(--bldr-space-3xl)',
      }}
    >
      <Story />
    </div>
  );
};

const meta = {
  title: 'Agent/Creative/CreativeBriefCard',
  component: CreativeBriefCard,
  parameters: { layout: 'centered' },
  args: { locale: 'en', brief: plannedBrief('en') },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'ar'] } },
  decorators: [inThread],
} satisfies Meta<typeof CreativeBriefCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A platformer, as the planner reads the empty state's game starter. */
export const Platformer: Story = {
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: t('en', 'brief.title') });
    await expect(region).toHaveTextContent(t('en', 'brief.genre.platformer'));
  },
};

/** A visual novel whose cast comes from the story bible, with each character's colour. */
export const WithCast: Story = {
  args: { brief: CAST_BRIEFS.en },
};

export const Dark: Story = {
  args: { brief: CAST_BRIEFS.en },
  parameters: { panel: { theme: 'dark' } },
};

export const RightToLeft: Story = {
  args: { locale: 'ar', brief: plannedBrief('ar') },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    const region = within(canvasElement).getByRole('region', { name: t('ar', 'brief.title') });
    await expect(region).toHaveTextContent(t('ar', 'brief.genre.platformer'));
  },
};

/** A bedtime picture book in Arabic. */
export const PictureBookArabic: Story = {
  args: { locale: 'ar', brief: plannedBrief('ar', 'bedtime') },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

/** A narrow phone dock: chips wrap, nothing scrolls sideways. */
export const Narrow: Story = {
  args: { brief: CAST_BRIEFS.en },
  parameters: { panel: { width: 280 } },
};
