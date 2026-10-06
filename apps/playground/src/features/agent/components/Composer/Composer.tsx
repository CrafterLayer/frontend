import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
  type UIEvent,
} from 'react';

import { t, type Key } from '../../copy';
import { resolveDir } from '../../model/resolve-dir';
import { SEND_SLOT } from '../../model/send-state';
import type {
  AgentController,
  AgentViewState,
  AssistantMode,
  ContextChipView,
  MentionCandidateView,
} from '../../model/view-types';
import { ClarifyPanel } from '../ClarifyPanel';
import { ComposerToolbar } from '../ComposerToolbar';
import { ContextChip } from '../ContextChip';
import { EnhanceNote } from '../EnhanceNote';
import { MentionMenu } from '../MentionMenu';
import { QueueHeader } from '../QueueHeader';
import { RunBar, useExitPresence } from '../RunBar';
import { isStopShortcut } from '../StopButton';

import './Composer.css';
import { isImeComposing } from './ime';

/** What the Composer reads: a slice of `AgentViewState`, so the panel passes its state as is. */
export type ComposerView = Pick<
  AgentViewState,
  | 'locale'
  | 'draft'
  | 'chips'
  | 'mention'
  | 'mode'
  | 'model'
  | 'effort'
  | 'send'
  | 'run'
  | 'queue'
  | 'enhancement'
  | 'clarify'
>;

/** What the Composer calls: a slice of `AgentController`, so the panel passes the controller. */
export type ComposerActions = Pick<
  AgentController,
  | 'setDraft'
  | 'send'
  | 'stop'
  | 'removeQueued'
  | 'continueQueued'
  | 'removeChip'
  | 'addMention'
  | 'setMode'
  | 'setModel'
  | 'setEffort'
  | 'enhanceDraft'
  | 'restoreDraft'
  | 'answerClarify'
  | 'sendAsWritten'
  | 'dismissClarify'
  | 'setComposerFocused'
>;

export interface ComposerProps {
  readonly view: ComposerView;
  readonly actions: ComposerActions;
  /**
   * A page plan waits in the thread (a ready `page-plan` turn): the empty box asks for a
   * change to the plan (`placeholder.afterPlan`, SPEC §3.7).
   */
  readonly awaitingPlan?: boolean | undefined;
  /**
   * The textarea, for the panel's own focus destinations (SPEC §6.3): a suggestion fills
   * and focuses it, Discard returns to it, Reuse request puts text back in it.
   */
  readonly inputRef?: Ref<HTMLTextAreaElement> | undefined;
  /** Appended to `ck-agent-composer`. */
  readonly className?: string | undefined;
}

const PLACEHOLDER_KEY = {
  auto: 'placeholder.auto',
  ask: 'placeholder.ask',
  plan: 'placeholder.plan',
} as const satisfies Readonly<Record<AssistantMode, Key>>;

/** SPEC §4.17: the draft's direction is re-read 100ms after the last keystroke. */
const DIR_SETTLE_MS = 100;

/** Whether the browser sizes a textarea to its content by itself (`field-sizing`). */
const FIELD_SIZING =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('field-sizing', 'content');

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref !== null && ref !== undefined) ref.current = value;
}

/** The block chip Backspace in an empty box removes: the last one (SPEC §3.2). */
function lastRemovableChip(chips: readonly ContextChipView[]): ContextChipView | undefined {
  return chips.findLast((chip) => chip.kind !== 'page');
}

