import { useCallback, useId, useRef, useState, type ReactNode, type Ref } from 'react';

import {
  buildTitleKey,
  formatClock,
  formatNumber,
  formatRemaining,
  t,
  tAnnounce,
} from '../../copy';
import type {
  AgentController,
  BuildPhase,
  BuildRecordView,
  Locale,
  RecordMenuItem,
} from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { BuildTaskBoard } from '../BuildTaskBoard';
import { DirectionLine } from '../DirectionLine';
import { ErrorBody } from '../ErrorRecord';
import { FactsDisclosure } from '../FactsDisclosure';
import { InlineConfirm } from '../InlineConfirm';
import { RecordMenu, type RecordMenuProps } from '../RecordMenu';
import { glyphForBuildPhase } from '../RunGlyph';
import { RunRecord, type RecordMetaItem } from '../RunRecord';
import { SpineList } from '../SpineList';
import { segmentForRow } from '../SpineRow';

import { assignRef } from './assign-ref';
import './BuildRecord.css';
import { RecordButton } from './RecordButton';
import { RecordLead, type LeadSegment } from './RecordLead';
import { useLandingStagger, useOnScreen } from './use-landing-stagger';

/**
 * The controller actions a build record calls. Every one is an action on the page or a
 * successor run; none posts a sentence as the person's turn (SPEC §4.8: `retrySkippedRequest`
 * is gone).
 */
export type BuildRecordActions = Pick<
  AgentController,
  | 'undoSection'
  | 'redoSection'
  | 'undoBuild'
  | 'redoBuild'
  | 'retrySections'
  | 'finishRest'
  | 'removeEmpty'
  | 'tryAgain'
  | 'reveal'
  | 'peek'
  | 'openPageHistory'
>;

export interface BuildRecordProps {
  readonly locale: Locale;
  readonly view: BuildRecordView;
  readonly actions: BuildRecordActions;
  /** The `[⋯]` menu's choice: Restore page…, Reuse request, Copy summary (the caller runs it). */
  readonly onMenuSelect: (item: RecordMenuItem) => void;
  /** Where focus goes after a menu item runs, when not back to `[⋯]` (Reuse → the composer). */
  readonly menuFocusAfter?: RecordMenuProps['focusAfterSelect'];
  /** `[⋯]`, which a dialog opened from the menu (Restore page…) returns focus to. */
  readonly menuTriggerRef?: Ref<HTMLButtonElement> | undefined;
  /** The record's heading, for callers that send focus to it (Build this page, SPEC §6.3). */
  readonly headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** Appended to `ck-agent-record ck-agent-build`. */
  readonly className?: string | undefined;
}

/** Phases in which the build is still being written. */
const LIVE: ReadonlySet<BuildPhase> = new Set(['skeleton', 'building', 'stopping']);

/**
 * Phases whose sections sit behind "Show sections" from the start: nothing of the build is on
 * the page, and the record's own lines (the failure, "Build undone") are the news.
 */
const FOLDED: ReadonlySet<BuildPhase> = new Set(['failed', 'undone']);

/** Where the DirectionLine shows (SPEC §4.8 phase table: building, done; a stop changes nothing). */
const WITH_DIRECTION: ReadonlySet<BuildPhase> = new Set(['building', 'stopping', 'done']);

/** The head's figures: the count while live, the final time once settled (SPEC §4.8). */
function headMeta(locale: Locale, view: BuildRecordView): readonly RecordMetaItem[] {
  switch (view.phase) {
    case 'building':
    case 'stopping':
      return [
        {
          text: `${formatNumber(locale, view.landed)}/${formatNumber(locale, view.total)}`,
          label: tAnnounce(locale, 'build.progress', { done: view.landed, total: view.total }),
        },
      ];
    case 'skeleton':
    case 'interrupted':
      return [];
    default:
      return view.elapsedMs === undefined ? [] : [{ text: formatClock(view.elapsedMs) }];
  }
}

