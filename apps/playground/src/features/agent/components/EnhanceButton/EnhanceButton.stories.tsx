import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';
import { AgentTooltipProvider } from '../IconButton';

import { EnhanceButton } from './EnhanceButton';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
}

/** The panel's root, and the composer's Sheet the button sits on (the toolbar's end). */
const inPanel: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light' } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: 320,
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <div style={{ padding: 'var(--bldr-space-6xl) var(--bldr-space-md) var(--bldr-space-md)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            minBlockSize: 32,
            padding: 7,
            border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border-strong)',
            borderRadius: 'var(--bldr-radius-xl)',
            background: 'var(--bldr-surface)',
          }}
        >
          <AgentTooltipProvider>
            <Story />
          </AgentTooltipProvider>
        </div>
      </div>
    </div>
  );
};

const meta = {
  title: 'Agent/Composer/EnhanceButton',
  component: EnhanceButton,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    enhancement: { status: 'idle' },
    empty: false,
    running: false,
    onEnhance: fn(),
  },
  decorators: [inPanel],
} satisfies Meta<typeof EnhanceButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Ready: a ghost ✨ in Graphite; the Wash under Ink on hover, never Indigo. */
export const Idle: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Improve my request' }),
    );
    await expect(args.onEnhance).toHaveBeenCalledTimes(1);
  },
};

/** Focus opens the tooltip, in the owner's own words. */
export const Tooltip: Story = {
  play: async ({ canvasElement }) => {
    within(canvasElement).getByRole('button', { name: 'Improve my request' }).focus();
    const tooltip = await waitFor(() => within(canvasElement).getByRole('tooltip'));
    await expect(tooltip.textContent.startsWith('Improve my request')).toBe(true);
  },
};

/** Nothing written yet: Slate, `aria-disabled`, and the tooltip says when it will work. */
export const EmptyDraft: Story = {
  args: { empty: true },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Improve my request' });
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(button).toHaveAccessibleDescription(t('en', 'enhance.empty'));
    await userEvent.click(button);
    await expect(args.onEnhance).not.toHaveBeenCalled();
  },
};

/** A run is live: Improve waits for it to end. */
export const WhileRunning: Story = {
  args: { running: true },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Improve my request' }),
    ).toHaveAccessibleDescription(t('en', 'enhance.busy'));
  },
};

/** Working: the sparkle turns into the spinner and the name says so. */
export const Enhancing: Story = {
  args: { enhancement: { status: 'enhancing' } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: t('en', 'enhance.working') }),
    ).toHaveAttribute('aria-disabled', 'true');
  },
};

/** The provider cannot rewrite requests: there is no button at all. */
export const Unavailable: Story = {
  args: { enhancement: { status: 'unavailable' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).toBeNull();
  },
};

export const IdleDark: Story = {
  parameters: { panel: { theme: 'dark' } },
};

export const EnhancingDark: Story = {
  args: { enhancement: { status: 'enhancing' } },
  parameters: { panel: { theme: 'dark' } },
};

/** Arabic: «حسّن طلبي». The sparkle never mirrors: light has no reading direction. */
export const IdleRightToLeft: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: t('ar', 'enhance.button') }),
    ).toBeInTheDocument();
  },
};

export const EmptyDraftRightToLeftDark: Story = {
  args: { locale: 'ar', empty: true },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

export const EnhancingRightToLeft: Story = {
  args: { locale: 'ar', enhancement: { status: 'enhancing' } },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};
