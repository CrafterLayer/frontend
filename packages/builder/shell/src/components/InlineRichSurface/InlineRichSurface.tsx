import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { RichText } from '@craftkit/builder-renderer';
import type { InlineEditorProps, InlineFormatAction } from '@craftkit/builder-schema';

import { applyOffsets, offsetsOfSelection, rangeGeometry } from '../../inline/dom-range';
import {
  isMarkActive,
  replaceRange,
  richTextLength,
  toggleMark,
  type TextRange,
  type ToggleableMark,
} from '../../inline/mark-range';
import './InlineRichSurface.css';

/** The marks the built-in surface offers, in bubble order. */
const MARKS: { id: ToggleableMark; label: string }[] = [
  { id: 'bold', label: 'Bold' },
  { id: 'italic', label: 'Italic' },
];

/**
 * The BUILT-IN rich inline surface (009 §15): real bold/italic over a real text
 * selection, with NO editing engine.
 *
 * Why this exists. The shell is layer 3 and can never import an engine, so
 * until now "rich" inline editing required the contributed TipTap extension —
 * and a builder whose headline feature only works with an optional package is
 * not a builder. This surface renders the stored document through the SAME
 * read path the canvas uses (`RichText`), maps the live DOM selection onto the
 * document's own offset space, and edits the document with pure functions.
 * Formatting therefore applies to exactly the selected characters — never the
 * whole paragraph — and it is STORED, not painted.
 *
 * It is deliberately small: bold and italic, typing, and deletion. Headings,
 * lists, links, and undo remain the contributed engine's job, and a contributed
 * editor still outranks this one wherever an extension registers it.
 *
 * CONTROLLED contenteditable: every input is intercepted and applied to the
 * document instead, so React stays the single authority over the DOM and the
 * stored document can never drift from what is on screen. The caret is
 * restored by offset after each commit, which is what makes typing feel
 * continuous through a round trip to the kernel and back.
 */
