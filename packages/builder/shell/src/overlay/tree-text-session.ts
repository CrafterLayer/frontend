import type { BuilderKernel, GroupStep } from '@craftkit/builder-core';
import type { CustomCodeNode, TreeTextMark } from '@craftkit/builder-schema';

import { tryDispatchTreeEdits, type ElementTarget } from '../custom-code/element-target';

/*
  ── Inline text editing for tree elements (style-manager DESIGN.md §E, P7) ──

  Double-click (or Enter) on a text element inside a custom-code region opens
  it for typing IN PLACE: the element's own canvas DOM becomes
  `contenteditable="plaintext-only"`. Enter or blur commits ONE transaction
  (`patchTreeNode {text}`, labelled "Text · Heading …"); Escape cancels and
  leaves no trace.

  Why not mount InlineTextSurface here, as registered blocks do: a tree element
  is rendered by the CustomCode renderer, not by a block that can swap in an
  editing surface through the inline-edit seam, and portalling a second React
  root into an element React already owns would fight its reconciler. So the
  session applies the surface's laws to the element itself:

  1. React's DOM is put back EXACTLY as it was (the same text nodes, the same
     data) before the document is written, so React reconciles its own nodes
     and the new text arrives through the normal render — never a stale or
     detached text node.
  2. Every key the person types while editing stays in the element: arrows
     move the caret, never the canvas selection; Enter and Escape are the
     session's own.
  3. Nullish text is written as an absent text, never the string "null".

  A selected range can be formatted (bold, italic, underline, highlight, link,
  size, colour) through `format`, which writes any pending typing AND the mark
  (`formatTreeText`) as one transaction.
*/

/** Tags that hold no text of their own (void or media). */
const NO_TEXT_TAGS = new Set([
  'img',
  'input',
  'hr',
  'br',
  'video',
  'audio',
  'iframe',
  'source',
  'track',
  'picture',
  'select',
  'textarea',
  'svg',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'ellipse',
  'g',
  'use',
  'defs',
  'wbr',
  'col',
  'embed',
  'object',
  'area',
  'meta',
  'link',
]);

/** Whether a tree node can be edited as plain text in place: an element leaf that holds text. */
export function isTreeTextEditable(node: CustomCodeNode): boolean {
  if (node.kind !== 'element') return false;
  if ((node.children?.length ?? 0) > 0) return false;
  return !NO_TEXT_TAGS.has(node.tag);
}

export type TreeTarget = Extract<ElementTarget, { kind: 'tree' }>;

export interface TreeTextFormat {
  readonly mark: TreeTextMark;
  readonly className?: string | undefined;
  readonly href?: string | undefined;
  /** The history label's property part: "Bold". */
  readonly label: string;
}

export type TreeTextOutcome = 'committed' | 'unchanged' | 'cancelled' | 'rejected';

/** How the session ended: a key the person pressed, focus leaving, or a caller. */
export type TreeTextExit = 'keyboard' | 'blur' | 'api';

export interface TreeTextSessionOptions {
  readonly kernel: BuilderKernel;
  /** The element's canvas DOM (the one carrying `data-ck-path`). */
  readonly element: HTMLElement;
  readonly target: TreeTarget;
  /** The stored text when the session opened. */
  readonly storedText: string;
  /** The element's display name, for history labels. */
  readonly name: string;
  /** Called once when the session ends, however it ends. */
  readonly onEnd: (outcome: TreeTextOutcome, exit: TreeTextExit, message?: string) => void;
  /** The caret or selection moved inside the element (the bubble re-measures). */
  readonly onSelectionChange?: (() => void) | undefined;
}

export interface TreeTextSession {
  readonly target: TreeTarget;
  readonly element: HTMLElement;
  /** What the element shows now. */
  currentText(): string;
  /** Character offsets of a non-empty selection inside the element, else null. */
  selectionRange(): { readonly start: number; readonly end: number } | null;
  /** End the session, writing the text when it changed. */
  commit(): void;
  /** End the session without writing; the element shows its stored text again. */
  cancel(): void;
  /**
   * Mark the selected range: pending typing and the mark are ONE transaction,
   * then the session ends (the element now holds runs, not plain text).
   */
  format(
    format: TreeTextFormat,
    range?: { readonly start: number; readonly end: number } | null,
  ): { readonly ok: boolean; readonly message: string };
  /**
   * While suspended, losing focus does not commit — the link field in the
   * bubble takes focus to type an address, and the session must survive it.
   */
  suspendBlur(suspended: boolean): void;
  /** Put focus (and the caret) back into the element. */
  refocus(): void;
  isOpen(): boolean;
}

function shownText(element: HTMLElement): string {
  const rendered = (element as { innerText?: string }).innerText;
  return rendered ?? element.textContent;
}

