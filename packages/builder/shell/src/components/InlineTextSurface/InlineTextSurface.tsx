import { useEffect, useRef, useState } from 'react';

import './InlineTextSurface.css';

/** Why a buffered edit was handed to the host. */
export type InlineCommitReason = 'enter' | 'blur';

export interface InlineTextSurfaceProps {
  /** Document truth. The DOM is written ONLY when this differs from what shows. */
  value: unknown;
  /**
   * ONE call per finished edit (Enter or blur), never per keystroke; the host
   * turns it into one labelled transaction through the kernel door. Not called
   * when the text is unchanged, nor after Escape.
   */
  onCommit: (next: string, reason: InlineCommitReason) => void;
  /** Ends the session (Escape, after the draft is discarded). */
  onExit?: (() => void) | undefined;
  /**
   * A single-line property refuses newlines: Enter commits and Shift+Enter is
   * inert. A multiline property inserts `\n` on Shift+Enter; Enter commits.
   */
  singleLine?: boolean | undefined;
  /** Accessible name — the property being edited. */
  label?: string | undefined;
}

/**
 * In-place plain-text editing (009 contract §4 t1; block-parts DESIGN §2.7).
 *
 * ADAPTED from Puck's `InlineTextField` (MIT) — the verbatim upstream file and
 * the full rationale live in `vendor/VENDOR.md`. Three upstream behaviors are
 * kept deliberately, because each is a bug someone else already paid for:
 *
 *  1. Write the DOM only when the incoming value differs from what is shown.
 *     Rewriting it for your own echo resets the caret mid-typing.
 *  2. `contentEditable` is enabled only while hovered or focused: Safari
 *     focuses contenteditables during a drag (webkit 112854), and every node on
 *     this canvas carries drag machinery.
 *  3. Coerce nullish to `''` — `replaceChildren` stringifies non-Node arguments,
 *     so an unguarded null renders the literal text "null".
 *
 * And one reason the upstream uses NATIVE listeners that this repository has
 * already learned twice (B2b's "keydown does not cross documents"): this
 * surface is portaled into the preview IFRAME, and React's synthetic events are
 * delegated at the host root — a real `input` fired inside the frame would
 * never reach a React `onInput`. Every listener here is attached to the element
 * itself.
 *
 * What we changed from upstream: it commits to its store on every `input`;
 * ours BUFFERS the draft in the DOM and calls `onCommit` once — on Enter or on
 * blur (law L1: one gesture, one Undo). Escape discards the draft. While a
 * draft is unsaved, incoming values (an Undo/Redo replay, a collaborator) do
 * not overwrite what the person is typing; once the draft is committed or
 * discarded, document truth shows through again.
 */
/**
 * What the element currently SHOWS. `innerText` is the right semantic (it is
 * what the user sees, with line breaks normalised) but it is a rendering-aware
 * API that jsdom does not implement, so the raw text content is the fallback —
 * a real browser takes the first branch, tests take the second, and both read
 * the same string for the plain-text content this surface edits.
 */
function shownText(element: HTMLElement): string {
  // The DOM types declare `innerText` as always present; jsdom does not
  // implement it at all. The narrowed type says what is actually true.
  const rendered = (element as { innerText?: string }).innerText;
  return rendered ?? element.textContent;
}

