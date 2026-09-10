import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { SourceHandle } from '@craftkit/builder';

import {
  CodeWorkspace,
  type CodeWorkspaceApprovalInput,
  type CodeWorkspaceDraftInput,
  type CodeWorkspacePort,
  type CodeWorkspaceSnapshot,
} from './code-workspace';

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  HTMLElement.prototype.scrollIntoView = () => undefined;
});

afterEach(cleanup);

const sourceHandle: SourceHandle = {
  projectId: 'project-one',
  modulePath: 'pages/home/index.tsx',
  sourceRevision: 'project-r1',
  astNodeId: 'hero-heading',
  instanceKey: 'hero-one',
};

function initialSnapshot(): CodeWorkspaceSnapshot {
  const activeFile = {
    projectId: 'project-one',
    modulePath: 'pages/home/index.tsx',
    projectRevision: 'project-r1',
    expectedFileHash: 'hash-r1',
    file: { language: 'tsx' as const, source: 'export default () => <h1>Launch</h1>;' },
    dirty: false,
  };
  return {
    pageId: 'home',
    files: [
      activeFile,
      {
        projectId: 'project-one',
        modulePath: 'pages/home/styles.css',
        projectRevision: 'project-r1',
        expectedFileHash: 'css-hash-r1',
        file: { language: 'css', source: 'h1 { color: navy; }' },
        dirty: false,
      },
    ],
    activeFile,
    selectedSource: { handle: sourceHandle, from: 22, to: 28 },
    diagnostics: [],
    completions: [{ label: 'Button', type: 'class', detail: '@craftkit/ui' }],
    diff: null,
    impact: null,
    impactStale: false,
    status: 'ready',
  };
}

class WorkspacePortHarness implements CodeWorkspacePort {
  readonly listeners = new Set<() => void>();
  readonly updateDraft = vi.fn((input: CodeWorkspaceDraftInput) => {
    const current = this.snapshot.activeFile;
    if (current === null) return;
    const activeFile = { ...current, file: input.file, dirty: true };
    this.publish({
      ...this.snapshot,
      activeFile,
      files: this.snapshot.files.map((file) =>
        file.modulePath === activeFile.modulePath ? activeFile : file,
      ),
    });
  });
  readonly saveDraft = vi.fn((_input: CodeWorkspaceDraftInput) => undefined);
  readonly approveDiff = vi.fn((_input: CodeWorkspaceApprovalInput) => undefined);
  readonly rejectDiff = vi.fn((_diffId: string) => undefined);
  readonly refreshImpact = vi.fn((_diffId: string) => undefined);
  readonly navigateToSource = vi.fn((_handle: SourceHandle) => undefined);
  private snapshot: CodeWorkspaceSnapshot;

  constructor(snapshot = initialSnapshot()) {
    this.snapshot = snapshot;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  selectFile = (modulePath: string) => {
    const activeFile = this.snapshot.files.find((file) => file.modulePath === modulePath) ?? null;
    this.publish({ ...this.snapshot, activeFile, diagnostics: [], diff: null, impact: null });
  };

  setSnapshot(snapshot: CodeWorkspaceSnapshot): void {
    this.publish(snapshot);
  }

  private publish(snapshot: CodeWorkspaceSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
}

describe('CodeWorkspace', () => {
  it('edits and saves the exact active source through revision-checked host inputs', async () => {
    const port = new WorkspacePortHarness();
    render(<CodeWorkspace port={port} />);

    const editor = await screen.findByRole('textbox', { name: 'Source code' });
    await userEvent.click(editor);
    await userEvent.keyboard('{Control>}a{/Control}');
    await userEvent.keyboard('export const title = "Ship";');

    await waitFor(() => {
      expect(port.updateDraft).toHaveBeenCalled();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save source' }));
    expect(port.saveDraft).toHaveBeenLastCalledWith({
      projectId: 'project-one',
      modulePath: 'pages/home/index.tsx',
      projectRevision: 'project-r1',
      expectedFileHash: 'hash-r1',
      file: { language: 'tsx', source: 'export const title = "Ship";' },
    });
  });

  it('navigates from the unified Canvas SourceHandle without matching visible text', async () => {
    const port = new WorkspacePortHarness();
    render(<CodeWorkspace port={port} />);
    await screen.findByRole('textbox', { name: 'Source code' });

    await userEvent.click(screen.getByRole('button', { name: 'Reveal selected element' }));
    expect(port.navigateToSource).toHaveBeenCalledWith(sourceHandle);
  });

  it('switches actual project files through the host and changes language mode', async () => {
    const port = new WorkspacePortHarness();
    render(<CodeWorkspace port={port} />);
    await screen.findByRole('textbox', { name: 'Source code' });

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'File' }),
      'pages/home/styles.css',
    );
    await waitFor(() => expect(screen.getByText('CSS')).toBeVisible());
    expect(screen.getByText('pages/home/styles.css', { selector: 'code' })).toBeVisible();
  });

  it('blocks a changed shared impact, refreshes it, then forwards the exact approval fingerprint', async () => {
    const port = new WorkspacePortHarness({
      ...initialSnapshot(),
      diff: { id: 'diff-one', original: 'export default () => <h1>Before</h1>;' },
      impact: {
        kind: 'shared',
        componentName: 'Hero heading',
        approval: {
          fingerprint: 'impact-r2',
          pageIds: ['home', 'pricing'],
          instanceIds: ['hero-home', 'hero-pricing'],
        },
      },
      impactStale: true,
    });
    render(<CodeWorkspace port={port} />);
    await screen.findByRole('textbox', { name: 'Source code' });

    expect(screen.getByRole('button', { name: 'Apply shared change' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Refresh impact' }));
    expect(port.refreshImpact).toHaveBeenCalledWith('diff-one');
    expect(port.approveDiff).not.toHaveBeenCalled();

    port.setSnapshot({ ...port.getSnapshot(), impactStale: false });
    await userEvent.click(screen.getByRole('button', { name: 'Apply shared change' }));
    const approval = port.approveDiff.mock.calls.at(-1)?.[0];
    expect(approval?.diffId).toBe('diff-one');
    expect(approval?.impactApproval?.fingerprint).toBe('impact-r2');
  });

  it('keeps the empty code-page state explicit and labelled', () => {
    const port = new WorkspacePortHarness({
      ...initialSnapshot(),
      files: [],
      activeFile: null,
      selectedSource: null,
    });
    render(<CodeWorkspace port={port} />);

    expect(screen.getByRole('region', { name: 'Page source workspace' })).toHaveTextContent(
      'No authored source is open',
    );
  });
});
