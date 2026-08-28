import type { BuilderKernel, CodeViewKernel } from '@craftkit/builder';

export interface CodeViewKernelAdapterHandle {
  readonly adapter: CodeViewKernel;
  dispose(): void;
}

type CodeViewKernelSnapshot = ReturnType<CodeViewKernel['getSnapshot']>;

function sameBlockTypes(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((type, index) => type === right[index]);
}

/**
 * Revisions are GLOBAL, not per-adapter. To the worker client a revision
 * identifies a document STATE, and it fails closed when one revision arrives
 * twice with different payloads. An adapter that restarted its own counter at 0
 * — which every reopen of the code view creates — would offer revision 0 for a
 * document the previous adapter had already sent revision 0 for, killing the
 * shared client. Counting here instead of per instance keeps that impossible.
 */
let nextRevision = 0;

/**
 * Bridges the playground kernel to the deliberately narrow code-view port.
 * Store notifications always fan out so selection scope remains live, but a
 * worker revision advances only when the document identity or registered block
 * vocabulary changes. Extension lifecycle events refresh that vocabulary even
 * when registration does not write to the store.
 */
export function createCodeViewKernelAdapter(kernel: BuilderKernel): CodeViewKernelAdapterHandle {
  nextRevision += 1;
  let revision = nextRevision;
  let disposed = false;
  const listeners = new Set<() => void>();
  const readBlockTypes = (): string[] => {
    return kernel.context.registry.blocks().map((block) => block.schema.type);
  };
  const initialState = kernel.context.store.getState();
  let snapshot: CodeViewKernelSnapshot = {
    document: initialState.doc,
    selection: initialState.selection,
    revision,
    blockTypes: readBlockTypes(),
  };

  const notifyListeners = (): void => {
    for (const listener of [...listeners]) {
      listener();
    }
  };

  const refreshSnapshot = (): boolean => {
    const state = kernel.context.store.getState();
    const blockTypes = readBlockTypes();
    const documentChanged = !Object.is(snapshot.document, state.doc);
    const vocabularyChanged = !sameBlockTypes(snapshot.blockTypes, blockTypes);
    const selectionChanged = !Object.is(snapshot.selection, state.selection);
    const revisionChanged = documentChanged || vocabularyChanged;

    if (revisionChanged) {
      nextRevision += 1;
      revision = nextRevision;
    }
    if (revisionChanged || selectionChanged) {
      snapshot = {
        document: state.doc,
        selection: state.selection,
        revision,
        blockTypes,
      };
    }
    return revisionChanged;
  };

  const unsubscribeStore = kernel.context.store.subscribe(() => {
    refreshSnapshot();
    notifyListeners();
  });
  const refreshVocabulary = (): void => {
    if (refreshSnapshot()) {
      notifyListeners();
    }
  };
  const unsubscribeRegistered = kernel.context.events.on('extension.registered', refreshVocabulary);
  const unsubscribeDisposed = kernel.context.events.on('extension.disposed', refreshVocabulary);

  return {
    adapter: {
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      getSnapshot: () => snapshot,
      dispatch: (patches) => {
        kernel.dispatch('applyPatches', { patches: [...patches] });
      },
    },
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      listeners.clear();
      unsubscribeStore();
      unsubscribeRegistered();
      unsubscribeDisposed();
    },
  };
}
