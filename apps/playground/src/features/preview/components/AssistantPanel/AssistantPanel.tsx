import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';

import { useAgentMood } from '../AgentFace';
import { AgentContextBar } from '../AgentContextBar';
import { AgentDockHeader } from '../AgentDockHeader';
import { AssistantComposer } from '../AssistantComposer';
import { AssistantThread } from '../AssistantThread';
import { BuildCardSeamContext } from '../BuildReportCard';
import { PlanPreviewDialog } from '../PlanPreviewDialog';
import { QueuedRequestCard } from '../QueuedRequestCard';
import { SuggestionRail } from '../SuggestionRail';
import {} from './AssistantPanel.icons';
import { useAppliedChangeMemory } from './AssistantPanel.memory';
import { insertMention, mentionCandidatesFor } from './AssistantPanel.mentions';
import { retrySkippedRequest, type ActiveRunLease } from './AssistantPanel.runs';
import type {
  AssistantPanelProps,
  BuildRecord,
  QueuedAssistantRequest,
} from './AssistantPanel.types';
import { useFaceLook } from './use-face-look';
import { useAsk } from './use-assistant-ask';
import { useAssistantProviders } from './use-assistant-providers';
import { useAssistantSessions } from './use-assistant-sessions';
import { useBuildReportActions } from './use-build-report-actions';
import { usePageBuild } from './use-page-build';
import { usePlanActions } from './use-plan-actions';
import { useRunQueue } from './use-run-queue';

/*
  Re-exported, not re-declared: `AssistantMode` is part of this panel's public
  surface and its data now lives beside the control that renders it.
*/
export { MODES, type AssistantMode } from './AssistantPanel.modes';
export type { AssistantPanelProps } from './AssistantPanel.types';

/*
  The panel is the COMPOSITION ROOT of the v1 assistant (split 2026-10-13):
  conversations (use-assistant-sessions), who answers (use-assistant-providers),
  the two run paths (use-page-build, use-assistant-ask + run-outline), the
  queue and the one lease (use-run-queue), and what a person does to cards
  (use-build-report-actions, use-plan-actions). It renders; they decide.
*/

