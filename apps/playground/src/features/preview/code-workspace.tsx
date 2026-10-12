import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import {
  CodeEditor,
  SourceImpactBar,
  type CodeEditorCompletion,
  type CodeEditorController,
  type CodeFile,
  type CompileDiagnostic,
  type SharedImpactApproval,
  type SourceHandle,
  type SourceImpact,
} from '@craftkit/builder';

import { CODE_WORKSPACE_LABELS_EN, type CodeWorkspaceLabels } from './code-workspace.labels';
import './code-workspace.css';

export interface CodeWorkspaceFile {
  readonly projectId: string;
  readonly modulePath: string;
  readonly projectRevision: string;
  readonly expectedFileHash: string;
  readonly file: Readonly<CodeFile>;
  readonly dirty: boolean;
}

export interface CodeWorkspaceSelection {
  readonly handle: SourceHandle;
  /** Exact AST span from the matching runtime `SourceElement`. */
  readonly from: number;
  readonly to: number;
}

export interface CodeWorkspaceDiff {
  readonly id: string;
  readonly original: string;
  readonly label?: string | undefined;
}

export interface CodeWorkspaceSnapshot {
  readonly pageId: string;
  readonly files: readonly CodeWorkspaceFile[];
  readonly activeFile: CodeWorkspaceFile | null;
  readonly selectedSource: CodeWorkspaceSelection | null;
  readonly diagnostics: readonly CompileDiagnostic[];
  readonly completions: readonly CodeEditorCompletion[];
  readonly diff: CodeWorkspaceDiff | null;
  readonly impact: SourceImpact | null;
  readonly impactStale: boolean;
  readonly status: 'ready' | 'saving' | 'saved' | 'error';
  readonly statusMessage?: string | undefined;
}

export interface CodeWorkspaceDraftInput {
  readonly projectId: string;
  readonly modulePath: string;
  readonly projectRevision: string;
  readonly expectedFileHash: string;
  readonly file: CodeFile;
}

export interface CodeWorkspaceApprovalInput extends CodeWorkspaceDraftInput {
  readonly diffId: string;
  readonly impactApproval?: SharedImpactApproval | undefined;
}

/** Host-owned store and SiteKernel command adapter. The workspace never clones a CodeProject. */
export interface CodeWorkspacePort {
  subscribe(listener: () => void): () => void;
  getSnapshot(): CodeWorkspaceSnapshot;
  selectFile(modulePath: string): void;
  updateDraft(input: CodeWorkspaceDraftInput): void;
  saveDraft(input: CodeWorkspaceDraftInput): void | Promise<void>;
  approveDiff(input: CodeWorkspaceApprovalInput): void | Promise<void>;
  rejectDiff(diffId: string): void;
  refreshImpact(diffId: string): void | Promise<void>;
  /** Maps a Canvas SourceHandle to the matching active module and source range. */
  navigateToSource(handle: SourceHandle): void;
}

export interface CodeWorkspaceProps {
  port: CodeWorkspacePort;
  label?: string | undefined;
  /** Every string the workspace shows; English unless the host passes its locale's set. */
  labels?: CodeWorkspaceLabels | undefined;
}

function inputFor(file: CodeWorkspaceFile, source: string): CodeWorkspaceDraftInput {
  return {
    projectId: file.projectId,
    modulePath: file.modulePath,
    projectRevision: file.projectRevision,
    expectedFileHash: file.expectedFileHash,
    file: { language: file.file.language, source },
  };
}

