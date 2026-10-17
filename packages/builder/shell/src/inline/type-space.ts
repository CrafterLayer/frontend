/*
  ── Typing a space inside a part that is a <button> (or role=tab)

  A label part is often drawn by a <button>: a call to action, a tab trigger.
  The editing surface is a contenteditable span INSIDE that button, and the
  browser's own button behaviour still runs for key events that bubble out of
  it: Chromium's default handler activates the button on the Space keyup and
  dispatches a click on it. The canvas reads that click as a press on the
  block, the editing session ends, and the rest of the typing lands nowhere
  (walk 2026-10-08: "Start now" committed as "Start").

  `stopPropagation` does not help, because a default handler is not a listener.
  The only reliable stop is `preventDefault` on the Space keydown AND keyup,
  which also cancels the native insertion — so the space is typed here instead.

  It is typed through the browser's own editing path (`insertText`), which
  extends the existing text node rather than adding a new one, keeps the caret
  after it, and fires the ordinary `beforeinput`/`input` pair a surface already
  listens to. jsdom implements no editing commands, so the fallback edits the
  text node directly and announces an `input` itself.
*/

/** True for the key a surface must type itself while inside a button. */
export function isSpaceKey(event: KeyboardEvent): boolean {
  return (event.key === ' ' || event.key === 'Spacebar') && !event.isComposing;
}

function insertWithoutCommand(surface: HTMLElement, text: string): void {
  const doc = surface.ownerDocument;
  const selection = doc.getSelection();
  const range = selection !== null && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  if (selection === null || range === null || !surface.contains(range.commonAncestorContainer)) {
    surface.append(text);
  } else {
    range.deleteContents();
    const container = range.startContainer;
    if (container.nodeType === 3) {
      // Extend the text node the caret is in: no new node, no structural change.
      const node = container as Text;
      const offset = range.startOffset;
      node.insertData(offset, text);
      range.setStart(node, offset + text.length);
    } else {
      const node = doc.createTextNode(text);
      range.insertNode(node);
      range.setStartAfter(node);
    }
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  const InputEventCtor = doc.defaultView?.InputEvent;
  surface.dispatchEvent(
    InputEventCtor === undefined
      ? new Event('input', { bubbles: true })
      : new InputEventCtor('input', { bubbles: true, data: text, inputType: 'insertText' }),
  );
}

/**
 * Type `text` at the caret of `surface` (replacing any selection), as one
 * native input with the caret after it.
 */
export function typeAtCaret(surface: HTMLElement, text: string): void {
  const doc = surface.ownerDocument;
  let inserted = false;
  try {
    // `execCommand` is deprecated in name only: it is still the one API that
    // inserts through the browser's editor (caret, native undo, input events).
    inserted =
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- the one API that inserts through the browser's editor
      typeof doc.execCommand === 'function' &&
      doc.activeElement !== null &&
      surface.contains(doc.activeElement) &&
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- caret, native undo and input events in one call
      doc.execCommand('insertText', false, text);
  } catch {
    inserted = false;
  }
  if (!inserted) insertWithoutCommand(surface, text);
}