/**
 * Where a request is written (SPEC §4.17 Composer): the panel's one bordered surface
 * besides the decisions (SPEC §1), a Sheet with a 1px Rule edge and radius 12.
 *
 * Top to bottom: the RunBar while a run is live (then a Hairline); a paused queued request
 * and the clarifying questions, each its own section above a Hairline; then the writing
 * area itself: the queued request's header (the queued request *is* this text), the ✨
 * Improve note, the context chips, the textarea (2 to 6 lines, then it scrolls), and the
 * toolbar. The `@` list floats above the whole card.
 *
 * Keys (SPEC §4.17, §6.7): Enter sends or queues and is ignored while an input method is
 * composing; Shift+Enter writes a line; with the `@` list open ↑ ↓ move, Enter or Tab pick
 * (never send) and Esc closes it; Esc then leaves the field; Backspace in an empty box
 * removes the last chip; Ctrl+. (⌘. on a Mac) stops the live run from anywhere in it.
 *
 * Focus is always sent somewhere named (SPEC §6.3): Send leaves it in the cleared box;
 * Stop keeps it on Stop until the RunBar goes, then the box; removing or continuing the
 * queued request, removing a chip, and the questions closing all return to the box.
 *
 * The box's direction follows its words, not the UI (`resolveDir`, re-read 100ms after
 * the last keystroke), with `unicode-bidi: plaintext` per line; an empty box follows the
 * UI, so the placeholder does. While ✨ Improve rewrites the draft the box is read-only
 * and its words shimmer in the reading direction (still Slate under reduced motion).
 */
