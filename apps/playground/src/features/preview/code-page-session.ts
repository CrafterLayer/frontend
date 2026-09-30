import type { BuilderSiteKernel } from '@craftkit/builder';
import type {
  PreviewEnvelope,
  RuntimeSnapshot,
  SourceElement,
} from '@craftkit/builder/code-runtime';

import {
  runtimeSnapshotFromSite,
  type CodeRuntimeClient,
  type CompiledCodePage,
  type ExportedCodePage,
} from './code-runtime-client';
import { prepareStaticTextChange, staticTextValue } from './source-text-edit';

export interface CodePageSessionState {
  readonly source: RuntimeSnapshot | undefined;
  readonly compiled: CompiledCodePage | undefined;
  readonly status: 'unavailable' | 'loading' | 'ready' | 'error';
  readonly message: string | undefined;
  readonly selection: SourceElement | undefined;
  readonly text: string;
  readonly exporting: boolean;
}

export interface CodePageSessionOptions {
  readonly kernel: BuilderSiteKernel;
  readonly client?: CodeRuntimeClient | undefined;
  readonly editing: boolean;
  readonly exporting: boolean;
  readonly publishedOrigin?: string | undefined;
}

/**
 * Owns derived build/selection state only. The kernel remains the sole source store.
 * Every asynchronous operation has a lease; abort is never the sole stale-result guard.
 */
export function createCodePageSession(options: CodePageSessionOptions) {
  const { kernel, client } = options;
  const listeners = new Set<() => void>();
  const cache = new Map<string, CompiledCodePage>();
  let unsubscribe: (() => void) | undefined;
  let lease = 0;
  let compileAbort: AbortController | undefined;
  let exportAbort: AbortController | undefined;
  let state: CodePageSessionState = {
    source: readSource(),
    compiled: undefined,
    status: 'unavailable',
    message: undefined,
    selection: undefined,
    text: '',
    exporting: false,
  };

  function readSource() {
    return runtimeSnapshotFromSite(kernel.getSite(), kernel.currentPage());
  }

  function publish(next: Partial<CodePageSessionState>) {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  }

  function cancelPending() {
    lease += 1;
    compileAbort?.abort();
    exportAbort?.abort();
    compileAbort = undefined;
    exportAbort = undefined;
  }

  async function rebuild() {
    cancelPending();
    const source = readSource();
    const previous = samePage(source, state.source) ? state.compiled : undefined;
    publish({ source, compiled: previous, selection: undefined, text: '', exporting: false });
    if (source === undefined || client === undefined) {
      publish({
        status: 'unavailable',
        message:
          source === undefined ? undefined : 'Configure the code runtime to preview this page.',
      });
      return;
    }
    const key = sourceKey(source);
    const cached = cache.get(key);
    if (cached !== undefined) {
      publish({ compiled: cached, status: 'ready', message: undefined });
      return;
    }
    const ownLease = lease;
    const controller = new AbortController();
    compileAbort = controller;
    publish({ status: 'loading', message: undefined });
    try {
      const result = await client.compile(source, controller.signal);
      if (lease !== ownLease || controller.signal.aborted || sourceKey(readSource()) !== key)
        return;
      if (!matchesSource(result, source))
        throw new Error('The compiler returned a different source revision.');
      cache.set(key, result);
      if (cache.size > 8) cache.delete(cache.keys().next().value ?? '');
      publish({ compiled: result, status: 'ready', message: undefined });
    } catch (error) {
      if (lease !== ownLease || controller.signal.aborted) return;
      publish({ status: 'error', message: reason(error, 'The code page did not compile.') });
    }
  }

  function refresh() {
    if (sourceKey(readSource()) !== sourceKey(state.source)) void rebuild();
  }

  function select(message: PreviewEnvelope) {
    if (message.type !== 'focus') return;
    const source = readSource();
    const compiled = state.compiled;
    if (source === undefined || compiled === undefined) return;
    if (
      message.projectId !== source.projectId ||
      message.pageId !== source.pageId ||
      message.artifactId !== compiled.artifact.artifactId
    )
      return;
    if (message.sourceRevision !== source.project.revision || !matchesSource(compiled, source)) {
      publish({
        selection: undefined,
        text: '',
        message: 'The preview shows an older revision. Rebuild before selecting.',
      });
      return;
    }
    const selection = compiled.sourceElements.find(
      ({ handle }) => handle.astNodeId === message.payload['astNodeId'],
    );
    if (selection === undefined) return;
    publish({ selection, text: staticTextValue(selection) ?? '', message: undefined });
  }

  function applyText() {
    if (!options.editing) return false;
    const source = readSource();
    if (source === undefined || state.selection === undefined) return false;
    try {
      const change = prepareStaticTextChange(source, state.selection, state.text);
      kernel.dispatch(
        'applyCodeChanges',
        {
          projectId: source.projectId,
          expectedProjectRevision: state.selection.handle.sourceRevision,
          changes: [change],
          attribution: { author: 'user' },
        },
        'user',
      );
      publish({ selection: undefined, text: '' });
      return true;
    } catch (error) {
      publish({ message: reason(error, 'The source edit was refused.') });
      return false;
    }
  }

  async function exportPage(): Promise<ExportedCodePage | undefined> {
    const source = readSource();
    const compiled = state.compiled;
    if (
      !options.exporting ||
      client === undefined ||
      source === undefined ||
      compiled === undefined ||
      state.exporting
    )
      return;
    if (!matchesSource(compiled, source)) {
      publish({ message: 'Build the current source revision before exporting.' });
      return;
    }
    const page = kernel.getSite().pages.find(({ id }) => id === source.pageId);
    if (page === undefined) return;
    const rootProps = page.document.nodes[page.document.rootId]?.props;
    const seo = rootProps?.['seo'];
    const metadata = seo !== null && typeof seo === 'object' && !Array.isArray(seo) ? seo : {};
    const direction = page.document.dir;
    const language = exportLanguage(rootProps?.['lang'], direction);
    const key = sourceKey(source);
    const ownLease = lease;
    const controller = new AbortController();
    exportAbort = controller;
    publish({ exporting: true, message: 'Preparing the selected revision for export.' });
    try {
      const result = await client.exportPage(
        {
          ...source,
          title: typeof metadata['title'] === 'string' ? metadata['title'] : page.title,
          description:
            typeof metadata['description'] === 'string' ? metadata['description'] : page.purpose,
          direction,
          language,
          ...(options.publishedOrigin === undefined
            ? {}
            : { canonicalUrl: new URL(page.address, options.publishedOrigin).href }),
        },
        compiled.artifact.artifactId,
        controller.signal,
      );
      if (lease !== ownLease || controller.signal.aborted || sourceKey(readSource()) !== key)
        return;
      publish({ exporting: false, message: `Exported ${String(result.files.length)} files.` });
      return result;
    } catch (error) {
      if (lease !== ownLease || controller.signal.aborted) return;
      publish({ exporting: false, message: reason(error, 'The export failed.') });
    }
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start: () => {
      unsubscribe?.();
      unsubscribe = kernel.subscribe(refresh);
      void rebuild();
      return () => {
        unsubscribe?.();
        unsubscribe = undefined;
        cancelPending();
      };
    },
    rebuild,
    select,
    setText: (text: string) => {
      publish({ text });
    },
    applyText,
    exportPage,
    report: (message: string) => {
      publish({ message });
    },
  };
}

