import type { BuilderKernel } from '@craftkit/builder-core';
import {
  // ── block-parts (2026-10-06) ──
  bindPathOf,
  blockPartsOf,
  formatPropPath,
  getAtPropPath,
  parsePropPath,
  type PartRef,
  // ── /block-parts ──
  type NodeId,
} from '@craftkit/builder-schema';

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
  /** The TOP-LEVEL prop holding the edited value (for a part: its bind's first key). */
  propKey: string;
  kind: 'text' | 'rich';
  // ── block-parts (2026-10-06) ──
  /**
   * Set only for a block-part session (DESIGN §2.8): the formatted bind path
   * of the edited value (`heading`, `items.2.title`, a link's text path).
   * NodeView swaps the editor in at this path; the canvas commits through
   * `partInlineCommit`. Absent for the legacy `inlineEditable` session.
   */
  bind?: string;
  /** The part instance being edited; set together with `bind`. */
  part?: PartRef;
  /** Plain-text parts: `!decl.multiline` (Enter commits; Shift+Enter inserts `\n` when false). */
  singleLine?: boolean;
  // ── /block-parts ──
}

export interface InlineSessionHandle {
  /** The open session, or null. */
  current: () => InlineSession | null;
  /**
   * Open a session. Returns false when the node is gone or the block declares
   * nothing inline-editable — the gesture is simply inert, never an error.
   *
   * With a part `ref` (block-parts), the kind comes from the part's
   * declaration — `rich` edits as rich text, `text` and `link` (its visible
   * label) as plain text — and the session carries the part's bind path.
   * Image, list, item and box parts, an undeclared part, or an instance whose
   * value is absent return false. The same ref twice is idempotent; another
   * ref replaces the session.
   */
  begin: (nodeId: NodeId, ref?: PartRef) => boolean;
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

// ── block-parts (2026-10-06) ──
/** A block part resolved to an inline session, or null when it is not text-editable. */
export function partInlineTargetOf(
  kernel: BuilderKernel,
  nodeId: NodeId,
  ref: PartRef,
): Required<Pick<InlineSession, 'propKey' | 'kind' | 'bind' | 'part' | 'singleLine'>> | null {
  const node = kernel.getDocument().nodes[nodeId];
  if (node === undefined) {
    return null;
  }
  const decl = blockPartsOf(kernel.context.registry.block(node.type)?.schema)[ref.part];
  if (decl === undefined) {
    return null;
  }
  const kind = decl.kind === 'rich' ? 'rich' : decl.kind === 'text' || decl.kind === 'link' ? 'text' : null;
  if (kind === null) {
    return null; // image → asset picker; list/item/box hold no editable text
  }
  // A link edits its visible label inline; its href belongs to the Link popover.
  const path = bindPathOf(decl, ref.index, 'text');
  const propKey = path?.[0];
  if (path === undefined || typeof propKey !== 'string') {
    return null;
  }
  if (getAtPropPath(node.props, path) === undefined) {
    return null; // the instance is not there (a cleared optional, a removed item)
  }
  return {
    propKey,
    kind,
    bind: formatPropPath(path),
    part: { part: ref.part, index: [...ref.index] },
    singleLine: decl.multiline !== true,
  };
}

function samePart(a: PartRef, b: PartRef): boolean {
  return (
    a.part === b.part &&
    a.index.length === b.index.length &&
    a.index.every((at, position) => at === b.index[position])
  );
}
// ── /block-parts ──

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
    const node = state.doc.nodes[session.nodeId];
    const stillThere = node !== undefined;
    const stillSelected = state.selection[0] === session.nodeId;
    if (!stillThere || !stillSelected) {
      end();
      return;
    }
    // ── block-parts (2026-10-06) ──
    const part = session.part;
    if (part === undefined || session.bind === undefined) {
      return;
    }
    // Part focus moved to ANOTHER part (of this node or another): this edit is
    // over. A null part focus is not a move — it never ends the session.
    const focus = state.partFocus;
    if (focus !== null && focus !== undefined && (focus.id !== session.nodeId || !samePart(focus, part))) {
      end();
      return;
    }
    // The edited instance vanished beneath the caret (an undo removed the
    // item, an optional prop was cleared): nothing left to edit.
    if (getAtPropPath(node.props, parsePropPath(session.bind)) === undefined) {
      end();
    }
    // ── /block-parts ──
  });

  return {
    current: () => session,
    begin: (nodeId, ref) => {
      // ── block-parts (2026-10-06) ──
      if (ref !== undefined) {
        const partTarget = partInlineTargetOf(kernel, nodeId, ref);
        if (partTarget === null) {
          return false;
        }
        if (
          session?.nodeId === nodeId &&
          session.part !== undefined &&
          samePart(session.part, partTarget.part)
        ) {
          return true; // idempotent: the same part twice is one session
        }
        session = { nodeId, ...partTarget };
        emit();
        return true;
      }
      // ── /block-parts ──
      const target = inlineTargetOf(kernel, nodeId);
      if (target === null) {
        return false;
      }
      if (
        session !== null &&
        session.nodeId === nodeId &&
        session.propKey === target.propKey &&
        session.part === undefined
      ) {
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
