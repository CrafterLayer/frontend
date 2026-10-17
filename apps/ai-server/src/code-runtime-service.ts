import type {
  CompiledPageArtifact,
  ExportPage,
  ExportResult,
  ManagedCatalog,
  PreviewArtifact,
  RuntimeSnapshot,
  SourceElement,
} from '@craftkit/builder/code-runtime';
import { projectFingerprints } from '@craftkit/builder/code-runtime/compiler';
import { exportSite } from '@craftkit/builder/code-runtime/export';

import { createArtifactStore, type ArtifactStore } from './artifact-store';
import type { RuntimeWorkerSupervisor } from './runtime-workers';

export interface CodeRuntimeService {
  compile(
    snapshot: RuntimeSnapshot,
    signal?: AbortSignal,
  ): Promise<{
    readonly ok: true;
    readonly artifact: PreviewArtifact;
    readonly sourceElements: readonly SourceElement[];
  }>;
  export(
    pages: readonly ExportPage[],
    artifactIds: readonly string[],
    signal?: AbortSignal,
  ): Promise<ExportResult>;
  serveArtifact(url: URL): Response;
}

export interface CodeRuntimeServiceOptions {
  readonly workers: RuntimeWorkerSupervisor;
  readonly catalog: () => Promise<ManagedCatalog>;
  readonly artifacts?: ArtifactStore;
}

export function createCodeRuntimeService(options: CodeRuntimeServiceOptions): CodeRuntimeService {
  const artifacts = options.artifacts ?? createArtifactStore();
  return {
    compile: async (snapshot, signal) => {
      const catalog = await options.catalog();
      signal?.throwIfAborted();
      const identity = await projectFingerprints(snapshot, catalog);
      signal?.throwIfAborted();
      const cached = artifacts.find(identity.artifactId);
      if (
        cached?.projectId === snapshot.projectId &&
        cached.pageId === snapshot.pageId &&
        cached.sourceRevision === snapshot.project.revision
      ) {
        return {
          ok: true,
          artifact: artifacts.put(cached),
          sourceElements: cached.sourceElements,
        };
      }
      const output = await options.workers.run({ kind: 'compile', snapshot }, signal);
      if (output.kind !== 'compile') throw new Error('Compile worker returned the wrong result.');
      signal?.throwIfAborted();
      const preview = artifacts.put(output.artifact);
      return { ok: true, artifact: preview, sourceElements: output.sourceElements };
    },
    export: async (pages, artifactIds, signal) => {
      if (pages.length === 0 || pages.length !== artifactIds.length) {
        return {
          ok: false,
          diagnostics: [
            {
              code: 'export-refused',
              severity: 'error',
              message: 'Export requires one artifact id for every page.',
            },
          ],
        };
      }
      const byPage = new Map<string, CompiledPageArtifact>();
      for (let index = 0; index < pages.length; index += 1) {
        const page = pages.at(index);
        const artifactId = artifactIds.at(index);
        if (page === undefined || artifactId === undefined) {
          throw new Error('Export page and artifact indexing failed.');
        }
        const artifact = artifacts.find(artifactId);
        if (artifact === undefined) {
          return {
            ok: false,
            diagnostics: [
              {
                code: 'export-refused',
                severity: 'error',
                message: `Page ${page.pageId} has no revision-matching artifact.`,
              },
            ],
          };
        }
        if (
          artifact.pageId !== page.pageId ||
          artifact.projectId !== page.projectId ||
          artifact.sourceRevision !== page.project.revision
        ) {
          return {
            ok: false,
            diagnostics: [
              {
                code: 'export-refused',
                severity: 'error',
                message: `Page ${page.pageId} has no revision-matching artifact.`,
              },
            ],
          };
        }
        byPage.set(page.pageId, artifact);
      }
      const catalog = await options.catalog();
      return exportSite(pages, {
        catalog,
        artifacts: byPage,
        ...(signal === undefined ? {} : { signal }),
        prerender: async (page, artifact, prerenderSignal) => {
          const output = await options.workers.run(
            { kind: 'prerender', page, artifact },
            prerenderSignal,
          );
          if (output.kind !== 'prerender') {
            throw new Error('Prerender worker returned the wrong result.');
          }
          return output.result;
        },
      });
    },
    serveArtifact: (url) => artifacts.serve(url),
  };
}
