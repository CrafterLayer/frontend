import { useCallback, useMemo } from 'react';

import type { ArtifactFile, BuilderSiteKernel, LiveUtilities } from '@craftkit/builder';

import type { PlaygroundFixture } from '../features/preview/create-playground-kernel';
import type { VaultSession } from '../features/vault/use-vault';
import { createCodeRuntimeClient } from '../features/preview/code-runtime-client';
import { useCodePageSession } from '../features/preview/use-code-page-session';
import { useCodeWorkspace } from '../features/preview/use-code-workspace';
import { usePublishStaticSite } from '../features/export';
import { createSourceAgentClient } from '../features/preview/source-agent-client';
import { useSourceAgent } from '../features/preview/use-source-agent';
import { PROFESSIONAL_BUILDER_FLAGS } from '../features/preview/feature-flags';
import { createArtifactArchive } from '../features/preview/artifact-archive';

const CODE_RUNTIME_ENDPOINT = import.meta.env['VITE_CODE_RUNTIME_ENDPOINT'] as string | undefined;
const CODE_RUNTIME_TOKEN = import.meta.env['VITE_CODE_RUNTIME_TOKEN'] as string | undefined;
const EXPORT_SITE_ORIGIN = import.meta.env['VITE_EXPORT_SITE_ORIGIN'] as string | undefined;
const CODE_PREVIEW_URL_TEMPLATE =
  (import.meta.env['VITE_CODE_PREVIEW_URL_TEMPLATE'] as string | undefined) ??
  'http://{project}.localhost:5175/';

function downloadArtifactFiles(files: readonly ArtifactFile[]): void {
  const url = URL.createObjectURL(
    new Blob([createArtifactArchive(files)], { type: 'application/zip' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'craftkit-site.zip';
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export interface CodeSessionOptions {
  readonly siteKernel: BuilderSiteKernel | undefined;
  readonly vault: VaultSession | undefined;
  readonly fixture: PlaygroundFixture;
  readonly liveUtilities: LiveUtilities | undefined;
  /** A stable setter: the source agent's review opens the rail's Code destination. */
  readonly setRailSection: (section: string) => void;
}

/**
 * The authored-code page, its source workspace and source agent, and the static
 * site publish: the runtime sessions the editor drives from the code view, the
 * top bar's Publish and the code page's toolbar.
 */
export function useCodeSession({
  siteKernel,
  vault,
  fixture,
  liveUtilities,
  setRailSection,
}: CodeSessionOptions) {
  const codeRuntimeClient = useMemo(
    () =>
      CODE_RUNTIME_ENDPOINT === undefined
        ? undefined
        : createCodeRuntimeClient({
            endpoint: CODE_RUNTIME_ENDPOINT,
            previewUrlTemplate: CODE_PREVIEW_URL_TEMPLATE,
            ...(CODE_RUNTIME_TOKEN === undefined ? {} : { token: CODE_RUNTIME_TOKEN }),
          }),
    [],
  );
  const codePage = useCodePageSession(
    siteKernel,
    codeRuntimeClient,
    PROFESSIONAL_BUILDER_FLAGS.sourceAwareEditing,
    PROFESSIONAL_BUILDER_FLAGS.codeExport,
    EXPORT_SITE_ORIGIN,
  );
  const {
    source: codeSnapshot,
    compiled: visibleCompiledCodePage,
    selection: selectedSource,
    text: selectedText,
  } = codePage;
  const sourceWorkspace = useCodeWorkspace(siteKernel, codePage.controller, vault?.store, fixture);
  const sourceAgentClient = useMemo(
    () =>
      CODE_RUNTIME_ENDPOINT === undefined
        ? undefined
        : createSourceAgentClient(CODE_RUNTIME_ENDPOINT, CODE_RUNTIME_TOKEN),
    [],
  );
  const reviewSource = useCallback(
    (files: readonly string[]) => {
      if (files[0] !== undefined) sourceWorkspace?.selectFile(files[0]);
      setRailSection('code');
    },
    [sourceWorkspace, setRailSection],
  );
  const sourceAgent = useSourceAgent(
    siteKernel,
    codePage.controller,
    codeRuntimeClient,
    sourceAgentClient,
    vault,
    fixture,
    PROFESSIONAL_BUILDER_FLAGS.remoteCodeGeneration,
    reviewSource,
  );
  const compileCodePage = () => codePage.controller?.rebuild();
  const exportCodePage = async () => {
    const exported = await codePage.controller?.exportPage();
    if (exported !== undefined) downloadArtifactFiles(exported.files);
  };
  // Canvas (non-code) pages publish as a static site: SEO head, sitemap, robots, 404.
  const publishSite = usePublishStaticSite(siteKernel, EXPORT_SITE_ORIGIN, liveUtilities);
  const publishStaticSiteFiles = async () => {
    const files = await publishSite.publish();
    if (files !== undefined) downloadArtifactFiles(files);
  };
  return {
    codePage,
    codeSnapshot,
    visibleCompiledCodePage,
    selectedSource,
    selectedText,
    sourceWorkspace,
    sourceAgent,
    compileCodePage,
    exportCodePage,
    publishSite,
    publishStaticSiteFiles,
  };
}

export type CodeSession = ReturnType<typeof useCodeSession>;
