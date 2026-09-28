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
import { AgentTooltipProvider } from '../IconButton';

import { ModeMenu } from './ModeMenu';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * The panel's root, with the trigger at the foot of a tall panel as it sits in the
 * composer's toolbar, so the menu opens upwards into the room above it.
 */
const inPanel: Decorator = (Story, { parameters }) => {
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
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          minBlockSize: 280,
          padding: 'var(--bldr-space-md) var(--bldr-space-3xl) var(--bldr-space-3xl)',
        }}
      >
        <AgentTooltipProvider>
          <Story />
        </AgentTooltipProvider>
      </div>
    </div>
  );
};

const meta = {
  title: 'Agent/Composer/ModeMenu',
  component: ModeMenu,
  parameters: { layout: 'centered' },
  args: { locale: 'en', mode: 'auto', running: false, onModeChange: fn() },
  decorators: [inPanel],
} satisfies Meta<typeof ModeMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Auto (the default): "Auto ▾", named "Mode: Auto". */
export const Auto: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Mode: Auto' }),
    ).toHaveTextContent('Auto');
  },
};

export const Ask: Story = { args: { mode: 'ask' } };

export const Plan: Story = { args: { mode: 'plan' } };

/**
 * Open: three two-line items; the chosen one has the check and the Mist, its description
 * in Graphite (Slate is forbidden on Mist).
 */
export const Open: Story = {
  args: { mode: 'ask' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Mode: Ask first' }));
    const menu = await canvas.findByRole('menu');
    const items = within(menu).getAllByRole('menuitemradio');
    await expect(items).toHaveLength(3);
    await expect(items[1]).toHaveAttribute('aria-checked', 'true');
  },
};

/** While a run is live: still enabled; the tooltip says the choice applies next time. */
export const WhileRunning: Story = {
  args: { running: true },
  play: async ({ canvasElement }) => {
    within(canvasElement).getByRole('button', { name: 'Mode: Auto' }).focus();
    await expect(await within(canvasElement).findByRole('tooltip')).toHaveTextContent(
      t('en', 'mode.running'),
    );
  },
};

export const OpenDark: Story = {
  args: { mode: 'plan' },
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Mode: Plan' }));
    await within(canvasElement).findByRole('menu');
  },
};

/** Arabic: «تلقائي ▾» at the right; the menu opens right-aligned, in Arabic type. */
export const RightToLeft: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const OpenRightToLeft: Story = {
  args: { locale: 'ar', mode: 'ask' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    const name = t('ar', 'mode.aria', { mode: t('ar', 'mode.ask') });
    await userEvent.click(within(canvasElement).getByRole('button', { name }));
    const menu = await within(canvasElement).findByRole('menu');
    await expect(menu).toHaveAttribute('dir', 'rtl');
    await expect(menu).toHaveAttribute('lang', 'ar');
  },
};

export const OpenRightToLeftDark: Story = {
  args: { locale: 'ar', mode: 'auto' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
  play: async ({ canvasElement }) => {
    const name = t('ar', 'mode.aria', { mode: t('ar', 'mode.auto') });
    await userEvent.click(within(canvasElement).getByRole('button', { name }));
    await within(canvasElement).findByRole('menu');
  },
};
