import {
  runRecordSchema,
  selectionTargetSchema,
  type JsonValue,
  type PersistenceAck,
  type RunRecord,
  type RunUnitRecord,
  type SelectionTarget,
} from '@craftkit/builder-schema';

export const RUN_COORDINATOR_VERSION = 1 as const;

export type RunCoordinatorErrorCode =
  | 'active-run-exists'
  | 'duplicate-run'
  | 'journal-not-durable'
  | 'queued-request-exists'
  | 'queued-request-missing'
  | 'run-not-active'
  | 'run-not-found'
  | 'run-not-resumable'
  | 'stale-base'
  | 'stale-result'
  | 'stale-target'
  | 'unit-already-completed'
  | 'unit-not-active';

export class RunCoordinatorError extends Error {
  readonly code: RunCoordinatorErrorCode;

  constructor(code: RunCoordinatorErrorCode, message: string) {
    super(message);
    this.name = 'RunCoordinatorError';
    this.code = code;
  }
}

export interface QueuedRunRequest {
  formatVersion: typeof RUN_COORDINATOR_VERSION;
  requestId: string;
  siteId: string;
  projectId: string;
  pageId: string;
  mode: RunRecord['mode'];
  prompt: string;
  target: SelectionTarget | null;
  baseRevision: string;
  createdAt: number;
  updatedAt: number;
  paused: boolean;
}

export interface StartRunInput {
  runId: string;
  siteId: string;
  projectId: string;
  pageId: string;
  mode: RunRecord['mode'];
  target: SelectionTarget | null;
  baseRevision: string;
  routingPolicyVersion: string;
}

export interface QueueRunRequestInput {
  requestId: string;
  siteId: string;
  projectId: string;
  pageId: string;
  mode: RunRecord['mode'];
  prompt: string;
  target: SelectionTarget | null;
  baseRevision: string;
}

export interface BeginRunUnitInput {
  unitId: string;
  stage: string;
  provider?: string | null;
  model?: string | null;
  effort?: string | null;
  fallback?: string | null;
}

export interface RunUnitLease {
  readonly runId: string;
  readonly unitId: string;
  readonly attempt: number;
  readonly sourceRevision: string;
  readonly signal: AbortSignal;
}

export interface CompleteRunUnitInput {
  checkpointId: string;
  checkpoint: JsonValue;
  latencyMs?: number | null;
  usage?: Partial<RunUnitRecord['usage']>;
}

export interface CompletedUnitJournalInput {
  record: RunRecord;
  unitId: string;
  attempt: number;
  sourceRevision: string;
  checkpointId: string;
  checkpoint: JsonValue;
  latencyMs: number | null;
  usage: RunUnitRecord['usage'];
}

/**
 * Persistence owns the atomic checkpoint + completion marker write. Returning
 * the stored record makes it impossible for the coordinator to publish a
 * completion marker that the durable journal did not actually accept.
 */
export interface RunJournalPort {
  loadRun(runId: string): Promise<RunRecord | undefined>;
  loadActiveRunForProject(projectId: string): Promise<RunRecord | undefined>;
  saveRun(record: RunRecord): Promise<PersistenceAck>;
  commitCompletedUnit(input: CompletedUnitJournalInput): Promise<RunRecord>;
  loadQueuedRequest(projectId: string): Promise<QueuedRunRequest | undefined>;
  saveQueuedRequest(
    projectId: string,
    request: QueuedRunRequest | null,
  ): Promise<PersistenceAck>;
}

export interface RunRevalidationInput {
  siteId: string;
  projectId: string;
  pageId: string;
  expectedProjectRevision: string;
  target: SelectionTarget | null;
}

export type RunRevalidationResult =
  | {
      ok: true;
      currentProjectRevision: string;
      currentSiteRevision: string;
      target: SelectionTarget | null;
    }
  | { ok: false; reason: 'missing-project' | 'missing-page' | 'stale-base' | 'stale-target' };

export interface RunRevalidationPort {
  revalidate(input: RunRevalidationInput): Promise<RunRevalidationResult>;
}

export interface CreateRunCoordinatorOptions {
  journal: RunJournalPort;
  revalidation: RunRevalidationPort;
  now?: () => number;
}

export interface RunCancellationScope {
  readonly runId: string;
  readonly scopeId: string;
  readonly signal: AbortSignal;
  dispose(): void;
}

interface CancellationNode {
  controller: AbortController;
  parentScopeId: string | null;
  childScopeIds: Set<string>;
}

interface LiveRun {
  record: RunRecord;
  scopes: Map<string, CancellationNode>;
  mutationTail: Promise<void>;
}

