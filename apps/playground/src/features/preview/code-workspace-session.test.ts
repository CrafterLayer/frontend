// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { codeFileHash, createSiteBuilder } from '@craftkit/builder';
import { createMemoryVaultStore } from '../vault/store';
import { createReferenceCodePageSite } from './code-page-fixture';
import { createCodePageSession } from './code-page-session';
import { createCodeWorkspaceSession } from './code-workspace-session';

function setup() {
  const kernel = createSiteBuilder({ site: createReferenceCodePageSite(), extensions: [] });
  const store = createMemoryVaultStore();
  const runtime = createCodePageSession({ kernel, editing: true, exporting: false });
  const stopRuntime = runtime.start();
  const workspace = createCodeWorkspaceSession(kernel, runtime, store, 'test');
  const stop = workspace.start();
  const input = (source: string) => {
    const file = workspace.port.getSnapshot().activeFile;
    if (file === null) throw new Error('Missing active file.');
    return { ...file, file: { ...file.file, source } };
  };
  return {
    kernel,
    store,
    runtime,
    workspace,
    input,
    stop: () => {
      stop();
      stopRuntime();
    },
  };
}

describe('source workspace journal', () => {
  it('journals invalid manual source without applying it and restores it after reopening', async () => {
    const t = setup();
    const original = t.kernel.getSite();
    t.workspace.port.updateDraft(t.input('export default function Broken( {'));
    await t.workspace.flushDrafts();
    expect(t.kernel.getSite()).toBe(original);
    expect(t.workspace.port.getSnapshot().statusMessage).toMatch(/session only/);
    const restored = createCodeWorkspaceSession(t.kernel, t.runtime, t.store, 'test');
    const stop = restored.start();
    await new Promise<void>((resolve) => {
      const unsubscribe = restored.port.subscribe(() => {
        if (restored.port.getSnapshot().activeFile?.dirty) {
          unsubscribe();
          resolve();
        }
      });
    });
    expect(restored.port.getSnapshot().activeFile?.file.source).toBe(
      'export default function Broken( {',
    );
    stop();
    t.stop();
  });

  it('applies an explicit save once, preserves invalid syntax, and can undo it', async () => {
    const t = setup();
    const original = t.kernel.getSite();
    const input = t.input('export default function Broken(');
    t.workspace.port.updateDraft(input);
    await t.workspace.port.saveDraft(input);
    expect(
      t.kernel.getSite().codeProjects?.[input.projectId]?.files[input.modulePath]?.source,
    ).toBe(input.file.source);
    expect(t.kernel.transactions()).toHaveLength(1);
    t.kernel.undo();
    expect(t.kernel.getSite()).toEqual(original);
    t.stop();
  });

  it('refuses a stale draft without overwriting the user change or losing the draft', async () => {
    const t = setup();
    const input = t.input('my draft');
    t.workspace.port.updateDraft(input);
    const original = t.kernel.getSite().codeProjects?.[input.projectId]?.files[input.modulePath];
    if (original === undefined) throw new Error('Missing source.');
    t.kernel.dispatch(
      'applyCodeChanges',
      {
        projectId: input.projectId,
        expectedProjectRevision: input.projectRevision,
        changes: [
          {
            path: input.modulePath,
            expectedHash: codeFileHash(original),
            file: { ...original, source: 'concurrent edit' },
          },
        ],
        attribution: { author: 'user' },
      },
      'user',
    );
    await t.workspace.port.saveDraft(input);
    expect(
      t.kernel.getSite().codeProjects?.[input.projectId]?.files[input.modulePath]?.source,
    ).toBe('concurrent edit');
    expect(t.workspace.port.getSnapshot().activeFile?.file.source).toBe('my draft');
    expect(t.workspace.port.getSnapshot().status).toBe('error');
    await t.workspace.flushDrafts();
    t.stop();
  });
});
