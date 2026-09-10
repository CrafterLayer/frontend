import {
  createSelectionController,
  type BuilderKernel,
  type SelectionCapability,
  type SelectionController,
  type SelectionIdentityResolver,
  type SelectionSnapshot,
  type SelectionTarget,
} from '@craftkit/builder';

export type PreviewSelectionOrigin =
  'canvas' | 'layers' | 'inspector' | 'breadcrumb' | 'toolbar' | 'agent' | 'insert' | 'kernel';

export interface SelectionRevealRequest {
  readonly nonce: number;
  readonly target: SelectionTarget;
}

export interface PreviewSelectionSnapshot extends SelectionSnapshot {
  readonly origin: PreviewSelectionOrigin;
  readonly reveal?: SelectionRevealRequest;
}

export interface PreviewSelectionStore {
  getSnapshot(): PreviewSelectionSnapshot;
  subscribe(listener: () => void): () => void;
  select(origin: PreviewSelectionOrigin, targets: readonly SelectionTarget[]): boolean;
  selectParent(): boolean;
  reconcile(): boolean;
  setPage(pageId: string): void;
  clear(origin: PreviewSelectionOrigin): void;
  captureForAgent(): readonly SelectionTarget[];
  revealAfterInsert(target: SelectionTarget): boolean;
  connectKernel(options: {
    readonly kernel: BuilderKernel;
    readonly pageId: string;
    readonly revision: () => string;
    readonly capabilitiesFor?: ((nodeId: string) => readonly SelectionCapability[]) | undefined;
  }): () => void;
}

function defaultNodeCapabilities(kernel: BuilderKernel, nodeId: string): SelectionCapability[] {
  const document = kernel.getDocument();
  const node = document.nodes[nodeId];
  if (node === undefined) return [];
  const schema = kernel.context.registry.block(node.type)?.schema;
  const isRoot = nodeId === document.rootId;
  return [
    'inspect',
    ...(schema?.inlineEditable === undefined ? [] : (['editText'] as const)),
    'editProps',
    ...(isRoot ? [] : (['duplicate', 'move', 'delete'] as const)),
    ...(schema?.slots === undefined ? [] : (['insertInside'] as const)),
  ];
}

/**
 * App composition for the shell controller. Every preview surface writes through this object;
 * native kernels are bridged bidirectionally so existing Canvas/Layers/Inspector consumers share it.
 */
export function createPreviewSelectionStore(options: {
  readonly pageId: string;
  readonly resolver: SelectionIdentityResolver;
}): PreviewSelectionStore {
  const controller: SelectionController = createSelectionController(options);
  let origin: PreviewSelectionOrigin = 'canvas';
  let reveal: SelectionRevealRequest | undefined;
  let revealNonce = 0;
  let snapshot: PreviewSelectionSnapshot = { ...controller.getSnapshot(), origin };
  const listeners = new Set<() => void>();

  const updateSnapshot = () => {
    snapshot = {
      ...controller.getSnapshot(),
      origin,
      ...(reveal === undefined ? {} : { reveal }),
    };
    for (const listener of [...listeners]) listener();
  };
  controller.subscribe(updateSnapshot);

  const store: PreviewSelectionStore = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    select(nextOrigin, targets) {
      origin = nextOrigin;
      reveal = undefined;
      const before = controller.getSnapshot();
      const result = controller.select(targets);
      if (controller.getSnapshot() === before) updateSnapshot();
      return result.targets.length === targets.length;
    },
    selectParent() {
      origin = 'breadcrumb';
      reveal = undefined;
      const before = controller.getSnapshot();
      const changed = controller.selectParent();
      if (controller.getSnapshot() === before) updateSnapshot();
      return changed;
    },
    reconcile() {
      const before = controller.getSnapshot().targets.length;
      const result = controller.reconcile();
      return result.targets.length === before && result.invalidReason === undefined;
    },
    setPage(pageId) {
      origin = 'canvas';
      reveal = undefined;
      controller.setPage(pageId);
    },
    clear(nextOrigin) {
      origin = nextOrigin;
      reveal = undefined;
      controller.clear();
    },
    captureForAgent: () => controller.capture(),
    revealAfterInsert(target) {
      origin = 'insert';
      const result = controller.select([target]);
      const current = result.targets[0];
      if (current === undefined) return false;
      revealNonce += 1;
      reveal = { nonce: revealNonce, target: current };
      updateSnapshot();
      return true;
    },
    connectKernel({ kernel, pageId, revision, capabilitiesFor }) {
      let writingKernel = false;
      let writingStore = false;
      const capabilities = (nodeId: string) => [
        ...(capabilitiesFor?.(nodeId) ?? defaultNodeCapabilities(kernel, nodeId)),
      ];
      const readKernel = () => {
        if (writingKernel) return;
        writingStore = true;
        const targets: SelectionTarget[] = kernel.context.store
          .getState()
          .selection.map((nodeId) => ({
            pageId,
            sourceOrNodeId: nodeId,
            revision: revision(),
            capabilities: capabilities(nodeId),
          }));
        store.select('kernel', targets);
        writingStore = false;
      };
      const offKernel = kernel.context.store.subscribe(readKernel);
      const offStore = store.subscribe(() => {
        if (writingStore || store.getSnapshot().pageId !== pageId) return;
        const identities = store.getSnapshot().targets.map((target) => target.sourceOrNodeId);
        if (!identities.every((identity): identity is string => typeof identity === 'string'))
          return;
        const current = kernel.context.store.getState().selection;
        if (
          current.length === identities.length &&
          current.every((nodeId, index) => nodeId === identities[index])
        ) {
          return;
        }
        writingKernel = true;
        kernel.setSelection(identities);
        writingKernel = false;
      });
      readKernel();
      return () => {
        offKernel();
        offStore();
      };
    },
  };
  return store;
}
