import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { Locale } from '../../model/view-types';
import { AgentTooltipProvider } from '../IconButton';

import { AgentHeader } from './AgentHeader';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
  /** The phone sheet sets the header to 56px (SPEC §2.7); the docked panel keeps 44. */
  readonly headerHeight?: number;
}

/**
 * One panel frame per story, drawn as AgentPanel draws its root: a region named أبو غضب,
 * with the theme, the story's language and direction, and the `agent` inline-size
 * container, so the header's container query sees the panel's width. The language comes
 * from the story's `locale` arg; theme, width and the sheet's header height from
 * `parameters.panel`.
 */
const inPanel: Decorator = (Story, { args, parameters }) => {
  const locale: Locale = args['locale'] === 'ar' ? 'ar' : 'en';
  const { theme = 'light', width = 320, headerHeight } = (parameters['panel'] ?? {}) as Frame;
  return (
    <section
      className="ck-agent"
      aria-label={t(locale, 'header.name')}
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={
        {
          inlineSize: width,
          background: 'var(--bldr-panel)',
          color: 'var(--bldr-panel-text)',
          fontFamily: 'var(--bldr-font)',
          containerType: 'inline-size',
          containerName: 'agent',
          ...(headerHeight === undefined
            ? {}
            : { '--bldr-agent-header-height': `${String(headerHeight)}px` }),
        } as CSSProperties
      }
    >
      <AgentTooltipProvider>
        <Story />
      </AgentTooltipProvider>
    </section>
  );
};

/* ── What every header must be (SPEC §4.2) ───────────────────────────────── */

/**
 * One line: the face, one name in the UI language and nothing else written. No "Agent",
 * no status beside the name, no conversation title, no count.
 */
async function expectOneName(canvasElement: HTMLElement, locale: Locale): Promise<void> {
  const header = canvasElement.querySelector<HTMLElement>('.ck-agent-header');
  if (header === null) throw new Error('no header');
  const name = within(header).getByRole('heading', { level: 2 });
  await expect(name).toHaveTextContent(t(locale, 'header.name'));
  // What is drawn, not what is hidden: a tooltip's hint sits in the DOM, `hidden`.
  await expect(header.innerText.trim()).toBe(t(locale, 'header.name'));
  await expect(header.innerText).not.toMatch(/agent/iu);
  await expect(header.querySelector('.ck-agent-header__face')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  const box = header.getBoundingClientRect();
  await expect(Math.round(box.height)).toBe(44);
  await expect(name.getBoundingClientRect().height).toBeLessThanOrEqual(24);
}

/** The face stands on the thread's gutter: 16px in, 12px under a 320px panel. */
async function expectFaceOnGutter(
  canvasElement: HTMLElement,
  locale: Locale,
  gutter: number,
): Promise<void> {
  const panel = canvasElement.querySelector('.ck-agent')?.getBoundingClientRect();
  const face = canvasElement.querySelector('.ck-agent-header__face')?.getBoundingClientRect();
  if (panel === undefined || face === undefined) throw new Error('no face');
  const inset = locale === 'ar' ? panel.right - face.right : face.left - panel.left;
  await expect(Math.round(inset)).toBe(gutter);
}

const meta = {
  title: 'Agent/Frame/AgentHeader',
  component: AgentHeader,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    face: { mood: 'idle' },
    scrolled: false,
    running: false,
    conversationsOpen: false,
    onConversations: fn(),
    onNewConversation: fn(),
  },
  decorators: [inPanel],
} satisfies Meta<typeof AgentHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** At rest: flat, no line under it. The face, the name, Conversations and New. */
export const AtRest: Story = {
  play: async ({ canvasElement, args }) => {
    await expectOneName(canvasElement, 'en');
    await expectFaceOnGutter(canvasElement, 'en', 16);
    const canvas = within(canvasElement);
    const conversations = canvas.getByRole('button', { name: 'Conversations' });
    await expect(conversations).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(conversations).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(canvas.getByRole('button', { name: 'New conversation' }));
    await expect(args.onNewConversation).toHaveBeenCalledTimes(1);
  },
};

/** Arabic: «أبو غضب» at the right, the buttons at the left, mirrored by logical properties. */
export const AtRestArabic: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await expectOneName(canvasElement, 'ar');
    await expectFaceOnGutter(canvasElement, 'ar', 16);
    const name = canvasElement.querySelector('.ck-agent-header__name')?.getBoundingClientRect();
    const actions = canvasElement
      .querySelector('.ck-agent-header__actions')
      ?.getBoundingClientRect();
    if (name === undefined || actions === undefined) throw new Error('header parts');
    await expect(actions.right).toBeLessThanOrEqual(name.left);
  },
};

