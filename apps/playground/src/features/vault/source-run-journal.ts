import {
  RunCoordinatorError,
  runRecordSchema,
  selectionTargetSchema,
  type JsonValue,
  type PersistenceAck,
  type QueuedRunRequest,
  type RunJournalPort,
  type RunRecord as SourceRunRecord,
  type RunUnitRecord as SourceRunUnitRecord,
} from '@craftkit/builder';

import { vaultWriteAcknowledgement, type VaultStore } from './store';

const SOURCE_RUN_STATE_KEY = 'vault/source-runs/v1';

interface SourceRunState {
  readonly formatVersion: 1;
  readonly sequence: number;
  readonly runs: Readonly<Record<string, SourceRunRecord>>;
  readonly checkpoints: Readonly<Record<string, JsonValue>>;
  readonly queued: Readonly<Record<string, QueuedRunRequest>>;
}

export interface SourceRunJournal extends RunJournalPort {
  acknowledgement(): PersistenceAck;
  loadCheckpoint(checkpointId: string): Promise<JsonValue | undefined>;
}

export interface SourceRunJournalOptions {
  readonly store: VaultStore;
}

/**
 * Durable coordinator journal over the same VaultStore as authored source.
 * The checkpoint and completed-unit record share one stored envelope and one IDB transaction.
 */
