import type { BuilderKernel } from '@craftkit/builder-core';
import type { NodeId } from '@craftkit/builder-schema';

/**
 * The inline editing session (009 contract §3).
 *
 * VIEW state, never document state: entering and leaving an edit dispatch
 * NOTHING. The session exists to answer one question for the canvas and the
 * toolbars — "which node's which property is open, and as what kind?" — and to
 * guarantee it ends cleanly in every path a real editor hits: Escape, selecting
 * something else, and the node disappearing beneath the caret (an undo, a
 * collaborator, another surface).
 */
export interface InlineSession {
  nodeId: NodeId;
  propKey: string;
  kind: 'text' | 'rich';
}

export interface InlineSessionHandle {
  /** The open session, or null. */
  current: () => InlineSession | null;
  /**
   * Open a session. Returns false when the node is gone or the block declares
   * nothing inline-editable — the gesture is simply inert, never an error.
   */
  begin: (nodeId: NodeId) => boolean;
  /** Close the session; idempotent, and never dispatches. */
  end: () => void;
  /** Consume one Escape layer in popup → text edit → parent → clear order. */
  escape: (layers: InlineEscapeLayers) => InlineEscapeStep;
  /** Notified on every change, with the new session (or null). */
  subscribe: (listener: (session: InlineSession | null) => void) => () => void;
  /** Detach the store subscription. */
  dispose: () => void;
}

export type InlineEscapeStep = 'popup' | 'text-edit' | 'parent' | 'clear' | 'none';

export interface InlineEscapeLayers {
  closePopup: () => boolean;
  selectParent: () => boolean;
  clearSelection: () => boolean;
}

/** What a block declares as inline-editable, resolved to a kind. */
export function inlineTargetOf(
  kernel: BuilderKernel,
  nodeId: NodeId,
): { propKey: string; kind: 'text' | 'rich' } | null {
  const node = kernel.getDocument().nodes[nodeId];
  if (node === undefined) {
    return null;
  }
  const schema = kernel.context.registry.block(node.type)?.schema;
  const propKey = schema?.inlineEditable;
  if (schema === undefined || propKey === undefined) {
    return null;
  }
  const shape = (schema.props._zod.def as { shape?: Record<string, { _zod: { def: unknown } }> })
    .shape;
  const declared = shape?.[propKey];
  if (declared === undefined) {
    return null;
  }
  // Rich text is declared by marker; everything else that survived the schema's
  // registration-time gate is plain text.
  const isRich = isRichTextDeclaration(declared as { meta?: () => Record<string, unknown> });
  return { propKey, kind: isRich ? 'rich' : 'text' };
}

function isRichTextDeclaration(schema: {
  meta?: () => Record<string, unknown> | undefined;
  _zod?: { def: { type: string; innerType?: unknown } };
}): boolean {
  let current = schema;
  for (;;) {
    if (current.meta?.()?.['craftkit'] === 'rich-text') {
      return true;
    }
    const def = current._zod?.def;
    if (def === undefined) {
      return false;
    }
    const isWrapper = def.type === 'optional' || def.type === 'default' || def.type === 'nullable';
    if (!isWrapper || def.innerType === undefined) {
      return false;
    }
    current = def.innerType as typeof current;
  }
}

/**
 * Every DECLARED kind is editable, so the only thing that makes a gesture inert
 * is a block declaring nothing: the canvas ships a built-in surface for both
 * kinds — plain text, and engine-free rich text with bold/italic over a real
 * selection (009 §15). A contributed editor (§11) still wins where an extension
 * registers one, and because that contribution is lazy, resolving it never
 * loads an editing engine (the containment law).
 */
export function createInlineSession(kernel: BuilderKernel): InlineSessionHandle {
  let session: InlineSession | null = null;
  const listeners = new Set<(next: InlineSession | null) => void>();

  const emit = () => {
    for (const listener of [...listeners]) {
      listener(session);
    }
  };

  const end = () => {
    if (session === null) {
      return;
    }
    session = null;
    emit();
  };

  // s2 — the node can vanish beneath the caret (undo, a collaborator, another
  // surface). The session closes itself; the kernel prunes the selection as it
  // already does. Nothing is committed on the way out.
  const offStore = kernel.context.store.subscribe((state) => {
    if (session === null) {
      return;
    }
    const stillThere = state.doc.nodes[session.nodeId] !== undefined;
    const stillSelected = state.selection[0] === session.nodeId;
    if (!stillThere || !stillSelected) {
      end();
    }
  });

  return {
    current: () => session,
    begin: (nodeId) => {
      const target = inlineTargetOf(kernel, nodeId);
      if (target === null) {
        return false;
      }
      if (session !== null && session.nodeId === nodeId && session.propKey === target.propKey) {
        return true; // idempotent: a second double-click is not a second session
      }
      session = { nodeId, propKey: target.propKey, kind: target.kind };
      emit();
      return true;
    },
    end,
    escape: ({ closePopup, selectParent, clearSelection }) => {
      if (closePopup()) return 'popup';
      if (session !== null) {
        end();
        return 'text-edit';
      }
      if (selectParent()) return 'parent';
      return clearSelection() ? 'clear' : 'none';
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      offStore();
      listeners.clear();
      session = null;
    },
  };
}
