import { ChromeButton } from '@craftkit/builder';
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import { t, tParts } from '../../copy';
import { resolveDir } from '../../model/resolve-dir';
import type { ClarifyQuestionView, ClarifyView, Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { isImeComposing } from '../Composer/ime';
import { IconButton } from '../IconButton';
import { RunGlyph } from '../RunGlyph';

import './ClarifyPanel.css';

export interface ClarifyPanelProps {
  readonly locale: Locale;
  /** The questions docked for the request just sent (`AgentViewState.clarify`). */
  readonly clarify: ClarifyView;
  /** A chip, or a typed answer, answers one question (`AgentController.answerClarify`). */
  readonly onAnswer: (questionId: string, answer: string) => void;
  /** Run the request untouched (`AgentController.sendAsWritten`). */
  readonly onSendAsWritten: () => void;
  /** Close the questions and put the request back in the box (`dismissClarify`). */
  readonly onDismiss: () => void;
  /** Appended to `ck-agent-clarify`. */
  readonly className?: string | undefined;
}

/** Where focus belongs for what the panel shows now; see the layout effect below. */
type FocusKey = 'rewriting' | 'done' | `choices:${string}` | `other:${string}`;

/** The question being asked: a revisited one, else the first without an answer. */
function currentQuestion(
  questions: readonly ClarifyQuestionView[],
  revisit: string | null,
): ClarifyQuestionView | undefined {
  return (
    questions.find((question) => question.id === revisit) ??
    questions.find((question) => question.answer === undefined)
  );
}

/**
 * Questions before guessing (the owner's request, 2026-09-28): when a request is too
 * unclear to act on, أبو غضب asks one to three short questions, docked on top of the
 * composer in QueueHeader's language, instead of running the request as it read it.
 *
 * One question at a time, so the panel stays short in a 320px column: the head (the
 * decision diamond, "A few questions before starting", "1 of 3"), the one-line restatement
 * of what was understood, the answers given so far (each one a button back to its
 * question), then the question with its choices as radio chips, and "Other" for an answer
 * in the person's own words. "Send as written" skips the questions; Cancel puts the
 * request back in the box, unsent.
 *
 * Keys (radio-like, but a pick commits, so arrows only move): ← → ↑ ↓ move between chips
 * in the reading direction, Home and End jump, Enter or Space picks. Focus moves to the
 * question when the panel opens and to the next question after each answer; the Composer
 * sends it back to the textarea when the panel goes. While the answers rewrite the
 * request, the diamond turns into the working glyph and the line says so.
 */
export function ClarifyPanel({
  locale,
  clarify,
  onAnswer,
  onSendAsWritten,
  onDismiss,
  className,
}: ClarifyPanelProps) {
  const titleId = useId();
  const questionId = useId();
  const editHintId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [revisit, setRevisit] = useState<string | null>(null);
  const [other, setOther] = useState<{ readonly question: string; readonly text: string } | null>(
    null,
  );
  const [roving, setRoving] = useState<{ readonly question: string; readonly index: number } | null>(
    null,
  );

  const uiDir = locale === 'ar' ? 'rtl' : 'ltr';
  const rewriting = clarify.status === 'rewriting';
  const { questions } = clarify;
  const current = rewriting ? undefined : currentQuestion(questions, revisit);
  const position = current === undefined ? questions.length : questions.indexOf(current) + 1;
  const answered = questions.filter(
    (question) => question.answer !== undefined && question.id !== current?.id,
  );
  const otherOpen = current !== undefined && other?.question === current.id;
  const choices = current?.choices ?? [];
  const checked =
    current?.answer === undefined
      ? -1
      : choices.includes(current.answer)
        ? choices.indexOf(current.answer)
        : choices.length;
  const tabbable =
    current !== undefined && roving?.question === current.id
      ? roving.index
      : Math.max(checked, 0);

  const focusKey: FocusKey = rewriting
    ? 'rewriting'
    : current === undefined
      ? 'done'
      : otherOpen
        ? `other:${current.id}`
        : `choices:${current.id}`;

  /*
    Focus follows what the panel shows, after React has drawn it: the element focus goes
    to did not exist a moment earlier (the next question's chips, the Other field). It
    moves only when the panel has just opened (SPEC-like: "focus moves to the question"),
    or when focus is already in the panel or fell to the body because the chip it was on
    is gone. A person who has moved on to the thread keeps their place.
  */
  const focusedFor = useRef<FocusKey | null>(null);
  useLayoutEffect(() => {
    const previous = focusedFor.current;
    focusedFor.current = focusKey;
    if (previous === focusKey) return;
    const root = panel.current;
    if (root === null) return;
    const active = document.activeElement;
    const mayMove =
      previous === null || active === null || active === document.body || root.contains(active);
    if (!mayMove) return;
    const target =
      focusKey === 'rewriting'
        ? root.querySelector<HTMLElement>('.ck-agent-clarify__working')
        : focusKey === 'done'
          ? root.querySelector<HTMLElement>('.ck-agent-clarify__title')
          : focusKey.startsWith('other:')
            ? root.querySelector<HTMLElement>('.ck-agent-clarify__field')
            : root.querySelector<HTMLElement>('[role="radio"][tabindex="0"]');
    target?.focus();
  }, [focusKey]);

  const pick = (question: ClarifyQuestionView, answer: string) => {
    const value = answer.trim();
    if (value === '') return;
    setRevisit(null);
    setOther(null);
    setRoving(null);
    onAnswer(question.id, value);
  };

  const moveBetweenChips = (event: KeyboardEvent<HTMLDivElement>) => {
    if (current === undefined) return;
    const radios = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')];
    const from = radios.indexOf(event.target as HTMLElement);
    if (from < 0) return;
    const last = radios.length - 1;
    const forward = from === last ? 0 : from + 1;
    const backward = from === 0 ? last : from - 1;
    const to = (() => {
      switch (event.key) {
        case 'ArrowDown':
          return forward;
        case 'ArrowUp':
          return backward;
        // Visual keys follow the reading direction: in Arabic → goes back.
        case 'ArrowRight':
          return uiDir === 'rtl' ? backward : forward;
        case 'ArrowLeft':
          return uiDir === 'rtl' ? forward : backward;
        case 'Home':
          return 0;
        case 'End':
          return last;
        default:
          return null;
      }
    })();
    if (to === null) return;
    event.preventDefault();
    setRoving({ question: current.id, index: to });
    radios[to]?.focus();
  };

  const understood = clarify.understood.trim();
  const root = className === undefined ? 'ck-agent-clarify' : `ck-agent-clarify ${className}`;

  return (
    <div
      ref={panel}
      role="group"
      aria-labelledby={titleId}
      className={root}
      data-status={clarify.status}
    >
      <div className="ck-agent-clarify__head">
        <RunGlyph state={rewriting ? 'working' : 'decision'} animate={false} />
        <p id={titleId} className="ck-agent-clarify__title" tabIndex={-1}>
          {t(locale, 'clarify.title')}
        </p>
        {rewriting || questions.length < 2 ? null : (
          <span className="ck-agent-clarify__progress">
            <span aria-hidden="true">
              {t(locale, 'clarify.progress', { i: position, n: questions.length })}
            </span>
            <span className="bldr-visually-hidden">
              {t(locale, 'clarify.progress.aria', { i: position, n: questions.length })}
            </span>
          </span>
        )}
      </div>

      {understood === '' ? null : (
        <p className="ck-agent-clarify__understood">
          {tParts(locale, 'enhance.understood', { prompt: understood }).map((part, index) =>
            part.kind === 'value' ? (
              <bdi key={index} dir={resolveDir(part.text, uiDir)}>
                {part.text}
              </bdi>
            ) : (
              part.text
            ),
          )}
        </p>
      )}

      {answered.length === 0 ? null : (
        <div className="ck-agent-clarify__answers">
          <span id={editHintId} hidden>
            {t(locale, 'clarify.edit')}
          </span>
          {answered.map((question) =>
            rewriting ? (
              <p key={question.id} className="ck-agent-clarify__answer">
                <span className="ck-agent-clarify__asked">{question.text}</span>
                <bdi className="ck-agent-clarify__given">{question.answer}</bdi>
              </p>
            ) : (
              <ChromeButton
                key={question.id}
                className="ck-agent-clarify__answer"
                size="lg"
                aria-describedby={editHintId}
                onClick={() => {
                  setOther(null);
                  setRoving(null);
                  setRevisit(question.id);
                }}
              >
                <span className="ck-agent-clarify__asked">{question.text}</span>
                <bdi className="ck-agent-clarify__given">{question.answer}</bdi>
                <AgentIcon name="pencil" className="ck-agent-clarify__edit" />
              </ChromeButton>
            ),
          )}
        </div>
      )}

      {rewriting ? (
        <p className="ck-agent-clarify__working" tabIndex={-1}>
          {t(locale, 'clarify.rewriting')}
        </p>
      ) : current === undefined ? null : (
        <div className="ck-agent-clarify__question">
          <p id={questionId} className="ck-agent-clarify__text" dir={resolveDir(current.text, uiDir)}>
            {current.text}
          </p>
          {otherOpen ? (
            <div className="ck-agent-clarify__other">
              <input
                className="ck-agent-clarify__field"
                type="text"
                value={other.text}
                dir={resolveDir(other.text, uiDir)}
                placeholder={t(locale, 'clarify.other.placeholder')}
                aria-label={t(locale, 'clarify.other.placeholder')}
                aria-describedby={questionId}
                enterKeyHint="send"
                onChange={(event) => {
                  setOther({ question: current.id, text: event.currentTarget.value });
                }}
                onKeyDown={(event) => {
                  if (isImeComposing(event)) return;
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    pick(current, other.text);
                  } else if (event.key === 'Escape') {
                    // Back to the chips, on Other: Esc undoes the last step, not the panel.
                    event.preventDefault();
                    event.stopPropagation();
                    setOther(null);
                    setRoving({ question: current.id, index: choices.length });
                  }
                }}
              />
              <IconButton
                icon="send"
                label={t(locale, 'clarify.other.send')}
                tooltipSide="top"
                tooltipAlign="end"
                unavailable={other.text.trim() === ''}
                onClick={() => {
                  pick(current, other.text);
                }}
              />
            </div>
          ) : (
            <div
              role="radiogroup"
              aria-labelledby={questionId}
              className="ck-agent-clarify__choices"
              onKeyDown={moveBetweenChips}
            >
              {choices.map((choice, index) => (
                <button
                  key={`${String(index)}:${choice}`}
                  type="button"
                  role="radio"
                  aria-checked={index === checked}
                  tabIndex={index === tabbable ? 0 : -1}
                  className="ck-agent-clarify__choice"
                  dir={resolveDir(choice, uiDir)}
                  onClick={() => {
                    pick(current, choice);
                  }}
                >
                  {index === checked ? (
                    <AgentIcon name="check" className="ck-agent-clarify__check" />
                  ) : null}
                  <span>{choice}</span>
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={checked === choices.length}
                tabIndex={tabbable === choices.length ? 0 : -1}
                className="ck-agent-clarify__choice"
                data-other=""
                onClick={() => {
                  const typed =
                    checked === choices.length && current.answer !== undefined ? current.answer : '';
                  setOther({ question: current.id, text: typed });
                }}
              >
                <AgentIcon name="pencil" className="ck-agent-clarify__check" />
                <span>{t(locale, 'clarify.other')}</span>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="ck-agent-clarify__actions">
        <ChromeButton className="ck-agent-clarify__send" size="lg" onClick={onSendAsWritten}>
          {t(locale, 'clarify.sendAsWritten')}
        </ChromeButton>
        <ChromeButton className="ck-agent-clarify__cancel" size="lg" onClick={onDismiss}>
          {t(locale, 'clarify.cancel')}
        </ChromeButton>
      </div>
    </div>
  );
}
