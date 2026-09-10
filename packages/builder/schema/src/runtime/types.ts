import { z } from 'zod';

import { modulePathSchema } from '../code/types';
import { jsonRecordZod } from '../json/json-value-schema';

export const managedCatalogEntrySchema = z.strictObject({
  packageId: z.string().min(1),
  version: z.string().min(1),
  importSpecifiers: z.array(z.string().min(1)).min(1),
  sourceArtifactId: z.string().min(1),
  cssArtifactIds: z.array(z.string().min(1)),
  license: z.string().min(1),
  integrity: z.string().min(1),
  props: jsonRecordZod.optional(),
});
export type ManagedCatalogEntry = z.infer<typeof managedCatalogEntrySchema>;

export const managedCatalogManifestSchema = z
  .strictObject({
    catalogVersion: z.string().min(1),
    runtimeProfile: z.literal('craftkit-react-v1'),
    packages: z.array(managedCatalogEntrySchema),
  })
  .refine((catalog) => {
    const names = catalog.packages.map((entry) => entry.packageId);
    const specifiers = catalog.packages.flatMap((entry) => entry.importSpecifiers);
    return new Set(names).size === names.length && new Set(specifiers).size === specifiers.length;
  }, 'Catalog packages and import specifiers must be unambiguous.');
export type ManagedCatalogManifest = z.infer<typeof managedCatalogManifestSchema>;

export const compileDiagnosticSchema = z.strictObject({
  code: z.string().min(1),
  message: z.string(),
  severity: z.enum(['error', 'warning']),
  modulePath: modulePathSchema.optional(),
  line: z.number().int().positive().optional(),
  column: z.number().int().nonnegative().optional(),
});
export type CompileDiagnostic = z.infer<typeof compileDiagnosticSchema>;

/** A portable artifact body; hosts may store it at an immutable URL. */
export const artifactFileSchema = z.strictObject({
  path: modulePathSchema,
  content: z.string(),
  integrity: z.string().optional(),
});
export type ArtifactFile = z.infer<typeof artifactFileSchema>;

export const buildArtifactSchema = z.strictObject({
  artifactId: z.string().min(1),
  sourceFingerprint: z.string().min(1),
  dependencyFingerprint: z.string().min(1),
  compilerFingerprint: z.string().min(1),
  runtimeFingerprint: z.string().min(1),
  catalogFingerprint: z.string().min(1),
  routeEntries: z.record(z.string(), modulePathSchema),
  js: z.array(artifactFileSchema),
  css: z.array(artifactFileSchema),
  sourceMap: artifactFileSchema.optional(),
  prerenders: z.record(z.string(), artifactFileSchema).optional(),
  diagnostics: z.array(compileDiagnosticSchema),
  createdAt: z.number().nonnegative(),
});
export type BuildArtifact = z.infer<typeof buildArtifactSchema>;

export const exportRouteSchema = z.strictObject({
  pageId: z.string().min(1),
  address: z.string().startsWith('/'),
  artifactId: z.string().min(1),
  html: modulePathSchema,
  hydrationEntry: modulePathSchema,
});
export const exportManifestSchema = z.strictObject({
  formatVersion: z.literal(1),
  siteRevision: z.string().min(1),
  routes: z.array(exportRouteSchema).min(1),
  files: z.array(artifactFileSchema),
  createdAt: z.number().nonnegative(),
});
export type ExportManifest = z.infer<typeof exportManifestSchema>;