export type CodePageSession = ReturnType<typeof createCodePageSession>;

function sourceKey(source: RuntimeSnapshot): string;
function sourceKey(source: RuntimeSnapshot | undefined): string | undefined;
function sourceKey(source: RuntimeSnapshot | undefined) {
  return source === undefined
    ? undefined
    : JSON.stringify([
        source.projectId,
        source.pageId,
        source.project.revision,
        source.entry,
        source.address,
        source.inputs,
      ]);
}

function samePage(left: RuntimeSnapshot | undefined, right: RuntimeSnapshot | undefined) {
  return left !== undefined && left.projectId === right?.projectId && left.pageId === right.pageId;
}

function matchesSource(compiled: CompiledCodePage, source: RuntimeSnapshot) {
  return (
    compiled.artifact.projectId === source.projectId &&
    compiled.artifact.pageId === source.pageId &&
    compiled.artifact.sourceRevision === source.project.revision
  );
}

function reason(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

const LANGUAGE_TAG = /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/u;

/**
 * The export's `<html lang>`: the page root's own `lang` when it is a valid tag,
 * otherwise the page's direction decides (an RTL page in this product is Arabic).
 * Without it every export — Arabic included — shipped as `lang="en"`.
 */
export function exportLanguage(lang: unknown, direction: 'ltr' | 'rtl'): string {
  if (typeof lang === 'string' && LANGUAGE_TAG.test(lang.trim())) return lang.trim();
  return direction === 'rtl' ? 'ar' : 'en';
}
