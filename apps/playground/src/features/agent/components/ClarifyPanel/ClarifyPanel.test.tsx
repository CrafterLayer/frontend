/**
 * ClarifyPanel: questions before guessing, docked on the composer.
 *
 * Ours to prove: a group named by its title; "1 of 3" drawn and "Question 1 of 3" spoken,
 * and no count for a single question; focus on the first chip when it opens and on the
 * next question's chip after each answer; chips as a radio group whose arrows follow the
 * reading direction (→ forward in English, ← forward in Arabic), Home and End jump, and
 * Enter or Space picks; Other opens a field whose Enter sends the typed answer and whose
 * Esc returns to the chips; an answered question is a button back to it; the two ways out
 * call the controller; while rewriting, the working line takes focus and no chip remains.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it, vi, type Mock } from 'vitest';

import { t } from '../../copy';
import type { ClarifyView, Locale } from '../../model/view-types';
import { clarifying } from '../../testing/wp-14-composer-fixtures';

import { ClarifyPanel } from './ClarifyPanel';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

interface Handlers {
  readonly onAnswer: Mock<(questionId: string, answer: string) => void>;
  readonly onSendAsWritten: Mock<() => void>;
  readonly onDismiss: Mock<() => void>;
}

/** The panel, answered the way the controller answers it. */
function Answering({
  locale,
  initial,
  handlers,
}: {
  readonly locale: Locale;
  readonly initial: ClarifyView;
  readonly handlers: Handlers;
}) {
  const [clarify, setClarify] = useState(initial);
  return (
    <ClarifyPanel
      locale={locale}
      clarify={clarify}
      onAnswer={(id, answer) => {
        handlers.onAnswer(id, answer);
        setClarify((current) => {
          const questions = current.questions.map((question) =>
            question.id === id ? { ...question, answer } : question,
          );
          const done = questions.every((question) => question.answer !== undefined);
          return { ...current, questions, status: done ? 'rewriting' : 'asking' };
        });
      }}
      onSendAsWritten={handlers.onSendAsWritten}
      onDismiss={handlers.onDismiss}
    />
  );
}

function mount(locale: Locale, initial: ClarifyView) {
  const handlers: Handlers = {
    onAnswer: vi.fn<(questionId: string, answer: string) => void>(),
    onSendAsWritten: vi.fn<() => void>(),
    onDismiss: vi.fn<() => void>(),
  };
  render(<Answering locale={locale} initial={initial} handlers={handlers} />);
  return { handlers, user: userEvent.setup() };
}

function radio(name: string): HTMLElement {
  return screen.getByRole('radio', { name });
}

describe('ClarifyPanel: what it shows', () => {
  it('is a group named by its title, with what was understood', () => {
    mount('en', clarifying('en', 3));
    const group = screen.getByRole('group', { name: t('en', 'clarify.title') });
    expect(group).toHaveTextContent('Understood: Add a link from this page to an inner page');
  });

  it('draws “1 of 3” and speaks “Question 1 of 3”', () => {
    mount('en', clarifying('en', 3));
    const progress = document.querySelector('.ck-agent-clarify__progress');
    expect(progress?.querySelector('[aria-hidden="true"]')).toHaveTextContent('1 of 3');
    expect(screen.getByText('Question 1 of 3')).toHaveClass('bldr-visually-hidden');
  });

  it('draws no count for a single question', () => {
    mount('en', clarifying('en', 1));
    expect(document.querySelector('.ck-agent-clarify__progress')).toBeNull();
  });

  it('asks in Arabic, with Latin digits', () => {
    mount('ar', clarifying('ar', 3));
    expect(screen.getByRole('group', { name: t('ar', 'clarify.title') })).toBeInTheDocument();
    expect(screen.getByText('السؤال 1 من 3')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'أي صفحة يفتحها الرابط؟' })).toBeInTheDocument();
  });

  it('offers each choice as a radio, plus Other', () => {
    mount('en', clarifying('en', 3));
    const group = screen.getByRole('radiogroup', { name: 'Which page should the link open?' });
    expect(within(group).getAllByRole('radio').map((item) => item.textContent)).toEqual([
      'Services',
      'Contact us',
      'Booking',
      t('en', 'clarify.other'),
    ]);
  });
});

