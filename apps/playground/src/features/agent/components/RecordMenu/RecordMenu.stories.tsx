import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { t } from '../../copy';
import type { Locale, RecordMenuItem } from '../../model/view-types';

import { RecordMenu } from './RecordMenu';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: theme, language,
 * direction, and the `agent` inline-size container on an element with no padding, so a
 * container query sees the panel's width. A story picks its frame with
 * `parameters.panel`; a story-level decorator would nest a second frame inside this one.
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
          justifyContent: 'flex-end',
          minBlockSize: 260,
          padding: 'var(--bldr-space-3xl)',
        }}
      >
        <Story />
      </div>
    </div>
  );
};

const BUILD_MENU: readonly RecordMenuItem[] = ['restore', 'reuse', 'copySummary', 'technical'];

/** Opens the menu from the keyboard and checks the SPEC §6.7 map on it. */
async function openFromKeyboard(canvasElement: HTMLElement, name: string): Promise<HTMLElement[]> {
  const trigger = within(canvasElement).getByRole('button', { name });
  trigger.focus();
  await userEvent.keyboard('{Enter}');
  const menu = await waitFor(() => within(canvasElement).getByRole('menu'));
  const items = within(menu).getAllByRole('menuitem');
  await waitFor(() => expect(items[0]).toHaveFocus());
  return items;
}

const meta = {
  title: 'Agent/Primitives/RecordMenu',
  component: RecordMenu,
  parameters: { layout: 'centered' },
  args: { locale: 'en', items: BUILD_MENU, onSelect: () => undefined },
  argTypes: {
    locale: { control: 'inline-radio', options: ['en', 'ar'] },
  },
  decorators: [inPanel],
} satisfies Meta<typeof RecordMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: the `[⋯]` at a record footer's inline end. */
export const Closed: Story = {};

/** Open from the keyboard: ↑ ↓ wrap, Home and End jump, Esc returns focus to `[⋯]`. */
export const KeyboardNavigation: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'More options' });
    const items = await openFromKeyboard(canvasElement, 'More options');
    await userEvent.keyboard('{ArrowDown}');
    await expect(items[1]).toHaveFocus();
    await userEvent.keyboard('{End}');
    await expect(items[3]).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(items[0]).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/** Open, as the pointer leaves it: the first item highlighted in the Wash, never Indigo. */
export const Open: Story = {
  play: async ({ canvasElement }) => {
    const items = await openFromKeyboard(canvasElement, 'More options');
    await expect(items.map((item) => item.textContent)).toEqual([
      t('en', 'menu.restore'),
      t('en', 'menu.reuse'),
      t('en', 'menu.copySummary'),
      t('en', 'menu.technical'),
    ]);
  },
};

export const OpenDark: Story = {
  parameters: { panel: { theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await openFromKeyboard(canvasElement, 'More options');
  },
};

/** Arabic: the menu opens aligned to the trigger's inline end, now the left, and reads RTL. */
export const OpenRightToLeft: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await openFromKeyboard(canvasElement, t('ar', 'menu.label'));
    const menu = within(canvasElement).getByRole('menu');
    await expect(menu).toHaveAttribute('dir', 'rtl');
    await expect(menu).toHaveAttribute('lang', 'ar');
    // Inside the panel: its theme and the Arabic type tokens reach the menu.
    await expect(canvasElement.querySelector('.ck-agent')).toContainElement(menu);
    await expect(getComputedStyle(menu).fontFamily).toMatch(/^"IBM Plex Sans Arabic"/);
  },
};

export const OpenRightToLeftDark: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
  play: async ({ canvasElement }) => {
    await openFromKeyboard(canvasElement, t('ar', 'menu.label'));
  },
};

/** An answer offers one thing. */
export const AnswerMenu: Story = {
  args: { items: ['copyAnswer'] },
};
