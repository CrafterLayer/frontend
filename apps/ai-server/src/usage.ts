export type AttemptStage =
  'generation' | 'technical-repair' | 'visual-repair' | 'review' | 'escalation';

export interface AttemptUsage {
  readonly runId: string;
  readonly unitId: string;
  readonly attempt: number;
  readonly stage: AttemptStage;
  readonly provider: string;
  readonly model: string;
  readonly accepted: boolean;
  readonly failed: boolean;
  readonly latencyMs: number | null;
  readonly inputTokens: number | null;
  readonly cachedInputTokens: number | null;
  readonly cacheWriteTokens: number | null;
  readonly outputTokens: number | null;
  readonly costUsd: number | null;
}

export interface UsageSummary {
  readonly attempts: number;
  readonly acceptedOutputs: number;
  readonly failedAttempts: number;
  readonly technicalRepairs: number;
  readonly visualRepairs: number;
  readonly reviews: number;
  readonly escalations: number;
  readonly inputTokens: number | null;
  readonly cachedInputTokens: number | null;
  readonly cacheWriteTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalCostUsd: number | null;
  readonly acceptedOutputCostUsd: number | null;
  readonly unknownFields: readonly string[];
}

export interface UsageLedger {
  record(usage: AttemptUsage): void;
  attempts(): readonly AttemptUsage[];
  summary(): UsageSummary;
}

const COUNT_FIELDS = [
  'inputTokens',
  'cachedInputTokens',
  'cacheWriteTokens',
  'outputTokens',
] as const;

function validNullable(value: number | null, name: string): void {
  if (value !== null && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`${name} must be a non-negative number or null.`);
  }
}

function sumNullable(
  attempts: readonly AttemptUsage[],
  field: (typeof COUNT_FIELDS)[number] | 'costUsd',
  unknown: Set<string>,
): number | null {
  let total = 0;
  for (const attempt of attempts) {
    const value = attempt[field];
    if (value === null) {
      unknown.add(field);
      return null;
    }
    total += value;
  }
  return total;
}

export function createUsageLedger(): UsageLedger {
  const entries: AttemptUsage[] = [];
  return {
    record: (usage) => {
      if (!Number.isSafeInteger(usage.attempt) || usage.attempt < 1) {
        throw new Error('attempt must be a positive integer.');
      }
      validNullable(usage.latencyMs, 'latencyMs');
      for (const field of COUNT_FIELDS) validNullable(usage[field], field);
      validNullable(usage.costUsd, 'costUsd');
      entries.push(structuredClone(usage));
    },
    attempts: () => structuredClone(entries),
    summary: () => {
      const snapshot = structuredClone(entries);
      const unknown = new Set<string>();
      const acceptedOutputs = snapshot.filter((entry) => entry.accepted).length;
      const totalCostUsd = sumNullable(snapshot, 'costUsd', unknown);
      return {
        attempts: snapshot.length,
        acceptedOutputs,
        failedAttempts: snapshot.filter((entry) => entry.failed).length,
        technicalRepairs: snapshot.filter((entry) => entry.stage === 'technical-repair').length,
        visualRepairs: snapshot.filter((entry) => entry.stage === 'visual-repair').length,
        reviews: snapshot.filter((entry) => entry.stage === 'review').length,
        escalations: snapshot.filter((entry) => entry.stage === 'escalation').length,
        inputTokens: sumNullable(snapshot, 'inputTokens', unknown),
        cachedInputTokens: sumNullable(snapshot, 'cachedInputTokens', unknown),
        cacheWriteTokens: sumNullable(snapshot, 'cacheWriteTokens', unknown),
        outputTokens: sumNullable(snapshot, 'outputTokens', unknown),
        totalCostUsd,
        acceptedOutputCostUsd:
          acceptedOutputs === 0 || totalCostUsd === null ? null : totalCostUsd / acceptedOutputs,
        unknownFields: [...unknown].sort(),
      };
    },
  };
}