/** The record's caption line (SPEC §4.8 "Caption line(s)"), or null when the phase has none. */
function captionOf(locale: Locale, view: BuildRecordView): string | null {
  switch (view.phase) {
    case 'done':
    case 'partial':
      return t(locale, 'build.caption.done', { n: view.landed });
    case 'stopped':
      return t(locale, 'build.caption.stopped', {
        n: view.rows.filter((row) => row.state === 'notWritten').length,
      });
    case 'interrupted':
      // The list was not saved: nothing can finish it, and the caption says so.
      return view.actions.finishRest === 0 && view.landed < view.total
        ? t(locale, 'build.caption.notResumable')
        : t(locale, 'build.caption.interrupted', { done: view.landed, total: view.total });
    default:
      return null;
  }
}

/**
 * One page build, in every phase (SPEC §4.8, §3.3 to §3.5, §3.10, §3.12): the signature of
 * the panel. A head that says the state in words, the count while live and the final time
 * after; the page spine, drawn in pencil and inked section by section as each lands; then the
 * one or two actions the phase allows.
 *
 * Honest by construction. The count is the view's `landed/total`, which counts landed
 * sections only; row Undo appears only where the view gives a row its landing record, after
 * `build.completed`; a record read back after a reload shows its Undo unavailable, described
 * by the caption that says why. Every action is a controller call, and focus goes where
 * SPEC §6.3 names: the record's head after Retry, Finish the rest, Remove empty and Undo
 * build; the same row's button, now Redo, after a row's Undo.
 *
 * Motion only while live, and only what SPEC §5 lists: rows arriving in page order, the light
 * on writers' stretches (paused off screen), each landing's stroke 80ms apart at least, and,
 * once, when the last section lands, one light down the whole unbroken stroke.
 */
