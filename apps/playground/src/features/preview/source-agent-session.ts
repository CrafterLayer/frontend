import {
  buildProjectIndex, codeFileHash, createRunCoordinator, projectAfterChanges,
  type ApplyCodeChangesArgs, type BuilderSiteKernel, type JsonValue, type RunRecord, type SelectionTarget,
} from '@craftkit/builder';
import type { RuntimeSnapshot, SourceElement } from '@craftkit/builder/code-runtime';
import type { SourceRunJournal } from '../vault/source-run-journal';
import { vaultWriteAcknowledgement, type VaultStore } from '../vault/store';
import type { CodePageSession } from './code-page-session';
import { runtimeSnapshotFromSite, type CodeRuntimeClient } from './code-runtime-client';
import { sourceAgentOutputSchema, type SourceAgentClient, type SourceAgentOutput, type SourceAgentRequest } from './source-agent-client';
import type { SourceAgentMode, SourceAgentPort, SourceAgentSnapshot, SourceAgentTurn } from './source-agent-types';

interface Capture {
  readonly source: RuntimeSnapshot;
  readonly selection: SourceElement | null;
  readonly prompt: string;
  readonly mode: SourceAgentMode;
  readonly title: string;
}
interface SavedTurn { readonly turn: SourceAgentTurn; readonly capture: Capture; readonly runId: string; }
interface Options {
  readonly kernel: BuilderSiteKernel;
  readonly runtime: CodePageSession;
  readonly compiler: CodeRuntimeClient | undefined;
  readonly client: SourceAgentClient | undefined;
  readonly journal: SourceRunJournal;
  readonly store: VaultStore;
  readonly siteId: string;
  readonly enabled: boolean;
  readonly onReview: (files: readonly string[]) => void;
}

