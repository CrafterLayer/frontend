// @craftkit/builder-code-view — the code view extension (011 contract §3–§4).
// The manifest contributes ONE lazy panel and ONE projection; a session that
// never opens the panel loads none of its React implementation (SC-006).
import type { ProjectionDef, TrustedExtensionManifest } from '@craftkit/builder-schema';
import {
  CANONICAL_JSON_PROJECTION_ID,
  parseDocument,
  parseScope,
  projectDocument,
  projectScope,
  type CodecPorts,
} from '@craftkit/builder-transforms';

import type { TransformWorkerClient } from './worker/client';

const canonicalJsonProjection: ProjectionDef = {
  id: CANONICAL_JSON_PROJECTION_ID,
  project: (document, scope) =>
    scope === undefined
      ? projectDocument(document).text
      : projectScope(document, scope.nodeId).text,
  // The CALLER owns the registry and answers `blockExists`; inferring the
  // vocabulary from the base document instead wrongly rejects registered types
  // the document does not use yet (011 T033 review, finding 5).
  parse: (text, document, ports, scope) => {
    const codecPorts: CodecPorts = { blockExists: (type) => ports.blockExists(type) };
    return scope === undefined
      ? parseDocument(text, document, codecPorts)
      : parseScope(text, document, scope.nodeId, codecPorts);
  },
};

/** Create the real module-worker client when the lazy panel is first opened. */
export async function createCodeViewWorkerClient(): Promise<TransformWorkerClient> {
  const { createTransformWorkerClient } = await import('./worker/client');
  const worker = new Worker(new URL('./worker/transform-worker.ts', import.meta.url), {
    name: 'craftkit-code-view',
    type: 'module',
  });
  return createTransformWorkerClient(worker);
}

export const codeViewExtension: TrustedExtensionManifest = {
  tier: 1,
  name: 'craftkit.code-view',
  version: '0.1.0',
  contributes: {
    panels: [
      {
        id: 'code-view',
        slot: 'bottom',
        title: 'builder.codeView.title',
        load: () => import('./CodeViewPanel'),
      },
    ],
    projections: [canonicalJsonProjection],
  },
};

// Worker plumbing is deliberately ABSENT here: the loopback and raw client
// constructor live on the './testing' subpath so the production entry keeps
// worker/client.ts and worker/protocol.ts off the initial module graph — the
// only static reach into ./worker from this file is type-only.
export type {
  CodeViewKernel,
  CodeViewKernelSnapshot,
  CodeViewPanelProps,
  CodeViewStatus,
} from './CodeViewPanel';
export {
  CodeEditor,
  type CodeEditorCompletion,
  type CodeEditorController,
  type CodeEditorDiff,
  type CodeEditorLanguage,
  type CodeEditorModuleLoader,
  type CodeEditorProps,
} from './components/CodeEditor';
export {
  SourceImpactBar,
  type SourceImpact,
  type SourceImpactBarProps,
} from './components/SourceImpactBar';
export type {
  TransformWorkerClient,
  TransformWorkerClientSnapshot,
  WorkerLike,
} from './worker/client';