export function Composer({ view, actions, awaitingPlan = false, inputRef, className }: ComposerProps) {
  const {
    locale,
    draft,
    chips,
    mention,
    mode,
    model,
    effort,
    send,
    run,
    queue,
    enhancement,
    clarify,
  } =
    view;
  const uiDir = locale === 'ar' ? 'rtl' : 'ltr';
  const listboxId = useId();
  const optionPrefix = useId();
  const emptyId = useId();
  const contextId = useId();
  const queueLabelId = useId();
  const queueCaptionId = useId();

  const input = useRef<HTMLTextAreaElement | null>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const runBar = useRef<HTMLDivElement>(null);
  const setInput = useCallback(
    (node: HTMLTextAreaElement | null) => {
      input.current = node;
      assignRef(inputRef, node);
    },
    [inputRef],
  );
  const focusInput = () => {
    input.current?.focus();
  };

  /* ── The RunBar: mounted while a run is live, folded away when it ends ───────── */

  const presence = useExitPresence(run);

  // Stop keeps focus while stopping (same button, `aria-disabled`); when the RunBar goes,
  // focus that was on it, or that fell to the body with it, goes to the box.
  const hadRun = useRef(run !== null);
  useLayoutEffect(() => {
    const had = hadRun.current;
    hadRun.current = run !== null;
    if (!had || run !== null) return;
    const active = document.activeElement;
    if (active === null || active === document.body || runBar.current?.contains(active) === true) {
      input.current?.focus();
    }
  }, [run]);

  // The questions going (answered, sent as written or cancelled) take their chips with
  // them; focus that was there lands in the box, where the request now continues.
  const hadClarify = useRef(clarify !== null);
  useLayoutEffect(() => {
    const had = hadClarify.current;
    hadClarify.current = clarify !== null;
    if (!had || clarify !== null) return;
    const active = document.activeElement;
    if (active === null || active === document.body) input.current?.focus();
  }, [clarify]);

  /* ── The `@` list ─────────────────────────────────────────────────────────── */

  const enhancing = enhancement.status === 'enhancing';
  // Esc closes the list for the draft it was open on; the next keystroke reopens it.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const listOpen = mention !== null && dismissedFor !== draft && !enhancing;
  const candidates = mention?.candidates ?? [];
  const mentionKey =
    mention === null
      ? ''
      : `${mention.query}\u0000${mention.candidates.map((candidate) => candidate.id).join('\u0001')}`;
  const [active, setActive] = useState(0);
  const [activeFor, setActiveFor] = useState(mentionKey);
  if (activeFor !== mentionKey) {
    // A new query is a new list: the keyboard starts again on its first option.
    setActiveFor(mentionKey);
    setActive(0);
  }
  const activeIndex = candidates.length === 0 ? -1 : Math.min(active, candidates.length - 1);
  const optionId = (index: number) => `${optionPrefix}-${String(index)}`;

  const pickMention = (candidate: MentionCandidateView) => {
    setDismissedFor(null);
    actions.addMention(candidate.id);
  };

  const startMention = () => {
    if (enhancing) return;
    const spaced = draft === '' || /\s$/u.test(draft) ? draft : `${draft} `;
    setDismissedFor(null);
    actions.setDraft(`${spaced}@`);
    focusInput();
  };

  /* ── Direction, size and the Improve shimmer ─────────────────────────────── */

  const [settledDir, setSettledDir] = useState(() => resolveDir(draft, uiDir));
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettledDir(resolveDir(draft, uiDir));
    }, DIR_SETTLE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [draft, uiDir]);
  const dir = draft.trim() === '' ? uiDir : settledDir;

  // Where `field-sizing: content` is missing, grow the box to its text by hand; the CSS
  // still clamps it to 2 to 6 lines.
  useLayoutEffect(() => {
    const field = input.current;
    if (field === null || FIELD_SIZING) return;
    field.style.removeProperty('block-size');
    if (field.scrollHeight > 0) field.style.blockSize = `${String(field.scrollHeight)}px`;
  }, [draft]);

  // The shimmer is a copy of the words laid exactly over the locked box (same box, same
  // font, same stable scrollbar gutter; see the stylesheet) and kept at the same scroll.
  const shimmer = enhancing && draft.trim() !== '';
  useLayoutEffect(() => {
    const field = input.current;
    const copy = mirror.current;
    if (!shimmer || field === null || copy === null) return;
    copy.scrollTop = field.scrollTop;
  }, [shimmer, draft]);

  /* ── Keys ─────────────────────────────────────────────────────────────────── */

  const onFieldKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (isImeComposing(event)) return;
    const plain = !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;

    if (listOpen) {
      const count = candidates.length;
      if (event.key === 'ArrowDown' && count > 0) {
        event.preventDefault();
        setActive((activeIndex + 1) % count);
        return;
      }
      if (event.key === 'ArrowUp' && count > 0) {
        event.preventDefault();
        setActive((activeIndex - 1 + count) % count);
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && plain) {
        const candidate = candidates[activeIndex];
        if (candidate !== undefined) {
          event.preventDefault();
          pickMention(candidate);
          return;
        }
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setDismissedFor(draft);
        return;
      }
    }

    if (event.key === 'Escape') {
      event.currentTarget.blur();
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      // Enter never writes a line here; Shift+Enter does.
      event.preventDefault();
      if (enhancing || SEND_SLOT[send].enter === 'nothing') return;
      // `send` also queues while a run is live, and says "already queued" when it is.
      actions.send();
      return;
    }

    if (event.key === 'Backspace' && draft === '') {
      const { selectionStart, selectionEnd } = event.currentTarget;
      const last = lastRemovableChip(chips);
      if (last !== undefined && selectionStart === 0 && selectionEnd === 0) {
        event.preventDefault();
        actions.removeChip(last.id);
      }
    }
  };

  // Ctrl+. / ⌘. stops the live run from anywhere in the composer (SPEC §6.7). The event is
  // spent here, so a listener at the panel's root can skip it (`isStopShortcut`).
  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (run === null || run.stopping || !isStopShortcut(event)) return;
    event.preventDefault();
    actions.stop();
  };

  /* ── Drawing ──────────────────────────────────────────────────────────────── */

  const queueHeadsText = queue !== null && queue.status !== 'paused';
  const describedBy = [
    queueHeadsText ? `${queueLabelId} ${queueCaptionId}` : '',
    chips.length > 0 ? contextId : '',
    listOpen && candidates.length === 0 ? emptyId : '',
  ]
    .filter((id) => id !== '')
    .join(' ');
  const placeholderKey: Key =
    run !== null ? 'placeholder.running' : awaitingPlan ? 'placeholder.afterPlan' : PLACEHOLDER_KEY[mode];

  return (
    <div
      className={className === undefined ? 'ck-agent-composer' : `ck-agent-composer ${className}`}
      data-running={run === null ? undefined : ''}
      onKeyDown={onRootKeyDown}
    >
      {mention !== null && listOpen ? (
        <div className="ck-agent-composer__popup">
          <MentionMenu
            locale={locale}
            id={listboxId}
            mention={mention}
            activeIndex={activeIndex}
            optionId={optionId}
            onActiveChange={setActive}
            onPick={pickMention}
            emptyId={emptyId}
          />
        </div>
      ) : null}

      <div className="ck-agent-composer__card">
        {presence.value === null ? null : (
          <RunBar
            ref={runBar}
            locale={locale}
            run={presence.value}
            leaving={presence.leaving}
            onStop={actions.stop}
          />
        )}

        {queue?.status === 'paused' ? (
          <div className="ck-agent-composer__section">
            <QueueHeader
              locale={locale}
              queue={queue}
              dockChips={chips}
              onRemove={() => {
                actions.removeQueued();
                focusInput();
              }}
              onContinue={() => {
                actions.continueQueued();
                focusInput();
              }}
            />
          </div>
        ) : null}

        {clarify === null ? null : (
          <div className="ck-agent-composer__section">
            <ClarifyPanel
              locale={locale}
              clarify={clarify}
              onAnswer={actions.answerClarify}
              onSendAsWritten={actions.sendAsWritten}
              onDismiss={actions.dismissClarify}
            />
          </div>
        )}

        <div className="ck-agent-composer__section ck-agent-composer__write">
          {queue !== null && queue.status !== 'paused' ? (
            <QueueHeader
              locale={locale}
              queue={queue}
              labelId={queueLabelId}
              captionId={queueCaptionId}
              onRemove={() => {
                actions.removeQueued();
                focusInput();
              }}
              onContinue={actions.continueQueued}
            />
          ) : null}

          {enhancement.status === 'enhanced' || enhancement.status === 'failed' ? (
            <EnhanceNote
              locale={locale}
              enhancement={enhancement}
              onRestore={() => {
                actions.restoreDraft();
                focusInput();
              }}
            />
          ) : null}

          {chips.length === 0 ? null : (
            <div id={contextId} className="ck-agent-composer__context">
              {chips.map((chip) => (
                <ContextChip
                  key={chip.id}
                  locale={locale}
                  chip={chip}
                  onRemove={(id) => {
                    actions.removeChip(id);
                    focusInput();
                  }}
                />
              ))}
            </div>
          )}

          <div className="ck-agent-composer__field" data-enhancing={enhancing ? '' : undefined}>
            <textarea
              ref={setInput}
              className="ck-agent-composer__input"
              // The textarea is the `@` list's combobox (SPEC §4.17, ARIA 1.2 pattern).
              role="combobox"
              aria-label={t(locale, 'input.aria')}
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-expanded={listOpen && candidates.length > 0}
              aria-controls={listOpen && candidates.length > 0 ? listboxId : undefined}
              aria-activedescendant={listOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
              aria-describedby={describedBy === '' ? undefined : describedBy}
              aria-busy={enhancing ? true : undefined}
              // The ring is the card's (`:has(:focus)`): one control, one ring.
              data-bldr-focus-ring="delegated"
              data-enhancing={enhancing ? '' : undefined}
              dir={dir}
              rows={2}
              value={draft}
              placeholder={t(locale, placeholderKey)}
              readOnly={enhancing}
              enterKeyHint="send"
              onChange={(event) => {
                actions.setDraft(event.currentTarget.value);
              }}
              onKeyDown={onFieldKeyDown}
              onFocus={() => {
                actions.setComposerFocused?.(true);
              }}
              onBlur={() => {
                actions.setComposerFocused?.(false);
              }}
              onScroll={(event: UIEvent<HTMLTextAreaElement>) => {
                if (mirror.current !== null) mirror.current.scrollTop = event.currentTarget.scrollTop;
              }}
            />
            {shimmer ? (
              <div ref={mirror} className="ck-agent-composer__shimmer" aria-hidden="true" dir={dir}>
                {draft}
              </div>
            ) : null}
          </div>

          <ComposerToolbar
            locale={locale}
            mode={mode}
            model={model}
            effort={effort}
            send={send}
            enhancement={enhancement}
            running={run !== null}
            onModeChange={actions.setMode}
            onModelChange={actions.setModel}
            onEffortChange={actions.setEffort}
            onMention={startMention}
            onEnhance={actions.enhanceDraft}
            onSend={() => {
              actions.send();
              // SPEC §6.3: after Send, focus stays in the (cleared) box.
              focusInput();
            }}
          />
        </div>
      </div>
    </div>
  );
}
