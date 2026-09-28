/**
 * AnswerRecord (SPEC §4.10): a words-only answer.
 *
 * Held here: the note glyph and the title "Answer" (never the ink of "on the page"); the prose
 * laid out in its own direction and language, per line, by the majority of its letters; "Show
 * more" only when six lines hide something, as a real disclosure on the prose.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import type { AnswerView } from '../../model/view-types';
import { answerLong, answerShort } from '../../testing/wp-12-records-fixtures';

import { AnswerRecord } from './AnswerRecord';

const CSS = readFileSync(
  join(process.cwd(), 'src', 'features', 'agent', 'components', 'AnswerRecord', 'AnswerRecord.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

/*
  jsdom lays nothing out. A prose longer than 300 characters stands in for "more than six
  lines": folded, it is 120px tall with 240px of content; unfolded, all of it shows. The
  observer reports at once, as a browser's does on `observe()`.
*/
const PROSE = 'ck-agent-answer__prose';
const original = {
  ResizeObserver: globalThis.ResizeObserver,
  scrollHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight'),
  clientHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight'),
};

beforeAll(() => {
  globalThis.ResizeObserver = class {
    readonly #callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.#callback = callback;
    }
    observe = (): void => {
      this.#callback([], this);
    };
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      if (!this.classList.contains(PROSE)) return 0;
      return (this.textContent ?? '').length > 300 ? 240 : 40;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      if (!this.classList.contains(PROSE)) return 0;
      return this.hasAttribute('data-folded') ? Math.min(120, this.scrollHeight) : this.scrollHeight;
    },
  });
});

afterAll(() => {
  globalThis.ResizeObserver = original.ResizeObserver;
  if (original.scrollHeight !== undefined) {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', original.scrollHeight);
  }
  if (original.clientHeight !== undefined) {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', original.clientHeight);
  }
});

function renderAnswer(view: AnswerView, locale: 'ar' | 'en' = 'en') {
  const onMenuSelect = vi.fn();
  return { ...render(<AnswerRecord locale={locale} view={view} onMenuSelect={onMenuSelect} />), onMenuSelect };
}

describe('AnswerRecord', () => {
  it('is an article titled "Answer", with the note glyph', () => {
    const { container } = renderAnswer(answerShort('en'));
    expect(screen.getByRole('article', { name: t('en', 'answer.title') })).toBeInTheDocument();
    expect(container.querySelector('.ck-agent-glyph')).toHaveAttribute('data-state', 'note');
  });

  it('lays the prose out in its own direction and language, whatever the panel’s', () => {
    const { container } = renderAnswer(answerShort('ar'), 'en');
    const prose = container.querySelector(`.${PROSE}`);
    expect(prose).toHaveAttribute('dir', 'rtl');
    expect(prose).toHaveAttribute('lang', 'ar');
  });

  it('gives each line the direction of the majority of its own letters', () => {
    const { container } = renderAnswer(
      { turnId: 'mixed', text: 'Hero قسم الخدمات يحتاج صورة\nThe hero needs a photo', menu: [] },
      'ar',
    );
    const lines = [...container.querySelectorAll('.ck-agent-answer__line')];
    expect(lines.map((line) => line.getAttribute('dir'))).toEqual(['rtl', 'ltr']);
  });

  it('shows no "Show more" when six lines hide nothing', () => {
    renderAnswer(answerShort('en'));
    expect(screen.queryByRole('button', { name: t('en', 'answer.more') })).toBeNull();
  });

  it('folds a long answer to six lines behind a disclosure, and opens it', async () => {
    const user = userEvent.setup();
    const { container } = renderAnswer(answerLong('en'));
    const prose = container.querySelector(`.${PROSE}`);
    expect(prose).toHaveAttribute('data-folded');
    const more = screen.getByRole('button', { name: 'Show more' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveAttribute('aria-controls', prose?.id);
    await user.click(more);
    expect(prose).not.toHaveAttribute('data-folded');
    expect(more).toHaveAccessibleName('Show less');
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(more).toHaveFocus();
    await user.click(more);
    expect(prose).toHaveAttribute('data-folded');
  });

  it('offers Copy answer, handed to its caller', async () => {
    const user = userEvent.setup();
    const { onMenuSelect } = renderAnswer(answerShort('en'));
    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Copy answer' }));
    expect(onMenuSelect).toHaveBeenCalledExactlyOnceWith('copyAnswer');
  });
});

describe('AnswerRecord.css', () => {
  it('sets the prose in Read, Ink, folded to six lines', () => {
    expect(CSS).toMatch(/color:\s*var\(--bldr-panel-text\);/);
    expect(CSS).toMatch(/-webkit-line-clamp:\s*6/);
    expect(CSS).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it('uses logical properties only', () => {
    expect(CSS).not.toMatch(
      /(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align:\s*(left|right)|translateX/,
    );
  });
});
