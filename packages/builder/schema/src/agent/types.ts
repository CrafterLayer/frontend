import { z } from 'zod';

import { selectionTargetSchema } from '../editing/types';

const count = z.number().int().nonnegative();
const unknownCount = count.nullable();
export const agentUsageSchema = z.strictObject({
  inputTokens: unknownCount,
  cachedInputTokens: unknownCount,
  cacheWriteTokens: unknownCount,
  outputTokens: unknownCount,
  costUsd: z.number().nonnegative().nullable(),
});
export type AgentUsage = z.infer<typeof agentUsageSchema>;

export const modelRoutingPolicySchema = z
  .strictObject({
    version: z.string().min(1),
    roles: z.record(
      z.string().min(1),
      z.strictObject({
        provider: z.string().min(1),
        model: z.string().min(1),
        effort: z.string().nullable(),
        fallback: z.string().nullable(),
        maxAttempts: count.min(1),
      }),
    ),
    defaultConcurrency: z.number().int().min(1).max(6),
    maxConcurrency: z.number().int().min(1).max(6),
  })
  .refine((policy) => policy.defaultConcurrency <= policy.maxConcurrency);
export type ModelRoutingPolicy = z.infer<typeof modelRoutingPolicySchema>;

export const cancellationStateSchema = z.strictObject({
  requested: z.boolean(),
  requestedAt: z.number().nonnegative().nullable(),
  reason: z.string().nullable(),
});
export type CancellationState = z.infer<typeof cancellationStateSchema>;

export const persistenceAckSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('durable'), sequence: count }),
  z.strictObject({ kind: z.literal('session-only'), sequence: count, reason: z.string() }),
  z.strictObject({
    kind: z.literal('failed'),
    sequence: count,
    reason: z.string(),
    recoverable: z.boolean(),
  }),
]);
export type PersistenceAck = z.infer<typeof persistenceAckSchema>;

export const runUnitRecordSchema = z
  .strictObject({
    unitId: z.string().min(1),
    stage: z.string().min(1),
    status: z.enum(['queued', 'active', 'completed', 'failed', 'stopped']),
    sourceRevision: z.string().min(1),
    checkpointId: z.string().nullable(),
    provider: z.string().nullable(),
    model: z.string().nullable(),
    effort: z.string().nullable(),
    fallback: z.string().nullable(),
    attempt: count.min(1),
    latencyMs: z.number().nonnegative().nullable(),
    usage: agentUsageSchema,
    persisted: persistenceAckSchema.nullable(),
  })
  .refine(
    (unit) =>
      unit.status !== 'completed' ||
      (unit.checkpointId !== null && unit.persisted?.kind === 'durable'),
    'Completed units require a durable checkpoint before publication.',
  );
export type RunUnitRecord = z.infer<typeof runUnitRecordSchema>;

export const runRecordSchema = z
  .strictObject({
    formatVersion: z.literal(1),
    runId: z.string().min(1),
    predecessorRunId: z.string().nullable(),
    siteId: z.string().min(1),
    projectId: z.string().min(1),
    pageId: z.string().min(1),
    mode: z.enum(['ask', 'plan', 'auto']),
    status: z.enum(['queued', 'active', 'stopped', 'failed', 'completed']),
    target: selectionTargetSchema.nullable(),
    baseRevision: z.string().min(1),
    draftRevision: z.string().nullable(),
    routingPolicyVersion: z.string().min(1),
    units: z.array(runUnitRecordSchema),
    cancellation: cancellationStateSchema,
    createdAt: z.number().nonnegative(),
    startedAt: z.number().nonnegative().nullable(),
    endedAt: z.number().nonnegative().nullable(),
    recoveryPoint: z.string().nullable(),
    queuedRequestPaused: z.boolean(),
    outcome: z.enum(['planned', 'applied', 'undone', 'rejected', 'failed', 'stopped']).nullable(),
  })
  .refine((run) => run.runId !== run.predecessorRunId, 'A successor must have a new run identity.')
  .refine(
    (run) => !(run.cancellation.requested && run.status === 'completed'),
    'A stopped run cannot complete.',
  );
export type RunRecord = z.infer<typeof runRecordSchema>;
