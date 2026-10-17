import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import type { Locale } from '../../model/view-types';
import { MENTION, MENTION_EMPTY } from '../../testing/wp-14-composer-fixtures';

import { MentionMenu } from './MentionMenu';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/** The panel's root, and the dock's 8px inset the list floats in, across the composer. */
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
      <div style={{ padding: 'var(--bldr-space-4xl) var(--bldr-space-md)' }}>
        <Story />
      </div>
    </div>
  );
};

const optionId = (index: number) => `mention-option-${String(index)}`;

const meta = {
  title: 'Agent/Composer/MentionMenu',
  component: MentionMenu,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    id: 'mention-list',
    mention: MENTION.en,
    activeIndex: 0,
    optionId,
    onActiveChange: fn(),
    onPick: fn(),
  },
  decorators: [inPanel],
} satisfies Meta<typeof MentionMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Open on "@se" (SPEC §3.2): sections first with their place on the page; the keyboard's
 * option in Mist with the Indigo bar at its inline start.
 */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('listbox', { name: 'Sections and blocks' });
    const options = within(list).getAllByRole('option');
    await expect(options).toHaveLength(3);
    await expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await expect(options[0]).toHaveTextContent('3 of 8');
  },
};

/** The keyboard moved down: the second option is the active one. */
export const SecondActive: Story = {
  args: { activeIndex: 1 },
};

/** No match: the line says so, and there is no empty listbox. */
export const Empty: Story = {
  args: { mention: MENTION_EMPTY.en, emptyId: 'mention-empty' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('listbox')).toBeNull();
    await expect(within(canvasElement).getByText('No section by that name')).toBeInTheDocument();
  },
};

export const OpenDark: Story = {
  parameters: { panel: { theme: 'dark' } },
};

/** 420px: the same rows with room for longer names. */
export const OpenWide: Story = {
  parameters: { panel: { width: 420 } },
};

/** Arabic, «@ال»: the bar at the right, «3 من 8» at the left. */
export const OpenRightToLeft: Story = {
  args: { locale: 'ar', mention: MENTION.ar },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const OpenRightToLeftDark: Story = {
  args: { locale: 'ar', mention: MENTION.ar, activeIndex: 2 },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

export const EmptyRightToLeft: Story = {
  args: { locale: 'ar', mention: MENTION_EMPTY.ar },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};
