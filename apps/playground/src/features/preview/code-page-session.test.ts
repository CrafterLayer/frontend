// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { codeFileHash, createSiteBuilder } from '@craftkit/builder';
import type {
  PreviewEnvelope,
  RuntimeSnapshot,
  SourceElement,
} from '@craftkit/builder/code-runtime';

import { createReferenceCodePageSite } from './code-page-fixture';
import { createCodePageSession, exportLanguage } from './code-page-session';
import type { CodeRuntimeClient, CompiledCodePage, ExportedCodePage } from './code-runtime-client';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function result(source: RuntimeSnapshot): CompiledCodePage {
  const file = source.project.files[source.entry];
  if (file === undefined) throw new Error('Missing entry.');
  const text = 'Turn ambitious ideas into a site people remember.';
  const start = file.source.indexOf(text);
  const element: SourceElement = {
    handle: {
      projectId: source.projectId,
      modulePath: source.entry,
      sourceRevision: source.project.revision,
      astNodeId: 'headline',
    },
    tag: 'h1',
    start: start - 4,
    end: start + text.length + 5,
    dynamic: false,
    staticText: { start, end: start + text.length, source: text },
  };
  return {
    artifact: {
      artifactId: `artifact-${source.project.revision}`,
      projectId: source.projectId,
      pageId: source.pageId,
      sourceRevision: source.project.revision,
      scriptUrls: [],
      stylesheetUrls: [],
      targetIds: ['headline'],
    },
    sourceElements: [element],
  };
}

function setup(dir: 'ltr' | 'rtl' = 'ltr') {
  const reference = createReferenceCodePageSite();
  const site =
    dir === 'ltr'
      ? reference
      : {
          ...reference,
          dir,
          pages: reference.pages.map((page) => ({ ...page, document: { ...page.document, dir } })),
        };
  const kernel = createSiteBuilder({ site, extensions: [] });
  const builds: {
    source: RuntimeSnapshot;
    signal: AbortSignal | undefined;
    pending: ReturnType<typeof deferred<CompiledCodePage>>;
  }[] = [];
  const exported = deferred<ExportedCodePage>();
  const exportPage = vi.fn((_page: unknown, _artifactId?: string, _signal?: AbortSignal) => exported.promise);
  const client: CodeRuntimeClient = {
    compile: vi.fn((source: RuntimeSnapshot, signal: AbortSignal | undefined) => {
      const pending = deferred<CompiledCodePage>();
      builds.push({ source, signal, pending });
      return pending.promise;
    }),
    exportPage,
  };
  const session = createCodePageSession({ kernel, client, editing: true, exporting: true });
  const stop = session.start();
  const edit = () => {
    const source = session.getSnapshot().source;
    if (source === undefined) throw new Error('Missing source.');
    const file = source.project.files[source.entry];
    if (file === undefined) throw new Error('Missing file.');
    kernel.dispatch(
      'applyCodeChanges',
      {
        projectId: source.projectId,
        expectedProjectRevision: source.project.revision,
        changes: [
          {
            path: source.entry,
            expectedHash: codeFileHash(file),
            file: { ...file, source: `${file.source}\n// change` },
          },
        ],
        attribution: { author: 'user' },
      },
      'user',
    );
  };
  const complete = async (index: number) => {
    const build = builds[index];
    if (build === undefined) throw new Error('Missing build.');
    build.pending.resolve(result(build.source));
    await build.pending.promise;
  };
  const focus = (): PreviewEnvelope => {
    const compiled = session.getSnapshot().compiled;
    if (compiled === undefined) throw new Error('Missing artifact.');
    return {
      ...compiled.artifact,
      version: 1,
      channel: 'test',
      type: 'focus',
      payload: { astNodeId: 'headline' },
    };
  };
  return { kernel, session, builds, client, exportPage, stop, edit, complete, focus, exported };
}

