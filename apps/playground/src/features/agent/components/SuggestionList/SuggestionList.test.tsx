/**
 * SuggestionList (SPEC §4.16): rows that FILL the composer and never send.
 *
 * The contract, in the order a person meets it: a named list of whole requests, each
 * described as "puts the text in the box without sending it"; choosing a row hands its
 * suggestion to the owner and nothing else; no row can submit a form; and, wired the way
 * AgentPanel wires it, the text lands in the composer with the caret at the end and focus
 * there, and the send count stays at zero.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import type { Locale, SuggestionView } from '../../model/view-types';
import { frameSuggestions } from '../../testing/wp-11-frame-fixtures';

import { SuggestionList } from './SuggestionList';

const LOCALES = ['ar', 'en'] as const satisfies readonly Locale[];

const TOKENS = new Set(
  [
    ...readFileSync(
      join(process.cwd(), '..', '..', 'packages', 'builder', 'theme', 'src', 'css', 'chrome.css'),
      'utf8',
    ).matchAll(/(--bldr-[\w-]+)\s*:/gu),
  ].map(([, name = '']) => name),
);

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'SuggestionList',
    'SuggestionList.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

/* ── The wiring AgentPanel does: fill the composer, focus it, caret at the end ── */

interface ComposerHarnessProps {
  readonly suggestions: readonly SuggestionView[];
  /** The controller's two doors this touches: `setDraft` must be called, `send` never. */
  readonly controller: { readonly setDraft: (text: string) => void; readonly send: () => void };
}

function ComposerHarness({ suggestions, controller }: ComposerHarnessProps) {
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        controller.send();
      }}
    >
      <SuggestionList
        locale="en"
        suggestions={suggestions}
        onChoose={(suggestion) => {
          flushSync(() => {
            setDraft(suggestion.text);
          });
          controller.setDraft(suggestion.text);
          const element = field.current;
          if (element === null) return;
          element.focus();
          element.setSelectionRange(element.value.length, element.value.length);
        }}
      />
      <textarea
        ref={field}
        aria-label="Your request"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
      />
    </form>
  );
}