/** Source Agent is independent of the block-command pipeline. All writes use one kernel CAS. */
export function createSourceAgentSession(options: Options) {
  const { kernel, runtime, journal, store, siteId } = options;
  const listeners = new Set<() => void>();
  const saved = new Map<string, SavedTurn>();
  const storageKey = `source-agent/${encodeURIComponent(siteId)}/v1`;
  let active: { id: string; runId: string; abort: AbortController; committed: boolean } | undefined;
  let queued: Capture | undefined;
  let stopped = false;
  let sequence = 0;
  let writeTail = Promise.resolve();
  let state: SourceAgentSnapshot = { mode: 'auto', draft: '', busy: false, enabled: options.enabled && options.client !== undefined && options.compiler !== undefined, context: contextLabel(), message: undefined, turns: [], queued: null };

  const coordinator = createRunCoordinator({
    journal,
    revalidation: { revalidate: async (input) => {
      const source = runtimeSnapshotFromSite(kernel.getSite(), input.pageId);
      if (source === undefined) return { ok: false, reason: 'missing-page' };
      if (source.projectId !== input.projectId) return { ok: false, reason: 'missing-project' };
      // A queued page request can advance. A source target must keep its exact revision.
      if (input.target !== null && source.project.revision !== input.expectedProjectRevision) return { ok: false, reason: 'stale-target' };
      return { ok: true, currentProjectRevision: source.project.revision, currentSiteRevision: source.project.revision, target: input.target };
    } },
  });

  function contextLabel() {
    const source = runtime.getSnapshot().source;
    const page = kernel.getSite().pages.find(({ id }) => id === source?.pageId);
    const selection = runtime.getSnapshot().selection;
    return page === undefined ? 'Select a code page' : selection === undefined ? `Page · ${page.title}` : `${page.title} · ${selection.tag}`;
  }
  function publish(next: Partial<SourceAgentSnapshot> = {}) {
    const last = kernel.transactions().at(-1);
    state = { ...state, ...next, context: contextLabel() };
    state = { ...state, turns: state.turns.map((turn) => ({ ...turn, canUndo: !state.busy && kernel.canUndo() && last?.codeChanges?.some(({ attribution }) => attribution.runId === saved.get(turn.id)?.runId) === true })) };
    for (const listener of listeners) listener();
  }
  function updateTurn(id: string, patch: Partial<SourceAgentTurn>) {
    const current = saved.get(id);
    if (current === undefined) return;
    const next = { ...current, turn: { ...current.turn, ...patch } };
    saved.set(id, next);
    publish({ turns: state.turns.map((turn) => turn.id === id ? next.turn : turn) });
  }
  async function persist() {
    const contents = { version: 1, turns: [...saved.values()], queued: queued ?? null };
    const ownSequence = ++sequence;
    const write = writeTail.then(async () => {
      const ack = vaultWriteAcknowledgement(store, await store.set(storageKey, contents, ownSequence), ownSequence);
      if (ack.kind !== 'durable') throw new Error(ack.kind === 'failed' ? ack.reason : 'Durable storage is required to recover this Agent run.');
    });
    writeTail = write.catch(() => undefined);
    return write;
  }
  function capture(prompt: string, mode = state.mode): Capture {
    const source = runtime.getSnapshot().source;
    if (source === undefined) throw new Error('Select a code page first.');
    const selection = runtime.getSnapshot().selection ?? null;
    if (selection !== null && selection.handle.modulePath !== source.entry) throw new Error('Open shared source to review its scope before asking for a change.');
    const title = kernel.getSite().pages.find(({ id }) => id === source.pageId)?.title ?? source.pageId;
    return { source, selection, prompt, mode, title };
  }
  function targetOf(captured: Capture): SelectionTarget | null {
    return captured.selection === null ? null : { pageId: captured.source.pageId, sourceOrNodeId: captured.selection.handle, revision: captured.source.project.revision, capabilities: ['inspect', 'editSource'] };
  }
  function requestFor(captured: Capture, runId: string): SourceAgentRequest {
    const source = captured.source;
    const paths = captured.selection === null ? Object.keys(source.project.files).filter((path) => path.startsWith(`pages/${source.pageId}/`)) : [captured.selection.handle.modulePath];
    const files = Object.fromEntries(paths.map((path) => [path, source.project.files[path]]));
    if (JSON.stringify(files).length > 250_000) throw new Error('This scope is too large. Select a section or source file.');
    const index = buildProjectIndex({ siteId, siteRevision: source.project.revision, site: kernel.getSite() });
    const page = index.pages.find(({ pageId }) => pageId === source.pageId);
    return {
      version: 1, mode: captured.mode, runId, projectId: source.projectId, sourceRevision: source.project.revision,
      designContract: { direction: index.direction, purpose: page?.purpose, audience: page?.audience, tokens: kernel.getSite().designSystem, requirements: ['specific content and typography', 'responsive composition', 'keyboard access', 'reduced motion'] },
      projectIndex: { ...index },
      units: [{ unitId: 'source', role: captured.mode === 'ask' ? 'context' : captured.selection === null ? 'design' : 'code', filePaths: captured.mode === 'auto' ? paths : [], prompt: captured.prompt,
        relevantContext: { files, dependencyLock: source.project.dependencyLock, entry: source.entry, selection: captured.selection, constraint: captured.selection === null ? 'Keep edits within this page. Shared files are read-only.' : 'Only change the selected AST span. Preserve every byte before and after it.' } }],
    };
  }

  async function execute(captured: Capture, prior?: SavedTurn) {
    if (active !== undefined || options.client === undefined || options.compiler === undefined || !state.enabled) return;
    const id = prior?.turn.id ?? crypto.randomUUID();
    const runId = crypto.randomUUID();
    const operation = { id, runId, abort: new AbortController(), committed: false };
    active = operation; stopped = false;
    const turn: SourceAgentTurn = { id, prompt: captured.prompt, pageTitle: captured.title, status: 'running', summary: '', currentTask: 'Preparing the captured page', completed: 0, total: captured.mode === 'auto' ? 3 : 1, files: [], details: [], canUndo: false, canResume: false };
    saved.set(id, { capture: captured, turn, runId });
    publish({ busy: true, message: undefined, turns: prior === undefined ? [...state.turns, turn] : state.turns.map((current) => current.id === id ? turn : current) });
    let record: RunRecord | undefined;
    const assertActive = () => { if (active !== operation || operation.abort.signal.aborted) throw new Error('Run stopped.'); };
    try {
      await persist();
      record = prior === undefined ? await coordinator.startRun({ runId, siteId, projectId: captured.source.projectId, pageId: captured.source.pageId, baseRevision: captured.source.project.revision, mode: captured.mode, target: targetOf(captured), routingPolicyVersion: 'server-configured-v1' }) : await coordinator.resumeRun(prior.runId, runId);
      await coordinator.activateRun(runId);
      assertActive();
      let output: SourceAgentOutput;
      const completed = record.units.find((unit) => unit.unitId === 'source' && unit.status === 'completed');
      if (completed?.checkpointId) {
        output = sourceAgentOutputSchema.parse(await journal.loadCheckpoint(completed.checkpointId));
      } else {
        updateTurn(id, { currentTask: captured.mode === 'auto' ? 'Writing page source' : 'Reading the requested context' });
        const unit = await coordinator.beginUnit(runId, { unitId: 'source', stage: captured.mode });
        const response = await options.client.run(requestFor(captured, runId), operation.abort.signal);
        assertActive();
        const result = response.units[0];
        if (result?.status !== 'completed' || result.output === undefined) throw new Error(result?.reason ?? 'Agent did not finish the source task.');
        output = result.output;
        await coordinator.completeUnit(unit, { checkpointId: `${runId}/source`, checkpoint: JSON.parse(JSON.stringify(output)) as JsonValue });
      }
      assertActive();
      updateTurn(id, { summary: output.summary, completed: 1, files: output.changes.map(({ path }) => path), details: [`${output.provider} · ${output.model} · ${output.effort}`, `Attempts: ${String(output.attempt)}`] });
      if (captured.mode === 'auto' && output.changes.length > 0) {
        const changes = changesFor(captured, output, runId);
        const current = runtimeSnapshotFromSite(kernel.getSite(), captured.source.pageId);
        if (current?.projectId !== captured.source.projectId) throw new Error('The captured page no longer exists.');
        if (captured.selection !== null && current.project.revision !== captured.source.project.revision) throw new Error('The selected source changed. Select it again.');
        // Disjoint edits may advance the project. Expected file hashes remain mandatory.
        const merged = projectAfterChanges(current.project, changes);
        const draft = { ...current, project: { ...merged, revision: `draft-${runId}` } };
        updateTurn(id, { currentTask: 'Compiling the merged draft' });
        const compiled = await options.compiler.compile(draft, operation.abort.signal);
        assertActive();
        updateTurn(id, { completed: 2, currentTask: 'Checking the running page in isolation' });
        await options.compiler.exportPage({ ...draft, title: captured.title, description: '', direction: kernel.getSite().dir }, compiled.artifact.artifactId, operation.abort.signal);
        assertActive();
        // A concurrent edit during compilation fails this final CAS. No mutation occurs before it.
        kernel.dispatch('applyCodeChanges', { ...changes, expectedProjectRevision: current.project.revision }, 'ai');
        operation.committed = true;
        updateTurn(id, { completed: 3, currentTask: 'Applied as one change', canResume: false });
        await kernel.flush();
      }
      await coordinator.completeRun(runId, operation.committed ? 'applied' : 'planned');
      updateTurn(id, { status: 'done', currentTask: captured.mode === 'auto' ? 'Complete' : 'Read-only response', completed: captured.mode === 'auto' ? 3 : 1, canResume: false });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Agent run failed.';
      const running = coordinator.getRun(runId);
      if (running?.status === 'active') await coordinator.stopRun(runId, reason).catch(() => undefined);
      updateTurn(id, { status: operation.committed ? 'done' : operation.abort.signal.aborted ? 'stopped' : 'failed', currentTask: operation.committed ? 'Applied; storage needs attention' : 'Draft kept for review', summary: reason, canResume: !operation.committed && record !== undefined });
    } finally {
      active = undefined;
      publish({ busy: false });
      await persist().catch((error: unknown) => publish({ message: error instanceof Error ? error.message : 'Run recovery could not be saved.' }));
      if (!stopped && queued !== undefined) {
        const next = queued;
        const latest = runtimeSnapshotFromSite(kernel.getSite(), next.source.pageId);
        if (latest?.projectId !== next.source.projectId || (next.selection !== null && latest.project.revision !== next.source.project.revision)) {
          publish({ message: 'The queued target changed. Review or remove the queued request.' });
        } else {
          queued = undefined; publish({ queued: null });
          await execute({ ...next, source: latest });
        }
      }
    }
  }

  const port: SourceAgentPort = {
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => state,
    setMode: (mode) => { publish({ mode }); },
    setDraft: (draft) => { publish({ draft }); },
    submit: async () => {
      if (!state.enabled || !state.draft.trim()) return;
      try {
        const captured = capture(state.draft.trim());
        if (active !== undefined) {
          if (queued !== undefined) throw new Error('One next request is already queued. Edit or remove it first.');
          queued = captured; publish({ draft: '', queued: { prompt: captured.prompt, context: captured.title } }); await persist();
        } else { publish({ draft: '' }); await execute(captured); }
      } catch (error) { publish({ message: error instanceof Error ? error.message : 'Request could not start.' }); }
    },
    stop: async () => {
      stopped = true;
      const operation = active;
      if (operation === undefined || operation.committed) return;
      operation.abort.abort();
      if (coordinator.getRun(operation.runId)?.status === 'active') await coordinator.stopRun(operation.runId).catch(() => undefined);
      publish({ draft: saved.get(operation.id)?.capture.prompt ?? state.draft });
    },
    editQueued: async (prompt) => { if (queued === undefined) return; queued = { ...queued, prompt }; publish({ queued: { prompt, context: queued.title } }); await persist().catch(() => publish({ message: 'Queued request could not be saved.' })); },
    removeQueued: async () => { queued = undefined; publish({ queued: null }); await persist().catch(() => publish({ message: 'Queue removal could not be saved.' })); },
    newConversation: () => { if (!state.busy) publish({ turns: [], draft: '', message: undefined }); },
    reviewChanges: (id) => { options.onReview(saved.get(id)?.turn.files ?? []); },
    undo: (id) => { if (state.turns.find((turn) => turn.id === id)?.canUndo) { kernel.undo(); publish(); } },
    resume: async (id) => {
      const prior = saved.get(id);
      if (prior === undefined || state.busy || !prior.turn.canResume) return;
      if (kernel.transactions().some((transaction) => transaction.codeChanges?.some(({ attribution }) => attribution.runId === prior.runId))) { updateTurn(id, { canResume: false, status: 'done', summary: 'This run was already applied.' }); return; }
      await execute(prior.capture, prior);
    },
  };
  return {
    port,
    start: () => {
      const unsubscribe = runtime.subscribe(() => publish());
      publish();
      return () => { unsubscribe(); stopped = true; active?.abort.abort(); };
    },
  };
}

function changesFor(capture: Capture, output: SourceAgentOutput, runId: string): ApplyCodeChangesArgs {
  const { source, selection } = capture;
  if (selection !== null) {
    if (output.changes.length !== 1 || output.changes[0]?.path !== selection.handle.modulePath) throw new Error('The Agent changed files outside the selected element.');
    const original = source.project.files[selection.handle.modulePath]?.source;
    const proposed = output.changes[0].source;
    if (original === undefined || !proposed.startsWith(original.slice(0, selection.start)) || !proposed.endsWith(original.slice(selection.end)) || proposed.length < selection.start + original.length - selection.end) throw new Error('The Agent changed content outside the selected element.');
  }
  return { projectId: source.projectId, expectedProjectRevision: source.project.revision, attribution: { author: 'ai', runId }, changes: output.changes.map(({ path, language, source: text }) => ({ path, expectedHash: source.project.files[path] === undefined ? null : codeFileHash(source.project.files[path]), file: { language, source: text } })) };
}