export interface RunCoordinator {
  startRun(input: StartRunInput): Promise<RunRecord>;
  activateRun(runId: string): Promise<RunRecord>;
  getRun(runId: string): RunRecord | undefined;
  beginUnit(runId: string, input: BeginRunUnitInput): Promise<RunUnitLease>;
  completeUnit(lease: RunUnitLease, input: CompleteRunUnitInput): Promise<RunRecord>;
  failUnit(lease: RunUnitLease): Promise<RunRecord>;
  setDraftRevision(runId: string, expectedRevision: string, nextRevision: string): Promise<RunRecord>;
  completeRun(runId: string, outcome: 'planned' | 'applied' | 'rejected'): Promise<RunRecord>;
  failRun(runId: string): Promise<RunRecord>;
  stopRun(runId: string, reason?: string): Promise<RunRecord>;
  resumeRun(predecessorRunId: string, successorRunId: string): Promise<RunRecord>;
  isResultCurrent(lease: Pick<RunUnitLease, 'runId' | 'unitId' | 'attempt' | 'sourceRevision'>): boolean;
  assertResultCurrent(
    lease: Pick<RunUnitLease, 'runId' | 'unitId' | 'attempt' | 'sourceRevision'>,
  ): void;
  createCancellationScope(
    runId: string,
    scopeId: string,
    parentScopeId?: string,
  ): RunCancellationScope;
  queueRequest(input: QueueRunRequestInput): Promise<QueuedRunRequest>;
  editQueuedRequest(projectId: string, requestId: string, prompt: string): Promise<QueuedRunRequest>;
  removeQueuedRequest(projectId: string, requestId: string): Promise<void>;
  getQueuedRequest(projectId: string): QueuedRunRequest | undefined;
  restoreQueuedRequest(projectId: string): Promise<QueuedRunRequest | undefined>;
  continueQueuedRequest(projectId: string, requestId: string): Promise<QueuedRunRequest>;
}

const ROOT_SCOPE = '$run';

const UNKNOWN_USAGE: RunUnitRecord['usage'] = Object.freeze({
  inputTokens: null,
  cachedInputTokens: null,
  cacheWriteTokens: null,
  outputTokens: null,
  costUsd: null,
});

