import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { Locale, SessionSummary } from '../../model/view-types';
import { conversations, FIXTURE_NOW } from '../../testing/wp-15-history-phone-fixtures';
import { AgentTooltipProvider } from '../IconButton';

import { HistoryRow, type HistoryRowProps } from './HistoryRow';

/* ── The Conversations list the row lives in ──────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  /** The list's width: the 320px panel less 8px a side (SPEC §4.18), or the 390px phone. */
  readonly width?: number;
}

/**
 * One list frame per story: the panel's theme, language and direction, and the popover's
 * Sheet with its 4px inset, so the row sits exactly where it sits in HistoryPopover. The
 * row is an `li`; the frame gives it its `ul`. A story picks its frame with
 * `parameters.panel`.
 */
const inList: Decorator = (Story, { parameters }) => {
  const { locale = 'en', theme = 'light', width = 304 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <div
      className="ck-agent"
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: width,
        padding: 'var(--bldr-space-xs)',
        boxSizing: 'border-box',
        border: 'var(--bldr-border-hairline) solid var(--bldr-surface-border)',
        borderRadius: 'var(--bldr-radius-lg)',
        background: 'var(--bldr-surface)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
      }}
    >
      <AgentTooltipProvider>
        <ul role="list" aria-label={t(locale, 'history.title')} style={{ margin: 0, padding: 0 }}>
          <Story />
        </ul>
      </AgentTooltipProvider>
    </div>
  );
};

function session(locale: Locale, index: number, current = false): SessionSummary {
  const found = conversations(locale, 12, null)[index];
  if (found === undefined) throw new Error(`no conversation ${String(index)}`);
  return { ...found, current };
}

function rowButton(canvasElement: HTMLElement): HTMLElement {
  const button = canvasElement.querySelector<HTMLElement>('.ck-agent-history-row__open');
  if (button === null) throw new Error('no row button');
  return button;
}

/** 40px on a mouse, 44 in the phone sheet; the delete button a sibling of the row button. */
async function expectRow(canvasElement: HTMLElement, height: number): Promise<void> {
  const open = rowButton(canvasElement);
  await expect(Math.round(open.getBoundingClientRect().height)).toBe(height);
  const trash = canvasElement.querySelector('.ck-agent-history-row__delete');
  await expect(trash).not.toBeNull();
  await expect(open.contains(trash)).toBe(false);
}

const meta = {
  title: 'Agent/History/HistoryRow',
  component: HistoryRow,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    session: session('en', 1),
    now: FIXTURE_NOW,
    onOpen: fn(),
    onDelete: fn(),
  },
  decorators: [inList],
} satisfies Meta<typeof HistoryRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A row in `locale` and `theme`, with the checks every row must pass. */
/** What a row story varies: the conversation, and the list's state around it. */
type RowArgs = Pick<HistoryRowProps, 'session'> &
  Partial<
    Pick<HistoryRowProps, 'openUnavailable' | 'deleteUnavailable' | 'unavailableId' | 'touch'>
  >;

function row(locale: Locale, theme: 'light' | 'dark', args: RowArgs, height = 40): Story {
  return {
    args: { locale, ...args },
    parameters: { panel: { locale, theme, ...(height === 44 ? { width: 390 } : {}) } },
    ...(locale === 'ar' ? { globals: { direction: 'rtl' } } : {}),
    play: async ({ canvasElement }) => {
      await expectRow(canvasElement, height);
    },
  };
}

/* ── A past conversation ─────────────────────────────────────────────────── */

/** Title (the first request) in Read, the time in Meta and Slate at the inline end. */
export const Default: Story = row('en', 'light', { session: session('en', 1) });
export const DefaultDark: Story = row('en', 'dark', { session: session('en', 1) });
export const DefaultArabic: Story = row('ar', 'light', { session: session('ar', 1) });
export const DefaultArabicDark: Story = row('ar', 'dark', { session: session('ar', 1) });

/**
 * The current conversation: Mist, a 2px Indigo bar at the inline start, and "Current"
 * before the time, in Graphite (Slate on Mist is forbidden). No check mark.
 */
export const Current: Story = {
  ...row('en', 'light', { session: session('en', 0, true) }),
  play: async ({ canvasElement }) => {
    await expectRow(canvasElement, 40);
    const open = rowButton(canvasElement);
    await expect(open).toHaveAttribute('aria-current', 'true');
    await expect(open).toHaveTextContent(t('en', 'history.current'));
    await expect(open.textContent).not.toMatch(/✓/u);
  },
};
export const CurrentDark: Story = row('en', 'dark', { session: session('en', 0, true) });
export const CurrentArabic: Story = row('ar', 'light', { session: session('ar', 0, true) });
export const CurrentArabicDark: Story = row('ar', 'dark', { session: session('ar', 0, true) });

