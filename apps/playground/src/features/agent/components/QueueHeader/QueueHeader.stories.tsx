import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';
import { DRAFT, queued } from '../../testing/wp-14-composer-fixtures';
import { AgentTooltipProvider } from '../IconButton';

import { QueueHeader } from './QueueHeader';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
  /** Draw the composer's own text under the header, as it is while the request waits. */
  readonly withText?: boolean;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root, with the header where it
 * lives: inside the composer's card, over the text it heads (while live) or over a
 * Hairline (paused, SPEC §3.10).
 */
const inPanel: Decorator = (Story, { parameters }) => {
  const {
    locale = 'en',
    theme = 'light',
    width = 320,
    withText = true,
  } = (parameters['panel'] ?? {}) as Frame;
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
      <div style={{ padding: 'var(--bldr-space-4xl) var(--bldr-space-md) var(--bldr-space-md)' }}>
        <div
          style={{
            padding: 7,
            border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border-strong)',
            borderRadius: 'var(--bldr-radius-xl)',
            background: 'var(--bldr-surface)',
          }}
        >
          <AgentTooltipProvider>
            <Story />
          </AgentTooltipProvider>
          {withText ? (
            <p
              style={{
                margin: 0,
                fontSize: 'var(--bldr-font-size-input)',
                lineHeight: 'var(--bldr-line-height-input)',
                minBlockSize: 'calc(2 * var(--bldr-line-height-input))',
              }}
            >
              {DRAFT[locale]}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const meta = {
  title: 'Agent/Composer/QueueHeader',
  component: QueueHeader,
  parameters: { layout: 'centered' },
  args: { locale: 'en', queue: queued('en'), onRemove: fn(), onContinue: fn() },
  decorators: [inPanel],
} satisfies Meta<typeof QueueHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Waiting its turn (SPEC §3.9): the Indigo dot, "Up next", when it will start, `×`. */
export const Editable: Story = {
  play: async ({ canvasElement }) => {
    const group = within(canvasElement).getByRole('group', { name: 'Up next' });
    await expect(group).toHaveAccessibleDescription(t('en', 'queue.caption'));
    await expect(
      within(group).getByRole('button', { name: t('en', 'queue.remove') }),
    ).toBeInTheDocument();
  },
};

/** The target changed after it was queued: it will be rechecked first (Amber). */
export const Stale: Story = {
  args: { queue: queued('en', 'stale') },
};

/** The target is gone: it cannot run as written (Alarm). */
export const Missing: Story = {
  args: { queue: queued('en', 'missing') },
};

/** Paused after Stop (SPEC §3.10): the request itself, its scope and Continue, over a Hairline. */
export const Paused: Story = {
  args: { queue: queued('en', 'paused') },
  parameters: { panel: { withText: false } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: t('en', 'queue.continue') }),
    ).toBeInTheDocument();
  },
};

export const EditableDark: Story = {
  parameters: { panel: { theme: 'dark' } },
};

export const StaleDark: Story = {
  args: { queue: queued('en', 'stale') },
  parameters: { panel: { theme: 'dark' } },
};

export const MissingDark: Story = {
  args: { queue: queued('en', 'missing') },
  parameters: { panel: { theme: 'dark' } },
};

export const PausedDark: Story = {
  args: { queue: queued('en', 'paused') },
  parameters: { panel: { theme: 'dark', withText: false } },
};

/** Arabic: the dot and «التالي» at the right, `×` at the left. */
export const EditableRightToLeft: Story = {
  args: { locale: 'ar', queue: queued('ar') },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const StaleRightToLeft: Story = {
  args: { locale: 'ar', queue: queued('ar', 'stale') },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const MissingRightToLeftDark: Story = {
  args: { locale: 'ar', queue: queued('ar', 'missing') },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

export const PausedRightToLeft: Story = {
  args: { locale: 'ar', queue: queued('ar', 'paused') },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', withText: false } },
};
