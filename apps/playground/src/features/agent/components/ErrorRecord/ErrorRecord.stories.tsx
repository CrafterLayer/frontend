import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { ErrorClass, ErrorView, Locale } from '../../model/view-types';
import { ERROR_CLASSES, errorView, errorViewTimed } from '../../testing/wp-12-records-fixtures';

import { ErrorRecord, type ErrorRecordActions } from './ErrorRecord';

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
      <div style={{ minBlockSize: 160, padding: 'var(--bldr-space-3xl)' }}>
        <Story />
      </div>
    </div>
  );
};

/** Every controller action the record may call, logged in the Actions panel. */
const actions: ErrorRecordActions = { tryAgain: fn(), removeEmpty: fn() };

/* ── Plays ────────────────────────────────────────────────────────────────── */

/**
 * Only classified words reach the screen (SPEC §4.14, §6.5): the fixture's technical text
 * names a run id, a command, a skill id, a token count and a timing, and none of it shows.
 */
async function expectNoInternals(canvasElement: HTMLElement): Promise<void> {
  const text = canvasElement.textContent;
  for (const internal of ['fill-3', 'setProp', 'craftkit.', '11.2k', '45000ms', 'remote/']) {
    await expect(text).not.toContain(internal);
  }
}

async function expectNoSidewaysScroll(canvasElement: HTMLElement): Promise<void> {
  const root = canvasElement.querySelector('.ck-agent');
  if (root === null) throw new Error('no panel');
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
}

/** Every class stacked, as a long conversation might hold them. */
function EveryClass({ locale }: { readonly locale: Locale }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--bldr-space-3xl)' }}>
      {ERROR_CLASSES.map((failure) => (
        <ErrorRecord
          key={failure}
          locale={locale}
          view={errorView(failure)}
          actions={actions}
          onMenuSelect={fn()}
        />
      ))}
    </div>
  );
}

/* ── Stories ──────────────────────────────────────────────────────────────── */

const meta = {
  title: 'Agent/Records/ErrorRecord',
  component: ErrorRecord,
  parameters: { layout: 'centered' },
  args: { locale: 'en', view: errorView('unreachable'), actions, onMenuSelect: fn() },
  argTypes: {
    locale: { control: 'inline-radio', options: ['en', 'ar'] },
  },
  decorators: [inPanel],
} satisfies Meta<typeof ErrorRecord>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One class of failure, in English, with its words, its page sentence and no internals. */
function english(failure: ErrorClass): Story {
  return {
    args: { view: errorView(failure) },
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      await expect(
        canvas.getByRole('article', { name: t('en', `error.${failure}.title`) }),
      ).toBeVisible();
      await expect(canvas.getByText(t('en', 'error.page.unchanged'))).toBeVisible();
      const retry = canvas.queryByRole('button', { name: t('en', 'error.retry') });
      if (failure === 'declined') await expect(retry).toBeNull();
      else await expect(retry).toBeVisible();
      await expectNoInternals(canvasElement);
    },
  };
}

/** The Arabic twin of a story: the same failure, in Arabic, right to left. */
function arabic(view: ErrorView, frame: Frame = {}): Story {
  return {
    args: { locale: 'ar', view },
    globals: { direction: 'rtl' },
    parameters: { panel: { locale: 'ar', ...frame } },
    play: async ({ canvasElement }) => {
      await expectNoInternals(canvasElement);
      await expectNoSidewaysScroll(canvasElement);
    },
  };
}

/** §3.11: the AI server didn't answer. The page wasn't changed. Try again. */
export const Unreachable: Story = english('unreachable');
export const UnreachableRightToLeft: Story = arabic(errorView('unreachable'));
export const UnreachableDark: Story = {
  ...english('unreachable'),
  parameters: { panel: { theme: 'dark' } },
};
export const UnreachableRightToLeftDark: Story = arabic(errorView('unreachable'), {
  theme: 'dark',
});

/** §3.11 as drawn, with the run's final time at the head's end once the view carries it. */
export const UnreachableWithTime: Story = {
  args: { view: errorViewTimed('unreachable', 31_000) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.ck-agent-record__meta')).toHaveTextContent('0:31');
  },
};

