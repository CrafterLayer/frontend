import { z } from 'zod';

import { modulePathSchema } from '../code/types';

export const sourceHandleSchema = z.strictObject({
  projectId: z.string().min(1),
  modulePath: modulePathSchema,
  sourceRevision: z.string().min(1),
  astNodeId: z.string().min(1),
  instanceKey: z.string().min(1).optional(),
});
export type SourceHandle = z.infer<typeof sourceHandleSchema>;

export const selectionCapabilitySchema = z.enum([
  'inspect',
  'editText',
  'editProps',
  'editClasses',
  'editSource',
  'duplicate',
  'move',
  'delete',
  'insertInside',
]);
export type SelectionCapability = z.infer<typeof selectionCapabilitySchema>;

export const selectionTargetSchema = z.strictObject({
  pageId: z.string().min(1),
  sourceOrNodeId: z.union([z.string().min(1), sourceHandleSchema]),
  revision: z.string().min(1),
  capabilities: z
    .array(selectionCapabilitySchema)
    .refine((items) => new Set(items).size === items.length, 'Capabilities must be unique.'),
});
export type SelectionTarget = z.infer<typeof selectionTargetSchema>;

export const insertionAnchorSchema = z
  .strictObject({
    pageId: z.string().min(1),
    owner: z.union([z.string().min(1), sourceHandleSchema]),
    slot: z.string().min(1),
    mode: z.enum(['before', 'after', 'inside']),
    beforeId: z.string().min(1).optional(),
    afterId: z.string().min(1).optional(),
    revision: z.string().min(1),
  })
  .refine(
    (anchor) =>
      anchor.mode === 'inside' || anchor.beforeId !== undefined || anchor.afterId !== undefined,
    'A sibling insertion needs a stable neighbor identity.',
  );
export type InsertionAnchor = z.infer<typeof insertionAnchorSchema>;

export const sharedImpactApprovalSchema = z.strictObject({
  fingerprint: z.string().min(1),
  pageIds: z.array(z.string().min(1)),
  instanceIds: z.array(z.string().min(1)),
});
export type SharedImpactApproval = z.infer<typeof sharedImpactApprovalSchema>;