export function createRunCoordinator(options: CreateRunCoordinatorOptions): RunCoordinator {
  const now = options.now ?? Date.now;
  const runs = new Map<string, LiveRun>();
  const activeMutatingRunByProject = new Map<string, string>();
  const projectStartReservations = new Set<string>();
  const runIdReservations = new Set<string>();
  const queueCreationReservations = new Set<string>();
  const queuedRequests = new Map<string, QueuedRunRequest>();
  const completionReservations = new Set<string>();

  function getLiveRun(runId: string): LiveRun {
    const live = runs.get(runId);
    if (!live) throw failure('run-not-found', `Run "${runId}" does not exist.`);
    return live;
  }

  function requireActive(runId: string): LiveRun {
    const live = getLiveRun(runId);
    if (live.record.status !== 'active' || live.record.cancellation.requested) {
      throw failure('run-not-active', `Run "${runId}" is not active.`);
    }
    return live;
  }

  async function requireValidCapture(
    capture: RunRevalidationInput,
    allowRevisionAdvance = false,
  ): Promise<Extract<RunRevalidationResult, { ok: true }>> {
    const result = await options.revalidation.revalidate(clone(capture));
    if (!result.ok) {
      const code = result.reason === 'stale-target' ? 'stale-target' : 'stale-base';
      throw failure(code, `Run capture is no longer valid: ${result.reason}.`);
    }
    if (result.currentProjectRevision !== capture.expectedProjectRevision) {
      throw failure('stale-base', 'The captured project revision is no longer current.');
    }
    if (
      !sameTarget(
        capture.target,
        result.target,
        result.currentSiteRevision,
        result.currentProjectRevision,
        allowRevisionAdvance,
      )
    ) {
      throw failure('stale-target', 'The captured selection target is no longer current.');
    }
    return result;
  }

  async function persistRecord(record: RunRecord): Promise<void> {
    const ack = await options.journal.saveRun(cloneRecord(record));
    requireDurable(ack);
  }

  async function startRun(input: StartRunInput): Promise<RunRecord> {
    assertNonEmpty(input.runId, 'runId');
    if (runs.has(input.runId) || runIdReservations.has(input.runId)) {
      throw failure('duplicate-run', `Run "${input.runId}" already exists.`);
    }
    const mutating = input.mode === 'auto';
    if (
      mutating &&
      (activeMutatingRunByProject.has(input.projectId) ||
        projectStartReservations.has(input.projectId))
    ) {
      throw failure('active-run-exists', 'This project already has an active mutating run.');
    }
    runIdReservations.add(input.runId);
    if (mutating) projectStartReservations.add(input.projectId);
    try {
      if ((await options.journal.loadRun(input.runId)) !== undefined) {
        throw failure('duplicate-run', `Run "${input.runId}" already exists.`);
      }
      if (mutating) {
        const persistedActive = await options.journal.loadActiveRunForProject(input.projectId);
        if (persistedActive !== undefined) {
          throw failure(
            'active-run-exists',
            `Project already has active run "${persistedActive.runId}" in its journal.`,
          );
        }
      }
      const validated = await requireValidCapture({
        siteId: input.siteId,
        projectId: input.projectId,
        pageId: input.pageId,
        expectedProjectRevision: input.baseRevision,
        target: input.target,
      });
      if (mutating && activeMutatingRunByProject.has(input.projectId)) {
        throw failure('active-run-exists', 'This project already has an active mutating run.');
      }
      const at = now();
      const record = parseRecord({
        formatVersion: RUN_COORDINATOR_VERSION,
        runId: input.runId,
        predecessorRunId: null,
        siteId: input.siteId,
        projectId: input.projectId,
        pageId: input.pageId,
        mode: input.mode,
        status: 'active',
        target: validated.target,
        baseRevision: input.baseRevision,
        draftRevision: null,
        routingPolicyVersion: input.routingPolicyVersion,
        units: [],
        cancellation: { requested: false, requestedAt: null, reason: null },
        createdAt: at,
        startedAt: at,
        endedAt: null,
        recoveryPoint: null,
        queuedRequestPaused: false,
        outcome: null,
      });
      await persistRecord(record);
      runs.set(record.runId, createLiveRun(record));
      if (mutating) activeMutatingRunByProject.set(record.projectId, record.runId);
      return cloneRecord(record);
    } finally {
      if (mutating) projectStartReservations.delete(input.projectId);
      runIdReservations.delete(input.runId);
    }
  }

  async function activateRun(runId: string): Promise<RunRecord> {
    const live = getLiveRun(runId);
    if (live.record.status !== 'queued') {
      throw failure('run-not-active', `Run "${runId}" is not waiting for activation.`);
    }
    if (live.record.mode === 'auto' && activeMutatingRunByProject.has(live.record.projectId)) {
      throw failure('active-run-exists', 'This project already has an active mutating run.');
    }
    const expectedRevision = live.record.draftRevision ?? live.record.baseRevision;
    const validated = await requireValidCapture({
      siteId: live.record.siteId,
      projectId: live.record.projectId,
      pageId: live.record.pageId,
      expectedProjectRevision: expectedRevision,
      target: live.record.target,
    });
    const next = parseRecord({
      ...live.record,
      status: 'active',
      target: validated.target,
      startedAt: now(),
    });
    await persistRecord(next);
    live.record = next;
    if (next.mode === 'auto') activeMutatingRunByProject.set(next.projectId, next.runId);
    return cloneRecord(next);
  }

  async function beginUnit(runId: string, input: BeginRunUnitInput): Promise<RunUnitLease> {
    const live = requireActive(runId);
    return withRunMutation(live, async () => {
      requireActive(runId);
      const existing = live.record.units.find((unit) => unit.unitId === input.unitId);
      if (existing?.status === 'completed') {
        throw failure(
          'unit-already-completed',
          `Unit "${input.unitId}" is an immutable completed checkpoint.`,
        );
      }
      if (existing?.status === 'active') {
        throw failure('unit-not-active', `Unit "${input.unitId}" already has an active attempt.`);
      }
      const sourceRevision = live.record.draftRevision ?? live.record.baseRevision;
      const unit: RunUnitRecord = {
        unitId: input.unitId,
        stage: input.stage,
        status: 'active',
        sourceRevision,
        checkpointId: null,
        provider: input.provider ?? null,
        model: input.model ?? null,
        effort: input.effort ?? null,
        fallback: input.fallback ?? null,
        attempt: (existing?.attempt ?? 0) + 1,
        latencyMs: null,
        usage: UNKNOWN_USAGE,
        persisted: null,
      };
      const next = replaceUnit(live.record, unit);
      await persistRecord(next);
      if (live.record.status !== 'active') {
        throw failure('run-not-active', `Run "${runId}" stopped while the unit was starting.`);
      }
      live.record = next;
      return Object.freeze({
        runId,
        unitId: unit.unitId,
        attempt: unit.attempt,
        sourceRevision,
        signal: live.scopes.get(ROOT_SCOPE)?.controller.signal ?? abortedSignal(),
      });
    });
  }

  async function completeUnit(
    lease: RunUnitLease,
    input: CompleteRunUnitInput,
  ): Promise<RunRecord> {
    assertResultCurrent(lease);
    const reservation = leaseKey(lease);
    if (completionReservations.has(reservation)) {
      throw failure('unit-not-active', 'This unit completion is already being persisted.');
    }
    completionReservations.add(reservation);
    try {
      const live = requireActive(lease.runId);
      return await withRunMutation(live, async () => {
        assertResultCurrent(lease);
        const unit = requireLeasedUnit(live.record, lease);
        const stored = parseRecord(
          await options.journal.commitCompletedUnit({
            record: cloneRecord(live.record),
            unitId: lease.unitId,
            attempt: lease.attempt,
            sourceRevision: lease.sourceRevision,
            checkpointId: input.checkpointId,
            checkpoint: clone(input.checkpoint),
            latencyMs: input.latencyMs ?? null,
            usage: { ...UNKNOWN_USAGE, ...input.usage },
          }),
        );
        // Stop may happen while the durable journal write is in flight. The
        // checkpoint may remain reusable, but the stopped run cannot publish it.
        if (!isResultCurrent(lease)) {
          throw failure('stale-result', 'The completed result belongs to a stopped or stale run.');
        }
        const completed = stored.units.find((candidate) => candidate.unitId === unit.unitId);
        if (
          !validCompletedJournalRecord(live.record, stored, unit.unitId) ||
          completed?.status !== 'completed' ||
          completed.attempt !== lease.attempt ||
          completed.sourceRevision !== lease.sourceRevision ||
          completed.checkpointId !== input.checkpointId ||
          completed.persisted?.kind !== 'durable'
        ) {
          throw failure(
            'journal-not-durable',
            'The journal did not atomically persist the requested completed unit.',
          );
        }
        live.record = stored;
        return cloneRecord(stored);
      });
    } finally {
      completionReservations.delete(reservation);
    }
  }

  async function failUnit(lease: RunUnitLease): Promise<RunRecord> {
    assertResultCurrent(lease);
    const live = requireActive(lease.runId);
    return withRunMutation(live, async () => {
      assertResultCurrent(lease);
      const unit = requireLeasedUnit(live.record, lease);
      const next = replaceUnit(live.record, {
        ...unit,
        status: 'failed',
        checkpointId: null,
        persisted: null,
      });
      await persistRecord(next);
      live.record = next;
      return cloneRecord(next);
    });
  }

  async function setDraftRevision(
    runId: string,
    expectedRevision: string,
    nextRevision: string,
  ): Promise<RunRecord> {
    const live = requireActive(runId);
    return withRunMutation(live, async () => {
      requireActive(runId);
      const current = live.record.draftRevision ?? live.record.baseRevision;
      if (current !== expectedRevision) {
        throw failure('stale-base', 'The run draft changed before the new revision was recorded.');
      }
      const next = parseRecord({ ...live.record, draftRevision: nextRevision });
      await persistRecord(next);
      live.record = next;
      return cloneRecord(next);
    });
  }

  async function completeRun(
    runId: string,
    outcome: 'planned' | 'applied' | 'rejected',
  ): Promise<RunRecord> {
    const live = requireActive(runId);
    return withRunMutation(live, async () => {
      requireActive(runId);
      if (live.record.units.some((unit) => unit.status === 'active')) {
        throw failure('unit-not-active', 'A run cannot complete while a unit is active.');
      }
      const next = parseRecord({
        ...live.record,
        status: 'completed',
        endedAt: now(),
        outcome,
      });
      await persistRecord(next);
      if (live.record.status !== 'active') {
        throw failure('run-not-active', `Run "${runId}" stopped while completion was saving.`);
      }
      live.record = next;
      releaseProject(next);
      abortAll(live);
      return cloneRecord(next);
    });
  }

  async function failRun(runId: string): Promise<RunRecord> {
    const live = requireActive(runId);
    const next = parseRecord({
      ...live.record,
      status: 'failed',
      units: live.record.units.map((unit) =>
        unit.status === 'active' ? { ...unit, status: 'failed' as const } : unit,
      ),
      endedAt: now(),
      outcome: 'failed',
    });
    live.record = next;
    releaseProject(next);
    abortAll(live);
    await withRunMutation(live, () => persistRecord(live.record));
    return cloneRecord(next);
  }

  async function stopRun(runId: string, reason = 'Stopped by user.'): Promise<RunRecord> {
    const live = requireActive(runId);
    const stoppedAt = now();
    const next = parseRecord({
      ...live.record,
      status: 'stopped',
      units: live.record.units.map((unit) =>
        unit.status === 'active' ? { ...unit, status: 'stopped' as const } : unit,
      ),
      cancellation: { requested: true, requestedAt: stoppedAt, reason },
      endedAt: stoppedAt,
      queuedRequestPaused: queuedRequests.has(live.record.projectId),
      outcome: 'stopped',
    });
    // Change memory and abort first. Late callbacks are rejected even while the
    // terminal state is being flushed to durable storage.
    live.record = next;
    releaseProject(next);
    abortAll(live, reason);
    const queued = queuedRequests.get(next.projectId);
    let queueFailure: unknown;
    if (queued) {
      const paused = freezeQueue({ ...queued, paused: true, updatedAt: stoppedAt });
      queuedRequests.set(next.projectId, paused);
      try {
        await requireDurableAsync(options.journal.saveQueuedRequest(next.projectId, clone(paused)));
      } catch (error) {
        queueFailure = error;
      }
    }
    await withRunMutation(live, () => persistRecord(live.record));
    if (queueFailure !== undefined) {
      throw queueFailure instanceof Error
        ? queueFailure
        : failure('journal-not-durable', 'Queued request persistence failed.');
    }
    return cloneRecord(next);
  }

  async function resumeRun(predecessorRunId: string, successorRunId: string): Promise<RunRecord> {
    assertNonEmpty(successorRunId, 'successorRunId');
    if (runs.has(successorRunId) || runIdReservations.has(successorRunId)) {
      throw failure('duplicate-run', `Run "${successorRunId}" already exists.`);
    }
    runIdReservations.add(successorRunId);
    try {
      if ((await options.journal.loadRun(successorRunId)) !== undefined) {
        throw failure('duplicate-run', `Run "${successorRunId}" already exists.`);
      }
      const livePredecessor = runs.get(predecessorRunId);
      const predecessor =
        livePredecessor?.record ?? (await options.journal.loadRun(predecessorRunId));
      if (!predecessor) throw failure('run-not-found', `Run "${predecessorRunId}" does not exist.`);
      let parsed = parseRecord(predecessor);
      if (parsed.status === 'active' && livePredecessor === undefined) {
        const stoppedAt = now();
        parsed = parseRecord({
          ...parsed,
          status: 'stopped',
          units: parsed.units.map((unit) =>
            unit.status === 'active' ? { ...unit, status: 'stopped' as const } : unit,
          ),
          cancellation: {
            requested: true,
            requestedAt: stoppedAt,
            reason: 'Recovered after an interrupted host session.',
          },
          endedAt: stoppedAt,
          outcome: 'stopped',
        });
        await persistRecord(parsed);
      }
      if (parsed.status !== 'stopped') {
        throw failure('run-not-resumable', 'Only a stopped or interrupted run can create a successor.');
      }
      const expectedRevision = parsed.draftRevision ?? parsed.baseRevision;
      const validated = await requireValidCapture(
        {
          siteId: parsed.siteId,
          projectId: parsed.projectId,
          pageId: parsed.pageId,
          expectedProjectRevision: expectedRevision,
          target: parsed.target,
        },
        true,
      );
      const successor = parseRecord({
        ...parsed,
        runId: successorRunId,
        predecessorRunId: parsed.runId,
        status: 'queued',
        target: validated.target,
        units: parsed.units.map((unit) =>
          unit.status === 'completed'
            ? unit
            : {
                ...unit,
                status: 'queued' as const,
                checkpointId: null,
                latencyMs: null,
                persisted: null,
              },
        ),
        cancellation: { requested: false, requestedAt: null, reason: null },
        createdAt: now(),
        startedAt: null,
        endedAt: null,
        queuedRequestPaused: false,
        outcome: null,
      });
      await persistRecord(successor);
      runs.set(successor.runId, createLiveRun(successor));
      return cloneRecord(successor);
    } finally {
      runIdReservations.delete(successorRunId);
    }
  }

  function isResultCurrent(
    lease: Pick<RunUnitLease, 'runId' | 'unitId' | 'attempt' | 'sourceRevision'>,
  ): boolean {
    const live = runs.get(lease.runId);
    if (live?.record.status !== 'active' || live.record.cancellation.requested) return false;
    const unit = live.record.units.find((candidate) => candidate.unitId === lease.unitId);
    return (
      unit?.status === 'active' &&
      unit.attempt === lease.attempt &&
      unit.sourceRevision === lease.sourceRevision &&
      (live.record.draftRevision ?? live.record.baseRevision) === lease.sourceRevision
    );
  }

  function assertResultCurrent(
    lease: Pick<RunUnitLease, 'runId' | 'unitId' | 'attempt' | 'sourceRevision'>,
  ): void {
    if (!isResultCurrent(lease)) {
      throw failure('stale-result', 'The result belongs to a stopped, superseded, or stale unit.');
    }
  }

  function createCancellationScope(
    runId: string,
    scopeId: string,
    parentScopeId = ROOT_SCOPE,
  ): RunCancellationScope {
    const live = requireActive(runId);
    if (live.scopes.has(scopeId)) {
      throw failure('unit-not-active', `Cancellation scope "${scopeId}" already exists.`);
    }
    const parent = live.scopes.get(parentScopeId);
    if (!parent) throw failure('unit-not-active', `Cancellation parent "${parentScopeId}" is absent.`);
    const controller = new AbortController();
    const node: CancellationNode = { controller, parentScopeId, childScopeIds: new Set() };
    live.scopes.set(scopeId, node);
    parent.childScopeIds.add(scopeId);
    if (parent.controller.signal.aborted) controller.abort(parent.controller.signal.reason);
    return Object.freeze({
      runId,
      scopeId,
      signal: controller.signal,
      dispose: () => {
        removeScope(live, scopeId);
      },
    });
  }

  async function queueRequest(input: QueueRunRequestInput): Promise<QueuedRunRequest> {
    if (!activeMutatingRunByProject.has(input.projectId)) {
      throw failure('run-not-active', 'A next request can be queued only behind an active Auto run.');
    }
    if (queuedRequests.has(input.projectId) || queueCreationReservations.has(input.projectId)) {
      throw failure('queued-request-exists', 'This project already has one queued request.');
    }
    const at = now();
    const request = parseQueue({
      ...input,
      formatVersion: RUN_COORDINATOR_VERSION,
      createdAt: at,
      updatedAt: at,
      paused: false,
    });
    queueCreationReservations.add(input.projectId);
    try {
      if ((await options.journal.loadQueuedRequest(input.projectId)) !== undefined) {
        throw failure('queued-request-exists', 'This project already has one queued request.');
      }
      await requireDurableAsync(options.journal.saveQueuedRequest(input.projectId, clone(request)));
      queuedRequests.set(input.projectId, request);
      return clone(request);
    } finally {
      queueCreationReservations.delete(input.projectId);
    }
  }

  async function editQueuedRequest(
    projectId: string,
    requestId: string,
    prompt: string,
  ): Promise<QueuedRunRequest> {
    const current = requireQueue(projectId, requestId);
    const next = parseQueue({ ...current, prompt, updatedAt: now() });
    await requireDurableAsync(options.journal.saveQueuedRequest(projectId, clone(next)));
    queuedRequests.set(projectId, next);
    return clone(next);
  }

  async function removeQueuedRequest(projectId: string, requestId: string): Promise<void> {
    requireQueue(projectId, requestId);
    await requireDurableAsync(options.journal.saveQueuedRequest(projectId, null));
    queuedRequests.delete(projectId);
  }

  async function restoreQueuedRequest(projectId: string): Promise<QueuedRunRequest | undefined> {
    const stored = await options.journal.loadQueuedRequest(projectId);
    if (!stored) return undefined;
    const parsed = parseQueue(stored);
    queuedRequests.set(projectId, parsed);
    return clone(parsed);
  }

  async function continueQueuedRequest(
    projectId: string,
    requestId: string,
  ): Promise<QueuedRunRequest> {
    if (activeMutatingRunByProject.has(projectId)) {
      throw failure('active-run-exists', 'The queued request must wait for the active Auto run.');
    }
    const current = requireQueue(projectId, requestId);
    const validated = await options.revalidation.revalidate({
      siteId: current.siteId,
      projectId,
      pageId: current.pageId,
      expectedProjectRevision: current.baseRevision,
      target: current.target,
    });
    if (!validated.ok) {
      const code = validated.reason === 'stale-target' ? 'stale-target' : 'stale-base';
      throw failure(code, `Queued request target is no longer valid: ${validated.reason}.`);
    }
    // A prior run is expected to advance the project. Continue explicitly
    // rebases the request capture to the revalidated current revision.
    if (
      !sameTarget(
        current.target,
        validated.target,
        validated.currentSiteRevision,
        validated.currentProjectRevision,
        true,
      )
    ) {
      throw failure('stale-target', 'Queued request target changed before continuation.');
    }
    const continued = parseQueue({
      ...current,
      baseRevision: validated.currentProjectRevision,
      target: validated.target,
      paused: false,
      updatedAt: now(),
    });
    await requireDurableAsync(options.journal.saveQueuedRequest(projectId, null));
    queuedRequests.delete(projectId);
    return clone(continued);
  }

  function requireQueue(projectId: string, requestId: string): QueuedRunRequest {
    const request = queuedRequests.get(projectId);
    if (request?.requestId !== requestId) {
      throw failure('queued-request-missing', 'The queued request does not exist.');
    }
    return request;
  }

  function releaseProject(record: RunRecord): void {
    if (activeMutatingRunByProject.get(record.projectId) === record.runId) {
      activeMutatingRunByProject.delete(record.projectId);
    }
  }

  return Object.freeze<RunCoordinator>({
    startRun,
    activateRun,
    getRun: (runId) => {
      const record = runs.get(runId)?.record;
      return record ? cloneRecord(record) : undefined;
    },
    beginUnit,
    completeUnit,
    failUnit,
    setDraftRevision,
    completeRun,
    failRun,
    stopRun,
    resumeRun,
    isResultCurrent,
    assertResultCurrent,
    createCancellationScope,
    queueRequest,
    editQueuedRequest,
    removeQueuedRequest,
    getQueuedRequest: (projectId) => {
      const request = queuedRequests.get(projectId);
      return request ? clone(request) : undefined;
    },
    restoreQueuedRequest,
    continueQueuedRequest,
  });
}

