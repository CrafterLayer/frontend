import { DirectionProvider } from '@radix-ui/react-direction';
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import { t } from '../../copy';
import { TickerPausedContext } from '../../hooks/use-ticker';
import {
  isAwaitingDecision,
  type AgentController,
  type FaceView,
  type SuggestionView,
  type TurnView as TurnViewData,
} from '../../model/view-types';
import { AgentHeader } from '../AgentHeader';
import { AgentSheet, type SheetControls, type SheetDetent } from '../AgentSheet';
import { AgentStatusPill, pillView } from '../AgentStatusPill';
import { AgentThread, type AgentThreadHandle } from '../AgentThread';
import { Composer, type ComposerActions } from '../Composer';
import { HistoryPopover } from '../HistoryPopover';
import { AgentTooltipProvider } from '../IconButton';
import { LiveStatus } from '../LiveStatus';
import { RunGlyph } from '../RunGlyph';
import { miniBarView, SheetMiniBar } from '../SheetMiniBar';
import { isStopShortcut } from '../StopButton';
import { StoryBiblePanel } from '../StoryBiblePanel';
import { TurnView } from '../TurnView';

import './AgentPanel.css';
import { clampPanelWidth, PANEL_WIDTH_DEFAULT } from './panel-width';
import { PanelSeparator } from './PanelSeparator';
import { usePhoneLayout } from './use-phone-layout';

/** Docked beside the canvas, the phone sheet, or whichever the viewport calls for. */
export type AgentPanelPresentation = 'auto' | 'dock' | 'sheet';

/**
 * The story bible shows once it can matter (creative agent, 2026-10-12): when free code is on
 * — the only mode that writes game and story scenes — or once the bible holds anything.
 */
function showBible(controller: AgentController): boolean {
  const bible = controller.storyBible;
  if (bible === undefined) return false;
  const { characters, assets, locations, facts } = bible.memory;
  const entries = characters.length + assets.length + locations.length + facts.length;
  return entries > 0 || controller.state.freeCode?.enabled === true;
}

export interface AgentPanelProps {
  /** The panel's one door to behaviour: `useAgentController`, or the fake one in stories. */
  readonly controller: AgentController;
  /**
   * Whether anyone is looking. Hidden keeps the panel mounted, so the run, the
   * conversation and the draft survive a visit to Layers, and pauses its clocks (SPEC §4.1).
   * While hidden, the status bar's pill speaks for it. Default `true`.
   */
  readonly visible?: boolean | undefined;
  /** The panel's width in px (288 to 480). Uncontrolled at 320 when left out. */
  readonly width?: number | undefined;
  /** The separator moved: the host re-sizes the column the panel sits in. */
  readonly onWidthChange?: ((width: number) => void) | undefined;
  /** `auto` (default): the sheet on a phone (<600px, coarse pointer), the dock elsewhere. */
  readonly presentation?: AgentPanelPresentation | undefined;
  /** The phone sheet's `[×]` or Esc: the host hides the panel (`visible` false). */
  readonly onClose?: (() => void) | undefined;
  /** The rail's agent button: focus returns to it when the phone sheet closes (SPEC §6.3). */
  readonly returnFocus?: (() => HTMLElement | null | undefined) | undefined;
  /**
   * Where the status pill is drawn while the panel is hidden: an element in the editor's
   * status bar (SPEC §4.20). Left out, no pill.
   */
  readonly pillContainer?: Element | null | undefined;
  /** The pill was activated: the host shows the panel. */
  readonly onOpen?: (() => void) | undefined;
  /** Hover time before a tooltip opens; tests pass 0. */
  readonly tooltipDelay?: number | undefined;
  /** Appended to `ck-agent-panel`. */
  readonly className?: string | undefined;
}

const IDLE_FACE: FaceView = { mood: 'idle', typing: false };

type PanelState = 'hidden' | 'stopping' | 'running' | 'checking' | 'awaiting-decision' | 'idle';

