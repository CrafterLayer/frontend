import { z } from 'zod';

import { jsonRecordZod } from '../json/json-value-schema';

/** Source paths are identities, never filesystem paths supplied to the host. */
export const modulePathSchema = z
  .string()
  .min(1)
  .refine(
    (path) =>
      !path.includes('\\') &&
      !/[\u0000-\u001f?#:]/.test(path) &&
      path
        .split('/')
        .every(
          (part) =>
            part !== '' &&
            part !== '.' &&
            part !== '..' &&
            !['__proto__', 'prototype', 'constructor'].includes(part),
        ),
    'Expected a normalized project-relative POSIX module path.',
  );
export type ModulePath = z.infer<typeof modulePathSchema>;

export const codeFileSchema = z.strictObject({
  language: z.enum(['js', 'jsx', 'ts', 'tsx', 'css', 'json']),
  source: z.string(),
});
export type CodeFile = z.infer<typeof codeFileSchema>;

export const managedDependencyLockSchema = z.strictObject({
  catalogVersion: z.string().min(1),
  packages: z.record(
    z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
    z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/),
  ),
});
export type ManagedDependencyLock = z.infer<typeof managedDependencyLockSchema>;

export const codeProjectSchema = z.strictObject({
  formatVersion: z.literal(1),
  runtimeProfile: z.literal('craftkit-react-v1'),
  dependencyLock: managedDependencyLockSchema,
  revision: z.string().min(1),
  files: z.record(modulePathSchema, codeFileSchema),
});
export type CodeProject = z.infer<typeof codeProjectSchema>;

export const pageSeoSchema = z.strictObject({
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  noIndex: z.boolean().optional(),
});
export type PageSeo = z.infer<typeof pageSeoSchema>;

export const codePageReferenceSchema = z.strictObject({
  projectId: z.string().min(1),
  entry: modulePathSchema,
  exportName: z.literal('default'),
  inputs: jsonRecordZod,
  seo: pageSeoSchema.optional(),
});
export type CodePageReference = z.infer<typeof codePageReferenceSchema>;

export const codeAttributionSchema = z.strictObject({
  author: z.enum(['user', 'ai', 'codeview']),
  runId: z.string().min(1).optional(),
  unitId: z.string().min(1).optional(),
});
export type CodeAttribution = z.infer<typeof codeAttributionSchema>;

export interface CodeTransactionResult {
  projectId: string;
  beforeRevision: string;
  afterRevision: string;
  attribution: CodeAttribution;
}

/** Generated links retain identity across route changes; literal URLs stay strings. */
export const pageLinkSchema = z.strictObject({
  kind: z.literal('page'),
  pageId: z.string().min(1),
  fragment: z.string().optional(),
});
export type PageLink = z.infer<typeof pageLinkSchema>;

/** Collision-free content token. Deliberately not a cryptographic security primitive. */
export function codeFileHash(file: CodeFile): string {
  return JSON.stringify([file.language, file.source]);
}