export interface CreateMemoryRunJournalOptions {
  /** Tests may opt into a durable acknowledgement; production memory must not. */
  durableForTests?: boolean;
}

/** In-memory reference adapter. It reports session-only unless a test opts in explicitly. */
export function createMemoryRunJournal(
  options: CreateMemoryRunJournalOptions = {},
): RunJournalPort & {
  checkpoint(checkpointId: string): JsonValue | undefined;
} {
  const runs = new Map<string, RunRecord>();
  const checkpoints = new Map<string, JsonValue>();
  const requests = new Map<string, QueuedRunRequest>();
  let sequence = 0;
  const journal: RunJournalPort & {
    checkpoint(checkpointId: string): JsonValue | undefined;
  } = {
    loadRun: (runId) => Promise.resolve(cloneOptionalRecord(runs.get(runId))),
    loadActiveRunForProject: (projectId) =>
      Promise.resolve(
        cloneOptionalRecord(
          [...runs.values()].find(
            (run) => run.projectId === projectId && run.mode === 'auto' && run.status === 'active',
          ),
        ),
      ),
    saveRun: (record) => {
      const parsed = parseRecord(record);
      runs.set(parsed.runId, parsed);
      sequence += 1;
      return Promise.resolve(memoryAck(sequence, options.durableForTests === true));
    },
    commitCompletedUnit: (input) => {
      if (options.durableForTests !== true) {
        return Promise.reject(
          failure('journal-not-durable', 'Session memory cannot publish a completed checkpoint.'),
        );
      }
      const record = parseRecord(input.record);
      const unit = record.units.find((candidate) => candidate.unitId === input.unitId);
      if (
        unit?.status !== 'active' ||
        unit.attempt !== input.attempt ||
        unit.sourceRevision !== input.sourceRevision
      ) {
        return Promise.reject(failure('stale-result', 'The journal refused a stale unit attempt.'));
      }
      sequence += 1;
      const completed: RunUnitRecord = {
        ...unit,
        status: 'completed',
        checkpointId: input.checkpointId,
        latencyMs: input.latencyMs,
        usage: input.usage,
        persisted: { kind: 'durable', sequence },
      };
      const stored = replaceUnit(record, completed, input.checkpointId);
      checkpoints.set(input.checkpointId, clone(input.checkpoint));
      runs.set(stored.runId, stored);
      return Promise.resolve(cloneRecord(stored));
    },
    loadQueuedRequest: (projectId) => Promise.resolve(cloneOptional(requests.get(projectId))),
    saveQueuedRequest: (projectId, request) => {
      if (request === null) requests.delete(projectId);
      else requests.set(projectId, parseQueue(request));
      sequence += 1;
      return Promise.resolve(memoryAck(sequence, options.durableForTests === true));
    },
    checkpoint: (checkpointId) => cloneOptional(checkpoints.get(checkpointId)),
  };
  return Object.freeze(journal);
}

