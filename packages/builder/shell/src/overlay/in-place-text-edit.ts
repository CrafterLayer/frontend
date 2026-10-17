/*
  ── Typing in place on a part a PARENT draws (block-parts, 2026-10-06)

  A tab trigger is the tab panel's `label` part, but Tabs draws it: the panel's
  own NodeView never renders that text, so the inline-edit seam has nowhere to
  swap an editing surface in. This session edits the drawn text where it is,
  under the same laws as the tree-text session (tree-text-session.ts):

  1. React's DOM is put back EXACTLY as it was before anything is written. The
     typing happens in a span this session owns, swapped in for React's
     children and swapped out again, so React reconciles its own nodes and the
     new text arrives through the normal render.
  2. Every key stays in the surface. Enter commits (Shift+Enter is a new line
     only for a multi-line part), Escape cancels, blur commits. Space is
     inserted by the session itself, because the part may be a <button> whose
     own Space activation would otherwise swallow it.
  3. ONE commit through the caller's door (the part planner: one labelled
     transaction, one Undo). A refusal is reported, and the stored text shows
     again.
*/

import { isSpaceKey, typeAtCaret } from '../inline/type-space';

export type InPlaceTextOutcome = 'committed' | 'unchanged' | 'cancelled' | 'rejected';

export type InPlaceTextExit = 'keyboard' | 'blur' | 'api';

export interface InPlaceTextEditOptions {
  /** The element whose text is edited (the forwarded part's own element). */
  readonly element: HTMLElement;
  /** The stored text when the session opened. */
  readonly storedText: string;
  /** Enter commits; false lets Shift+Enter insert a line break. Default true. */
  readonly singleLine?: boolean | undefined;
  /** Accessible name of the editing surface. */
  readonly label: string;
  /** Write the new text: ONE transaction, or a refusal message. */
  readonly onCommit: (text: string) => { readonly ok: true } | { readonly ok: false; readonly message: string };
  /** Called once when the session ends, however it ends. */
  readonly onEnd: (outcome: InPlaceTextOutcome, exit: InPlaceTextExit, message?: string) => void;
}

export interface InPlaceTextEdit {
  readonly element: HTMLElement;
  /** The text the surface shows now. */
  currentText(): string;
  /** End the session, writing the text when it changed. */
  commit(): void;
  /** End the session without writing. */
  cancel(): void;
  isOpen(): boolean;
}

/** Pointer gestures inside the surface place the caret; the canvas never sees them. */
const STOPPED = ['click', 'pointerdown', 'mousedown', 'dblclick'] as const;

/** The class of the editing span, for styles and tests. */
export const IN_PLACE_TEXT_CLASS = 'bldr-in-place-text';

function placeCaretAtEnd(element: HTMLElement): void {
  const selection = element.ownerDocument.getSelection();
  if (selection === null) return;
  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function shownText(surface: HTMLElement): string {
  const rendered = (surface as { innerText?: string }).innerText;
  return rendered ?? surface.textContent;
}

/** Open the element's text for typing in place. */
export function beginInPlaceTextEdit(options: InPlaceTextEditOptions): InPlaceTextEdit {
  const { element, storedText, label, onCommit, onEnd } = options;
  const singleLine = options.singleLine ?? true;
  const doc = element.ownerDocument;
  // (1) Snapshot React's nodes so they can be put back exactly. Typing never
  // touches them (it happens in the session's own span), so a React update
  // that lands mid-session is kept as React wrote it.
  const originalChildren = Array.from(element.childNodes);
  const surface = doc.createElement('span');
  surface.className = IN_PLACE_TEXT_CLASS;
  surface.setAttribute('contenteditable', 'plaintext-only');
  surface.setAttribute('role', 'textbox');
  surface.setAttribute('aria-label', label);
  if (!singleLine) surface.setAttribute('aria-multiline', 'true');
  surface.setAttribute('dir', 'auto');
  surface.textContent = storedText;
  // Buttons suppress text selection; the editing span must allow a caret.
  // Inline and temporary: the span exists only while the session is open.
  surface.style.setProperty('user-select', 'text');
  surface.style.setProperty('-webkit-user-select', 'text');
  surface.style.setProperty('cursor', 'text');
  surface.style.setProperty('min-inline-size', '1ch');
  surface.style.setProperty('display', 'inline-block');
  element.replaceChildren(surface);
  element.setAttribute('data-bldr-inline-editing', '');

  let open = true;
  let exit: InPlaceTextExit = 'api';

  const restoreDom = () => {
    element.replaceChildren(...originalChildren);
    element.removeAttribute('data-bldr-inline-editing');
  };

  const detach = () => {
    surface.removeEventListener('keydown', onKeyDown);
    surface.removeEventListener('keyup', onKeyUp);
    surface.removeEventListener('blur', onBlur);
    for (const type of STOPPED) surface.removeEventListener(type, stop);
  };

  const session: InPlaceTextEdit = {
    element,
    currentText: () => shownText(surface),
    commit: () => {
      if (!open) return;
      const raw = shownText(surface);
      const text = singleLine ? raw.replace(/\s*\n\s*/g, ' ') : raw;
      open = false;
      detach();
      restoreDom();
      if (text === storedText) {
        onEnd('unchanged', exit);
        return;
      }
      const result = onCommit(text);
      if (!result.ok) {
        onEnd('rejected', exit, result.message);
        return;
      }
      onEnd('committed', exit);
    },
    cancel: () => {
      if (!open) return;
      open = false;
      detach();
      restoreDom();
      onEnd('cancelled', exit);
    },
    isOpen: () => open,
  };

  // (2) Every key stays in the surface while it is being edited.
  function onKeyDown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      exit = 'keyboard';
      session.cancel();
      return;
    }
    if (event.key === 'Enter' && (singleLine || !event.shiftKey) && !event.isComposing) {
      event.preventDefault();
      exit = 'keyboard';
      session.commit();
      return;
    }
    if (isSpaceKey(event)) {
      // A <button> part activates on Space; the session types it instead,
      // extending the text node so no structural mutation follows the key.
      event.preventDefault();
      typeAtCaret(surface, ' ');
    }
  }
  function onKeyUp(event: KeyboardEvent): void {
    event.stopPropagation();
    if (isSpaceKey(event)) event.preventDefault();
  }
  function onBlur(): void {
    exit = 'blur';
    session.commit();
  }
  function stop(event: Event): void {
    event.stopPropagation();
  }

  surface.addEventListener('keydown', onKeyDown);
  surface.addEventListener('keyup', onKeyUp);
  for (const type of STOPPED) surface.addEventListener(type, stop);
  surface.focus({ preventScroll: true });
  placeCaretAtEnd(surface);
  // Attached after focus so the focus move itself can never read as a blur.
  surface.addEventListener('blur', onBlur);
  return session;
}