function placeCaretAtEnd(element: HTMLElement): void {
  const doc = element.ownerDocument;
  const selection = doc.getSelection();
  if (selection === null) return;
  const range = doc.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Open an element for in-place typing. */
export function beginTreeTextEdit(options: TreeTextSessionOptions): TreeTextSession {
  const { kernel, element, target, storedText, name, onEnd, onSelectionChange } = options;
  const doc = element.ownerDocument;
  // (1) Snapshot React's nodes so they can be put back exactly.
  const originalChildren = Array.from(element.childNodes);
  const originalData = new Map<Node, string>();
  for (const child of originalChildren) {
    if (child.nodeType === 3) originalData.set(child, child.nodeValue ?? '');
  }
  const previousEditable = element.getAttribute('contenteditable');
  const initialShown = shownText(element);
  let open = true;
  let blurSuspended = false;

  const restoreDom = () => {
    element.replaceChildren(...originalChildren);
    for (const [node, data] of originalData) node.nodeValue = data;
    if (previousEditable === null) element.removeAttribute('contenteditable');
    else element.setAttribute('contenteditable', previousEditable);
    element.removeAttribute('data-bldr-inline-editing');
  };

  const detach = () => {
    element.removeEventListener('keydown', onKeyDown);
    element.removeEventListener('blur', onBlur);
    doc.removeEventListener('selectionchange', onSelection);
  };

  let exit: TreeTextExit = 'api';

  const finish = (steps: readonly GroupStep[], label: string): { ok: boolean; message: string } => {
    open = false;
    detach();
    // (1) React's DOM back first; then the write re-renders through React.
    restoreDom();
    if (steps.length === 0) {
      onEnd('unchanged', exit);
      return { ok: true, message: '' };
    }
    const result = tryDispatchTreeEdits(kernel, steps, `${label} · ${name}`);
    if (!result.ok) {
      onEnd('rejected', exit, result.message);
      return { ok: false, message: result.message };
    }
    onEnd('committed', exit);
    return { ok: true, message: '' };
  };

  const textStep = (text: string): GroupStep => ({
    command: 'patchTreeNode',
    // (3) An emptied element stores no text at all.
    args: { id: target.nodeId, path: [...target.path], set: { text: text === '' ? null : text } },
  });

  const session: TreeTextSession = {
    target,
    element,
    currentText: () => shownText(element),
    selectionRange: () => {
      const selection = doc.getSelection();
      if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) return null;
      const range = selection.getRangeAt(0);
      if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return null;
      const before = doc.createRange();
      before.selectNodeContents(element);
      before.setEnd(range.startContainer, range.startOffset);
      const start = before.toString().length;
      const end = start + range.toString().length;
      return end > start ? { start, end } : null;
    },
    commit: () => {
      if (!open) return;
      const text = shownText(element);
      finish(text === initialShown ? [] : [textStep(text)], 'Text');
    },
    cancel: () => {
      if (!open) return;
      open = false;
      detach();
      restoreDom();
      onEnd('cancelled', exit);
    },
    format: (format, given) => {
      if (!open) return { ok: false, message: 'The text is no longer open for editing' };
      const range = given ?? session.selectionRange();
      if (range === null) return { ok: false, message: 'Select some text first' };
      const text = shownText(element);
      const steps: GroupStep[] = [];
      // Offsets are read in what the element SHOWS; when that differs from the
      // stored text (typing, or collapsed whitespace) the shown text is
      // written first so the offsets mean the same characters.
      if (text !== storedText) steps.push(textStep(text));
      steps.push({
        command: 'formatTreeText',
        args: {
          id: target.nodeId,
          path: [...target.path],
          start: range.start,
          end: range.end,
          mark: format.mark,
          ...(format.className === undefined ? {} : { className: format.className }),
          ...(format.href === undefined ? {} : { href: format.href }),
        },
      });
      return finish(steps, format.label);
    },
    suspendBlur: (suspended) => {
      blurSuspended = suspended;
    },
    refocus: () => {
      if (!open) return;
      element.focus({ preventScroll: true });
    },
    isOpen: () => open,
  };

  // (2) Every key stays in the element while it is being edited.
  function onKeyDown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      exit = 'keyboard';
      session.cancel();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      exit = 'keyboard';
      session.commit();
    }
  }
  function onBlur(): void {
    if (blurSuspended) return;
    exit = 'blur';
    session.commit();
  }
  function onSelection(): void {
    onSelectionChange?.();
  }

  element.setAttribute('contenteditable', 'plaintext-only');
  element.setAttribute('data-bldr-inline-editing', '');
  element.addEventListener('keydown', onKeyDown);
  doc.addEventListener('selectionchange', onSelection);
  element.focus({ preventScroll: true });
  placeCaretAtEnd(element);
  // Attached after focus so the focus move itself can never read as a blur.
  element.addEventListener('blur', onBlur);
  return session;
}
