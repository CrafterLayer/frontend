import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

import { t } from '../../copy';
import type { ClarifyView, Locale } from '../../model/view-types';
import { clarifying } from '../../testing/wp-14-composer-fixtures';
import { AgentTooltipProvider } from '../IconButton';

import { ClarifyPanel } from './ClarifyPanel';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly locale?: Locale;
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/**
 * One panel frame per story, with the questions where they live: the first section of the
 * composer's card, over a Hairline and the (empty) box the request came from.
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
      <div style={{ padding: 'var(--bldr-space-4xl) var(--bldr-space-md) var(--bldr-space-md)' }}>
        <div
          style={{
            border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border-strong)',
            borderRadius: 'var(--bldr-radius-xl)',
            background: 'var(--bldr-surface)',
          }}
        >
          <div style={{ padding: 7 }}>
            <AgentTooltipProvider>
              <Story />
            </AgentTooltipProvider>
          </div>
          <div
            style={{
              padding: 7,
              borderBlockStart: 'var(--bldr-border-hairline) solid var(--bldr-panel-border)',
              minBlockSize: 'calc(2 * var(--bldr-line-height-input))',
            }}
          />
        </div>
      </div>
    </div>
  );
};

/** The questions, answered the way the controller answers them, for stories that play. */
function Answering({ locale, initial }: { readonly locale: Locale; readonly initial: ClarifyView }) {
  const [clarify, setClarify] = useState(initial);
  return (
    <ClarifyPanel
      locale={locale}
      clarify={clarify}
      onAnswer={(id, answer) => {
        setClarify((current) => {
          const questions = current.questions.map((question) =>
            question.id === id ? { ...question, answer } : question,
          );
          const done = questions.every((question) => question.answer !== undefined);
          return { ...current, questions, status: done ? 'rewriting' : 'asking' };
        });
      }}
      onSendAsWritten={fn()}
      onDismiss={fn()}
    />
  );
}

const meta = {
  title: 'Agent/Composer/ClarifyPanel',
  component: ClarifyPanel,
  parameters: { layout: 'centered' },
  args: {
    locale: 'en',
    clarify: clarifying('en', 3),
    onAnswer: fn(),
    onSendAsWritten: fn(),
    onDismiss: fn(),
  },
  decorators: [inPanel],
} satisfies Meta<typeof ClarifyPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Three questions, the first asked: the diamond (a decision is waiting), the title, "1 of 3",
 * what was understood, the question and its chips, Other, and the two ways out. Focus
 * starts on the first chip.
 */
export const Asking: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('group', { name: t('en', 'clarify.title') })).toBeVisible();
    await expect(canvas.getByText('Question 1 of 3')).toBeInTheDocument();
    await waitFor(() => expect(canvas.getByRole('radio', { name: 'Services' })).toHaveFocus());
  },
};

/** One question: no count, nothing to page through. */
export const OneQuestion: Story = {
  args: { clarify: clarifying('en', 1) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText('Question 1 of 1')).toBeNull();
  },
};

export const TwoQuestions: Story = {
  args: { clarify: clarifying('en', 2) },
};

/** Two answered, the last asked: each answer is a row that goes back to its question. */
export const LastQuestion: Story = {
  args: { clarify: clarifying('en', 3, 2) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Question 3 of 3')).toBeInTheDocument();
    await expect(canvas.getAllByRole('button', { name: /Services|In the header/u })).toHaveLength(2);
  },
};

/** Every question answered: the request is being rewritten, and the line says so. */
export const Rewriting: Story = {
  args: { clarify: clarifying('en', 3, 3, 'rewriting') },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(t('en', 'clarify.rewriting')),
    ).toBeInTheDocument();
    await expect(within(canvasElement).queryByRole('radio')).toBeNull();
  },
};

/** Other: the person's own answer, sent with Enter. */
export const OtherAnswer: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('radio', { name: t('en', 'clarify.other') }));
    const input = canvas.getByRole('textbox', { name: t('en', 'clarify.other.placeholder') });
    await expect(input).toHaveFocus();
    await userEvent.keyboard('The pricing page{Enter}');
    await expect(args.onAnswer).toHaveBeenCalledWith('q-page', 'The pricing page');
  },
};

/** The keyboard: → and ← follow the reading direction, Enter or Space picks. */
export const ByKeyboard: Story = {
  render: ({ locale }) => <Answering locale={locale} initial={clarifying(locale, 3)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('radio', { name: 'Services' })).toHaveFocus());
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('radio', { name: 'Contact us' })).toHaveFocus();
    await userEvent.keyboard(' ');
    await waitFor(() =>
      expect(canvas.getByRole('radio', { name: 'In the header' })).toHaveFocus(),
    );
    await expect(canvas.getByText('Question 2 of 3')).toBeInTheDocument();
  },
};

/** Send as written and Cancel: the two ways out, always there. */
export const WaysOut: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: t('en', 'clarify.sendAsWritten') }));
    await expect(args.onSendAsWritten).toHaveBeenCalledTimes(1);
    await userEvent.click(canvas.getByRole('button', { name: t('en', 'clarify.cancel') }));
    await expect(args.onDismiss).toHaveBeenCalledTimes(1);
  },
};

export const AskingDark: Story = {
  args: { clarify: clarifying('en', 3, 1) },
  parameters: { panel: { theme: 'dark' } },
};

export const RewritingDark: Story = {
  args: { clarify: clarifying('en', 3, 3, 'rewriting') },
  parameters: { panel: { theme: 'dark' } },
};

/** 420px: the chips sit on one line. */
export const AskingWide: Story = {
  args: { clarify: clarifying('en', 3, 1) },
  parameters: { panel: { width: 420 } },
};

/* ── Arabic, right to left ─────────────────────────────────────────────────── */

/** The owner's own request, asked about in Arabic: «1 من 3», the diamond at the right. */
export const AskingRightToLeft: Story = {
  args: { locale: 'ar', clarify: clarifying('ar', 3) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByText(t('ar', 'clarify.progress.aria', { i: 1, n: 3 })),
    ).toBeInTheDocument();
  },
};

export const OneQuestionRightToLeft: Story = {
  args: { locale: 'ar', clarify: clarifying('ar', 1) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

export const LastQuestionRightToLeftDark: Story = {
  args: { locale: 'ar', clarify: clarifying('ar', 3, 2) },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar', theme: 'dark' } },
};

export const RewritingRightToLeft: Story = {
  args: { locale: 'ar', clarify: clarifying('ar', 2, 2, 'rewriting') },
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
};

/** In Arabic ← moves forward: the arrows follow the reading direction, not the keycap. */
export const ByKeyboardRightToLeft: Story = {
  args: { locale: 'ar' },
  render: ({ locale }) => <Answering locale={locale} initial={clarifying(locale, 3)} />,
  globals: { direction: 'rtl' },
  parameters: { panel: { locale: 'ar' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole('radio', { name: 'الخدمات' })).toHaveFocus());
    await userEvent.keyboard('{ArrowLeft}');
    await expect(canvas.getByRole('radio', { name: 'تواصل معنا' })).toHaveFocus();
  },
};
