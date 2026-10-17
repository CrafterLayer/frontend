import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { expect, fn, userEvent, within } from 'storybook/test';

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';

import { t } from '../../copy';
import type { Locale, SuggestionView } from '../../model/view-types';
import { frameSuggestions } from '../../testing/wp-11-frame-fixtures';

import { SuggestionList } from './SuggestionList';

/* ── The panel's root, as AgentPanel draws it ─────────────────────────────── */

interface Frame {
  readonly theme?: 'light' | 'dark';
  readonly width?: number;
}

/** The thread's paper, 16px gutter and 12px block padding, in the story's language. */
const inPanel: Decorator = (Story, { args, parameters }) => {
  const locale: Locale = args['locale'] === 'ar' ? 'ar' : 'en';
  const { theme = 'light', width = 320 } = (parameters['panel'] ?? {}) as Frame;
  return (
    <section
      className="ck-agent"
      aria-label={t(locale, 'header.name')}
      data-bldr-theme={theme}
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={{
        inlineSize: width,
        boxSizing: 'border-box',
        paddingBlock: 'var(--bldr-space-xl)',
        paddingInline: 'var(--bldr-space-3xl)',
        background: 'var(--bldr-panel)',
        color: 'var(--bldr-panel-text)',
        fontFamily: 'var(--bldr-font)',
        containerType: 'inline-size',
        containerName: 'agent',
      }}
    >
      <Story />
    </section>
  );
};

/* ── A stand-in composer, to show what choosing a row does ───────────────── */

/**
 * What AgentPanel wires (SPEC §4.16, §6.3): choosing a row puts its text in the composer
 * and focuses the composer with the caret at the end. Sending is a separate act, the
 * person's own: this stand-in counts sends, and a chosen row must never add one.
 */
function WithComposer({
  locale,
  suggestions,
}: {
  readonly locale: Locale;
  readonly suggestions: readonly SuggestionView[];
}) {
  const [draft, setDraft] = useState('');
  const [sent, setSent] = useState(0);
  const field = useRef<HTMLTextAreaElement>(null);
  return (
    <form
      style={{ display: 'grid', gap: 'var(--bldr-space-3xl)' }}
      onSubmit={(event) => {
        event.preventDefault();
        setSent((count) => count + 1);
      }}
    >
      <SuggestionList
        locale={locale}
        suggestions={suggestions}
        onChoose={(suggestion) => {
          flushSync(() => {
            setDraft(suggestion.text);
          });
          const element = field.current;
          if (element === null) return;
          element.focus();
          element.setSelectionRange(element.value.length, element.value.length);
        }}
      />
      <textarea
        ref={field}
        aria-label={t(locale, 'input.aria')}
        placeholder={t(locale, 'placeholder.auto')}
        rows={2}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        style={{
          boxSizing: 'border-box',
          inlineSize: '100%',
          padding: 'var(--bldr-space-md)',
          border: 'var(--bldr-border-hairline) solid var(--bldr-panel-border-strong)',
          borderRadius: 'var(--bldr-radius-xl)',
          background: 'var(--bldr-surface)',
          color: 'var(--bldr-panel-text)',
          fontFamily: 'var(--bldr-font)',
          fontSize: 'var(--bldr-font-size-input)',
          lineHeight: 'var(--bldr-line-height-input)',
          resize: 'none',
        }}
      />
      <span data-sent={sent} hidden>
        {sent}
      </span>
    </form>
  );
}

/**
 * Each row is a quiet card (Studio Indigo, 2026-10-12): its words start 33px in — the hairline,
 * 8px, the 16px glyph column and 8px — no longer on the records' 24px title edge.
 */
async function expectRowGeometry(canvasElement: HTMLElement, locale: Locale): Promise<void> {
  for (const row of within(canvasElement).getAllByRole('button')) {
    const box = row.getBoundingClientRect();
    const text = row.querySelector('.ck-agent-suggestion__text')?.getBoundingClientRect();
    if (text === undefined) throw new Error('row text');
    const inset = locale === 'ar' ? box.right - text.right : text.left - box.left;
    await expect(Math.round(inset)).toBe(33);
    await expect(box.height).toBeGreaterThanOrEqual(32);
  }
  const root = canvasElement.querySelector('.ck-agent');
  if (root === null) throw new Error('no panel');
  await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
}

const EN = frameSuggestions('en');
const AR = frameSuggestions('ar');