/** Source-only UI over a subscribed host port; every durable write remains SiteKernel-owned. */
export function CodeWorkspace({
  port,
  labels = CODE_WORKSPACE_LABELS_EN,
  label = labels.region,
}: CodeWorkspaceProps) {
  const controllerRef = useRef<CodeEditorController | null>(null);
  const subscribe = useCallback((listener: () => void) => port.subscribe(listener), [port]);
  const getSnapshot = useCallback(() => port.getSnapshot(), [port]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const file = snapshot.activeFile;
  const selection = snapshot.selectedSource;
  const fileProjectId = file?.projectId;
  const fileModulePath = file?.modulePath;
  const fileRevision = file?.projectRevision;
  const selectionProjectId = selection?.handle.projectId;
  const selectionModulePath = selection?.handle.modulePath;
  const selectionRevision = selection?.handle.sourceRevision;
  const selectionFrom = selection?.from;
  const selectionTo = selection?.to;

  useEffect(() => {
    if (
      fileProjectId === undefined ||
      fileModulePath === undefined ||
      fileRevision === undefined ||
      selectionProjectId !== fileProjectId ||
      selectionModulePath !== fileModulePath ||
      selectionRevision !== fileRevision ||
      selectionFrom === undefined ||
      selectionTo === undefined
    ) {
      return;
    }
    controllerRef.current?.goToRange(selectionFrom, selectionTo);
  }, [
    fileModulePath,
    fileProjectId,
    fileRevision,
    selectionFrom,
    selectionModulePath,
    selectionProjectId,
    selectionRevision,
    selectionTo,
  ]);

  if (file === null) {
    return (
      <section
        className="playground-code-workspace playground-code-workspace--empty"
        aria-label={label}
      >
        <strong>{labels.emptyTitle}</strong>
        <span>{labels.emptyHint}</span>
      </section>
    );
  }

  const diff = snapshot.diff;
  const impact = snapshot.impact;
  const applyDiff = (approval?: SharedImpactApproval) => {
    if (diff === null || snapshot.impactStale) return;
    void port.approveDiff({
      ...inputFor(file, file.file.source),
      diffId: diff.id,
      ...(approval === undefined ? {} : { impactApproval: approval }),
    });
  };

  return (
    <section className="playground-code-workspace" aria-label={label}>
      <header className="playground-code-workspace__header">
        <div>
          <strong>{labels.source}</strong>
          <span>{snapshot.pageId}</span>
        </div>
        <label>
          <span>{labels.file}</span>
          <select
            value={file.modulePath}
            onChange={(event) => {
              port.selectFile(event.currentTarget.value);
            }}
          >
            {snapshot.files.map((candidate) => (
              <option key={candidate.modulePath} value={candidate.modulePath}>
                {candidate.dirty ? `${candidate.modulePath} •` : candidate.modulePath}
              </option>
            ))}
          </select>
        </label>
        <div className="playground-code-workspace__actions">
          {selection === null ? null : (
            <button
              type="button"
              onClick={() => {
                port.navigateToSource(selection.handle);
                if (
                  selection.handle.projectId === file.projectId &&
                  selection.handle.modulePath === file.modulePath &&
                  selection.handle.sourceRevision === file.projectRevision
                ) {
                  controllerRef.current?.goToRange(selection.from, selection.to);
                }
              }}
            >
              {labels.reveal}
            </button>
          )}
          <button
            type="button"
            disabled={!file.dirty || snapshot.status === 'saving'}
            onClick={() => {
              void port.saveDraft(inputFor(file, file.file.source));
            }}
          >
            {snapshot.status === 'saving' ? labels.saving : labels.save}
          </button>
        </div>
      </header>
      {impact === null ? null : (
        <SourceImpactBar
          impact={impact}
          stale={snapshot.impactStale}
          onOpenSource={
            selection === null
              ? undefined
              : () => {
                  port.navigateToSource(selection.handle);
                }
          }
          onRefresh={
            diff === null
              ? undefined
              : () => {
                  void port.refreshImpact(diff.id);
                }
          }
          onApply={diff === null ? undefined : applyDiff}
        />
      )}
      <CodeEditor
        value={file.file.source}
        language={file.file.language}
        label={labels.editor}
        path={file.modulePath}
        busy={snapshot.status === 'saving'}
        diagnostics={snapshot.diagnostics}
        completions={snapshot.completions}
        diff={
          diff === null
            ? undefined
            : {
                original: diff.original,
                onReject: () => {
                  port.rejectDiff(diff.id);
                },
                ...(diff.label === undefined ? {} : { label: diff.label }),
                ...(impact === null && !snapshot.impactStale
                  ? {
                      onApprove: () => {
                        applyDiff();
                      },
                    }
                  : {}),
              }
        }
        onReady={(controller) => {
          controllerRef.current = controller;
          if (
            controller !== null &&
            selection !== null &&
            selection.handle.projectId === file.projectId &&
            selection.handle.modulePath === file.modulePath &&
            selection.handle.sourceRevision === file.projectRevision
          ) {
            controller.goToRange(selection.from, selection.to);
          }
        }}
        onChange={(source) => {
          port.updateDraft(inputFor(file, source));
        }}
        onSave={(source) => {
          void port.saveDraft(inputFor(file, source));
        }}
      />
      <p
        className="playground-code-workspace__status"
        data-status={snapshot.status}
        aria-live="polite"
      >
        {snapshot.statusMessage ?? (file.dirty ? labels.unsaved : labels.matches)}
      </p>
    </section>
  );
}