describe('source page session', () => {
  it('rejects a late successful compile even when the server ignores abort', async () => {
    const t = setup();
    t.edit();
    expect(t.builds[0]?.signal?.aborted).toBe(true);
    await t.complete(1);
    const current = t.session.getSnapshot().compiled;
    await t.complete(0);
    expect(t.session.getSnapshot().compiled).toBe(current);
    expect(current?.artifact.sourceRevision).toBe(t.session.getSnapshot().source?.project.revision);
    t.stop();
  });

  it('preserves the last successful preview on invalid source and restores the matching artifact on undo', async () => {
    const t = setup();
    await t.complete(0);
    const original = t.session.getSnapshot().compiled;
    t.edit();
    const failed = t.builds[1];
    failed?.pending.reject(new Error('Invalid TSX'));
    await failed?.pending.promise.catch(() => undefined);
    expect(t.session.getSnapshot()).toMatchObject({
      compiled: original,
      status: 'error',
      message: 'Invalid TSX',
    });
    t.kernel.undo();
    expect(t.session.getSnapshot()).toMatchObject({ compiled: original, status: 'ready' });
    expect(t.builds).toHaveLength(2);
    t.stop();
  });

  it('edits only the selected exact source span in one transaction and clears stale selection', async () => {
    const t = setup();
    await t.complete(0);
    t.session.select(t.focus());
    const previous = t.session.getSnapshot().source?.project;
    t.session.setText('A <clear> direction');
    expect(t.session.applyText()).toBe(true);
    expect(t.session.getSnapshot().selection).toBeUndefined();
    expect(t.session.getSnapshot().source?.project.files['pages/home/index.tsx']?.source).toContain(
      '<h1>A &lt;clear&gt; direction</h1>',
    );
    t.kernel.undo();
    expect(t.session.getSnapshot().source?.project).toEqual(previous);
    t.stop();
  });

  it('refuses stale selection and revision-mismatched export', async () => {
    const t = setup();
    await t.complete(0);
    const focus = t.focus();
    t.edit();
    t.session.select(focus);
    expect(t.session.getSnapshot().selection).toBeUndefined();
    await t.session.exportPage();
    expect(t.exportPage).not.toHaveBeenCalled();
    t.stop();
  });

  it('cancels export when the source changes and never delivers a late download', async () => {
    const t = setup();
    await t.complete(0);
    const promise = t.session.exportPage();
    t.edit();
    t.exported.resolve({ files: [], artifactIds: [] });
    expect(await promise).toBeUndefined();
    expect(t.session.getSnapshot().exporting).toBe(false);
    t.stop();
  });

  it('stops pending work on teardown and can restart under React StrictMode', async () => {
    const t = setup();
    t.stop();
    const restart = t.session.start();
    await t.complete(0);
    expect(t.session.getSnapshot().compiled).toBeUndefined();
    await t.complete(1);
    expect(t.session.getSnapshot().status).toBe('ready');
    restart();
  });

  it('passes the page language and direction to the export, so Arabic ships as lang="ar"', async () => {
    for (const [dir, language] of [
      ['rtl', 'ar'],
      ['ltr', 'en'],
    ] as const) {
      const t = setup(dir);
      await t.complete(0);
      const promise = t.session.exportPage();
      t.exported.resolve({ files: [], artifactIds: [] });
      await promise;
      expect(t.exportPage).toHaveBeenCalledTimes(1);
      expect(t.exportPage.mock.calls[0]?.[0]).toMatchObject({ language, direction: dir });
      t.stop();
    }
  });

  it('derives the export language from the root lang, falling back to the direction', () => {
    expect(exportLanguage('ar-JO', 'ltr')).toBe('ar-JO');
    expect(exportLanguage('', 'rtl')).toBe('ar');
    expect(exportLanguage(undefined, 'ltr')).toBe('en');
    expect(exportLanguage('not a tag', 'rtl')).toBe('ar');
  });
});
