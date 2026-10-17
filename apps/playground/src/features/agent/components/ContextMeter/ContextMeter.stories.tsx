import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import type { Locale } from '../../model/view-types';
import { ContextChip } from '../ContextChip';

import { ContextMeter } from './ContextMeter';

/* ── The composer's context row, as the panel draws it ─────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/** The panel's root and the composer's context row: the chips, then the meter at its end. */
const inContextRow: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light', width = 320 } = (parameters['panel'] ?? {}) as Frame;
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
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: 'var(--bldr-space-md)',
          padding: 'var(--bldr-space-md)',
          border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border-strong)',
          borderRadius: 'var(--bldr-radius-xl)',
          background: 'var(--bldr-surface)',
        }}
      >
        <ContextChip locale={locale} chip={{ kind: 'page', id: 'page' }} />
        <Story />
      </div>
    </div>
  );
};

const meta = {
  title: 'Agent/Composer/ContextMeter',
  component: ContextMeter,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    meter: { used: 12_345, max: 64_000, level: 'normal', trimmed: false },
  },
  decorators: [inContextRow],
} satisfies Meta<typeof ContextMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The latest request well inside its budget: Slate figure, Slate bar. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const meter = within(canvasElement).getByRole('meter', { name: 'Context' });
    await expect(meter).toHaveAttribute('aria-valuetext', 'About 12,345 of 64,000 tokens');
    await expect(within(canvasElement).getByText('12k / 64k')).toBeVisible();
  },
};

/** A short request: under a thousand tokens reads as the count itself. */
export const Small: Story = {
  args: { meter: { used: 850, max: 64_000, level: 'normal', trimmed: false } },
};

/** Past 80% of the budget: the warning token, and the spoken value says older messages go first. */
export const NearTheLimit: Story = {
  args: { meter: { used: 55_100, max: 64_000, level: 'warning', trimmed: false } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('meter')).toHaveAttribute('data-level', 'warning');
  },
};

/** The conversation already gave way to fit: its oldest messages were shortened or left out. */
export const Trimmed: Story = {
  args: { meter: { used: 61_800, max: 64_000, level: 'warning', trimmed: true } },
};

export const NearTheLimitDark: Story = {
  args: { meter: { used: 55_100, max: 64_000, level: 'warning', trimmed: false } },
  parameters: { panel: { theme: 'dark' } },
};

/** Arabic: the bar fills from the right, the digits stay Latin. */
export const RightToLeft: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    const meter = within(canvasElement).getByRole('meter', { name: 'السياق' });
    await expect(meter).toHaveAttribute('aria-valuetext', 'نحو 12,345 من 64,000 توكن');
  },
};

export const RightToLeftNearTheLimitDark: Story = {
  args: { locale: 'ar', meter: { used: 55_100, max: 64_000, level: 'warning', trimmed: true } },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

/** A narrow panel: the meter wraps under the chip rather than squeezing it. */
export const Narrow: Story = {
  parameters: { panel: { width: 220 } },
};
