import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { AnswerView, Locale } from '../../model/view-types';
import { answerLong, answerShort } from '../../testing/wp-12-records-fixtures';

import { AnswerRecord } from './AnswerRecord';

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

/* ── Plays ────────────────────────────────────────────────────────────────── */

async function expectNoSidewaysScroll(canvasElement: HTMLElement): Promise<void> {
  const root = canvasElement.querySelector('.ck-agent');
  if (root === null) throw new Error('no panel');
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
}

/**
 * A long answer opens folded to six lines behind "Show more", a real disclosure: it opens the
 * prose, keeps focus, and reads "Show less" once open.
 */
async function expectFoldsAndOpens(canvasElement: HTMLElement, locale: Locale): Promise<void> {
  const canvas = within(canvasElement);
  const prose = canvasElement.querySelector('.ck-agent-answer__prose');
  if (prose === null) throw new Error('no prose');
  const lineHeight = Number.parseFloat(getComputedStyle(prose).lineHeight);
  await expect(prose.getBoundingClientRect().height).toBeLessThanOrEqual(lineHeight * 6 + 0.5);
  const more = await canvas.findByRole('button', { name: t(locale, 'answer.more') });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(more);
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(more).toHaveAccessibleName(t(locale, 'answer.less'));
  await expect(more).toHaveFocus();
  await waitFor(async () => {
    await expect(prose.getBoundingClientRect().height).toBeGreaterThan(lineHeight * 6);
  });
}

/* ── Stories ──────────────────────────────────────────────────────────────── */

const meta = {
  title: 'Agent/Records/AnswerRecord',
  component: AnswerRecord,
  parameters: { layout: 'centered' },
  args: { locale: 'en', view: answerShort('en'), onMenuSelect: fn() },
  argTypes: {
    locale: { control: 'inline-radio', options: ['en', 'ar'] },
  },
  decorators: [inPanel],
} satisfies Meta<typeof AnswerRecord>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The Arabic twin of a story: the same answer, in Arabic, right to left. */
function arabic(view: AnswerView, frame: Frame = {}): Story {
  return {
    args: { locale: 'ar', view },
    globals: { direction: 'rtl' },
    parameters: { panel: { locale: 'ar', ...frame } },
  };
}

/** A short answer: the note glyph, "Answer", the prose in Ink, `[⋯]` to copy it. */
export const Short: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('article', { name: t('en', 'answer.title') })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: t('en', 'answer.more') })).toBeNull();
    await expect(
      canvasElement.querySelector('.ck-agent-record__head .ck-agent-glyph'),
    ).toHaveAttribute('data-state', 'note');
  },
};

export const ShortRightToLeft: Story = arabic(answerShort('ar'));
export const ShortDark: Story = { parameters: { panel: { theme: 'dark' } } };
export const ShortRightToLeftDark: Story = arabic(answerShort('ar'), { theme: 'dark' });

/** Longer than six lines: folded, with "Show more". */
export const Long: Story = {
  args: { view: answerLong('en') },
  play: async ({ canvasElement }) => {
    await expectFoldsAndOpens(canvasElement, 'en');
    await expectNoSidewaysScroll(canvasElement);
  },
};

export const LongRightToLeft: Story = {
  ...arabic(answerLong('ar')),
  play: async ({ canvasElement }) => {
    await expectFoldsAndOpens(canvasElement, 'ar');
    await expectNoSidewaysScroll(canvasElement);
  },
};

export const LongDark: Story = {
  args: { view: answerLong('en') },
  parameters: { panel: { theme: 'dark' } },
};
export const LongRightToLeftDark: Story = arabic(answerLong('ar'), { theme: 'dark' });

export const LongAt420: Story = {
  args: { view: answerLong('en') },
  parameters: { panel: { width: 420 } },
};
export const LongAt420RightToLeft: Story = arabic(answerLong('ar'), { width: 420 });

/**
 * An English answer in the Arabic panel: the record mirrors, the prose keeps its own
 * direction and language (SPEC §4.10, §6.6).
 */
export const EnglishInArabicPanel: Story = {
  ...arabic(answerShort('en')),
  play: async ({ canvasElement }) => {
    const prose = canvasElement.querySelector('.ck-agent-answer__prose');
    await expect(prose).toHaveAttribute('dir', 'ltr');
    await expect(prose).toHaveAttribute('lang', 'en');
  },
};

/** An Arabic answer in the English panel. */
export const ArabicInEnglishPanel: Story = {
  args: { view: answerShort('ar') },
  play: async ({ canvasElement }) => {
    const prose = canvasElement.querySelector('.ck-agent-answer__prose');
    await expect(prose).toHaveAttribute('dir', 'rtl');
    await expect(prose).toHaveAttribute('lang', 'ar');
  },
};

/** `[⋯]` offers Copy answer; the caller copies it. */
export const CopyAnswer: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: t('en', 'menu.label') }));
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole('menuitem', { name: t('en', 'menu.copyAnswer') }));
    await expect(args.onMenuSelect).toHaveBeenCalledWith('copyAnswer');
  },
};
