export const DEFAULT_RUN_CONCURRENCY = 3;
export const MAX_RUN_CONCURRENCY = 6;
export const MAX_TECHNICAL_REPAIRS = 2;
export const MAX_VISUAL_REPAIRS = 1;
export const MAX_ESCALATIONS = 1;

export type RepairKind = 'technical' | 'visual';

export interface ScheduledUnitContext {
  readonly runId: string;
  readonly unitId: string;
  readonly attempt: number;
  readonly repair: RepairKind | null;
  readonly previousFailure: string | null;
  readonly escalated: boolean;
  readonly signal: AbortSignal;
}

export type ScheduledUnitResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly repair: RepairKind;
      readonly retryable: boolean;
    };

export interface ScheduledUnit<T> {
  readonly unitId: string;
  readonly filePaths: readonly string[];
  execute(context: ScheduledUnitContext): Promise<ScheduledUnitResult<T>>;
}

export interface ScheduledUnitReport<T> {
  readonly unitId: string;
  readonly status: 'completed' | 'failed' | 'cancelled';
  readonly attempts: number;
  readonly technicalRepairs: number;
  readonly visualRepairs: number;
  readonly escalated: boolean;
  readonly value?: T;
  readonly reason?: string;
}

export interface ScheduleRunInput<T> {
  readonly runId: string;
  readonly projectId: string;
  /** Defaults to true. Ask/Plan runs set false and never occupy the project's writer lock. */
  readonly mutates?: boolean;
  readonly units: readonly ScheduledUnit<T>[];
  readonly concurrency?: number;
  readonly signal?: AbortSignal;
  readonly onUnitComplete?: (report: ScheduledUnitReport<T>) => void;
}

export interface RunScheduleReport<T> {
  readonly runId: string;
  readonly projectId: string;
  readonly concurrency: number;
  readonly units: readonly ScheduledUnitReport<T>[];
}

export interface RunScheduler {
  run<T>(input: ScheduleRunInput<T>): Promise<RunScheduleReport<T>>;
  readonly activeProjects: ReadonlySet<string>;
}

function assertUnits<T>(units: readonly ScheduledUnit<T>[]): void {
  const ids = new Set<string>();
  const owners = new Map<string, string>();
  for (const unit of units) {
    if (unit.unitId.trim() === '' || ids.has(unit.unitId)) {
      throw new Error(`Run units need unique non-empty ids; received "${unit.unitId}".`);
    }
    ids.add(unit.unitId);
    const ownPaths = new Set<string>();
    for (const path of unit.filePaths) {
      if (path.trim() === '' || ownPaths.has(path)) {
        throw new Error(`Unit "${unit.unitId}" has an invalid or duplicate file path.`);
      }
      ownPaths.add(path);
      const owner = owners.get(path);
      if (owner !== undefined) {
        throw new Error(`File "${path}" has two writers: "${owner}" and "${unit.unitId}".`);
      }
      owners.set(path, unit.unitId);
    }
  }
}

function concurrencyOf(requested: number | undefined, unitCount: number): number {
  const value = requested ?? DEFAULT_RUN_CONCURRENCY;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_RUN_CONCURRENCY) {
    throw new Error(`Concurrency must be an integer from 1 to ${String(MAX_RUN_CONCURRENCY)}.`);
  }
  return Math.min(value, Math.max(1, unitCount));
}

function cancelled<T>(unitId: string, attempts: number): ScheduledUnitReport<T> {
  return {
    unitId,
    status: 'cancelled',
    attempts,
    technicalRepairs: 0,
    visualRepairs: 0,
    escalated: false,
    reason: 'Run cancelled.',
  };
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

/** A server-scoped coordinator: one mutating run per project and bounded path-disjoint workers. */
export function createRunScheduler(): RunScheduler {
  const activeProjects = new Set<string>();

  return {
    activeProjects,
    run: async <T>(input: ScheduleRunInput<T>): Promise<RunScheduleReport<T>> => {
      assertUnits(input.units);
      const concurrency = concurrencyOf(input.concurrency, input.units.length);
      const mutates = input.mutates ?? true;
      if (mutates && activeProjects.has(input.projectId)) {
        throw new Error(`Project "${input.projectId}" already has an active mutating run.`);
      }
      if (mutates) activeProjects.add(input.projectId);
      const reports = new Array<ScheduledUnitReport<T>>(input.units.length);
      let next = 0;
      let escalations = 0;

      const runUnit = async (unit: ScheduledUnit<T>): Promise<ScheduledUnitReport<T>> => {
        let attempt = 0;
        let technicalRepairs = 0;
        let visualRepairs = 0;
        let escalated = false;
        let previousRepair: RepairKind | null = null;
        let lastReason = 'Unit failed.';
        for (;;) {
          if (isAborted(input.signal)) return cancelled<T>(unit.unitId, attempt);
          attempt += 1;
          let result: ScheduledUnitResult<T>;
          try {
            result = await unit.execute({
              runId: input.runId,
              unitId: unit.unitId,
              attempt,
              repair: previousRepair,
              previousFailure: attempt === 1 ? null : lastReason,
              escalated,
              signal: input.signal ?? new AbortController().signal,
            });
          } catch (cause) {
            if (isAborted(input.signal)) return cancelled<T>(unit.unitId, attempt);
            result = {
              ok: false,
              reason: cause instanceof Error ? cause.message : 'Unit worker failed.',
              repair: 'technical',
              retryable: true,
            };
          }
          if (isAborted(input.signal)) return cancelled<T>(unit.unitId, attempt);
          if (result.ok) {
            return {
              unitId: unit.unitId,
              status: 'completed',
              attempts: attempt,
              technicalRepairs,
              visualRepairs,
              escalated,
              value: result.value,
            };
          }
          lastReason = result.reason;
          if (!result.retryable) break;
          if (result.repair === 'technical' && technicalRepairs < MAX_TECHNICAL_REPAIRS) {
            technicalRepairs += 1;
            previousRepair = 'technical';
            continue;
          }
          if (result.repair === 'visual' && visualRepairs < MAX_VISUAL_REPAIRS) {
            visualRepairs += 1;
            previousRepair = 'visual';
            continue;
          }
          if (!escalated && escalations < MAX_ESCALATIONS) {
            escalations += 1;
            escalated = true;
            previousRepair = result.repair;
            continue;
          }
          break;
        }
        return {
          unitId: unit.unitId,
          status: 'failed',
          attempts: attempt,
          technicalRepairs,
          visualRepairs,
          escalated,
          reason: lastReason,
        };
      };

      const worker = async (): Promise<void> => {
        for (;;) {
          const index = next;
          next += 1;
          const unit = input.units[index];
          if (unit === undefined) return;
          const report = isAborted(input.signal)
            ? cancelled<T>(unit.unitId, 0)
            : await runUnit(unit);
          reports[index] = report;
          input.onUnitComplete?.(report);
        }
      };

      try {
        await Promise.all(Array.from({ length: concurrency }, () => worker()));
        return { runId: input.runId, projectId: input.projectId, concurrency, units: reports };
      } finally {
        if (mutates) activeProjects.delete(input.projectId);
      }
    },
  };
}
