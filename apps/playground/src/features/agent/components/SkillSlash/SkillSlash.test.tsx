/**
 * SkillSlash (2026-10-12): the composer's `/` skills list, over the real knowledge hook
 * (`useAgentKnowledge`, seeded) and a real textarea standing in for the Composer's.
 *
 * Asserted by role and name: a `/` at the start or after a space opens a listbox of the
 * person's enabled skills, then the built-ins, then "Manage skills & memory"; the words
 * after it narrow the list. The textarea keeps focus and is the combobox (expanded,
 * controls, active option). ↑ ↓ move, Enter or Tab pick (the composer never sees them), Esc
 * closes for that draft. A pick keeps an inline skill token in this prompt, with no persistent
 * chip or UI-only three-selection limit.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState, type KeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { knowledgeLabels } from '../../copy/knowledge-labels';
import { useAgentKnowledge } from '../../hooks/use-agent-knowledge';
import type { Locale } from '../../model/view-types';
import {
  SAMPLE_NOTES,
  SAMPLE_NOTES_AR,
  SAMPLE_SKILLS,
  SAMPLE_SKILLS_AR,
  seededStorage,
} from '../../testing/knowledge-fixtures';

import { SkillSlash } from './SkillSlash';

const EN = knowledgeLabels('en').slash;
const AR = knowledgeLabels('ar').slash;

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'SkillSlash', 'SkillSlash.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//gu, '');

interface HostProps {
  readonly locale?: Locale;
  readonly onManage?: () => void;
  /** The composer's own Enter: it must never fire while the list owns the keys. */
  readonly onSend?: (draft: string) => void;
}

/**
 * The list over the real knowledge hook, above a textarea wired as the Composer wires its
 * own: the `@` list's combobox, Enter sends. SkillSlash takes the keys while it is open.
 */
function Host({ locale = 'en', onManage = vi.fn(), onSend = vi.fn() }: HostProps) {
  const arabic = locale === 'ar';
  const [storage] = useState(() =>
    seededStorage(
      arabic ? SAMPLE_SKILLS_AR : SAMPLE_SKILLS,
      arabic ? SAMPLE_NOTES_AR : SAMPLE_NOTES,
    ),
  );
  const { view } = useAgentKnowledge({ storage });
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLTextAreaElement | null>(null);
  return (
    <div className="ck-agent" lang={locale} dir={arabic ? 'rtl' : 'ltr'}>
      <SkillSlash
        locale={locale}
        skills={view.skills}
        draft={draft}
        onDraftChange={setDraft}
        inputRef={input}
        onManage={onManage}
      />
      <textarea
        ref={input}
        role="combobox"
        aria-label="Message"
        aria-autocomplete="list"
        aria-haspopup="listbox"
        aria-expanded={false}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSend(draft);
          }
        }}
      />
    </div>
  );
}

function setup(props: HostProps = {}) {
  render(<Host {...props} />);
  const field = screen.getByRole('combobox', { name: 'Message' });
  return { user: userEvent.setup(), field };
}

function theList(locale: Locale = 'en'): HTMLElement {
  return screen.getByRole('listbox', { name: locale === 'ar' ? AR.label : EN.label });
}

function options(): HTMLElement[] {
  return within(theList()).getAllByRole('option');
}

function chips(locale: Locale = 'en'): HTMLElement | null {
  return screen.queryByRole('group', {
    name: locale === 'ar' ? 'مهارات الرسالة التالية' : 'Skills for the next message',
  });
}

