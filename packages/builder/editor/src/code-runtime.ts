import {
  managedCatalogManifestSchema,
  type CodeFile,
  type ManagedCatalogManifest,
} from '@craftkit/builder-schema';

import type { ManagedCatalog } from '@craftkit/builder-code-runtime';
export { projectPreviewUrl } from '@craftkit/builder-code-runtime';

export type {
  BuildCache,
  CompileOptions,
  CompileResult,
  CompiledPageArtifact,
  ExportOptions,
  ExportPage,
  ExportResult,
  ManagedCatalog,
  PreviewArtifact,
  PreviewBridge,
  PreviewEnvelope,
  PreviewEventType,
  PreviewHostCommand,
  PrerenderResult,
  RuntimeSnapshot,
  SourceElement,
} from '@craftkit/builder-code-runtime';

export interface ManagedCatalogComposition {
  readonly manifest: ManagedCatalogManifest;
  readonly modules: Readonly<Record<string, CodeFile>>;
  readonly stylesheets?: readonly string[];
}

/**
 * Builds the trusted runtime port supplied by the app-facing facade.
 *
 * The runtime deliberately knows nothing about CraftKit's extension packages.
 * A host resolves pinned artifacts first, then passes their virtual modules and
 * CSS through this small composition boundary. Keeping the function in this
 * shared entrypoint also avoids pulling the compiler into browser consumers.
 */
export function composeManagedCatalog(input: ManagedCatalogComposition): ManagedCatalog {
  const manifest = managedCatalogManifestSchema.parse(input.manifest);
  const modules: Record<string, CodeFile> = Object.create(null) as Record<string, CodeFile>;

  for (const [specifier, file] of Object.entries(input.modules)) {
    if (Object.prototype.hasOwnProperty.call(modules, specifier)) {
      throw new Error(`Duplicate managed catalog module: ${specifier}`);
    }
    modules[specifier] = { ...file };
  }

  return {
    manifest,
    modules,
    ...(input.stylesheets?.length
      ? { stylesheet: input.stylesheets.filter(Boolean).join('\n') }
      : {}),
  };
}

export {
  REFERENCE_MANAGED_CATALOG_VERSION,
  referenceManagedCatalog,
} from './catalog/managed-catalog';