/** Older than six days: a date, «21 أيلول» / "21 Sep", in Latin digits. */
export const OlderDate: Story = row('en', 'light', { session: session('en', 3) });
export const OlderDateArabic: Story = row('ar', 'light', { session: session('ar', 3) });

/** Migrated from v1 storage, which kept no time: the title alone. */
export const NoTime: Story = row('en', 'light', { session: session('en', 11) });

/**
 * A title in the other script keeps its own direction: an Arabic request in an English
 * list reads right to left, and its ellipsis falls at its own end.
 */
export const OtherScript: Story = row('en', 'light', { session: session('en', 5) });
export const OtherScriptArabic: Story = row('ar', 'light', { session: session('ar', 3) });

/** A long first request: one line, the ellipsis at its end, the time never pushed off. */
export const LongTitle: Story = row('en', 'light', {
  session: {
    ...session('en', 2),
    title:
      'A portfolio for Lina, a product designer in Amman, with case studies, a short bio and a contact form',
  },
});

/* ── Focus and delete ────────────────────────────────────────────────────── */

/** Focus anywhere in the row brings Delete in over the time, on a mouse. */
export const Focused: Story = {
  ...row('en', 'light', { session: session('en', 1) }),
  play: async ({ canvasElement }) => {
    await userEvent.tab();
    await expect(rowButton(canvasElement)).toHaveFocus();
    const trash = within(canvasElement).getByRole('button', {
      name: t('en', 'history.delete'),
    });
    // It fades in over 120ms (a colour-only change, SPEC §2.6).
    await waitFor(() => expect(getComputedStyle(trash).opacity).toBe('1'));
  },
};

/** The Delete key asks first, in the row; focus goes to Cancel; Esc goes back to the row. */
export const Confirming: Story = {
  ...row('en', 'light', { session: session('en', 1) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.tab();
    await userEvent.keyboard('{Delete}');
    await expect(canvas.getByRole('button', { name: t('en', 'history.confirm.no') })).toHaveFocus();
    await expect(canvas.getByRole('group')).toHaveAccessibleName(t('en', 'history.confirm'));
    await userEvent.keyboard('{Escape}');
    await expect(rowButton(canvasElement)).toHaveFocus();
  },
};

export const ConfirmingArabicDark: Story = {
  ...row('ar', 'dark', { session: session('ar', 1) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: t('ar', 'history.delete') }));
    await expect(canvas.getByRole('button', { name: t('ar', 'history.confirm.no') })).toHaveFocus();
  },
};

/* ── While a run is live ─────────────────────────────────────────────────── */

/** Another conversation waits: focusable, `aria-disabled`, and says why. */
export const OpenUnavailable: Story = {
  ...row('en', 'light', {
    session: session('en', 1),
    openUnavailable: true,
    unavailableId: 'history-busy',
  }),
  render: (args) => (
    <>
      <HistoryRow {...args} />
      <li id="history-busy" style={{ listStyle: 'none' }} hidden>
        {t('en', 'history.busy')}
      </li>
    </>
  ),
  play: async ({ canvasElement }) => {
    await expect(rowButton(canvasElement)).toHaveAttribute('aria-disabled', 'true');
    await expect(rowButton(canvasElement)).toHaveAccessibleDescription(t('en', 'history.busy'));
  },
};

/** The current conversation cannot be deleted while its run is live. */
export const DeleteUnavailable: Story = {
  ...row('en', 'light', { session: session('en', 0, true), deleteUnavailable: true }),
  play: async ({ canvasElement }) => {
    const trash = within(canvasElement).getByRole('button', { name: t('en', 'history.delete') });
    await expect(trash).toHaveAttribute('aria-disabled', 'true');
  },
};

/* ── The phone sheet's list ──────────────────────────────────────────────── */

/** 44px, Delete always there beside the time: a finger has no hover. */
export const Touch: Story = row('en', 'light', { session: session('en', 1), touch: true }, 44);
export const TouchCurrentArabic: Story = row(
  'ar',
  'light',
  { session: session('ar', 0, true), touch: true },
  44,
);
export const TouchArabicDark: Story = row(
  'ar',
  'dark',
  { session: session('ar', 2), touch: true },
  44,
);
