import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { t } from '../../copy';
import { SEND_STATES } from '../../model/send-state';
import type { Locale } from '../../model/view-types';
import { AgentTooltipProvider } from '../IconButton';

import { SendButton } from './SendButton';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
}

/** The panel's root, and the composer's Sheet the slot sits on (its toolbar's end). */
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
      <div style={{ padding: 'var(--bldr-space-4xl) var(--bldr-space-md) var(--bldr-space-md)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--bldr-space-xs)',
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
  title: 'Agent/Composer/SendButton',
  component: SendButton,
  parameters: { layout: 'centered' },
  args: { locale: 'en', state: 'idle-ready', onSend: fn() },
  decorators: [inPanel],
} satisfies Meta<typeof SendButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing to send: the Wash under a Slate ↑, `aria-disabled`, still focusable. */
export const IdleEmpty: Story = {
  args: { state: 'idle-empty' },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Send' });
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(button);
    await expect(args.onSend).not.toHaveBeenCalled();
  },
};

/** A draft: the Indigo primary; the tooltip's second line teaches the keys. */
export const IdleReady: Story = {
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Send' });
    await expect(button).toHaveAccessibleDescription(t('en', 'keys.hint'));
    await userEvent.click(button);
    await expect(args.onSend).toHaveBeenCalledTimes(1);
  },
};

/** A run is live, the box is empty: ↑, unavailable. Stop lives in the RunBar, not here. */
export const RunningEmpty: Story = {
  args: { state: 'running-empty' },
};

/** A run is live and there is a draft: Queue as next ↵, pointing back to the reading start. */
export const RunningReady: Story = {
  args: { state: 'running-ready' },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Queue as next' }),
    ).toBeInTheDocument();
  },
};

/** The draft is the queued request: a pill that says Queued, `aria-disabled`. */
export const RunningQueued: Story = {
  args: { state: 'running-queued' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Queued' });
    await expect(button).toHaveTextContent('Queued');
    await expect(button).toHaveAccessibleDescription(t('en', 'queue.caption'));
  },
};

/** Focus opens the tooltip: its first line is the name. */
export const Tooltip: Story = {
  play: async ({ canvasElement }) => {
    within(canvasElement).getByRole('button', { name: 'Send' }).focus();
    const tooltip = await waitFor(() => within(canvasElement).getByRole('tooltip'));
    await expect(tooltip.textContent.startsWith('Send')).toBe(true);
  },
};

/** Every state at once, in SPEC §4.17's order. */
function renderAll({ locale, onSend }: { readonly locale: Locale; readonly onSend: () => void }) {
  return (
    <>
      {SEND_STATES.map((state) => (
        <SendButton key={state} locale={locale} state={state} onSend={onSend} />
      ))}
    </>
  );
}

/** Every state side by side, so the slot is seen to be one control that never says Stop. */
export const AllStates: Story = {
  render: renderAll,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: /stop/iu })).toBeNull();
  },
};

export const AllStatesDark: Story = {
  render: renderAll,
  parameters: { panel: { theme: 'dark' } },
};

/** Arabic: «إرسال»; Queue's ↵ mirrors, ↑ never does. */
export const AllStatesRightToLeft: Story = {
  args: { locale: 'ar' },
  render: renderAll,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: t('ar', 'queued') }),
    ).toHaveTextContent(t('ar', 'queued'));
  },
};

export const AllStatesRightToLeftDark: Story = {
  args: { locale: 'ar' },
  render: renderAll,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};