function memoryAck(sequence: number, durable: boolean): PersistenceAck {
  return durable
    ? { kind: 'durable', sequence }
    : { kind: 'session-only', sequence, reason: 'Run journal is held in memory only.' };
}

function createLiveRun(record: RunRecord): LiveRun {
  return {
    record,
    scopes: new Map([
      [
        ROOT_SCOPE,
        { controller: new AbortController(), parentScopeId: null, childScopeIds: new Set() },
      ],
    ]),
    mutationTail: Promise.resolve(),
  };
}

function removeScope(live: LiveRun, scopeId: string): void {
  if (scopeId === ROOT_SCOPE) return;
  const node = live.scopes.get(scopeId);
  if (!node) return;
  for (const child of [...node.childScopeIds]) abortScope(live, child, 'Parent scope disposed.');
  live.scopes.delete(scopeId);
  if (node.parentScopeId) live.scopes.get(node.parentScopeId)?.childScopeIds.delete(scopeId);
}

function abortAll(live: LiveRun, reason = 'Run ended.'): void {
  abortScope(live, ROOT_SCOPE, reason);
}

function abortScope(live: LiveRun, scopeId: string, reason: string): void {
  const node = live.scopes.get(scopeId);
  if (!node) return;
  for (const child of [...node.childScopeIds]) abortScope(live, child, reason);
  if (!node.controller.signal.aborted) node.controller.abort(reason);
  if (scopeId !== ROOT_SCOPE) removeScope(live, scopeId);
}

