import { codeFileHash, type BuilderSiteKernel } from '@craftkit/builder';
import { z } from 'zod';

import type { VaultStore } from '../vault/store';
import { vaultWriteAcknowledgement } from '../vault/store';
import type { CodePageSession } from './code-page-session';
import type {
  CodeWorkspaceDraftInput,
  CodeWorkspacePort,
  CodeWorkspaceSnapshot,
} from './code-workspace';

const draftSchema = z.object({
  projectId: z.string().min(1),
  modulePath: z.string().min(1),
  projectRevision: z.string().min(1),
  expectedFileHash: z.string(),
  file: z.object({
    language: z.enum(['js', 'jsx', 'ts', 'tsx', 'css', 'json']),
    source: z.string(),
  }),
});

/** A journal of edited files, never a second project or document. */
export function createCodeWorkspaceSession(
  kernel: BuilderSiteKernel,
  runtime: CodePageSession,
  store: VaultStore,
  siteId: string,
) {
  const drafts = new Map<string, CodeWorkspaceDraftInput>();
  const listeners = new Set<() => void>();
  const loaded = new Set<string>();
  let activePath: string | undefined;
  let state: CodeWorkspaceSnapshot;
  let status: CodeWorkspaceSnapshot['status'] = 'ready';
  let statusMessage: string | undefined;
  let writeTail = Promise.resolve();
  let generation = 0;
  let sequence = 0;
  const prefix = `source-draft/${encodeURIComponent(siteId)}/`;
  const keyFor = (projectId: string, path: string) =>
    `${prefix}${encodeURIComponent(projectId)}/${encodeURIComponent(path)}`;

  function publish() {
    const current = runtime.getSnapshot();
    const source = current.source;
    const files =
      source === undefined
        ? []
        : Object.entries(source.project.files).map(([modulePath, file]) => {
            const draft = drafts.get(keyFor(source.projectId, modulePath));
            return draft === undefined
              ? {
                  projectId: source.projectId,
                  modulePath,
                  projectRevision: source.project.revision,
                  expectedFileHash: codeFileHash(file),
                  file,
                  dirty: false,
                }
              : {
                  ...draft,
                  dirty: draft.file.source !== file.source || draft.file.language !== file.language,
                };
          });
    const activeFile =
      files.find(({ modulePath }) => modulePath === activePath) ??
      files.find(({ modulePath }) => modulePath === source?.entry) ??
      files[0] ??
      null;
    activePath = activeFile?.modulePath;
    const selection = current.selection;
    state = {
      pageId: source?.pageId ?? '',
      files,
      activeFile,
      selectedSource:
        selection === undefined
          ? null
          : { handle: selection.handle, from: selection.start, to: selection.end },
      diagnostics: [],
      completions: [],
      diff: activeFile?.dirty
        ? {
            id: keyFor(activeFile.projectId, activeFile.modulePath),
            original: source?.project.files[activeFile.modulePath]?.source ?? '',
            label: activeFile.modulePath,
          }
        : null,
      impact: null,
      impactStale: activeFile !== null && activeFile.projectRevision !== source?.project.revision,
      status,
      ...(statusMessage === undefined ? {} : { statusMessage }),
    };
    for (const listener of listeners) listener();
  }

  async function restore(projectId: string) {
    if (loaded.has(projectId)) return;
    loaded.add(projectId);
    const ownGeneration = generation;
    try {
      const keys = await store.keys(`${prefix}${encodeURIComponent(projectId)}/`);
      for (const key of keys) {
        const candidate = draftSchema.safeParse(await store.get<unknown>(key));
        if (ownGeneration !== generation) return;
        if (
          !candidate.success ||
          candidate.data.projectId !== projectId ||
          key !== keyFor(projectId, candidate.data.modulePath) ||
          drafts.has(key)
        )
          continue;
        drafts.set(key, candidate.data);
      }
      publish();
    } catch (error) {
      status = 'error';
      statusMessage = message(error);
      publish();
    }
  }

  function refresh() {
    publish();
    const projectId = runtime.getSnapshot().source?.projectId;
    if (projectId !== undefined) void restore(projectId);
  }

  function updateDraft(input: CodeWorkspaceDraftInput) {
    const source = runtime.getSnapshot().source;
    if (
      source?.projectId !== input.projectId ||
      !Object.hasOwn(source.project.files, input.modulePath)
    )
      return;
    const key = keyFor(input.projectId, input.modulePath);
    const draft = draftSchema.parse(input);
    drafts.set(key, draft);
    status = 'saving';
    statusMessage = 'Saving source draft…';
    publish();
    const ownSequence = ++sequence;
    writeTail = writeTail
      .then(async () => {
        const ack = vaultWriteAcknowledgement(
          store,
          await store.set(key, draft, ownSequence),
          ownSequence,
        );
        if (sequence !== ownSequence) return;
        status = ack.kind === 'durable' ? 'saved' : ack.kind === 'failed' ? 'error' : 'ready';
        statusMessage =
          ack.kind === 'durable'
            ? 'Draft saved to this device. Apply it to update the page.'
            : ack.kind === 'session-only'
              ? 'Draft is kept for this session only. Persistent storage is unavailable.'
              : ack.reason;
        publish();
      })
      .catch((error: unknown) => {
        status = 'error';
        statusMessage = message(error);
        publish();
      });
  }

  async function saveDraft(input: CodeWorkspaceDraftInput) {
    try {
      const project = kernel.getSite().codeProjects?.[input.projectId];
      if (project?.revision !== input.projectRevision)
        throw new Error(
          'The project changed. Your draft is preserved; review it against the current source.',
        );
      kernel.dispatch(
        'applyCodeChanges',
        {
          projectId: input.projectId,
          expectedProjectRevision: input.projectRevision,
          changes: [
            { path: input.modulePath, expectedHash: input.expectedFileHash, file: input.file },
          ],
          attribution: { author: 'user' },
        },
        'user',
      );
      // Keep the recovery draft until the matching kernel source has actually been stored.
      await kernel.flush();
      const key = keyFor(input.projectId, input.modulePath);
      await writeTail;
      const latestDraft = drafts.get(key);
      if (
        latestDraft?.file.source === input.file.source &&
        latestDraft.file.language === input.file.language
      ) {
        const ack = vaultWriteAcknowledgement(store, await store.remove(key), sequence);
        if (ack.kind === 'failed') throw new Error(ack.reason);
        drafts.delete(key);
      }
      status = 'ready';
      statusMessage = 'Source applied. Preview and storage report their own status.';
      publish();
    } catch (error) {
      status = 'error';
      statusMessage = message(error);
      publish();
    }
  }

  const port: CodeWorkspacePort = {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    selectFile: (path) => {
      activePath = path;
      publish();
    },
    updateDraft,
    saveDraft,
    approveDiff: (input) => saveDraft(input),
    rejectDiff: (key) => {
      const draft = drafts.get(key);
      if (draft === undefined) return;
      writeTail = writeTail
        .then(async () => {
          const ack = vaultWriteAcknowledgement(store, await store.remove(key), sequence);
          if (ack.kind === 'failed') throw new Error(ack.reason);
          if (drafts.get(key) === draft) drafts.delete(key);
          status = 'ready';
          statusMessage = undefined;
          publish();
        })
        .catch((error: unknown) => {
          status = 'error';
          statusMessage = message(error);
          publish();
        });
    },
    refreshImpact: () => { publish(); },
    navigateToSource: (handle) => {
      const source = runtime.getSnapshot().source;
      if (
        handle.projectId !== source?.projectId ||
        handle.sourceRevision !== source.project.revision
      )
        return;
      activePath = handle.modulePath;
      publish();
    },
  };
  publish();
  return {
    port,
    start: () => {
      const unsubscribe = runtime.subscribe(refresh);
      refresh();
      return () => {
        unsubscribe();
        generation += 1;
        loaded.clear();
      };
    },
    flushDrafts: () => writeTail,
  };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Source draft could not be stored.';
}
