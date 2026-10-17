import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';

import { CreativeStarters } from './CreativeStarters';

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/** The empty thread as AgentPanel draws it: theme, language, direction, width. */
const inThread: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light', width = 400 } = (parameters['panel'] ?? {}) as Frame;
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
  title: 'Agent/Creative/CreativeStarters',
  component: CreativeStarters,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    freeCode: { enabled: false },
    onChoose: fn(),
    onFreeCodeChange: fn(),
  },
  argTypes: { locale: { control: 'inline-radio', options: ['en', 'ar'] } },
  decorators: [inThread],
} satisfies Meta<typeof CreativeStarters>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Free code off: the note explains and offers to turn it on. */
export const FreeCodeOff: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: t('en', 'creative.enableFreeCode') }));
    await expect(args.onFreeCodeChange).toHaveBeenCalledWith(true);
  },
};

/** Free code on: choosing a card fills the composer with its request. */
export const FreeCodeOn: Story = {
  args: { freeCode: { enabled: true } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Platformer game/u }));
    await expect(args.onChoose).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'creative:game', source: 'starter' }),
    );
  },
};

export const Dark: Story = {
  parameters: { panel: { theme: 'dark' } },
};

export const RightToLeft: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

/** A narrow phone dock: the cards stack, the tile beside the words. */
export const Narrow: Story = {
  args: { locale: 'ar', freeCode: { enabled: true } },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', width: 300 } },
};
