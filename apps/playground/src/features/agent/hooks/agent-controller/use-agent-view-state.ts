/**
 * The panel's view state (`AgentViewState`), derived on every render from what the
 * controller hook reads: the turns and their history, the RunBar, the composer's chips,
 * mention and suggestions, the face, the clarify panel and the menus.
 */
import { summarizeDocumentForIntent, type BuilderDocument, type NodeId } from '@craftkit/builder';
import { useEffect, useMemo } from 'react';

import type { UseAgentMoodResult } from '../../../preview/components/AgentFace';
import { visibleStatus, type VisibleStatus } from '../../model/agent-status';
import { blockName, blockTypeName } from '../../model/block-name';
import { contextMeterView, withScopeFocus } from '../../model/context-meter';
import { EMPTY_HISTORY, isNewest, isNextRedo } from '../../model/kernel-history';
import { mentionCandidatesFor, mentionQuery } from '../../model/mentions';
import { effortSelection } from '../../model/effort';
import { modelSelection } from '../../model/model-label';
import { queueView } from '../../model/queue';
import { lastDropped, lastFollowUp, ranOnPage } from '../../model/runs';
import { sendState } from '../../model/send-state';
import { panelSuggestions, starterSuggestions } from '../../model/suggestions';
import { turnViewsOf, withPendingRequest, type TurnViewContext } from '../../model/turn-views';
import type { BuildTurn, EditTurn } from '../../model/turns';
import {
  isAwaitingDecision,
  type AgentCapabilities,
  type AgentViewState,
  type ClarifyView,
  type ContextChipView,
  type FreeCodeView,
  type EmptyStateView,
  type FaceView,
  type MentionView,
  type RunBarView,
  type SuggestionView,
  type TurnView,
} from '../../model/view-types';
import type { AgentSessions } from '../use-agent-sessions';
import type { LiveStatus } from '../use-live-status';
import type { PromptEnhancerHandle } from '../use-prompt-enhancer';
import type { Runtime, UiState } from './controller-state';
import type { AgentClock, UseAgentControllerOptions } from './options';
import { selectionShown } from './send';
import { runStatusInput } from './view-readers';

/** What the view is derived from: the controller hook's own stores and readings. */
export interface AgentViewInputs {
  readonly options: UseAgentControllerOptions;
  readonly capabilities: AgentCapabilities;
  readonly document: BuilderDocument;
  readonly selection: readonly NodeId[];
  readonly uiState: UiState;
  readonly runtime: Runtime;
  readonly historyVersion: number;
  readonly sessions: AgentSessions;
  readonly live: LiveStatus;
  readonly enhancer: PromptEnhancerHandle;
  readonly mood: UseAgentMoodResult;
  readonly clock: AgentClock;
  readonly tick: number;
}