function requireLeasedUnit(
  record: RunRecord,
  lease: Pick<RunUnitLease, 'unitId' | 'attempt' | 'sourceRevision'>,
): RunUnitRecord {
  const unit = record.units.find((candidate) => candidate.unitId === lease.unitId);
  if (
    unit?.status !== 'active' ||
    unit.attempt !== lease.attempt ||
    unit.sourceRevision !== lease.sourceRevision
  ) {
    throw failure('unit-not-active', `Unit "${lease.unitId}" is not the active leased attempt.`);
  }
  return unit;
}

function replaceUnit(record: RunRecord, unit: RunUnitRecord, recoveryPoint?: string): RunRecord {
  const found = record.units.some((candidate) => candidate.unitId === unit.unitId);
  return parseRecord({
    ...record,
    units: found
      ? record.units.map((candidate) => (candidate.unitId === unit.unitId ? unit : candidate))
      : [...record.units, unit],
    ...(recoveryPoint === undefined ? {} : { recoveryPoint }),
  });
}

function validCompletedJournalRecord(
  before: RunRecord,
  after: RunRecord,
  completedUnitId: string,
): boolean {
  if (
    after.runId !== before.runId ||
    after.status !== 'active' ||
    after.cancellation.requested ||
    after.baseRevision !== before.baseRevision ||
    after.draftRevision !== before.draftRevision ||
    after.units.length !== before.units.length
  ) {
    return false;
  }
  return before.units.every((unit) => {
    const stored = after.units.find((candidate) => candidate.unitId === unit.unitId);
    return stored !== undefined &&
      (unit.unitId === completedUnitId || JSON.stringify(stored) === JSON.stringify(unit));
  });
}

