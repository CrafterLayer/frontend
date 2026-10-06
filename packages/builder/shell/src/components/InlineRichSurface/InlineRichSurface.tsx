import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { RichText } from '@craftkit/builder-renderer';
import type { InlineEditorProps, InlineFormatAction } from '@craftkit/builder-schema';

import {
  applyOffsets,
  offsetsOfDomRange,
  offsetsOfSelection,
  rangeGeometry,
  type DomRangeLike,
} from '../../inline/dom-range';
import {
  isMarkActive,
  replaceRange,
  richTextLength,
  toggleMark,
  type TextRange,
  type ToggleableMark,
} from '../../inline/mark-range';
import './InlineRichSurface.css';

/** A local edit; `dirty` until it has been handed to the host. */
interface RichDraft {
  readonly doc: unknown;
  readonly dirty: boolean;
}

/** The marks the built-in surface offers, in bubble order. */
const MARKS: { id: ToggleableMark; label: string }[] = [
  { id: 'bold', label: 'Bold' },
  { id: 'italic', label: 'Italic' },
];

const BACKWARD_DELETIONS: ReadonlySet<string> = new Set([
  'deleteContentBackward',
  'deleteWordBackward',
  'deleteSoftLineBackward',
  'deleteHardLineBackward',
]);

const FORWARD_DELETIONS: ReadonlySet<string> = new Set([
  'deleteContentForward',
  'deleteWordForward',
  'deleteSoftLineForward',
  'deleteHardLineForward',
]);

const TARGET_RANGE_DELETIONS: ReadonlySet<string> = new Set([
  ...BACKWARD_DELETIONS,
  ...FORWARD_DELETIONS,
  'deleteByCut',
  'deleteByDrag',
  'deleteEntireSoftLine',
  'deleteContent',
]);

interface InputEventWithOptionalTargetRanges {
  getTargetRanges?: (() => readonly DomRangeLike[] | undefined) | undefined;
}

/** The browser's exact deletion range, when this Input Events API is present. */
function targetRangeOf(event: InputEvent, root: HTMLElement): TextRange | null {
  const getTargetRanges = (event as InputEventWithOptionalTargetRanges).getTargetRanges;
  if (typeof getTargetRanges !== 'function') {
    return null;
  }
  const target = getTargetRanges.call(event)?.[0];
  return target === undefined ? null : offsetsOfDomRange(root, target);
}

/** Legacy/jsdom fallback: selection first, then one character in the command's direction. */
function fallbackDeletionRange(range: TextRange, inputType: string, length: number): TextRange {
  if (range.from < range.to) {
    return range;
  }
  if (BACKWARD_DELETIONS.has(inputType)) {
    return { from: Math.max(range.from - 1, 0), to: range.from };
  }
  if (FORWARD_DELETIONS.has(inputType)) {
    return { from: range.from, to: Math.min(range.from + 1, length) };
  }
  // Cut/drag/deleteContent need a selection, and an entire-line delete needs
  // the browser's target range; without either, there is no honest span to use.
  return range;
}

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
 * CONTROLLED contenteditable: every input is intercepted and applied to a
 * LOCAL draft document instead, so React stays the single authority over the
 * DOM and what is on screen is always a real document. The caret is restored
 * by offset after each edit.
 *
 * Commit law (block-parts DESIGN §2.7, law L1): the draft is handed to the host
 * ONCE — on Enter, on blur, or when the session ends under it — never per
 * keystroke, so one edit is one Undo. A formatting action (Bold, Italic) is a
 * discrete gesture and commits immediately, together with any typing before
 * it. Escape discards the draft. While a draft is unsaved, incoming values (an
 * Undo/Redo replay, a collaborator) do not overwrite it.
 */
