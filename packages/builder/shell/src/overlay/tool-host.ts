import type { BuilderKernel } from '@craftkit/builder-core';
import type {
  KernelApi,
  NodeId,
  OverlayToolDef,
  OverlayToolRenderer,
} from '@craftkit/builder-schema';

import type { NodeRect, RectIndex } from '../rects';

/** Concretization of the B0 OverlayToolRenderer target (005 contract §3). */
export interface CanvasToolTarget {
  nodeId: NodeId;
  rect: NodeRect;
  /** The chrome layer; tools mount here, never into the frame document. */
  layer: HTMLElement;
  ctx: KernelApi;
}

/**
 * Authoring helper (variance erasure, the defineCommand pattern): tool authors
 * write against the concrete CanvasToolTarget; the stored OverlayToolDef keeps
 * the schema's deliberately-abstract target. One cast, here, forever.
 */
export function defineCanvasTool(definition: {
  id: string;
  on: OverlayToolDef['on'];
  order?: number;
  mount: (target: CanvasToolTarget) => Cleanup;
}): OverlayToolDef {
  return {
    id: definition.id,
    on: definition.on,
    ...(definition.order === undefined ? {} : { order: definition.order }),
    // The single un-erasure boundary: concrete target in, abstract stored form out.
    load: () => Promise.resolve({ default: definition.mount as unknown as OverlayToolRenderer }),
  };
}

export interface ToolHost {
  notifySelection(id: NodeId | null): void;
  notifyHover(id: NodeId | null): void;
  /** Mounts 'always' tools for the document root; call once when the canvas is ready. */
  start(): void;
  dispose(): void;
}

type Activation = 'selection' | 'hover' | 'always';
type Cleanup = () => void;

const ZERO_RECT = { x: 0, y: 0, width: 0, height: 0, version: -1 };

/**
 * First consumer of the B0 canvasTools contribution point (005 contract §5).
 * Guarantees: g1 lazy cached load per tool id; g2 every successful mount's
 * cleanup runs exactly once (target change, activation end, registry change,
 * dispose — whichever first); g3 a load rejection or mount throw is contained
 * via onToolError and never breaks built-in chrome or other tools; g4 tools
 * receive the chrome layer, never the frame. 'drag' registers but never fires
 * in B2a.
 */
export function createToolHost(options: {
  kernel: BuilderKernel;
  index: RectIndex;
  layer: HTMLElement;
  onToolError?: ((toolId: string, error: unknown) => void) | undefined;
}): ToolHost {
  const { kernel, index, layer } = options;
  const onToolError =
    options.onToolError ??
    ((toolId: string, error: unknown) => {
      console.error(`[builder-shell] canvas tool "${toolId}" failed`, error);
    });

  const loads = new Map<string, Promise<{ default: OverlayToolRenderer }>>();
  const slots: Record<
    Activation,
    { target: NodeId | null; generation: number; cleanups: Cleanup[] }
  > = {
    selection: { target: null, generation: 0, cleanups: [] },
    hover: { target: null, generation: 0, cleanups: [] },
    always: { target: null, generation: 0, cleanups: [] },
  };
  let disposed = false;

  const runCleanups = (slot: (typeof slots)[Activation]) => {
    const pending = slot.cleanups.splice(0);
    for (const cleanup of pending) {
      try {
        cleanup();
      } catch (error) {
        onToolError('cleanup', error);
      }
    }
  };

  const targetFor = (nodeId: NodeId): CanvasToolTarget => ({
    nodeId,
    rect: index.rect(nodeId) ?? { nodeId, ...ZERO_RECT },
    layer,
    ctx: kernel.context,
  });

  const mountSlot = (activation: Activation, nodeId: NodeId | null) => {
    const slot = slots[activation];
    slot.generation += 1;
    const generation = slot.generation;
    runCleanups(slot);
    slot.target = nodeId;
    if (nodeId === null || disposed) {
      return;
    }
    const tools = kernel.context.registry.canvasTools().filter((tool) => tool.on === activation);
    for (const tool of tools) {
      mountTool(tool, nodeId, slot, generation);
    }
  };

  const mountTool = (
    tool: OverlayToolDef,
    nodeId: NodeId,
    slot: (typeof slots)[Activation],
    generation: number,
  ) => {
    let load = loads.get(tool.id);
    if (load === undefined) {
      load = tool.load();
      loads.set(tool.id, load);
    }
    load
      .then((loaded) => {
        if (disposed || slot.generation !== generation) {
          return; // the activation moved on while the tool was loading
        }
        try {
          slot.cleanups.push(loaded.default(targetFor(nodeId)));
        } catch (error) {
          onToolError(tool.id, error);
        }
      })
      .catch((error: unknown) => {
        loads.delete(tool.id); // allow a retry on the next activation
        onToolError(tool.id, error);
      });
  };

  const remountAll = () => {
    // Registry changed (runtime registration/disposal — FR-013): re-derive every
    // active slot from the fresh catalog.
    for (const activation of ['selection', 'hover', 'always'] as const) {
      const current = slots[activation].target;
      mountSlot(activation, current);
    }
  };
  const offRegistered = kernel.context.events.on('extension.registered', remountAll);
  const offDisposed = kernel.context.events.on('extension.disposed', remountAll);

  /**
   * A target id can stay identical while its NODE disappears (an undo removing
   * the selected node). An id-equality gate alone would leave tool chrome
   * orphaned at a stale position — the built-in outline self-heals because it
   * re-derives from the rect index every flush, and tools must behave the same.
   */
  const liveTarget = (id: NodeId | null): NodeId | null =>
    id !== null && kernel.getDocument().nodes[id] !== undefined ? id : null;

  const notify = (activation: 'selection' | 'hover', id: NodeId | null) => {
    const next = liveTarget(id);
    if (slots[activation].target !== next) {
      mountSlot(activation, next);
    }
  };

  return {
    notifySelection(id) {
      notify('selection', id);
    },
    notifyHover(id) {
      notify('hover', id);
    },
    start() {
      mountSlot('always', kernel.getDocument().rootId);
    },
    dispose() {
      offRegistered();
      offDisposed();
      for (const activation of ['selection', 'hover', 'always'] as const) {
        slots[activation].generation += 1;
        runCleanups(slots[activation]);
      }
      disposed = true;
    },
  };
}