/**
 * The agent panel's composition root (SPEC §4.1, §7.2 #51). Three rows on a grid: the
 * 44px header, the thread (the only scroller) and the dock with the composer, whose
 * RunBar, queue header, Improve note and clarifying questions ride above the text field.
 * The root sets `dir`, `lang` and `class="ck-agent"`, declares the `agent` inline-size
 * container every component's container queries read, and sits inside Radix's
 * `DirectionProvider`, so menus and popovers follow the panel's reading direction.
 *
 * It owns what belongs to no one component:
 * - the one live region (LiveStatus), mounted for the panel's whole life;
 * - the resize separator on the edge toward the canvas;
 * - Conversations (HistoryPopover under the header's `[◷]`);
 * - focus destinations: a suggestion fills the composer and puts the caret at its end;
 *   sending while scrolled up follows the thread to the newest line;
 * - Ctrl+. / ⌘. anywhere in the panel stops the live run (the composer spends it first);
 * - hidden: mounted, clocks paused, and the status-bar pill in its place;
 * - the phone: below 600px on a coarse pointer the same parts sit in AgentSheet, whose
 *   detent the panel owns; sending an edit in Auto drops the sheet to mini, so the change
 *   can be watched (SPEC §4.19), and nothing else moves it by itself.
 */
export function AgentPanel({
  controller,
  visible = true,
  width,
  onWidthChange,
  presentation = 'auto',
  onClose,
  returnFocus,
  pillContainer,
  onOpen,
  tooltipDelay,
  className,
}: AgentPanelProps) {
  const { state } = controller;
  const { locale, turns, run } = state;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const headingId = useId();
  const historyId = useId();

  const phoneViewport = usePhoneLayout();
  const phone = presentation === 'sheet' || (presentation === 'auto' && phoneViewport);
  /*
    On a phone the sheet is portalled to a body-level layer that carries the panel's
    `dir` and `lang` (its faces are `position: fixed`, so no ancestor may be their
    containing block). The layer is React's own element, rendered into the body; the
    sheet mounts into it once it exists.
  */
  const [sheetHost, setSheetHost] = useState<HTMLElement | null>(null);

  const rootRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const threadRef = useRef<AgentThreadHandle | null>(null);
  const conversationsRef = useRef<HTMLButtonElement | null>(null);
  const caretToEnd = useRef(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [ownWidth, setOwnWidth] = useState(PANEL_WIDTH_DEFAULT);
  const panelWidth = clampPanelWidth(width ?? ownWidth);
  const changeWidth = (next: number): void => {
    if (width === undefined) setOwnWidth(next);
    onWidthChange?.(next);
  };

  /* ── The phone sheet's detent: the host decides, the sheet only asks ────────── */

  const [detent, setDetent] = useState<SheetDetent>(visible ? 'full' : 'closed');
  const [shownFor, setShownFor] = useState(visible);
  if (shownFor !== visible) {
    setShownFor(visible);
    setDetent(visible ? 'full' : 'closed');
  }
  // Sending an edit in Auto drops the sheet to mini, once per run, so the change is seen.
  const editRun = run?.activity === 'edit' ? run.turnId : null;
  const [droppedFor, setDroppedFor] = useState<string | null>(null);
  if (phone && editRun !== null && editRun !== droppedFor) {
    setDroppedFor(editRun);
    if (state.mode === 'auto' && detent === 'full') setDetent('mini');
  }
  const changeDetent = (next: SheetDetent): void => {
    setDetent(next);
    if (next === 'closed') onClose?.();
  };

  /* ── The pill: a run that ended while hidden keeps its line until the panel shows ── */

  const runTurn = run?.turnId ?? null;
  const [lastRun, setLastRun] = useState<string | null>(runTurn);
  const [finished, setFinished] = useState<string | null>(null);
  if (lastRun !== runTurn) {
    setLastRun(runTurn);
    setFinished(runTurn === null && !visible ? lastRun : null);
  }
  if (visible && finished !== null) setFinished(null);
  const pill = visible ? null : pillView(state, finished);

  /* ── Focus destinations ──────────────────────────────────────────────────────── */

  const draft = state.draft;
  useLayoutEffect(() => {
    if (!caretToEnd.current) return;
    caretToEnd.current = false;
    const input = inputRef.current;
    if (input === null) return;
    input.focus();
    input.setSelectionRange(draft.length, draft.length);
  }, [draft]);

  const onSuggestion = (suggestion: SuggestionView): void => {
    caretToEnd.current = true;
    controller.setDraft(suggestion.text);
    inputRef.current?.focus();
  };

  /*
    The clarify check (fix pass, 2026-09-29). A sent request the controller checks first
    leaves the panel with no run, no questions yet and the words still in the box for as
    long as the check takes: 45s once, with Send still Indigo, which read as no response.
    The view does not name that phase, but the panel holds both ends of it: the person's
    own Send, and the Improve state the check runs under (`enhancing`). ✨ Improve runs
    under the same state, so only a Send opens it; a run, the questions, or the check
    ending closes it, and a later Improve cannot reopen it.
  */
  const enhancing = state.enhancement.status === 'enhancing';
  const [sent, setSent] = useState(false);
  const checking = sent && enhancing && run === null && state.clarify === null;
  if (sent && !checking) setSent(false);

  const composerActions: ComposerActions = {
    ...controller,
    send: () => {
      // The person's own action: a reader scrolled up is taken to the newest line.
      threadRef.current?.scrollToBottom();
      if (run === null && !enhancing) setSent(true);
      controller.send();
    },
  };
  // While the request is checked, Send reads Queued and refuses: it is already sent.
  const composerView = checking ? { ...state, send: 'running-queued' as const } : state;

  // The header is in the panel, or in the sheet's layer on a phone.
  const newConversationButton = (): HTMLElement | null =>
    (phone ? sheetHost : rootRef.current)?.querySelector<HTMLElement>(
      `.ck-agent-header button[aria-label="${t(locale, 'header.new')}"]`,
    ) ?? null;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (run === null || run.stopping || !isStopShortcut(event)) return;
    event.preventDefault();
    controller.stop();
  };

  const renderTurn = (turn: TurnViewData) => (
    <TurnView locale={locale} turn={turn} actions={controller} composer={() => inputRef.current} />
  );

  const awaitingPlan = turns.some((turn) => turn.kind === 'page-plan' && turn.view.status === 'ready');
  const panelState: PanelState = !visible
    ? 'hidden'
    : run?.stopping === true
      ? 'stopping'
      : run !== null
        ? 'running'
        : checking
          ? 'checking'
          : turns.some(isAwaitingDecision)
            ? 'awaiting-decision'
            : 'idle';

  /* ── The parts, shared by the dock and the sheet ─────────────────────────────── */

  const column = (sheet: SheetControls | null) => (
    <div className="ck-agent-panel__column">
      <div
        className="ck-agent-panel__header"
        ref={(element) => {
          // `[⤓]`, where focus lands when the sheet rises from mini. A detach passes
          // nothing: the sheet checks the target is still connected before using it.
          if (sheet === null || element === null) return;
          sheet.showPageRef(
            element.querySelector<HTMLElement>(
              `button[aria-label="${t(locale, 'sheet.showPage')}"]`,
            ),
          );
        }}
      >
        <AgentHeader
          locale={locale}
          face={state.face ?? IDLE_FACE}
          scrolled={scrolled}
          running={run !== null}
          conversationsOpen={historyOpen}
          onConversations={() => {
            setHistoryOpen((open) => !open);
          }}
          onNewConversation={controller.newConversation}
          conversationsRef={conversationsRef}
          conversationsControls={historyId}
          headingId={headingId}
          onClose={sheet?.close}
          onShowPage={sheet?.showPage}
        />
      </div>
      <AgentThread
        ref={threadRef}
        locale={locale}
        turns={turns}
        renderTurn={renderTurn}
        activity={run?.activity ?? null}
        empty={state.empty}
        suggestions={state.suggestions}
        draft={draft}
        onSuggestion={onSuggestion}
        onScrolledChange={setScrolled}
      />
      <div className="ck-agent-panel__dock" aria-busy={checking ? true : undefined}>
        {checking ? (
          // Drawn, not spoken: LiveStatus stays the panel's one live region.
          <p className="ck-agent-panel__checking">
            <RunGlyph state="working" className="ck-agent-panel__checking-glyph" />
            <span>{t(locale, 'run.understanding')}</span>
          </p>
        ) : null}
        {showBible(controller) && controller.storyBible !== undefined ? (
          <StoryBiblePanel
            locale={locale}
            bible={controller.storyBible}
            className="ck-agent-panel__bible"
          />
        ) : null}
        <Composer
          view={composerView}
          actions={composerActions}
          awaitingPlan={awaitingPlan}
          inputRef={inputRef}
        />
      </div>
      <HistoryPopover
        locale={locale}
        sessions={state.sessions}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onOpenConversation={controller.openConversation}
        onDeleteConversation={controller.deleteConversation}
        anchorRef={conversationsRef}
        presentation={sheet === null ? 'popover' : 'sheet'}
        id={historyId}
        running={run !== null}
        focusWhenEmpty={newConversationButton}
      />
    </div>
  );

  const live = <LiveStatus locale={locale} announcement={state.announcement} />;

  const statusPill =
    pill === null || pillContainer === undefined || pillContainer === null
      ? null
      : createPortal(
          <AgentStatusPill
            locale={locale}
            view={pill}
            face={state.face}
            onOpen={() => onOpen?.()}
            onStop={run === null ? undefined : controller.stop}
            stopping={run?.stopping === true}
          />,
          pillContainer,
        );

  const body = phone ? (
    sheetHost === null ? null : (
      <div
        ref={(element) => {
          rootRef.current = element;
        }}
        className={className === undefined ? 'ck-agent-panel' : `ck-agent-panel ${className}`}
        data-presentation="sheet"
        data-state={panelState}
        onKeyDown={onKeyDown}
      >
        <AgentSheet
          locale={locale}
          detent={detent}
          onDetentChange={changeDetent}
          returnFocus={returnFocus}
          persistent={live}
          container={sheetHost}
          mini={(sheet) => (
            <SheetMiniBar
              locale={locale}
              view={miniBarView(state)}
              commands={controller}
              onBackToChat={sheet.backToChat}
              backToChatRef={sheet.backToChatRef}
            />
          )}
        >
          {(sheet) => column(sheet)}
        </AgentSheet>
      </div>
    )
  ) : (
    <div
      className={className === undefined ? 'ck-agent-panel' : `ck-agent-panel ${className}`}
      data-presentation="dock"
      data-state={panelState}
      hidden={!visible}
      style={{ '--bldr-assistant-width': `${String(panelWidth)}px` } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      <section
        ref={rootRef}
        className="ck-agent ck-agent-panel__root"
        dir={dir}
        lang={locale}
        aria-labelledby={headingId}
      >
        {column(null)}
        {live}
      </section>
      <PanelSeparator locale={locale} width={panelWidth} onWidthChange={changeWidth} />
    </div>
  );

  const sheetLayer =
    phone && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={setSheetHost}
            className="bldr-root ck-agent ck-agent-panel__sheet-host"
            dir={dir}
            lang={locale}
          />,
          document.body,
        )
      : null;

  return (
    <DirectionProvider dir={dir}>
      <TickerPausedContext value={!visible}>
        <AgentTooltipProvider delayDuration={tooltipDelay}>
          {sheetLayer}
          {body}
          {statusPill}
        </AgentTooltipProvider>
      </TickerPausedContext>
    </DirectionProvider>
  );
}