export function InlineRichSurface({
  value,
  label,
  onCommit,
  onExit,
  onAnchor,
  onActions,
}: InlineEditorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  /** Where to put the caret once the committed value comes back. */
  const pendingCaretRef = useRef<TextRange | null>(null);

  // Latest-callback refs: the host passes fresh closures every render, and the
  // native listeners below must not re-bind for that (they live on the FRAME's
  // document, and re-binding mid-gesture drops events).
  const valueRef = useRef(value);
  const commitRef = useRef(onCommit);
  const exitRef = useRef(onExit);
  const anchorRef = useRef(onAnchor);
  const actionsRef = useRef(onActions);
  useEffect(() => {
    valueRef.current = value;
    commitRef.current = onCommit;
    exitRef.current = onExit;
    anchorRef.current = onAnchor;
    actionsRef.current = onActions;
  });

  const selectionOf = useCallback((root: HTMLElement): TextRange | null => {
    const selection = root.ownerDocument.getSelection();
    return offsetsOfSelection(root, selection);
  }, []);

  /** One commit, plus where the caret belongs once the value returns. */
  const commit = useCallback((next: unknown, caret: TextRange) => {
    pendingCaretRef.current = caret;
    commitRef.current(next);
  }, []);

  /**
   * Publish what the canvas needs to draw its bubble: the selection's geometry
   * and the actions available for it. An empty or collapsed selection reports
   * NO actions, which is how the canvas knows to hide the bubble — the same
   * rule the contributed editor follows.
   */
  const report = useCallback(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    const range = selectionOf(root);
    const document_ = valueRef.current;
    if (range === null || range.from >= range.to) {
      anchorRef.current(null);
      actionsRef.current([]);
      return;
    }
    anchorRef.current(rangeGeometry(root, range));
    actionsRef.current(
      MARKS.map((mark): InlineFormatAction => ({
        id: mark.id,
        label: mark.label,
        pressed: isMarkActive(document_, range, mark.id),
        run: () => {
          // ONE transaction, and the selection is preserved across it: the
          // caret comes back to the same characters, so a second press
          // toggles the same word rather than a stale one.
          commit(toggleMark(valueRef.current, range, mark.id), range);
        },
      })),
    );
  }, [commit, selectionOf]);

  // Selection lives on the DOCUMENT, not the element — and this surface is
  // portaled into the preview frame, where React's synthetic events never
  // reach (the B2b cross-document law). Native listener, frame document.
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return undefined;
    }
    const frameDocument = root.ownerDocument;
    const onSelectionChange = () => {
      report();
    };
    frameDocument.addEventListener('selectionchange', onSelectionChange);
    return () => {
      frameDocument.removeEventListener('selectionchange', onSelectionChange);
      // Never strand a bubble over text nobody is editing.
      anchorRef.current(null);
      actionsRef.current([]);
    };
  }, [report]);

  // Editing. Every input is applied to the DOCUMENT and the browser's own
  // mutation is refused, so the DOM never diverges from stored truth.
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return undefined;
    }
    const onBeforeInput = (event: InputEvent) => {
      const range = selectionOf(root);
      if (range === null) {
        // NO position to apply the input to — and letting it through would let
        // the raw contenteditable mutate the DOM behind the document's back,
        // which is the one thing a controlled surface must never allow. Refuse.
        event.preventDefault();
        return;
      }
      const type = event.inputType;
      const insert =
        type === 'insertText' || type === 'insertReplacementText' || type === 'insertFromPaste';
      if (insert) {
        event.preventDefault();
        // Paste arrives as data OR as dataTransfer text; both are plain text
        // here on purpose — pasting formatting is the engine's job.
        const text = event.data ?? event.dataTransfer?.getData('text/plain') ?? '';
        const applied = replaceRange(valueRef.current, range, text);
        commit(applied.doc, { from: applied.caret, to: applied.caret });
        return;
      }
      if (type === 'deleteContentBackward' || type === 'deleteContentForward') {
        event.preventDefault();
        // A collapsed caret deletes one character in the given direction;
        // a real selection deletes exactly itself.
        const target =
          range.from < range.to
            ? range
            : type === 'deleteContentBackward'
              ? { from: Math.max(range.from - 1, 0), to: range.from }
              : {
                  from: range.from,
                  to: Math.min(range.from + 1, richTextLength(valueRef.current)),
                };
        if (target.from === target.to) {
          return; // nothing to delete at the edges
        }
        const applied = replaceRange(valueRef.current, target, '');
        commit(applied.doc, { from: applied.caret, to: applied.caret });
        return;
      }
      // Everything else this surface does not model (composition, formatting
      // inputs, history) is refused rather than silently corrupting the
      // document — the contributed engine is the upgrade path.
      event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        exitRef.current();
        return;
      }
      // Arrows, Home/End and the selection chords move the CARET here; the
      // canvas must never see them and move the block selection instead.
      event.stopPropagation();
    };
    const stop = (event: Event) => {
      event.stopPropagation();
    };
    root.addEventListener('beforeinput', onBeforeInput as EventListener);
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('click', stop);
    root.addEventListener('pointerdown', stop);
    root.addEventListener('dblclick', stop);
    return () => {
      root.removeEventListener('beforeinput', onBeforeInput as EventListener);
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('click', stop);
      root.removeEventListener('pointerdown', stop);
      root.removeEventListener('dblclick', stop);
    };
  }, [commit, selectionOf]);

  // The session opens ON this surface: take focus and put the caret at the end,
  // so the first keystroke lands here rather than in the canvas behind it.
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    root.focus({ preventScroll: true });
    const end = richTextLength(valueRef.current);
    applyOffsets(root, { from: end, to: end }, root.ownerDocument.getSelection());
  }, []);

  // Document truth came back (our own commit, an undo, a collaborator): React
  // has just rebuilt the text nodes, so the caret must be re-applied BEFORE
  // paint or the user sees it jump to the start.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const caret = pendingCaretRef.current;
    if (root === null || caret === null) {
      return;
    }
    pendingCaretRef.current = null;
    applyOffsets(root, caret, root.ownerDocument.getSelection());
    report();
  }, [value, report]);

  return (
    <div
      ref={rootRef}
      className="bldr-inline-rich"
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      contentEditable
      suppressContentEditableWarning
      tabIndex={0}
      // Mixed ar/en prose follows its own content's direction, exactly as the
      // contributed editor's surface does.
      dir="auto"
    >
      <RichText value={value} />
    </div>
  );
}
