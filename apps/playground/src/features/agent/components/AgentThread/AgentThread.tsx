import {
  useCallback,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
  type Ref,
} from 'react';

import { t } from '../../copy';
import { useStickToBottom, type StickToBottomOptions } from '../../hooks/stick-to-bottom';
import { SUGGESTION_LIMITS } from '../../model/suggestions';
import {
  isAwaitingDecision,
  type EmptyStateView,
  type FreeCodeView,
  type Locale,
  type RunActivity,
  type SuggestionView,
  type TurnView,
} from '../../model/view-types';
import { CreativeStarters } from '../CreativeStarters';
import { EmptyState } from '../EmptyState';
import { JumpToLatest } from '../JumpToLatest';
import { SuggestionList } from '../SuggestionList';
import { RunTelemetry } from '../RunTelemetry';

import './AgentThread.css';
import { focusNewestHead, isUnderPill, turnIdOf } from './thread-focus';

/** What AgentPanel can ask of the thread from outside it. */
export interface AgentThreadHandle {
  /**
   * Scroll to the newest line and follow again. For the person's own action, such as
   * sending while scrolled up; the panel's growth alone never moves a reader.
   */
  readonly scrollToBottom: () => void;
  /** What the jump pill does: scroll to the newest line, focus the newest record's head. */
  readonly jumpToLatest: () => void;
}

export interface AgentThreadProps {
  readonly locale: Locale;
  /** The conversation, oldest first (`AgentViewState.turns`). */
  readonly turns: readonly TurnView[];
  /**
   * Draws one turn: TurnView (SPEC §7.2 #50) maps it to its record or card. The thread
   * owns the `<li>` around it, keyed by `turnId`, so a turn that changes kind (a plan
   * becoming its build) keeps its node and its focus target.
   */
  readonly renderTurn: (turn: TurnView) => ReactNode;
  /**
   * What the live run is doing (`AgentViewState.run?.activity`), or `null` when nothing
   * runs: the jump pill's word, and suggestions hide while it is set.
   */
  readonly activity: RunActivity | null;
  /** The greeting when there are no turns (`AgentViewState.empty`). */
  readonly empty: EmptyStateView;
  /** `AgentViewState.suggestions`: the empty state's starters, or the rows after a run. */
  readonly suggestions: readonly SuggestionView[];
  /** The composer's text: suggestions hide while the person is writing (SPEC §4.16). */
  readonly draft: string;
  /** A suggestion was chosen: fill the composer with its text and focus it. Never send. */
  readonly onSuggestion: (suggestion: SuggestionView) => void;
  /** Whether content sits under the header, for AgentHeader's hairline (SPEC §2.5). */
  readonly onScrolledChange?: ((scrolled: boolean) => void) | undefined;
  /**
   * creative agent (2026-10-12): the free-code switch (`AgentViewState.freeCode`). Given,
   * the empty thread offers the creative starters under the page starters; absent or `null`
   * (the host keeps no switch, so no game can be written), it offers none.
   */
  readonly freeCode?: FreeCodeView | null | undefined;
  /** Turn free code on from the creative starters' note (`AgentController.setFreeCode`). */
  readonly onFreeCodeChange?: ((enabled: boolean) => void) | undefined;
  readonly ref?: Ref<AgentThreadHandle> | undefined;
}

/**
 * The first report lands at the bottom at once: opening a conversation never scrolls
 * through its history. Growth after that follows with the hook's spring. Under reduced
 * motion the hook makes every scroll instant (SPEC §4.4, §5).
 */
const STICK_OPTIONS: StickToBottomOptions = { initial: 'instant' };

/**
 * The conversation (SPEC §4.4, §3.12): the panel's only scroller, a `<section>` named
 * "Conversation" holding an `<ol>` of turns, then the suggestion rows.
 *
 * Deliberately not `role="log"`: a log is implicitly live, and the panel has exactly one
 * live region, LiveStatus. Nothing in the thread announces itself.
 *
 * It follows the newest line while the reader is there, through the vendored
 * `use-stick-to-bottom`, and lets go the moment a wheel, pointer, touch or key moves it
 * up: the panel's own growth never pulls a reader back down (v1 yanked the reader to the
 * bottom on every progress tick). While the reader is away, the jump pill says why there
 * is news below: "Latest", or "Building" / "Editing" while a run is live. It hides the
 * moment the reader is back, and it never covers the focused element: it hides while
 * focus is in the newest turn, or anywhere in the band it floats over (WCAG 2.4.11).
 * Jumping lands focus on the newest record's head (SPEC §6.3).
 *
 * With no turns, the greeting and its starters sit at the bottom, above the composer
 * (SPEC §3.1). Suggestions hide while a run is live, while the composer has text, and
 * while a decision is waiting (SPEC §4.16).
 *
 * The thread is focusable (`tabIndex=0`), so it scrolls from the keyboard even when it
 * holds nothing else that takes focus.
 */