describe('SuggestionList', () => {
  it('is a named list with one button per suggestion, whole words, in order', () => {
    for (const locale of LOCALES) {
      const rows = frameSuggestions(locale).starters;
      const { unmount } = render(
        <SuggestionList locale={locale} suggestions={rows} onChoose={vi.fn()} />,
      );
      const list = screen.getByRole('list', { name: t(locale, 'suggestions.label') });
      const buttons = within(list).getAllByRole('button');
      expect(buttons.map((button) => button.textContent)).toEqual(rows.map((row) => row.text));
      unmount();
    }
  });

  it('shows the SPEC’s four starters on an empty page, per locale (SPEC §4.16)', () => {
    render(
      <SuggestionList
        locale="ar"
        suggestions={frameSuggestions('ar').starters}
        onChoose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'صفحة لعيادة أسنان في عمّان، والحجز عبر واتساب' }),
    ).toBeVisible();
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('describes every row as filling the box without sending', () => {
    for (const locale of LOCALES) {
      const { unmount } = render(
        <SuggestionList
          locale={locale}
          suggestions={frameSuggestions(locale).afterRun}
          onChoose={vi.fn()}
        />,
      );
      for (const row of screen.getAllByRole('button')) {
        expect(row).toHaveAccessibleDescription(t(locale, 'suggestions.description'));
      }
      unmount();
    }
  });

  it('hands the chosen suggestion to its owner, by click, Enter and Space', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const rows = frameSuggestions('en').afterRun;
    render(<SuggestionList locale="en" suggestions={rows} onChoose={onChoose} />);
    const [first, second, third] = rows;
    if (first === undefined || second === undefined || third === undefined) throw new Error('rows');

    await user.click(screen.getByRole('button', { name: first.text }));
    screen.getByRole('button', { name: second.text }).focus();
    await user.keyboard('{Enter}');
    screen.getByRole('button', { name: third.text }).focus();
    await user.keyboard(' ');

    expect(onChoose.mock.calls).toEqual([[first], [second], [third]]);
  });

  it('never sends: no row submits the form it sits in', async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: SubmitEvent) => {
      event.preventDefault();
    });
    render(
      <form
        onSubmit={(event) => {
          submit(event.nativeEvent);
        }}
      >
        <SuggestionList
          locale="en"
          suggestions={frameSuggestions('en').starters}
          onChoose={vi.fn()}
        />
      </form>,
    );
    for (const row of screen.getAllByRole('button')) {
      expect(row).toHaveAttribute('type', 'button');
      await user.click(row);
    }
    screen.getAllByRole('button')[0]?.focus();
    await user.keyboard('{Enter}');
    expect(submit).not.toHaveBeenCalled();
  });

  it('fills the composer and focuses it with the caret at the end; send is never called', async () => {
    const user = userEvent.setup();
    const controller = { setDraft: vi.fn(), send: vi.fn() };
    const rows = frameSuggestions('en').starters;
    render(<ComposerHarness suggestions={rows} controller={controller} />);
    const field = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Your request' });

    for (const row of rows) {
      await user.click(screen.getByRole('button', { name: row.text }));
      expect(field).toHaveValue(row.text);
      expect(field).toHaveFocus();
      expect(field.selectionStart).toBe(row.text.length);
      expect(field.selectionEnd).toBe(row.text.length);
    }
    expect(controller.setDraft.mock.calls).toEqual(rows.map((row) => [row.text]));
    expect(controller.send).not.toHaveBeenCalled();
  });

  it('draws nothing when there is nothing to suggest', () => {
    const { container } = render(
      <SuggestionList locale="en" suggestions={[]} onChoose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('gives a row written in the other script its own direction and language', () => {
    render(
      <SuggestionList
        locale="ar"
        suggestions={[
          { key: 'a', text: 'إضافة قسم للأسعار', source: 'followUp' },
          { key: 'b', text: 'Add a FAQ about insurance.', source: 'followUp' },
        ]}
        onChoose={vi.fn()}
      />,
    );
    const arabic = screen.getByRole('button', { name: 'إضافة قسم للأسعار' });
    const latin = screen.getByRole('button', { name: 'Add a FAQ about insurance.' });
    const arabicText = arabic.querySelector('.ck-agent-suggestion__text');
    const latinText = latin.querySelector('.ck-agent-suggestion__text');
    expect(arabicText).not.toHaveAttribute('dir');
    expect(arabicText).not.toHaveAttribute('lang');
    expect(latinText).toHaveAttribute('dir', 'ltr');
    expect(latinText).toHaveAttribute('lang', 'en');
  });

  it('keeps its ▫ glyph out of the accessible name', () => {
    render(
      <SuggestionList
        locale="en"
        suggestions={frameSuggestions('en').selection}
        onChoose={vi.fn()}
      />,
    );
    for (const row of screen.getAllByRole('button')) {
      expect(row.querySelector('.ck-agent-suggestion__glyph')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    }
  });
});

describe('SuggestionList.css', () => {
  it('draws 32px rows on the glyph column, 44px with 8px between them on a coarse pointer', () => {
    expect(CSS).toMatch(/min-block-size:\s*var\(--bldr-agent-row-height\)/u);
    expect(CSS).toMatch(
      /grid-template-columns:\s*var\(--bldr-space-3xl\) minmax\(0, 1fr\);\s*column-gap:\s*var\(--bldr-space-md\)/u,
    );
    expect(CSS).toMatch(
      /@media \(pointer: coarse\)\s*\{\s*\.ck-agent-suggestions__list\s*\{\s*row-gap:\s*var\(--bldr-space-md\)/u,
    );
  });

  it('wraps rows instead of truncating them', () => {
    expect(CSS).not.toMatch(/text-overflow|line-clamp|white-space:\s*nowrap/u);
  });

  it('rings a focused row inside itself, so adjacent rows never share a ring (SPEC §6.3)', () => {
    expect(CSS).toMatch(
      /:focus-visible[^{]*\{[^}]*outline-offset:\s*calc\(-1 \* var\(--bldr-focus-ring-width\)\)/u,
    );
  });

  it('hovers with the Wash, never Indigo', () => {
    expect(CSS).toMatch(/:hover\s*\{[^}]*background-color:\s*var\(--bldr-surface-hover\)/u);
    expect(CSS).not.toMatch(/--bldr-accent/u);
  });

  it('reads only tokens the chrome contract defines, through logical properties', () => {
    const used = [...CSS.matchAll(/var\((--[\w-]+)/gu)].map(([, name = '']) => name);
    expect(used.filter((name) => !TOKENS.has(name))).toEqual([]);
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|(?:margin|padding|border)-(?:left|right|top|bottom)|(?:min-|max-)?(?:width|height))\s*:/mu,
    );
    expect(CSS).not.toMatch(/text-align:\s*(?:left|right)/u);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/iu);
  });
});