export function AssistantPanel({
  kernel,
  onReviewAsCode,
  planProvider,
  providerKind = 'offline',
  skillRegistry,
  selectedSkillIds,
  agentPolicy,
  onAgentEvent,
  onBuildEvent,
  persistKey,
  defaultMode = 'ask',
  locale = 'ar',
  visible = true,
  onSiteSeam,
  models: offeredModels,
  model: chosenModel,
  onSelectModel,
}: AssistantPanelProps) {
  const {
    sessions,
    setSessions,
    nextId,
    activeId,
    setActiveId,
    panelMode,
    setMode,
    chooseMode,
    active,
    turns,
    patchTurns,
    openTurn,
  } = useAssistantSessions(persistKey, defaultMode);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [queuedRequest, setQueuedRequest] = useState<QueuedAssistantRequest | null>(null);
  const [queuePaused, setQueuePaused] = useState(false);
  /** Whether the composer holds focus — the face listens when it does. */
  const [composerFocused, setComposerFocused] = useState(false);
  /*
    The character's mood: a pure function of the run log plus the composer.
    The hook owns one timer for its dwells and holds; the panel only tells it
    when a run begins, what the agent said, how the turn settled, and what
    the person did to a card.
  */
  const {
    snapshot: face,
    beginRun: beginFaceRun,
    onEvent: onFaceEvent,
    settleTurn: settleFaceTurn,
    noteTurn: noteFaceTurn,
    reset: resetFace,
  } = useAgentMood({ mode: panelMode, composerFocused, draftLength: draft.length });
  // He watches you cross the header (or the empty state) — never while you type.
  const { watchZone: watchHeadZone, holdSeat: holdHeadSeat } = useFaceLook();
  const { watchZone: watchEmptyZone, holdSeat: holdEmptySeat } = useFaceLook();
  /** The @-mention in progress: the text typed after the trailing @, or null. */
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  /** A lease and controller for the one run allowed to own this panel. */
  const activeRunRef = useRef<ActiveRunLease | null>(null);
  /**
   * The pending answer to a build's ONE question. A ref, not state: it is the
   * continuation of a promise the orchestrator is awaiting, and putting it in
   * state would re-render the panel to store something no view reads.
   */
  const approvalRef = useRef<((answer: 'build' | 'stop') => void) | null>(null);
  /** Every finished build this panel ran, by its report turn's id. */
  const buildsRef = useRef(new Map<string, BuildRecord>());
  const memory = useAppliedChangeMemory();
  const memoryProvider = memory.provider;
  const threadRef = useRef<HTMLDivElement | null>(null);
  const inputId = useId();
  const modeLockId = useId();
  const subscribeToKernel = useCallback(
    (onStoreChange: () => void) => kernel.context.store.subscribe(onStoreChange),
    [kernel],
  );
  const getSelectionSnapshot = useCallback(
    () => kernel.context.store.getState().selection,
    [kernel],
  );
  const selectedIds = useSyncExternalStore(
    subscribeToKernel,
    getSelectionSnapshot,
    getSelectionSnapshot,
  );

  /*
    The newest turn is the one being read, so the thread follows it — on arrival
    AND on the way back into view.

    `visible` is in the list for a measured reason. The host keeps this panel
    mounted while a person is on Layers or Blocks, and a hidden element measures
    zero: every turn that landed while it was away scrolled the thread to 0, and
    nothing re-ran on return because `turns` had not changed since. Measured in
    Chromium, five replies received while hidden left the reader ~360px above
    the newest one — in the exact scenario keeping it mounted was written for.
  */
  useEffect(() => {
    const thread = threadRef.current;
    if (thread !== null && visible) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [turns, visible]);

  /**
   * What the assistant can SEE, stated rather than guessed at.
   *
   * A person cannot judge a proposal without knowing what it was looking at,
   * and an assistant that stays silent about its context invites them to assume
   * it saw more than it did.
   */
  const selectedId = selectedIds[0];
  const selectedType =
    selectedId === undefined ? undefined : kernel.getDocument().nodes[selectedId]?.type;
  const sees = selectedType === undefined ? 'the whole page' : `${selectedType} · selected`;

  const { registry, resolvedProvider, catalogFirstProvider, suggestions } = useAssistantProviders({
    kernel,
    planProvider,
    skillRegistry,
    selectedType,
    turns,
    locale,
  });

  const { answerApproval, undoTask, buildCardSeam } = useBuildReportActions({
    locale,
    panelMode,
    turns,
    patchTurns,
    noteFaceTurn,
    buildsRef,
    approvalRef,
  });

  const startNewChat = useCallback(() => {
    activeRunRef.current?.controller.abort();
    activeRunRef.current = null;
    // The face forgets the run with the lease: the late run.cancelled the
    // abort produces carries the old run id and the reducer drops it.
    resetFace();
    setBusy(false);
    setQueuedRequest(null);
    setQueuePaused(false);
    const id = nextId('session');
    setSessions((previous) => [...previous, { id, title: 'New chat', turns: [] }]);
    setActiveId(id);
    setDraft('');
  }, [nextId, resetFace, setSessions, setActiveId]);

  useEffect(
    () => () => {
      activeRunRef.current?.controller.abort();
      activeRunRef.current = null;
    },
    [],
  );

  /** What every run borrows from the panel: its conversation, face, lease and provider. */
  const runInputs = {
    kernel,
    nextId,
    active,
    openTurn,
    patchTurns,
    beginFaceRun,
    onFaceEvent,
    settleFaceTurn,
    onAgentEvent,
    memory,
    memoryProvider,
    resolvedProvider,
    registry,
    selectedSkillIds,
    providerKind,
    agentPolicy,
    activeRunRef,
    setBusy,
    setDraft,
  };
  const runBuild = usePageBuild({ ...runInputs, onBuildEvent, approvalRef, buildsRef });
  const ask = useAsk({
    ...runInputs,
    panelMode,
    busy,
    sees,
    selectedType,
    catalogFirstProvider,
    queuedRequest,
    setQueuedRequest,
    setQueuePaused,
    runBuild,
  });
  const stop = useRunQueue({
    kernel,
    ask,
    busy,
    setBusy,
    queuedRequest,
    setQueuedRequest,
    queuePaused,
    setQueuePaused,
    activeRunRef,
    onSiteSeam,
  });

  /** Every block a trailing @ can point at, filtered as the person types. */
  const mentionCandidates = mentionCandidatesFor(kernel.getDocument(), mentionQuery);

  const pickMention = useCallback(
    (id: string) => {
      setDraft((current) => insertMention(current, mentionQuery, id));
      setMentionQuery(null);
    },
    [mentionQuery],
  );

  const { accept, preview, setPreview, mutatesLiveDocument, openPreview, discard } = usePlanActions(
    { kernel, memory, panelMode, noteFaceTurn, patchTurns },
  );

  return (
    <section className="pg-chat" aria-label="Assistant" data-mood={face.mood}>
      <AgentDockHeader
        locale={locale}
        face={face}
        conversations={sessions.map((session) => ({
          id: session.id,
          title: session.title,
          turnCount: session.turns.length,
        }))}
        activeId={activeId}
        onSelectConversation={setActiveId}
        onNewChat={startNewChat}
        watchZone={watchHeadZone}
        holdSeat={holdHeadSeat}
      />

      <AgentContextBar
        scope={selectedType === undefined ? 'page' : 'instance'}
        label={`Sees: ${sees}`}
        detail={selectedId}
      />

      <BuildCardSeamContext.Provider value={buildCardSeam}>
        <AssistantThread
          turns={turns}
          face={face}
          locale={locale}
          mode={panelMode}
          busy={busy}
          canWrite={mutatesLiveDocument}
          threadRef={threadRef}
          watchEmptyZone={watchEmptyZone}
          holdEmptySeat={holdEmptySeat}
          onApproval={answerApproval}
          onStop={stop}
          onUndoTask={undoTask}
          onRetrySkipped={(titles) => {
            void ask(retrySkippedRequest(titles));
          }}
          onRetry={(request) => {
            void ask(request);
          }}
          onJump={(id) => {
            /*
            Selecting is the jump. The canvas scrolls to the selection and the
            Inspector follows, so one door does the whole thing — and it is the
            same door a click on the canvas uses, which is why a jumped-to
            section behaves exactly like one the person found themselves.
          */
            kernel.setSelection([id]);
          }}
          onBuild={(request) => {
            /*
            The mode control MOVES, and it moves first. A run's authority is
            fixed when it starts, so building a planned page means starting a
            run in a writing mode — and the panel must not be in one state while
            the run it just started is in another. Ask, not Auto: the person
            asked to plan, and the section list still gets its one approval.
          */
            setMode('ask');
            void ask(request, 'build');
          }}
          onApplyPlan={accept}
          onPreviewPlan={openPreview}
          onDiscardPlan={discard}
          onUndoPlan={() => {
            kernel.undo();
          }}
          onReviewAsCode={onReviewAsCode}
        />
      </BuildCardSeamContext.Provider>

      {/*
        The suggestion strip, ABOVE the composer and outside the thread.

        Outside, because it is not part of the conversation: putting it in the
        log made it scroll away with the messages, which is how the old starters
        disappeared after the first turn and never came back. Above the composer
        is where the next thing a person says is being decided.
      */}
      {/*
        The rail is its own component. Its two layouts, its wheel handling and
        its RTL sign live with it — this panel decides only WHAT to offer and
        what happens when one is picked.
      */}
      {turns.length === 0 && !busy ? (
        <SuggestionRail
          suggestions={suggestions}
          layout="stack"
          busy={false}
          onPick={(text) => {
            void ask(text, 'suggestion');
          }}
        />
      ) : null}

      {queuedRequest === null ? null : (
        <QueuedRequestCard
          request={queuedRequest.request}
          context={queuedRequest.context}
          state={queuedRequest.state}
          paused={queuePaused}
          onChange={(request) => {
            setQueuedRequest((current) => (current === null ? null : { ...current, request }));
          }}
          onRemove={() => {
            setQueuedRequest(null);
            setQueuePaused(false);
          }}
          onRun={() => {
            const selection = kernel.context.store.getState().selection;
            setQueuedRequest((current) =>
              current === null
                ? null
                : {
                    ...current,
                    context: sees,
                    selection,
                    targetTypes: selection.map((id) => kernel.getDocument().nodes[id]?.type),
                    state: 'editable',
                  },
            );
            setQueuePaused(false);
          }}
        />
      )}

      <AssistantComposer
        draft={draft}
        onDraftChange={setDraft}
        inputId={inputId}
        busy={busy}
        queued={queuedRequest !== null}
        onSend={() => {
          void ask(draft);
        }}
        onStop={stop}
        onFocusChange={setComposerFocused}
        mentionQuery={mentionQuery}
        onMentionQueryChange={setMentionQuery}
        mentionCandidates={mentionCandidates}
        onPickMention={pickMention}
        mode={panelMode}
        onModeChange={chooseMode}
        modeLockId={modeLockId}
        locale={locale}
        models={offeredModels}
        model={chosenModel}
        onSelectModel={onSelectModel}
      />

      {/*
        THE PREVIEW: the would-be page, rendered from the scratch rehearsal.
        Same static renderer the published path uses, same registry, zero
        writes — builder.io's accept-with-your-eyes-open pattern, through this
        kernel's own door.
      */}
      {preview === null ? null : (
        <PlanPreviewDialog
          document={preview.document}
          blocks={kernel.context.registry.block}
          /*
            The PANEL's promise, not the proposal's: in Plan mode nothing here
            writes, so the dialog draws the reason instead of a button `accept`
            would refuse to honour.
          */
          canApply={mutatesLiveDocument}
          onApply={() => {
            accept(preview.id, preview.proposal);
            setPreview(null);
          }}
          onClose={() => {
            setPreview(null);
          }}
        />
      )}
    </section>
  );
}