describe('ClarifyPanel: focus and keys', () => {
  it('focuses the first question’s first chip when it opens', () => {
    mount('en', clarifying('en', 3));
    expect(radio('Services')).toHaveFocus();
    expect(radio('Services')).toHaveAttribute('tabindex', '0');
    expect(radio('Contact us')).toHaveAttribute('tabindex', '-1');
  });

  it('moves with the arrows in the reading direction, and Home / End jump (English)', async () => {
    const { user } = mount('en', clarifying('en', 3));
    await user.keyboard('{ArrowRight}');
    expect(radio('Contact us')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(radio('Booking')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(radio('Contact us')).toHaveFocus();
    await user.keyboard('{End}');
    expect(radio(t('en', 'clarify.other'))).toHaveFocus();
    await user.keyboard('{Home}');
    expect(radio('Services')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(radio(t('en', 'clarify.other'))).toHaveFocus();
  });

  it('moves forward with ← in Arabic', async () => {
    const { user } = mount('ar', clarifying('ar', 3));
    expect(radio('الخدمات')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(radio('تواصل معنا')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(radio('الخدمات')).toHaveFocus();
  });

  it('only moves on arrows: nothing is answered until Enter or Space', async () => {
    const { user, handlers } = mount('en', clarifying('en', 3));
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(handlers.onAnswer).not.toHaveBeenCalled();
  });

  it('answers with Enter, then focuses the next question', async () => {
    const { user, handlers } = mount('en', clarifying('en', 3));
    await user.keyboard('{ArrowRight}{Enter}');
    expect(handlers.onAnswer).toHaveBeenCalledWith('q-page', 'Contact us');
    expect(screen.getByText('Question 2 of 3')).toBeInTheDocument();
    expect(radio('In the header')).toHaveFocus();
  });

  it('answers with Space too', async () => {
    const { user, handlers } = mount('en', clarifying('en', 2));
    await user.keyboard(' ');
    expect(handlers.onAnswer).toHaveBeenCalledWith('q-page', 'Services');
  });

  it('answers with a click on a chip', async () => {
    const { user, handlers } = mount('en', clarifying('en', 2));
    await user.click(radio('Booking'));
    expect(handlers.onAnswer).toHaveBeenCalledWith('q-page', 'Booking');
  });
});

describe('ClarifyPanel: Other', () => {
  it('opens a field for the person’s own answer, sent with Enter', async () => {
    const { user, handlers } = mount('en', clarifying('en', 2));
    await user.click(radio(t('en', 'clarify.other')));
    const field = screen.getByRole('textbox', { name: t('en', 'clarify.other.placeholder') });
    expect(field).toHaveFocus();
    expect(field).toHaveAccessibleDescription('Which page should the link open?');
    await user.keyboard('The pricing page{Enter}');
    expect(handlers.onAnswer).toHaveBeenCalledWith('q-page', 'The pricing page');
    expect(radio('In the header')).toHaveFocus();
  });

  it('sends nothing empty, and its send button waits for words', async () => {
    const { user, handlers } = mount('en', clarifying('en', 2));
    await user.click(radio(t('en', 'clarify.other')));
    await user.keyboard('   {Enter}');
    expect(handlers.onAnswer).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: t('en', 'clarify.other.send') })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('returns to the chips on Esc, on Other', async () => {
    const { user } = mount('en', clarifying('en', 2));
    await user.click(radio(t('en', 'clarify.other')));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(radio(t('en', 'clarify.other'))).toHaveFocus();
  });
});

describe('ClarifyPanel: answers, ways out, rewriting', () => {
  it('lists earlier answers as buttons back to their question', async () => {
    const { user } = mount('en', clarifying('en', 3, 2));
    expect(screen.getByText('Question 3 of 3')).toBeInTheDocument();
    const back = screen.getByRole('button', { name: /Which page should the link open\?/u });
    expect(back).toHaveAccessibleDescription(t('en', 'clarify.edit'));
    await user.click(back);
    expect(screen.getByText('Question 1 of 3')).toBeInTheDocument();
    expect(radio('Services')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Services')).toHaveFocus();
  });

  it('Send as written and Cancel call the controller', async () => {
    const { user, handlers } = mount('en', clarifying('en', 3));
    await user.click(screen.getByRole('button', { name: t('en', 'clarify.sendAsWritten') }));
    await user.click(screen.getByRole('button', { name: t('en', 'clarify.cancel') }));
    expect(handlers.onSendAsWritten).toHaveBeenCalledTimes(1);
    expect(handlers.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('rewriting: the working line takes focus, and no chip remains', async () => {
    const { user } = mount('en', clarifying('en', 1));
    await user.click(radio('Services'));
    const working = screen.getByText(t('en', 'clarify.rewriting'));
    expect(working).toHaveFocus();
    expect(screen.queryByRole('radio')).toBeNull();
    // The answers stay in view, but are no longer a way back.
    expect(screen.queryByRole('button', { name: /Which page/u })).toBeNull();
  });
});