const meta = {
  title: 'Agent/Frame/SuggestionList',
  component: SuggestionList,
  parameters: { layout: 'centered' },
  args: { locale: 'en', suggestions: EN.starters, onChoose: fn() },
  decorators: [inPanel],
} satisfies Meta<typeof SuggestionList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An empty page's four starters: a trade and what its page must do, each. */
export const Starters: Story = {
  play: async ({ canvasElement, args }) => {
    await expectRowGeometry(canvasElement, 'en');
    const first = EN.starters[0];
    if (first === undefined) throw new Error('no starter');
    const row = within(canvasElement).getByRole('button', { name: first.text });
    await expect(row).toHaveAccessibleDescription(t('en', 'suggestions.description'));
    await userEvent.click(row);
    await expect(args.onChoose).toHaveBeenCalledWith(first);
  },
};

export const StartersArabic: Story = {
  args: { locale: 'ar', suggestions: AR.starters },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    await expectRowGeometry(canvasElement, 'ar');
  },
};

/** After a run, three of the model's follow-ups, written as the person's next request. */
export const AfterRun: Story = {
  args: { suggestions: EN.afterRun },
};

export const AfterRunArabic: Story = {
  args: { locale: 'ar', suggestions: AR.afterRun },
  globals: { direction: 'rtl' },
};

/** A block selected: what can be done to it, naming it by its title on the page. */
export const Selection: Story = {
  args: { suggestions: EN.selection },
};

export const SelectionArabicDark: Story = {
  args: { locale: 'ar', suggestions: AR.selection },
  globals: { direction: 'rtl' },
  parameters: { panel: { theme: 'dark' } },
};

/**
 * A 288px panel: the longer rows wrap to a second line instead of losing words, and the
 * ▫ stays on the first line.
 */
export const WrapsAt288: Story = {
  args: { suggestions: EN.hasContent },
  parameters: { panel: { width: 288 } },
  play: async ({ canvasElement }) => {
    for (const row of within(canvasElement).getAllByRole('button')) {
      const glyph = row.querySelector('.ck-agent-suggestion__glyph')?.getBoundingClientRect();
      const text = row.querySelector('.ck-agent-suggestion__text')?.getBoundingClientRect();
      if (glyph === undefined || text === undefined) throw new Error('row parts');
      await expect(Math.abs(glyph.top - text.top)).toBeLessThan(1);
    }
  },
};

/**
 * A model's English follow-up inside the Arabic panel: its own direction and language,
 * so its punctuation stays at its end.
 */
export const LatinRowInArabic: Story = {
  args: {
    locale: 'ar',
    suggestions: [
      ...AR.afterRun.slice(0, 2),
      {
        key: 'followUp:latin',
        text: 'Add a FAQ about insurance (Arabic and English).',
        source: 'followUp',
      },
    ],
  },
  globals: { direction: 'rtl' },
  play: async ({ canvasElement }) => {
    const latin = within(canvasElement).getByRole('button', {
      name: 'Add a FAQ about insurance (Arabic and English).',
    });
    const text = latin.querySelector('.ck-agent-suggestion__text');
    await expect(text).toHaveAttribute('dir', 'ltr');
    await expect(text).toHaveAttribute('lang', 'en');
  },
};

/**
 * Choosing a row fills the composer and never sends: the text lands in the box, focus
 * moves there with the caret at the end, and the send count stays at 0, by click and by
 * keyboard.
 */
export const FillsTheComposer: Story = {
  render: () => <WithComposer locale="en" suggestions={EN.starters} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole<HTMLTextAreaElement>('textbox', { name: t('en', 'input.aria') });
    const [first, second] = EN.starters;
    if (first === undefined || second === undefined) throw new Error('starters');

    await userEvent.click(canvas.getByRole('button', { name: first.text }));
    await expect(field).toHaveValue(first.text);
    await expect(field).toHaveFocus();
    await expect(field.selectionStart).toBe(first.text.length);
    await expect(field.selectionEnd).toBe(first.text.length);

    canvas.getByRole('button', { name: second.text }).focus();
    await userEvent.keyboard('{Enter}');
    await expect(field).toHaveValue(second.text);
    await expect(field).toHaveFocus();
    await expect(canvasElement.querySelector('[data-sent]')).toHaveAttribute('data-sent', '0');
  },
};

export const FillsTheComposerArabic: Story = {
  args: { locale: 'ar' },
  render: () => <WithComposer locale="ar" suggestions={AR.starters} />,
  globals: { direction: 'rtl' },
};