function sameTarget(
  captured: SelectionTarget | null,
  current: SelectionTarget | null,
  currentSiteRevision: string,
  currentProjectRevision: string,
  allowRevisionAdvance: boolean,
): boolean {
  if (captured === null || current === null) return captured === current;
  if (current.revision !== currentSiteRevision) return false;
  if (!allowRevisionAdvance && captured.revision !== currentSiteRevision) return false;
  if (!sameTargetIdentity(captured, current)) return false;
  const capturedSource = captured.sourceOrNodeId;
  const currentSource = current.sourceOrNodeId;
  if (typeof currentSource !== 'string' && currentSource.sourceRevision !== currentProjectRevision) {
    return false;
  }
  if (
    !allowRevisionAdvance &&
    typeof capturedSource !== 'string' &&
    capturedSource.sourceRevision !== currentProjectRevision
  ) {
    return false;
  }
  return (
    captured.capabilities.length === current.capabilities.length &&
    captured.capabilities.every((capability) => current.capabilities.includes(capability))
  );
}

function sameTargetIdentity(left: SelectionTarget, right: SelectionTarget): boolean {
  if (left.pageId !== right.pageId) return false;
  const leftSource = left.sourceOrNodeId;
  const rightSource = right.sourceOrNodeId;
  if (typeof leftSource === 'string' || typeof rightSource === 'string') return leftSource === rightSource;
  return (
    leftSource.projectId === rightSource.projectId &&
    leftSource.modulePath === rightSource.modulePath &&
    leftSource.astNodeId === rightSource.astNodeId &&
    leftSource.instanceKey === rightSource.instanceKey
  );
}