export const UnreachableWithTimeRightToLeft: Story = arabic(errorViewTimed('unreachable', 31_000));

export const Timeout: Story = english('timeout');
export const TimeoutRightToLeft: Story = arabic(errorView('timeout'));

/** The longest cause: two sentences, wrapping as prose, never clipped. */
export const Busy: Story = english('busy');
export const BusyRightToLeft: Story = arabic(errorView('busy'));

/** Declined: different wording may work, so there is no Try again. */
export const Declined: Story = english('declined');
export const DeclinedRightToLeft: Story = arabic(errorView('declined'));

export const Invalid: Story = english('invalid');
export const InvalidRightToLeft: Story = arabic(errorView('invalid'));

export const TooLarge: Story = english('tooLarge');
export const TooLargeRightToLeft: Story = arabic(errorView('tooLarge'));

export const Offline: Story = english('offline');
export const OfflineRightToLeft: Story = arabic(errorView('offline'));

/** Unknown: the title alone says it; there is no cause line to invent. */
export const Unknown: Story = english('unknown');
export const UnknownRightToLeft: Story = arabic(errorView('unknown'));

/** Sections landed before the error: they stay, and the sentence counts them. */
export const KeptWhatLanded: Story = {
  args: { view: errorView('timeout', { kind: 'kept', landed: 3 }) },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(t('en', 'error.page.kept', { n: 3 })),
    ).toBeVisible();
  },
};

export const KeptWhatLandedRightToLeft: Story = arabic(
  errorView('timeout', { kind: 'kept', landed: 3 }),
);

/** The empty layout is still on the page: "Remove the empty layout" beside Try again. */
export const SkeletonLeft: Story = {
  args: { view: errorView('invalid', { kind: 'skeleton' }) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: t('en', 'error.removeSkeleton') }));
    await expect(args.actions.removeEmpty).toHaveBeenCalledWith(args.view.turnId);
    await expect(canvas.getByRole('heading', { level: 3 })).toHaveFocus();
  },
};

export const SkeletonLeftRightToLeft: Story = arabic(errorView('invalid', { kind: 'skeleton' }));
export const SkeletonLeftRightToLeftDark: Story = arabic(
  errorView('invalid', { kind: 'skeleton' }),
  { theme: 'dark' },
);

/** A record from v1 that never kept what landed first: the sentence says only what is true. */
export const PageStateUnknown: Story = {
  args: { view: errorView('unreachable', { kind: 'unknown' }) },
};

export const PageStateUnknownRightToLeft: Story = arabic(
  errorView('unreachable', { kind: 'unknown' }),
);

/**
 * Try again is an action, not a message: the controller starts a successor run, and focus
 * goes to this record's head instead of falling to the page.
 */
export const TryAgain: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: t('en', 'error.retry') }));
    await expect(args.actions.tryAgain).toHaveBeenCalledWith(args.view.turnId);
    await expect(
      canvas.getByRole('heading', { level: 3, name: t('en', 'error.unreachable.title') }),
    ).toHaveFocus();
  },
};

/** `[⋯]` offers Copy error details: the technical text goes to the clipboard only. */
export const CopyErrorDetails: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: t('en', 'menu.label') }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole('menuitem', { name: t('en', 'error.copy') }));
    await expect(args.onMenuSelect).toHaveBeenCalledWith('copyError');
  },
};

/** Every class at 320, stacked. */
export const EveryClassAt320: Story = {
  render: () => <EveryClass locale="en" />,
  play: async ({ canvasElement }) => {
    await expectNoInternals(canvasElement);
    await expectNoSidewaysScroll(canvasElement);
  },
};

export const EveryClassAt420RightToLeft: Story = {
  render: () => <EveryClass locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', width: 420 } },
  play: async ({ canvasElement }) => {
    await expectNoInternals(canvasElement);
    await expectNoSidewaysScroll(canvasElement);
  },
};

export const EveryClassRightToLeftDark: Story = {
  render: () => <EveryClass locale="ar" />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};