export function createSourceRunJournal(options: SourceRunJournalOptions): SourceRunJournal {
  const { store } = options;
  let chain: Promise<unknown> = Promise.resolve();
  let lastAcknowledgement: PersistenceAck = store.persistence?.(0) ?? {
    kind: 'session-only',
    sequence: 0,
    reason: 'This storage port did not provide durable acknowledgement.',
  };

  const serialise = async <T>(work: () => Promise<T>): Promise<T> => {
    const next = chain.then(work, work);
    chain = next.catch(() => undefined);
    return next;
  };

  const readState = async (): Promise<SourceRunState> => {
    const stored = await store.get<unknown>(SOURCE_RUN_STATE_KEY);
    if (stored === undefined) return emptyState();
    if (
      !isRecord(stored) ||
      stored['formatVersion'] !== 1 ||
      typeof stored['sequence'] !== 'number' ||
      !Number.isInteger(stored['sequence']) ||
      stored['sequence'] < 0 ||
      !isRecord(stored['runs']) ||
      !isRecord(stored['checkpoints']) ||
      !isRecord(stored['queued'])
    ) {
      throw new TypeError('The source run journal has an unsupported stored format.');
    }
    return stored as unknown as SourceRunState;
  };

  const writeState = async (
    state: SourceRunState,
    allowSessionFallback = true,
  ): Promise<PersistenceAck> => {
    const acknowledgement = vaultWriteAcknowledgement(
      store,
      await store.set(SOURCE_RUN_STATE_KEY, state, state.sequence, {
        allowSessionFallback,
      }),
      state.sequence,
    );
    lastAcknowledgement = acknowledgement;
    return acknowledgement;
  };

  const journal: SourceRunJournal = {
    acknowledgement: () => lastAcknowledgement,

    loadRun: (runId) =>
      serialise(async () => {
        const record = (await readState()).runs[runId];
        return record === undefined ? undefined : cloneRun(record);
      }),

    loadActiveRunForProject: (projectId) =>
      serialise(async () => {
        const records = Object.values((await readState()).runs)
          .map(cloneRun)
          .filter(
            (record) =>
              record.projectId === projectId &&
              record.mode === 'auto' &&
              record.status === 'active',
          )
          .sort((left, right) => right.createdAt - left.createdAt);
        return records[0] === undefined ? undefined : cloneRun(records[0]);
      }),

    saveRun: (record) =>
      serialise(async () => {
        const parsed = cloneRun(record);
        const current = await readState();
        const next: SourceRunState = {
          ...current,
          sequence: current.sequence + 1,
          runs: { ...current.runs, [parsed.runId]: parsed },
        };
        return writeState(next);
      }),

    commitCompletedUnit: (input) =>
      serialise(async () => {
        const proposed = cloneRun(input.record);
        const current = await readState();
        const storedValue = current.runs[proposed.runId];
        if (storedValue === undefined) {
          throw new RunCoordinatorError('run-not-found', 'The source run is not stored.');
        }
        const stored = cloneRun(storedValue);
        const unit = stored.units.find((candidate) => candidate.unitId === input.unitId);
        if (
          stored.status !== 'active' ||
          stored.cancellation.requested ||
          stored.baseRevision !== proposed.baseRevision ||
          stored.draftRevision !== proposed.draftRevision ||
          unit?.status !== 'active' ||
          unit.attempt !== input.attempt ||
          unit.sourceRevision !== input.sourceRevision
        ) {
          throw new RunCoordinatorError(
            'stale-result',
            'The journal refused a stale completed unit.',
          );
        }

        const sequence = current.sequence + 1;
        const completed: SourceRunUnitRecord = {
          ...unit,
          status: 'completed',
          checkpointId: input.checkpointId,
          latencyMs: input.latencyMs,
          usage: structuredClone(input.usage),
          persisted: { kind: 'durable', sequence },
        };
        const completedRecord = cloneRun({
          ...stored,
          units: stored.units.map((candidate) =>
            candidate.unitId === completed.unitId ? completed : candidate,
          ),
          recoveryPoint: input.checkpointId,
        });
        const next: SourceRunState = {
          ...current,
          sequence,
          runs: { ...current.runs, [completedRecord.runId]: completedRecord },
          checkpoints: {
            ...current.checkpoints,
            [input.checkpointId]: structuredClone(input.checkpoint),
          },
        };
        const acknowledgement = await writeState(next, false);
        if (acknowledgement.kind !== 'durable') {
          await writeState(current);
          throw new RunCoordinatorError('journal-not-durable', acknowledgement.reason);
        }
        return completedRecord;
      }),

    loadQueuedRequest: (projectId) =>
      serialise(async () => {
        const request = (await readState()).queued[projectId];
        return request === undefined ? undefined : cloneQueue(request);
      }),

    saveQueuedRequest: (projectId, request) =>
      serialise(async () => {
        const current = await readState();
        let queued: Readonly<Record<string, QueuedRunRequest>>;
        if (request === null) {
          queued = Object.fromEntries(
            Object.entries(current.queued).filter(([candidate]) => candidate !== projectId),
          );
        } else {
          const parsed = cloneQueue(request);
          if (parsed.projectId !== projectId) {
            throw new TypeError('Queued request project identity does not match its storage key.');
          }
          queued = { ...current.queued, [projectId]: parsed };
        }
        return writeState({ ...current, sequence: current.sequence + 1, queued });
      }),

    loadCheckpoint: (checkpointId) =>
      serialise(async () => {
        const checkpoint = (await readState()).checkpoints[checkpointId];
        return checkpoint === undefined ? undefined : structuredClone(checkpoint);
      }),
  };

  return Object.freeze(journal);
}

function emptyState(): SourceRunState {
  return { formatVersion: 1, sequence: 0, runs: {}, checkpoints: {}, queued: {} };
}

function cloneRun(record: SourceRunRecord): SourceRunRecord {
  return runRecordSchema.parse(structuredClone(record));
}

function cloneQueue(request: QueuedRunRequest): QueuedRunRequest {
  if (
    request.requestId.length === 0 ||
    request.siteId.length === 0 ||
    request.projectId.length === 0 ||
    request.pageId.length === 0 ||
    request.prompt.trim().length === 0 ||
    request.baseRevision.length === 0 ||
    !Number.isFinite(request.createdAt) ||
    !Number.isFinite(request.updatedAt)
  ) {
    throw new TypeError('Queued request is incomplete.');
  }
  if (request.target !== null) selectionTargetSchema.parse(request.target);
  return structuredClone(request);
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