describe('SkillSlash', () => {
  it('stays closed while the draft ends on no slash', async () => {
    const { user, field } = setup();
    await user.type(field, 'Make the hero darker');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(field).not.toHaveAttribute('aria-controls');
    expect(field).not.toHaveAttribute('aria-activedescendant');
  });

  it('opens on "/": enabled skills, then the built-ins, and Manage last', async () => {
    const { user, field } = setup();
    await user.type(field, '/');
    const list = theList();
    const names = options().map((option) => option.textContent);
    expect(names[0]).toContain('Brand voice');
    expect(names[1]).toContain('House style');
    expect(names.join(' ')).not.toContain('Seasonal menu');
    expect(names.at(-1)).toBe(EN.manage);
    expect(options().length).toBeGreaterThan(3);
    // The section headings are drawn, not options.
    for (const heading of [EN.yours, EN.builtIn]) {
      const row = within(list).getByText(heading);
      expect(row).toHaveAttribute('role', 'presentation');
      expect(row).toHaveAttribute('aria-hidden', 'true');
    }
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
    expect(field).toHaveFocus();
  });

  it('makes the textarea its combobox while open', async () => {
    const { user, field } = setup();
    await user.type(field, '/');
    expect(field).toHaveAttribute('aria-expanded', 'true');
    expect(field).toHaveAttribute('aria-controls', theList().id);
    expect(field).toHaveAttribute('aria-activedescendant', options()[0]!.id);
    await user.keyboard('{ArrowDown}');
    expect(field).toHaveAttribute('aria-activedescendant', options()[1]!.id);
    expect(options()[1]).toHaveAttribute('aria-selected', 'true');
    expect(options()[0]).toHaveAttribute('aria-selected', 'false');
    await user.type(field, ' ');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(field).not.toHaveAttribute('aria-controls');
    expect(field).not.toHaveAttribute('aria-activedescendant');
  });

  it('opens after a space, never inside a word', async () => {
    const { user, field } = setup();
    await user.type(field, 'hero/');
    expect(screen.queryByRole('listbox')).toBeNull();
    await user.clear(field);
    await user.type(field, 'hero /');
    expect(theList()).toBeInTheDocument();
  });

  it('narrows as it is typed: /brand puts Brand voice first', async () => {
    const { user, field } = setup();
    await user.type(field, '/house');
    expect(options()[0]).toHaveTextContent('House style');
    await user.clear(field);
    await user.type(field, '/brand');
    expect(options()[0]).toHaveTextContent('/brand-voice');
    expect(options()[0]).toHaveTextContent('Brand voice');
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('says so when no skill matches, and still offers Manage', async () => {
    const { user, field } = setup();
    await user.type(field, '/zzzz');
    expect(theList().parentElement).toHaveTextContent(EN.empty);
    expect(options()).toHaveLength(1);
    expect(options()[0]).toHaveTextContent(EN.manage);
  });

  it('↓ and Enter keep the chosen skill inline in this prompt without sending or chips', async () => {
    const onSend = vi.fn();
    const { user, field } = setup({ onSend });
    await user.type(field, 'Write the hero /');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSend).not.toHaveBeenCalled();
    expect(field).toHaveValue('/house-style Write the hero ');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(chips()).toBeNull();
    // A pinned skill leaves the list.
    await user.type(field, '/');
    expect(
      options()
        .map((option) => option.textContent)
        .join(' '),
    ).not.toContain('House style');
    // Closed again, Enter is the composer's.
    await user.keyboard('{Escape}{Enter}');
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('Tab picks too, and ↑ from the first option wraps to Manage', async () => {
    const onManage = vi.fn();
    const { user, field } = setup({ onManage });
    await user.type(field, '/');
    await user.keyboard('{Tab}');
    expect(chips()).toBeNull();
    expect(field).toHaveFocus();
    expect(field).toHaveValue('/brand-voice ');
    await user.type(field, '/');
    await user.keyboard('{ArrowUp}');
    expect(options().at(-1)).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(onManage).toHaveBeenCalledTimes(1);
    expect(field).toHaveValue('/brand-voice ');
  });

  it('Esc closes the list for that draft; the next letter opens it again', async () => {
    const { user, field } = setup();
    await user.type(field, '/b');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(field).toHaveAttribute('aria-expanded', 'false');
    expect(field).toHaveValue('/b');
    await user.type(field, 'r');
    expect(theList()).toBeInTheDocument();
  });

  it('a click inserts the selected skill inline and keeps focus in the field', async () => {
    const { user, field } = setup();
    await user.type(field, 'Hero /');
    await user.click(options()[1]!);
    expect(chips()).toBeNull();
    expect(field).toHaveValue('/house-style Hero ');
    expect(field).toHaveFocus();
  });

  it('"Manage skills & memory" calls onManage and clears the /words', async () => {
    const onManage = vi.fn();
    const { user, field } = setup({ onManage });
    await user.type(field, '/sk');
    await user.click(within(theList()).getByRole('option', { name: EN.manage }));
    expect(onManage).toHaveBeenCalledTimes(1);
    expect(field).toHaveValue('');
    expect(chips()).toBeNull();
  });

  it('allows four inline choices and removes a choice by editing this prompt', async () => {
    const { user, field } = setup();
    for (let pick = 0; pick < 4; pick += 1) {
      await user.type(field, '/');
      await user.keyboard('{Enter}');
    }
    expect((field as HTMLTextAreaElement).value.match(/\/[^\s]+/gu)).toHaveLength(4);
    expect(chips()).toBeNull();
    await user.clear(field);
    await user.type(field, '/');
    expect(options()[0]).toHaveTextContent('Brand voice');
    expect(field).toHaveFocus();
  });

  it('speaks Arabic, and finds «أسلوب» when «اسلوب» is typed', async () => {
    const { user, field } = setup({ locale: 'ar' });
    await user.type(field, '/');
    const list = theList('ar');
    expect(within(list).getByText(AR.yours)).toHaveAttribute('aria-hidden', 'true');
    expect(within(list).getByText(AR.builtIn)).toHaveAttribute('aria-hidden', 'true');
    expect(within(list).getAllByRole('option')[0]).toHaveTextContent('نبرة العلامة');
    expect(within(list).getAllByRole('option').at(-1)).toHaveTextContent(AR.manage);
    await user.type(field, 'اسلوب');
    expect(within(theList('ar')).getAllByRole('option')[0]).toHaveTextContent('أسلوب المنزل');
    await user.keyboard('{Enter}');
    expect(chips('ar')).toBeNull();
    expect(field).toHaveValue('/أسلوب-المنزل ');
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|top|bottom|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