/** Insert a literal line feed at the caret (Shift+Enter in a multiline part). */
function insertLineFeed(element: HTMLElement): void {
  const selection = element.ownerDocument.getSelection();
  if (selection === null || selection.rangeCount === 0) {
    element.append('\n');
    return;
  }
  const range = selection.getRangeAt(0);
  if (!element.contains(range.commonAncestorContainer)) {
    element.append('\n');
    return;
  }
  range.deleteContents();
  const feed = element.ownerDocument.createTextNode('\n');
  range.insertNode(feed);
  range.setStartAfter(feed);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function InlineTextSurface({
  value,
  onCommit,
  onExit,
  singleLine,
  label,
}: InlineTextSurfaceProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  // TWO flags, exactly as upstream: editability survives the pointer leaving
  // while the caret is still in the text — the guard is against Safari's
  // drag-focus, not against normal editing.
  const [hovering, setHovering] = useState(false);
  // Starts LIVE, deliberately: this surface only mounts because the editor
  // asked to edit this node, and a programmatic focus updates state on the NEXT
  // render — a keystroke in that gap would be dropped by the browser (caught by
  // the Chromium story, invisible in jsdom). The Safari guard still applies
  // from the first blur onwards.
  const [focused, setFocused] = useState(true);
  const interactive = hovering || focused;
  const text = typeof value === 'string' ? value : '';

  /** Document truth as last seen — the cancel target. */
  const textRef = useRef(text);
  /** The last string handed to (or received from) the host: the change test. */
  const lastSentRef = useRef(text);
  /** Typed since the last commit or cancel: incoming values must not clobber it. */
  const dirtyRef = useRef(false);
  /** Escape ran: the blur that follows the focus hand-off must not commit. */
  const cancelledRef = useRef(false);

  // (1) — caret safety: only an EXTERNAL change touches the DOM, and never
  // while an unsaved draft is open (history replay must not eat typing).
  useEffect(() => {
    textRef.current = text;
    lastSentRef.current = text;
    const element = ref.current;
    if (element !== null && !dirtyRef.current && shownText(element) !== text) {
      element.replaceChildren(text);
    }
  }, [text]);

  // Native listeners: this element lives in the frame document, where React's
  // delegated synthetic events never arrive.
  const commitRef = useRef(onCommit);
  const exitRef = useRef(onExit);
  const singleLineRef = useRef(singleLine);
  useEffect(() => {
    commitRef.current = onCommit;
    exitRef.current = onExit;
    singleLineRef.current = singleLine;
  });

  useEffect(() => {
    const element = ref.current;
    /* v8 ignore next 3 -- the ref is set before effects run. */
    if (element === null) {
      return undefined;
    }
    const read = (): string => {
      const raw = shownText(element);
      return singleLine === true ? raw.replaceAll(/[\r\n]/g, '') : raw;
    };
    const flush = (reason: InlineCommitReason) => {
      if (cancelledRef.current) {
        return;
      }
      const next = read();
      dirtyRef.current = false;
      if (next === lastSentRef.current) {
        return; // unchanged: no transaction at all
      }
      lastSentRef.current = next;
      commitRef.current(next, reason);
    };
    const onInput = () => {
      cancelledRef.current = false;
      dirtyRef.current = true;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      // Typing must never reach the canvas's traversal handler — arrow keys
      // move the caret here, not the selection. Escape is consumed here too:
      // the canvas learns about it through `onExit`.
      event.stopPropagation();
      if (event.key === 'Escape') {
        // Cancel BEFORE exiting: exiting moves focus away, and the blur that
        // follows must find nothing to commit.
        cancelledRef.current = true;
        dirtyRef.current = false;
        if (shownText(element) !== textRef.current) {
          element.replaceChildren(textRef.current);
        }
        exitRef.current?.();
        return;
      }
      if (event.key !== 'Enter' || event.isComposing) {
        return;
      }
      event.preventDefault();
      if (event.shiftKey && singleLine !== true) {
        insertLineFeed(element);
        cancelledRef.current = false;
        dirtyRef.current = true;
        return;
      }
      if (event.shiftKey) {
        return; // single-line: Shift+Enter is inert
      }
      flush('enter');
    };
    const onBeforeInput = (event: InputEvent) => {
      // A single-line part never takes a paragraph or line break, whatever
      // route the browser offers (IME, a soft keyboard's return key).
      if (
        singleLine === true &&
        (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak')
      ) {
        event.preventDefault();
      }
    };
    const stop = (event: Event) => {
      // Clicking inside an open edit places the caret; it must not re-run the
      // canvas selection path or start a drag.
      event.stopPropagation();
    };
    const onOver = () => {
      setHovering(true);
    };
    const onOut = () => {
      setHovering(false);
    };
    const onFocus = () => {
      cancelledRef.current = false;
      setFocused(true);
    };
    const onBlur = () => {
      setFocused(false);
      flush('blur');
    };
    element.addEventListener('input', onInput);
    element.addEventListener('beforeinput', onBeforeInput as EventListener);
    element.addEventListener('keydown', onKeyDown);
    element.addEventListener('keyup', stop);
    element.addEventListener('click', stop);
    element.addEventListener('dblclick', stop);
    element.addEventListener('pointerdown', stop);
    element.addEventListener('mouseover', onOver);
    element.addEventListener('mouseout', onOut);
    element.addEventListener('focus', onFocus);
    element.addEventListener('blur', onBlur);
    return () => {
      element.removeEventListener('input', onInput);
      element.removeEventListener('beforeinput', onBeforeInput as EventListener);
      element.removeEventListener('keydown', onKeyDown);
      element.removeEventListener('keyup', stop);
      element.removeEventListener('click', stop);
      element.removeEventListener('dblclick', stop);
      element.removeEventListener('pointerdown', stop);
      element.removeEventListener('mouseover', onOver);
      element.removeEventListener('mouseout', onOut);
      element.removeEventListener('focus', onFocus);
      element.removeEventListener('blur', onBlur);
    };
  }, [singleLine]);

  // The session is open BECAUSE the editor asked for it: take focus on mount so
  // the caret is where the gesture landed, without a second click. On unmount,
  // a draft that never saw its blur (the session ended under it — another block
  // was selected first) is committed rather than silently lost.
  useEffect(() => {
    const element = ref.current;
    if (element !== null) {
      setFocused(true);
      element.focus({ preventScroll: true });
    }
    return () => {
      if (element === null || !dirtyRef.current || cancelledRef.current) {
        return;
      }
      dirtyRef.current = false;
      const raw = shownText(element);
      const next = singleLineRef.current === true ? raw.replaceAll(/[\r\n]/g, '') : raw;
      if (next !== lastSentRef.current) {
        lastSentRef.current = next;
        commitRef.current(next, 'blur');
      }
    };
  }, []);

  return (
    <span
      ref={ref}
      className="bldr-inline-text"
      role="textbox"
      aria-label={label}
      aria-multiline={singleLine === true ? undefined : 'true'}
      // Mixed Arabic/English: each edit follows its own content's direction,
      // never the page's (an English line on an RTL page keeps its full stop
      // at the end).
      dir="auto"
      // (2) — Safari focuses contenteditables during drag: inert until the
      // pointer or the keyboard actually arrives. Only ever live while this
      // session's surface is mounted.
      contentEditable={interactive ? 'plaintext-only' : 'false'}
      suppressContentEditableWarning
      tabIndex={0}
    />
  );
}