export function AgentThread({
  locale,
  turns,
  renderTurn,
  activity,
  empty,
  suggestions,
  draft,
  onSuggestion,
  onScrolledChange,
  freeCode,
  onFreeCodeChange,
  ref,
}: AgentThreadProps) {
  const { scrollRef, contentRef, scrollToBottom, isAtBottom, isScrolled } =
    useStickToBottom(STICK_OPTIONS);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const attachScroller = useCallback(
    (element: HTMLElement | null) => {
      scrollerRef.current = element;
      scrollRef(element);
    },
    [scrollRef],
  );

  // Which turn holds focus, and whether the focused element reaches under the pill. Set
  // from focus and scroll events; the pill's visibility is derived from them in render.
  const [focusedTurnId, setFocusedTurnId] = useState<string | null>(null);
  const [focusUnderPill, setFocusUnderPill] = useState(false);

  const clearFocus = () => {
    setFocusedTurnId(null);
    setFocusUnderPill(false);
  };

  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    setFocusedTurnId(turnIdOf(event.target));
    setFocusUnderPill(isUnderPill(scrollerRef.current, event.target));
  };

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    clearFocus();
  };

  // Scrolling moves the focused element under the pill or out from under it. It also
  // heals a focus that left without a blur (its element was removed from the page).
  const handleScroll = () => {
    const scroller = scrollerRef.current;
    const active = document.activeElement;
    if (scroller === null || active === null || !scroller.contains(active)) {
      clearFocus();
      return;
    }
    setFocusUnderPill(isUnderPill(scroller, active));
  };

  const jumpToLatest = () => {
    void scrollToBottom();
    focusNewestHead(scrollerRef.current);
  };

  useImperativeHandle(ref, () => ({
    scrollToBottom: () => {
      void scrollToBottom();
    },
    jumpToLatest,
  }));

  const reportScrolled = useEffectEvent((scrolled: boolean) => {
    onScrolledChange?.(scrolled);
  });
  useEffect(() => {
    reportScrolled(isScrolled);
  }, [isScrolled]);

  const lastTurnId = turns.at(-1)?.view.turnId ?? null;
  const focusInLastTurn = focusedTurnId !== null && focusedTurnId === lastTurnId;
  const pillVisible = turns.length > 0 && !isAtBottom && !focusInLastTurn && !focusUnderPill;
  const suggestionsShown =
    suggestions.length > 0 &&
    activity === null &&
    draft.trim() === '' &&
    !turns.some(isAwaitingDecision);
  /*
    The pill hid while it had keyboard focus (the reader reached the bottom some other
    way): focus goes where pressing it would have sent it, the newest record's head, and
    never falls to body. Read after the commit that set `hidden`, before the browser's
    focus fix-up moves focus off the hidden button.
  */
  const pillRef = useRef<HTMLButtonElement | null>(null);
  const pillWasVisible = useRef(pillVisible);
  useLayoutEffect(() => {
    const wasVisible = pillWasVisible.current;
    pillWasVisible.current = pillVisible;
    if (!wasVisible || pillVisible) return;
    const pill = pillRef.current;
    if (pill !== null && pill === document.activeElement) focusNewestHead(scrollerRef.current);
  }, [pillVisible]);

  // The creative starters follow the page starters' rules, on an empty thread only, and
  // not while a block is selected: that greeting asks about the block.
  const creativeShown =
    freeCode != null &&
    turns.length === 0 &&
    empty.kind !== 'selection' &&
    activity === null &&
    draft.trim() === '';

  // SPEC §4.16: at most 4 rows in the empty state, 3 after a run, whatever arrives.
  const rows = suggestions.slice(
    0,
    turns.length === 0 ? SUGGESTION_LIMITS.empty : SUGGESTION_LIMITS.afterRun,
  );

  return (
    <div className="ck-agent-thread">
      <section
        ref={attachScroller}
        className="ck-agent-thread__scroller"
        aria-label={t(locale, 'thread.label')}
        tabIndex={0}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onScroll={handleScroll}
      >
        <div
          ref={contentRef}
          className="ck-agent-thread__content"
          data-empty={turns.length === 0 ? '' : undefined}
        >
          {turns.length === 0 ? (
            <div className="ck-agent-thread__empty">
              <EmptyState locale={locale} view={empty} />
            </div>
          ) : (
            // role="list": WebKit drops the list role from a list drawn without markers.
            <ol role="list" className="ck-agent-thread__turns">
              {turns.map((turn) => (
                <li
                  key={turn.view.turnId}
                  className="ck-agent-thread__turn"
                  data-turn-id={turn.view.turnId}
                  data-turn-kind={turn.kind}
                >
                  {renderTurn(turn)}
                  {turn.telemetry === undefined ? null : (
                    <RunTelemetry
                      locale={locale}
                      state={turn.telemetry}
                      live={
                        (turn.kind === 'edit' && turn.view.phase === 'running') ||
                        (turn.kind === 'build' &&
                          ['skeleton', 'building', 'stopping'].includes(turn.view.phase)) ||
                        (turn.kind === 'proposal' && turn.view.status === 'drafting') ||
                        (turn.kind === 'page-plan' && turn.view.status === 'drafting')
                      }
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
          {suggestionsShown ? (
            <SuggestionList locale={locale} suggestions={rows} onChoose={onSuggestion} />
          ) : null}
          {creativeShown ? (
            <CreativeStarters
              locale={locale}
              freeCode={freeCode}
              onChoose={onSuggestion}
              onFreeCodeChange={onFreeCodeChange}
            />
          ) : null}
        </div>
      </section>
      <div className="ck-agent-thread__jump">
        <JumpToLatest
          ref={pillRef}
          locale={locale}
          activity={activity}
          visible={pillVisible}
          onJump={jumpToLatest}
        />
      </div>
    </div>
  );
}