/** The thread is scrolled beneath: a 1px Hairline at the header's block end (SPEC §2.5). */
export const Scrolled: Story = {
  args: { scrolled: true },
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector('.ck-agent-header');
    await expect(header).toHaveAttribute('data-scrolled');
    await expectOneName(canvasElement, 'en');
  },
};

export const ScrolledArabicDark: Story = {
  args: { locale: 'ar', scrolled: true },
  globals: { direction: 'rtl' },
  parameters: { panel: { theme: 'dark' } },
};

/**
 * A run is live: the face works, and New conversation stays focusable, `aria-disabled`,
 * its tooltip saying when it will be available. A press does nothing.
 */
export const Running: Story = {
  args: { running: true, face: { mood: 'working' } },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const fresh = canvas.getByRole('button', { name: 'New conversation' });
    await expect(fresh).toHaveAttribute('aria-disabled', 'true');
    await expect(fresh).toHaveAccessibleDescription(t('en', 'header.new.busy'));
    await userEvent.click(fresh);
    await expect(args.onNewConversation).not.toHaveBeenCalled();
    fresh.focus();
    await expect(fresh).toHaveFocus();
    const tooltip = await waitFor(() => within(canvasElement).getByRole('tooltip'));
    await expect(tooltip).toHaveTextContent(t('en', 'header.new.busy'));
    await expectOneName(canvasElement, 'en');
  },
};

export const RunningArabic: Story = {
  args: { locale: 'ar', running: true, face: { mood: 'working' } },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    const fresh = within(canvasElement).getByRole('button', { name: t('ar', 'header.new') });
    await expect(fresh).toHaveAccessibleDescription(t('ar', 'header.new.busy'));
  },
};

/** Conversations open: the button says so (`aria-expanded`) and keeps the Wash under it. */
export const ConversationsOpen: Story = {
  args: { conversationsOpen: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Conversations' });
    await expect(button).toHaveAttribute('aria-expanded', 'true');
  },
};

export const Dark: Story = {
  parameters: { panel: { theme: 'dark' } },
};

export const DarkRunning: Story = {
  args: { running: true, face: { mood: 'working' } },
  parameters: { panel: { theme: 'dark' } },
};

/** A 288px panel (compact density): the gutter narrows to 12px and the face follows it. */
export const Narrow288: Story = {
  parameters: { panel: { width: 288 } },
  play: async ({ canvasElement }) => {
    await expectFaceOnGutter(canvasElement, 'en', 12);
  },
};

/** The widest panel: the same one line, the buttons still at the inline end. */
export const Wide480Arabic: Story = {
  args: { locale: 'ar' },
  globals: { direction: 'rtl' },
  parameters: { panel: { width: 480 } },
};

/**
 * The phone sheet (SPEC §3.16): Close at the inline start, then the face and the name;
 * Conversations, New and Show the page at the inline end. AgentSheet sets 56px.
 */
export const PhoneSheet: Story = {
  args: { onClose: fn(), onShowPage: fn() },
  parameters: { panel: { width: 390, headerHeight: 56 } },
  play: async ({ canvasElement, args }) => {
    const buttons = within(canvasElement).getAllByRole('button');
    await expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      t('en', 'sheet.close'),
      t('en', 'header.conversations'),
      t('en', 'header.new'),
      t('en', 'sheet.showPage'),
    ]);
    // A touch surface whatever the pointer: every target 44px, 8px apart, in a 56px line.
    for (const button of buttons) {
      await expect(Math.round(button.getBoundingClientRect().height)).toBe(44);
    }
    const [, conversations, fresh] = buttons;
    if (conversations === undefined || fresh === undefined) throw new Error('actions');
    await expect(
      Math.round(fresh.getBoundingClientRect().left - conversations.getBoundingClientRect().right),
    ).toBe(8);
    const header = canvasElement.querySelector('.ck-agent-header');
    await expect(Math.round(header?.getBoundingClientRect().height ?? 0)).toBe(56);
    await userEvent.click(within(canvasElement).getByRole('button', { name: 'Show the page' }));
    await expect(args.onShowPage).toHaveBeenCalledTimes(1);
  },
};

export const PhoneSheetArabic: Story = {
  args: { locale: 'ar', onClose: fn(), onShowPage: fn() },
  globals: { direction: 'rtl' },
  parameters: { panel: { width: 390, headerHeight: 56 } },
};