export function InlineRichSurface({
  value,
  label,
  onCommit,
  onExit,
  onAnchor,
  onActions,
  requestFormattingMenuFocus,
  formattingMenuElement,
}: InlineEditorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  /*
    The local draft. `null` = nothing typed: the stored value shows. After a
    commit the draft is kept CLEAN until the stored value moves (the host's
    echo, or an undo), so a refused commit never snaps the text back under the
    caret.
  */
  const [draft, setDraft] = useState<RichDraft | null>(null);
  const draftRef = useRef<RichDraft | null>(null);
  // The stored value moved (the host's echo, an undo, a collaborator): a CLEAN
  // draft yields to it; a dirty one is kept (a replay never eats typing).
  // Adjusting state while rendering is React's documented pattern for this.
  const [seenValue, setSeenValue] = useState(value);
  if (seenValue !== value) {
    setSeenValue(value);
    if (draft !== null && !draft.dirty) {
      setDraft(null);
    }
  }
  const shown = draft === null ? value : draft.doc;
  /** Where to put the caret once the committed value comes back. */
  const pendingCaretRef = useRef<TextRange | null>(null);
  /** Selection bookmark while host-document formatting chrome owns focus. */
  const formattingSelectionRef = useRef<TextRange | null>(null);

  // Latest-callback refs: the host passes fresh closures every render, and the
  // native listeners below must not re-bind for that (they live on the FRAME's
  // document, and re-binding mid-gesture drops events).
  const valueRef = useRef(value);
  /** The document on screen right now — what every edit applies to. */
  const docRef = useRef<unknown>(shown);
  const commitRef = useRef(onCommit);
  const exitRef = useRef(onExit);
  const anchorRef = useRef(onAnchor);
  const actionsRef = useRef(onActions);
  const requestFormattingMenuFocusRef = useRef(requestFormattingMenuFocus);
  // A LAYOUT effect, not a passive one: a deferred passive sync could land
  // after a keystroke staged a newer draft and overwrite it with the previous
  // render's — layout effects run in the commit itself, before any next event.
  useLayoutEffect(() => {
    valueRef.current = value;
    docRef.current = shown;
    draftRef.current = draft;
    commitRef.current = onCommit;
    exitRef.current = onExit;
    anchorRef.current = onAnchor;
    actionsRef.current = onActions;
    requestFormattingMenuFocusRef.current = requestFormattingMenuFocus;
  });

  const selectionOf = useCallback((root: HTMLElement): TextRange | null => {
    const selection = root.ownerDocument.getSelection();
    return offsetsOfSelection(root, selection);
  }, []);

  /** Apply an edit to the draft (no commit), plus where the caret belongs. */
  const stage = useCallback((next: unknown, caret: TextRange) => {
    pendingCaretRef.current = caret;
    const staged: RichDraft = { doc: next, dirty: true };
    draftRef.current = staged;
    docRef.current = next;
    setDraft(staged);
  }, []);

  /** Hand an unsaved draft to the host: ONE commit, or nothing when clean. */
  const flush = useCallback(() => {
    const current = draftRef.current;
    if (current?.dirty !== true) {
      return;
    }
    const clean: RichDraft = { ...current, dirty: false };
    draftRef.current = clean;
    setDraft(clean);
    commitRef.current(current.doc);
  }, []);

  /** Escape: forget the draft; the stored value shows again. */
  const discard = useCallback(() => {
    draftRef.current = null;
    docRef.current = valueRef.current;
    pendingCaretRef.current = null;
    setDraft(null);
  }, []);

  /**
   * Publish what the canvas needs to draw its bubble: selection VISIBILITY,
   * a deferred geometry source, and the actions available for it. An empty or
   * collapsed selection reports NO actions. `rangeGeometry` stays inside the
   * source so only the frame-coalesced anchor flush may force layout.
   */
  const report = useCallback(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }
    const editorActiveElement = root.ownerDocument.activeElement;
    const editorOwnsFocus =
      editorActiveElement !== null &&
      (editorActiveElement === root || root.contains(editorActiveElement));
    const menuActiveElement = formattingMenuElement?.ownerDocument.activeElement ?? null;
    const menuOwnsFocus =
      formattingMenuElement !== undefined &&
      formattingMenuElement !== null &&
      menuActiveElement !== null &&
      formattingMenuElement.contains(menuActiveElement);
    const range =
      formattingSelectionRef.current ??
      (editorOwnsFocus || menuOwnsFocus ? selectionOf(root) : null);
    const document_ = docRef.current;
    if (range === null) {
      anchorRef.current(null);
      actionsRef.current([]);
      return;
    }
    /*
      block-parts (2026-10-06): a collapsed caret keeps the formatting chrome
      on screen (the canvas docks it at this surface instead of a selection),
      with the marks DISABLED: this surface stores marks on characters, and a
      caret has none to carry them. No anchor, so the bar never points at a
      zero-width rect.
    */
    const collapsed = range.from >= range.to;
    anchorRef.current(collapsed ? null : { measure: () => rangeGeometry(root, range) });
    actionsRef.current(
      MARKS.map((mark): InlineFormatAction => ({
        id: mark.id,
        label: mark.label,
        pressed: !collapsed && isMarkActive(document_, range, mark.id),
        disabled: collapsed,
        run: () => {
          if (collapsed) {
            return;
          }
          // ONE transaction (with any typing before it), and the selection
          // is preserved across it: the caret comes back to the same
          // characters, so a second press toggles the same word.
          stage(toggleMark(docRef.current, range, mark.id), range);
          flush();
        },
      })),
    );
  }, [flush, formattingMenuElement, selectionOf, stage]);
  // The mount effect below must run ONCE (its cleanup commits an unsaved
  // draft), so it reads the latest `report` through a ref.
  const reportRef = useRef(report);
  useLayoutEffect(() => {
    reportRef.current = report;
  });

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
    const onFocusChange = () => {
      report();
    };
    const onBlur = () => {
      // Tab toward the formatting chrome bookmarks the selection first: that
      // blur is a hand-off within the edit, not the end of it.
      if (formattingSelectionRef.current === null) {
        flush();
      }
      report();
    };
    frameDocument.addEventListener('selectionchange', onSelectionChange);
    root.addEventListener('focus', onFocusChange);
    root.addEventListener('blur', onBlur);
    return () => {
      frameDocument.removeEventListener('selectionchange', onSelectionChange);
      root.removeEventListener('focus', onFocusChange);
      root.removeEventListener('blur', onBlur);
      formattingSelectionRef.current = null;
      // Never strand a bubble over text nobody is editing.
      anchorRef.current(null);
      actionsRef.current([]);
    };
  }, [flush, report]);

  // Leaving the formatting host for unrelated host content retires the editor
  // bookmark after focus has settled. Moving between its own buttons keeps it.
  useEffect(() => {
    const menu = formattingMenuElement;
    if (menu === undefined || menu === null) {
      return undefined;
    }
    let live = true;
    const onFocusIn = () => {
      report();
    };
    const onFocusOut = () => {
      queueMicrotask(() => {
        if (!live) {
          return;
        }
        const activeElement = menu.ownerDocument.activeElement;
        if (activeElement === null || !menu.contains(activeElement)) {
          formattingSelectionRef.current = null;
          report();
        }
      });
    };
    menu.addEventListener('focusin', onFocusIn);
    menu.addEventListener('focusout', onFocusOut);
    return () => {
      live = false;
      menu.removeEventListener('focusin', onFocusIn);
      menu.removeEventListener('focusout', onFocusOut);
    };
  }, [formattingMenuElement, report]);

  // Editing. Every input is applied to the DOCUMENT and the browser's own
  // mutation is refused, so the DOM never diverges from stored truth.
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) {
      return undefined;
    }
    const onBeforeInput = (event: InputEvent) => {
      const type = event.inputType;
      const insert =
        type === 'insertText' || type === 'insertReplacementText' || type === 'insertFromPaste';
      if (insert) {
        event.preventDefault();
        const range = selectionOf(root);
        if (range === null) {
          // NO position to apply the input to — and letting it through would
          // let the raw contenteditable mutate behind document truth. Refuse.
          return;
        }
        // Paste arrives as data OR as dataTransfer text; both are plain text
        // here on purpose — pasting formatting is the engine's job.
        const text = event.data ?? event.dataTransfer?.getData('text/plain') ?? '';
        const applied = replaceRange(docRef.current, range, text);
        stage(applied.doc, { from: applied.caret, to: applied.caret });
        return;
      }
      if (TARGET_RANGE_DELETIONS.has(type)) {
        event.preventDefault();
        // Modern browsers state the command's exact word/line/cut/drag span.
        // jsdom and legacy paths may omit it, so retain the former selection +
        // collapsed-caret behavior as a safe fallback instead of throwing.
        const browserTarget = targetRangeOf(event, root);
        const selection = selectionOf(root);
        let target = browserTarget;
        if (target === null) {
          if (selection === null) {
            return;
          }
          target = fallbackDeletionRange(selection, type, richTextLength(docRef.current));
        }
        if (target.from === target.to) {
          return; // nothing to delete at the edges
        }
        const applied = replaceRange(docRef.current, target, '');
        stage(applied.doc, { from: applied.caret, to: applied.caret });
        return;
      }
      // Everything else this surface does not model (composition, formatting
      // inputs, history) is refused rather than silently corrupting the
      // document — the contributed engine is the upgrade path.
      event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Discard BEFORE exiting: exiting moves focus away, and the blur that
        // follows must find nothing to commit.
        event.stopPropagation();
        discard();
        exitRef.current();
        return;
      }
      if (event.key === 'Enter' && !event.isComposing) {
        // This surface models no paragraphs: Enter finishes the edit (one
        // commit) and Shift+Enter is inert. The contributed engine owns
        // block structure.
        event.preventDefault();
        event.stopPropagation();
        if (!event.shiftKey) {
          flush();
        }
        return;
      }
      if (
        event.key === 'Tab' &&
        !event.shiftKey &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        const range = selectionOf(root);
        const request = requestFormattingMenuFocusRef.current;
        if (range !== null && range.from < range.to && request !== undefined) {
          formattingSelectionRef.current = range;
          const moved = request(() => {
            const currentRoot = rootRef.current;
            const bookmark = formattingSelectionRef.current;
            if (currentRoot === null || bookmark === null) {
              return;
            }
            currentRoot.focus({ preventScroll: true });
            applyOffsets(currentRoot, bookmark, currentRoot.ownerDocument.getSelection());
            formattingSelectionRef.current = null;
            report();
          });
          if (moved) {
            // Host focus must not erase the frame selection the action is about
            // to format. Re-apply it without refocusing this element.
            applyOffsets(root, range, root.ownerDocument.getSelection());
            event.preventDefault();
            event.stopPropagation();
            report();
            return;
          }
          formattingSelectionRef.current = null;
        }
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
  }, [discard, flush, report, selectionOf, stage]);

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
    // The caret is placed: report it now (a caret keeps the docked chrome)
    // rather than waiting on a selectionchange some engines never deliver.
    reportRef.current();
    return () => {
      // The session ended under an unsaved draft (another block was selected
      // before any blur reached this surface): commit it once, never lose it.
      const current = draftRef.current;
      if (current?.dirty === true) {
        draftRef.current = { ...current, dirty: false };
        commitRef.current(current.doc);
      }
    };
  }, []);

  // An edit was staged (or document truth came back): React has just rebuilt
  // the text nodes, so the caret must be re-applied BEFORE paint or the user
  // sees it jump to the start.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const caret = pendingCaretRef.current;
    if (root === null || caret === null) {
      return;
    }
    pendingCaretRef.current = null;
    applyOffsets(root, caret, root.ownerDocument.getSelection());
    report();
  }, [shown, report]);

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
      <RichText value={shown} />
    </div>
  );
}