/** The view half of `useAgentController`: everything `state` shows, read off its inputs. */
export function useAgentViewState(inputs: AgentViewInputs): AgentViewState {
  const {
    options,
    capabilities,
    document,
    selection,
    uiState,
    runtime,
    historyVersion,
    sessions,
    live,
    enhancer,
    mood,
    clock,
    tick,
  } = inputs;
  const { kernel, locale } = options;

  /* ── The view ─────────────────────────────────────────────────────────────── */

  const developer = options.developer === true;
  const previewing = uiState.previewing;
  const viewContext = useMemo((): TurnViewContext => {
    void historyVersion;
    return {
      capabilities,
      developer,
      document,
      previewing,
      buildHistory: (turn: BuildTurn) => {
        if (turn.revived === true || turn.status !== 'settled') return undefined;
        const shadow =
          runtime.shadows.get(runtime.builds.get(turn.id)?.kernel ?? kernel) ?? EMPTY_HISTORY;
        const ids = turn.transactionIds ?? [];
        return {
          undone: turn.undone === true,
          canUndo: turn.undone !== true && (isNewest(shadow, ids) || capabilities.undoBuild),
          canRedo: turn.undone === true && isNextRedo(shadow, ids),
        };
      },
      editHistory: (turn: EditTurn) => {
        if (turn.revived === true) return undefined;
        const shadow = runtime.shadows.get(kernel) ?? EMPTY_HISTORY;
        const undoneId = turn.outcome?.kind === 'undone' ? turn.outcome.transactionId : undefined;
        const liveId =
          turn.outcome?.kind === 'redone' ? turn.outcome.transactionId : turn.transactionId;
        return {
          canUndo: liveId !== undefined && isNewest(shadow, [liveId]),
          canRedo: undoneId !== undefined && isNextRedo(shadow, [undoneId]),
        };
      },
    };
  }, [capabilities, developer, document, previewing, runtime, kernel, historyVersion]);

  const activeTurns = sessions.active.turns;
  const turns = useMemo(() => turnViewsOf(activeTurns, viewContext), [activeTurns, viewContext]);

  /* The live run's record, from whichever conversation it writes. */
  const liveRun = uiState.run;
  const allSessions = sessions.state.sessions;
  const runRecord = useMemo((): TurnView | null => {
    if (liveRun === null) return null;
    const turn = allSessions
      .find((session) => session.id === liveRun.sessionId)
      ?.turns.find((candidate) => candidate.id === liveRun.turnId);
    return turn === undefined ? null : (turnViewsOf([turn], viewContext)[0] ?? null);
  }, [liveRun, allSessions, viewContext]);

  const visible = useMemo((): VisibleStatus | null => {
    void tick;
    if (liveRun === null || liveRun.awaiting) return null;
    return visibleStatus(runStatusInput(liveRun, runRecord), clock.now());
  }, [liveRun, runRecord, clock, tick]);

  // The live region hears the RunBar line change: how a blocked episode starts and ends.
  const statusLine =
    visible === null ? null : `${visible.statusKey} ${JSON.stringify(visible.params)}`;
  const reportStatus = live.status;
  useEffect(() => {
    reportStatus(visible);
    // Keyed on the line's value: `visible` is a new object on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusLine, reportStatus]);

  const runBar: RunBarView | null =
    liveRun === null || visible === null
      ? null
      : {
          turnId: liveRun.turnId,
          activity: liveRun.activity,
          statusKey: visible.statusKey,
          params: visible.params,
          startedAt: liveRun.startedAt,
          stopping: liveRun.stopping,
        };

  const shownSelection = useMemo(
    () =>
      selectionShown(uiState, selection).filter(
        (id) => document.nodes[id] !== undefined && id !== document.rootId,
      ),
    [uiState, selection, document],
  );

  const blockChips = useMemo((): readonly ContextChipView[] => {
    const blocks: ContextChipView[] = [
      ...shownSelection.map((id) => ({
        kind: 'selection' as const,
        id,
        label: blockName(kernel, id),
        stale: false,
      })),
      ...uiState.mentions
        .filter((entry) => !shownSelection.includes(entry.id))
        .map((entry) => ({
          kind: 'mention' as const,
          id: entry.id,
          label: entry.label,
          stale: document.nodes[entry.id] === undefined,
        })),
    ];
    return blocks.length === 0 ? [{ kind: 'page', id: 'page' }] : blocks;
  }, [shownSelection, uiState.mentions, document, kernel]);
  // While the box is empty the scope chip speaks of the latest request: what it focused on.
  const activeId = sessions.state.activeId;
  const chips = useMemo(
    () => withScopeFocus(blockChips, uiState.context, activeId, uiState.draft),
    [blockChips, uiState.context, activeId, uiState.draft],
  );
  const contextMeter = useMemo(
    () => contextMeterView(uiState.context, activeId),
    [uiState.context, activeId],
  );

  const query = mentionQuery(uiState.draft);
  const mention: MentionView | null =
    query === null
      ? null
      : {
          query,
          candidates: mentionCandidatesFor(document, query, {
            nameOf: (id) => blockName(kernel, id),
            exclude: chips.flatMap((chip) => (chip.kind === 'page' ? [] : [chip.id])),
          }),
        };

  const runLife: 'idle' | 'live' | 'stopping' =
    liveRun === null || liveRun.awaiting ? 'idle' : liveRun.stopping ? 'stopping' : 'live';
  const queued = uiState.queue !== null && !uiState.queue.paused;
  const sendSlot = sendState({ run: runLife, draft: uiState.draft, queued });

  const awaiting = turns.some(isAwaitingDecision);
  const quiet =
    liveRun !== null || uiState.draft.trim() !== '' || awaiting || uiState.clarify !== null;
  // The registry is mutable: an extension registered later changes the catalog, not its identity.
  const catalogVersion = kernel.extensions.version();
  const suggestions = useMemo((): readonly SuggestionView[] => {
    void catalogVersion;
    // Hidden while running, while the box has text, while a decision waits (SPEC §4.16).
    if (quiet) return [];
    const page = summarizeDocumentForIntent(document);
    if ((page.nodeCount === 0 || page.placeholderOnly) && activeTurns.length === 0) {
      return starterSuggestions(locale);
    }
    const first = shownSelection[0];
    const type = first === undefined ? undefined : document.nodes[first]?.type;
    const schema = type === undefined ? undefined : kernel.context.registry.block(type)?.schema;
    const dropped = lastDropped(activeTurns);
    const newest = activeTurns.findLast((turn) => turn.kind === 'edit' || turn.kind === 'proposal');
    const salvaged =
      dropped !== undefined && dropped.length > 0 && newest !== undefined && 'target' in newest
        ? newest.target
        : undefined;
    return panelSuggestions({
      blocks: kernel.context.registry.blocks(kernel.context.surface),
      nameOf: (block) =>
        block.nodeId === undefined ? blockTypeName(block.type) : blockName(kernel, block.nodeId),
      ...(first !== undefined && schema !== undefined
        ? { selected: { nodeId: first, schema } }
        : {}),
      followUp: lastFollowUp(activeTurns),
      ...(salvaged === undefined ? {} : { salvaged: [salvaged] }),
      ...(ranOnPage(activeTurns) ? { pageSections: page.sectionLabels } : {}),
      locale,
      limit: activeTurns.length === 0 ? 4 : 3,
    });
  }, [quiet, document, activeTurns, locale, kernel, shownSelection, catalogVersion]);

  const empty = useMemo((): EmptyStateView => {
    const first = shownSelection[0];
    if (first !== undefined) return { kind: 'selection', title: blockName(kernel, first) };
    const sections = Object.values(document.nodes[document.rootId]?.slots ?? {}).flat().length;
    const page = summarizeDocumentForIntent(document);
    return sections > 0 && !page.placeholderOnly
      ? { kind: 'hasContent', sections }
      : { kind: 'greeting' };
  }, [shownSelection, document, kernel]);

  const snapshot = mood.snapshot;
  const face = useMemo(
    (): FaceView => ({
      mood: snapshot.mood,
      ...(snapshot.variant === undefined ? {} : { variant: snapshot.variant }),
      ...(snapshot.outcome === undefined ? {} : { outcome: snapshot.outcome }),
      typing: snapshot.typing,
    }),
    [snapshot],
  );

  const clarify = useMemo(
    (): ClarifyView | null =>
      uiState.clarify === null
        ? null
        : {
            request: uiState.clarify.request,
            understood: uiState.clarify.understood,
            questions: uiState.clarify.questions,
            status: uiState.clarify.status,
          },
    [uiState.clarify],
  );

  const model = useMemo(
    () => modelSelection(options.models ?? [], options.model),
    [options.models, options.model],
  );
  const effort = useMemo(
    () => effortSelection(options.effort, options.onSelectEffort !== undefined),
    [options.effort, options.onSelectEffort],
  );
  const freeCode = useMemo<FreeCodeView | null>(
    () => (options.onToggleFreeCode === undefined ? null : { enabled: options.freeCode === true }),
    [options.freeCode, options.onToggleFreeCode],
  );
  const queue = useMemo(
    () => (uiState.queue === null ? null : queueView(uiState.queue, document)),
    [uiState.queue, document],
  );

  // The request the clarify panel asks about is the person's bubble while it asks.
  const clarifying = uiState.clarify;
  const shownTurns = useMemo(
    () => withPendingRequest(turns, clarifying, document),
    [turns, clarifying, document],
  );

  const state: AgentViewState = {
    locale,
    turns: shownTurns,
    draft: uiState.draft,
    chips,
    contextMeter,
    mention,
    mode: sessions.state.mode,
    model,
    workers: uiState.workers,
    effort,
    freeCode,
    send: sendSlot,
    run: runBar,
    queue,
    sessions: sessions.summaries,
    suggestions,
    empty,
    announcement: live.announcement,
    enhancement: enhancer.view,
    clarify,
    face,
  };

  return state;
}
