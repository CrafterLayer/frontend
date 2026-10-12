import { ChromeButton, CodePreviewFrame, type BuilderSiteKernel } from '@craftkit/builder';

import { CodeWorkspace } from '../features/preview/code-workspace';
import { PROFESSIONAL_BUILDER_FLAGS } from '../features/preview/feature-flags';
import type { EditorLabels } from './editor-labels';
import type { CodeSession } from './use-code-session';

export interface CodeRuntimeViewProps {
  readonly code: CodeSession;
  /** The authored code page that is open. */
  readonly codeSnapshot: NonNullable<CodeSession['codeSnapshot']>;
  readonly siteKernel: BuilderSiteKernel | undefined;
  /** The rail's Code destination is open: the source workspace replaces the preview. */
  readonly codeOpen: boolean;
  readonly labels: EditorLabels['codeWorkspace'];
  readonly frameWidth: number;
  readonly zoom: number;
}

/** The canvas while an authored code page is open: its toolbar and its isolated preview or source. */
export function CodeRuntimeView({
  code,
  codeSnapshot,
  siteKernel,
  codeOpen,
  labels,
  frameWidth,
  zoom,
}: CodeRuntimeViewProps) {
  const { codePage, visibleCompiledCodePage, sourceWorkspace, compileCodePage, exportCodePage } =
    code;
  return (
    <section className="pg-code-runtime" aria-label="Authored code page">
      <div className="pg-code-runtime__toolbar" role="toolbar" aria-label="Code page actions">
        <ChromeButton size="sm" onClick={() => void compileCodePage()}>
          Build preview
        </ChromeButton>
        <ChromeButton
          size="sm"
          disabled={!siteKernel?.canUndo()}
          onClick={() => {
            siteKernel?.undo();
          }}
        >
          Undo source
        </ChromeButton>
        <ChromeButton
          size="sm"
          onClick={() => {
            void siteKernel?.flush().then(
              () => undefined,
              (error: unknown) => {
                codePage.controller?.report(
                  error instanceof Error
                    ? error.message
                    : 'Storage did not acknowledge the source.',
                );
              },
            );
          }}
        >
          Save now
        </ChromeButton>
        <ChromeButton
          size="sm"
          disabled={
            !PROFESSIONAL_BUILDER_FLAGS.codeExport ||
            codePage.exporting ||
            visibleCompiledCodePage?.artifact.sourceRevision !== codeSnapshot.project.revision
          }
          onClick={() => void exportCodePage()}
        >
          Export files
        </ChromeButton>
        <span className="pg-code-runtime__revision">Revision {codeSnapshot.project.revision}</span>
      </div>
      <div className="pg-code-runtime__stage">
        {codeOpen && sourceWorkspace !== undefined ? (
          <CodeWorkspace port={sourceWorkspace} labels={labels} />
        ) : (
          <CodePreviewFrame
            artifact={visibleCompiledCodePage?.artifact}
            sourceRevision={codeSnapshot.project.revision}
            previewUrl={visibleCompiledCodePage?.previewUrl ?? 'http://unbuilt.localhost:5175/'}
            expectedOrigin={
              new URL(visibleCompiledCodePage?.previewUrl ?? 'http://unbuilt.localhost:5175/')
                .origin
            }
            publicData={codeSnapshot.inputs}
            frameWidth={frameWidth}
            zoom={zoom}
            status={codePage.status}
            message={codePage.message}
            onMessage={codePage.controller?.select}
            onRetry={() => void compileCodePage()}
          />
        )}
      </div>
    </section>
  );
}