async function withRunMutation<T>(live: LiveRun, operation: () => Promise<T>): Promise<T> {
  const previous = live.mutationTail;
  let release: (() => void) | undefined;
  live.mutationTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release?.();
  }
}

function parseRecord(value: unknown): RunRecord {
  return Object.freeze(runRecordSchema.parse(clone(value)));
}

function parseQueue(value: unknown): QueuedRunRequest {
  if (!isRecord(value)) throw new TypeError('Queued request must be an object.');
  const allowed = new Set([
    'formatVersion',
    'requestId',
    'siteId',
    'projectId',
    'pageId',
    'mode',
    'prompt',
    'target',
    'baseRevision',
    'createdAt',
    'updatedAt',
    'paused',
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new TypeError('Queued request contains an unknown field.');
  }
  if (value['formatVersion'] !== RUN_COORDINATOR_VERSION) {
    throw new TypeError('Unsupported queue format.');
  }
  const requestId = queueString(value, 'requestId');
  const siteId = queueString(value, 'siteId');
  const projectId = queueString(value, 'projectId');
  const pageId = queueString(value, 'pageId');
  const prompt = queueString(value, 'prompt');
  if (prompt.trim().length === 0) throw new TypeError('prompt must not be blank.');
  const baseRevision = queueString(value, 'baseRevision');
  const mode = value['mode'];
  if (mode !== 'ask' && mode !== 'plan' && mode !== 'auto') {
    throw new TypeError('Unsupported queue mode.');
  }
  const createdAt = queueTime(value, 'createdAt');
  const updatedAt = queueTime(value, 'updatedAt');
  if (typeof value['paused'] !== 'boolean') throw new TypeError('paused must be boolean.');
  const target =
    value['target'] === null ? null : selectionTargetSchema.parse(value['target']);
  return freezeQueue({
    formatVersion: RUN_COORDINATOR_VERSION,
    requestId,
    siteId,
    projectId,
    pageId,
    mode,
    prompt,
    target,
    baseRevision,
    createdAt,
    updatedAt,
    paused: value['paused'],
  });
}

function queueString(value: Readonly<Record<string, unknown>>, key: string): string {
  const found = value[key];
  if (typeof found !== 'string' || found.length === 0) throw new TypeError(`${key} must not be empty.`);
  return found;
}

function queueTime(value: Readonly<Record<string, unknown>>, key: string): number {
  const found = value[key];
  if (typeof found !== 'number' || !Number.isFinite(found) || found < 0) {
    throw new TypeError(`${key} must be a non-negative number.`);
  }
  return found;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function freezeQueue(value: QueuedRunRequest): QueuedRunRequest {
  return Object.freeze({
    ...value,
    target: value.target === null ? null : Object.freeze(clone(value.target)),
  });
}

function requireDurable(ack: PersistenceAck): void {
  if (ack.kind !== 'durable') {
    throw failure('journal-not-durable', 'Run state was not acknowledged by durable storage.');
  }
}

async function requireDurableAsync(pending: Promise<PersistenceAck>): Promise<void> {
  requireDurable(await pending);
}

function assertNonEmpty(value: string, field: string): void {
  if (value.length === 0) throw new TypeError(`${field} must not be empty.`);
}

function failure(code: RunCoordinatorErrorCode, message: string): RunCoordinatorError {
  return new RunCoordinatorError(code, message);
}

function leaseKey(
  lease: Pick<RunUnitLease, 'runId' | 'unitId' | 'attempt' | 'sourceRevision'>,
): string {
  return JSON.stringify([lease.runId, lease.unitId, lease.attempt, lease.sourceRevision]);
}

function abortedSignal(): AbortSignal {
  const controller = new AbortController();
  controller.abort('Run is unavailable.');
  return controller.signal;
}

function cloneRecord(record: RunRecord): RunRecord {
  return parseRecord(record);
}

function cloneOptionalRecord(record: RunRecord | undefined): RunRecord | undefined {
  return record === undefined ? undefined : cloneRecord(record);
}

function cloneOptional<T extends JsonValue | QueuedRunRequest>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : clone(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