export function BuildRecord({
  locale,
  view,
  actions,
  onMenuSelect,
  menuFocusAfter,
  menuTriggerRef,
  headingRef,
  className,
}: BuildRecordProps) {
  const { turnId, phase, rows } = view;
  const heading = useRef<HTMLHeadingElement | null>(null);
  const root = useRef<HTMLElement | null>(null);
  const setHeading = useCallback(
    (node: HTMLHeadingElement | null) => {
      heading.current = node;
      root.current = node?.closest('article') ?? null;
      assignRef(headingRef, node);
    },
    [headingRef],
  );
  const sectionsId = useId();
  const revivedId = useId();

  // What this record witnessed, fixed when it mounted: a record read back from history, or
  // mounted already settled, never replays arrivals or landings.
  const [live] = useState(() => LIVE.has(phase));
  const [arrive] = useState(() => rows.length === 0);

  // The person's own Show sections / Hide sections; open stays open until they close it.
  const [opened, setOpened] = useState(false);
  const [toggled, setToggled] = useState(false);

  // The completion sweep: once, when this record saw its build become whole (SPEC §5 moment 5).
  const [seenPhase, setSeenPhase] = useState(phase);
  const [sweep, setSweep] = useState(false);
  if (seenPhase !== phase) {
    setSeenPhase(phase);
    const whole = rows.length > 0 && rows.every((row) => row.state === 'landed');
    if (live && LIVE.has(seenPhase) && phase === 'done' && whole) setSweep(true);
  }

  useLandingStagger(root, rows, live);
  const writing = rows.some((row) => row.state === 'writing' || row.state === 'retrying');
  const onScreen = useOnScreen(root, live && writing);

  const focusHead = () => {
    heading.current?.focus();
  };

  const collapsedClosed = view.collapsed && !opened;
  const foldable = rows.length > 0 && (view.collapsed || FOLDED.has(phase));
  const rowsShown = rows.length > 0 && (!foldable || opened);
  const showRevived =
    view.revived &&
    (phase === 'done' ||
      phase === 'partial' ||
      rows.some((row) => row.undo?.kind === 'unavailable' && row.undo.why === 'revived'));

  /* ── The lead: the record's first lines, beside the spine's first stretch ── */

  const lines: ReactNode[] = [];
  if (phase === 'skeleton') {
    lines.push(
      <p key="live" className="ck-agent-lead__live">
        {t(locale, 'build.live.skeleton')}
      </p>,
    );
  }
  const caption = captionOf(locale, view);
  if (caption !== null) {
    lines.push(
      <p key="caption" className="ck-agent-build__caption">
        {caption}
      </p>,
    );
  }
  if (!collapsedClosed) {
    if (rows.length > 0 && (phase === 'building' || phase === 'stopping')) {
      lines.push(
        <BuildTaskBoard
          key="tasks"
          locale={locale}
          rows={rows}
          writers={view.writers ?? null}
          phase={phase}
        />,
      );
    }
    if (WITH_DIRECTION.has(phase) && view.direction !== undefined) {
      lines.push(<DirectionLine key="direction" locale={locale} direction={view.direction} />);
    }
    if (phase === 'building' && view.remainingMs !== null) {
      lines.push(
        <p key="estimate" className="ck-agent-build__estimate">
          {formatRemaining(locale, view.remainingMs)}
        </p>,
      );
    }
  }
  if (phase === 'failed' && view.error !== undefined) {
    lines.push(<ErrorBody key="error" locale={locale} body={view.error} />);
  }
  if (showRevived && !collapsedClosed) {
    lines.push(
      <p key="revived" id={revivedId} className="ck-agent-build__caption">
        {t(locale, 'build.caption.revived')}
      </p>,
      <RecordButton
        key="history"
        tone="text"
        data-ck-align="text"
        className="ck-agent-build__history"
        onClick={() => {
          actions.openPageHistory();
        }}
      >
        {t(locale, 'build.pageHistory')}
      </RecordButton>,
    );
  }

  const first = rows[0];
  let segment: LeadSegment | null = null;
  if (phase === 'skeleton') {
    segment = { state: 'indeterminate', to: 'end' };
  } else if (first !== undefined) {
    const state = segmentForRow(first.state);
    if (rowsShown) segment = { state, to: 'node', live, landKey: first.key };
    // Folded under a newer turn: the stretch runs beside the caption and stops with it.
    else if (!FOLDED.has(phase) && lines.length > 0) segment = { state, to: 'end' };
  }

  /* ── The spine ─────────────────────────────────────────────────────────── */

  const spine =
    rows.length === 0 ? null : (
      <SpineList
        id={sectionsId}
        locale={locale}
        rows={rows}
        live={live}
        arrive={arrive}
        sweep={sweep}
        onSweepEnd={() => {
          setSweep(false);
        }}
        revivedCaptionId={showRevived ? revivedId : undefined}
        onReveal={actions.reveal}
        onPeek={actions.peek}
        onUndo={(key) => {
          actions.undoSection(turnId, key);
        }}
        onRedo={(key) => {
          actions.redoSection(turnId, key);
        }}
        onRetry={(key) => {
          actions.retrySections(turnId, [key]);
          focusHead();
        }}
      />
    );

  /* ── The footer: at most one primary and one secondary, then text (SPEC §4.6) ── */

  const buttons: ReactNode[] = [];
  const a = view.actions;
  if (!collapsedClosed) {
    if (phase === 'failed' && view.error?.retryable === true) {
      buttons.push(
        <RecordButton
          key="try-again"
          tone="primary"
          onClick={() => {
            actions.tryAgain(turnId);
            focusHead();
          }}
        >
          {t(locale, 'error.retry')}
        </RecordButton>,
      );
    }
    if (a.retryFailed > 0) {
      buttons.push(
        <RecordButton
          key="retry-failed"
          tone="primary"
          onClick={() => {
            actions.retrySections(
              turnId,
              rows.filter((row) => row.canRetry).map((row) => row.key),
            );
            focusHead();
          }}
        >
          {t(locale, 'footer.retryFailed', { n: a.retryFailed })}
        </RecordButton>,
      );
    }
    if (a.finishRest > 0) {
      buttons.push(
        <RecordButton
          key="finish-rest"
          tone="primary"
          onClick={() => {
            actions.finishRest(turnId);
            focusHead();
          }}
        >
          {t(locale, 'footer.finishRest', { n: a.finishRest })}
        </RecordButton>,
      );
    }
    if (a.undoBuild) {
      buttons.push(
        <InlineConfirm
          key="undo-build"
          message={t(locale, 'confirm.undoBuild')}
          confirmLabel={t(locale, 'confirm.undo')}
          cancelLabel={t(locale, 'confirm.cancel')}
          onConfirm={() => {
            actions.undoBuild(turnId);
            focusHead();
          }}
          renderOpener={({ open }) => (
            <RecordButton tone="secondary" onClick={open}>
              {t(locale, 'footer.undoBuild')}
            </RecordButton>
          )}
        />,
      );
    }
    if (a.redoBuild) {
      buttons.push(
        <RecordButton
          key="redo-build"
          tone="secondary"
          onClick={() => {
            actions.redoBuild(turnId);
            focusHead();
          }}
        >
          {t(locale, 'footer.redoBuild')}
        </RecordButton>,
      );
    }
    // A finished build at 420 (SPEC §3.17): Copy summary joins the footer as text. The
    // stylesheet shows it only from 400px of panel; below, it stays in the [⋯] menu.
    if ((phase === 'done' || phase === 'partial') && view.menu.includes('copySummary')) {
      buttons.push(
        <RecordButton
          key="copy-summary"
          tone="text"
          className="ck-agent-build__copy"
          onClick={() => {
            onMenuSelect('copySummary');
          }}
        >
          {t(locale, 'menu.copySummary')}
        </RecordButton>,
      );
    }
    if (phase === 'failed' && view.error?.pageState.kind === 'skeleton') {
      buttons.push(
        <RecordButton
          key="remove-skeleton"
          tone="text"
          onClick={() => {
            actions.removeEmpty(turnId);
            focusHead();
          }}
        >
          {t(locale, 'error.removeSkeleton')}
        </RecordButton>,
      );
    } else if (a.removeEmpty > 0) {
      buttons.push(
        <RecordButton
          key="remove-empty"
          tone="text"
          onClick={() => {
            actions.removeEmpty(turnId);
            focusHead();
          }}
        >
          {t(locale, 'footer.removeEmpty', { n: a.removeEmpty })}
        </RecordButton>,
      );
    }
  }

  const failed = rows.filter((row) => row.state === 'failed').length;
  // A sample can only need replacing where its section is on the page: a section that was
  // stopped, failed or undone claims nothing. Facts no row names are kept as given.
  const rowState = new Map(rows.map((row) => [row.key, row.state]));
  const facts = view.facts.filter((fact) => {
    const state = rowState.get(fact.nodeId);
    return state === undefined || state === 'landed';
  });

  return (
    <RunRecord
      className={className === undefined ? 'ck-agent-build' : `ck-agent-build ${className}`}
      data-phase={phase}
      data-offscreen={onScreen ? undefined : ''}
      glyph={glyphForBuildPhase(phase)}
      animateGlyph={live}
      title={t(locale, buildTitleKey(phase, view.stopReason), { n: failed })}
      meta={headMeta(locale, view)}
      headingRef={setHeading}
      actions={buttons.length === 0 ? undefined : buttons}
      menu={
        collapsedClosed || view.menu.length === 0 ? undefined : (
          <RecordMenu
            locale={locale}
            items={view.menu}
            onSelect={onMenuSelect}
            focusAfterSelect={menuFocusAfter}
            triggerRef={menuTriggerRef}
          />
        )
      }
    >
      {lines.length === 0 && segment === null ? null : (
        <RecordLead segment={segment}>{lines}</RecordLead>
      )}
      {foldable ? (
        <div
          className="ck-agent-build__sections"
          data-open={rowsShown ? '' : undefined}
          data-animate={toggled ? '' : undefined}
          inert={!rowsShown}
        >
          <div className="ck-agent-build__sections-inner">{spine}</div>
        </div>
      ) : (
        spine
      )}
      {foldable ? (
        <button
          type="button"
          className="ck-agent-build__toggle"
          aria-expanded={rowsShown}
          aria-controls={sectionsId}
          onClick={() => {
            setOpened((current) => !current);
            setToggled(true);
          }}
        >
          <AgentIcon name="disclosure" className="ck-agent-build__chevron" />
          {rowsShown
            ? t(locale, 'build.hideSections')
            : t(locale, 'build.showSections', { n: view.total })}
        </button>
      ) : null}
      {collapsedClosed || facts.length === 0 ? null : (
        <FactsDisclosure locale={locale} facts={facts} onReveal={actions.reveal} />
      )}
    </RunRecord>
  );
}
