import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { Editor } from '@tiptap/react';

import { richText, type RichTextDoc } from '@craftkit/builder-schema';

import { RichTextEditor } from '../RichTextField/RichTextEditor';
import { selectionAnchorOf, type SelectionAnchor } from './selection-anchor';
import { shouldShowBubble } from './should-show';
import './InlineRichText.css';

export interface InlineRichTextProps {
  /** The stored rich-text value — document truth, re-seeded on external writes. */
  value: unknown;
  /**
   * ONE call per editor update with the projected stored doc — the B3b commit
   * law, unchanged (009 contract §4 t2). Mounting, exiting, and editability
   * changes never call it.
   */
  onCommit: (next: RichTextDoc) => void;
  /** Escape inside the surface — the host ends the inline session (§3 s2). */
  onExit?: (() => void) | undefined;
  /**
   * The selection channel (§5 b1): a frame-viewport anchor whenever the bubble
   * should show, `null` whenever it should not — reported on every selection
   * update, after every transaction, on focus/blur, and once on unmount so a
   * bubble is never stranded.
   */
  onSelectionChange?: ((anchor: SelectionAnchor | null) => void) | undefined;
  /** Accessible name for the editing surface. */
  label?: string | undefined;
  /**
   * Dev/test instrumentation — receives the engine instance ONCE per editor
   * (the existing `onEditorReady` pattern in this package). Hosts never pass it.
   */
  onEditorReady?: ((editor: Editor) => void) | undefined;
}

// The reused editor takes FieldProps; the inline surface has no schema/path of
// its own (the HOST owns the dispatch), so these satisfy the contract inertly.
const INLINE_SCHEMA = richText();
const INLINE_PATH: (string | number)[] = ['props'];

/**
 * The inline rich editing surface used INSIDE the canvas (009 contract §4 t2):
 * the SAME B3b editor machinery in inline chrome — no second engine — with the
 * block toolbar hidden because the floating bubble replaces it on the canvas.
 * All the editor's laws are inherited, not reimplemented: one commit per
 * update, canonical-JSON re-seed on external writes, live a11y attributes, and
 * zero phantom commits on mount or editability changes.
 */
export function InlineRichText({
  value,
  onCommit,
  onExit,
  onSelectionChange,
  label,
  onEditorReady,
}: InlineRichTextProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const labelId = useId();

  // Latest-callback refs: hosts pass fresh closures per render, and neither
  // the editor subscription nor the native listener should re-bind for that.
  const commitRef = useRef(onCommit);
  const exitRef = useRef(onExit);
  const selectionRef = useRef(onSelectionChange);
  const readyRef = useRef(onEditorReady);
  useEffect(() => {
    commitRef.current = onCommit;
    exitRef.current = onExit;
    selectionRef.current = onSelectionChange;
    readyRef.current = onEditorReady;
  });

  // The editor only ever emits `toStoredRichText` output — the projection onto
  // the stored whitelist — so the narrowing is truthful.
  const handleCommit = useCallback((next: unknown) => {
    commitRef.current(next as RichTextDoc);
  }, []);

  const handleReady = useCallback((instance: Editor) => {
    setEditor(instance);
    readyRef.current?.(instance);
  }, []);

  // The selection channel: anchor when the bubble should show, null when not.
  useEffect(() => {
    if (editor === null) {
      return;
    }
    const report = () => {
      const notify = selectionRef.current;
      if (notify === undefined) {
        return;
      }
      notify(shouldShowBubble(editor) ? selectionAnchorOf(editor) : null);
    };
    report();
    editor.on('selectionUpdate', report);
    editor.on('transaction', report);
    editor.on('focus', report);
    editor.on('blur', report);
    return () => {
      editor.off('selectionUpdate', report);
      editor.off('transaction', report);
      editor.off('focus', report);
      editor.off('blur', report);
      // Editing ended: never leave a stranded bubble (§5 b1).
      selectionRef.current?.(null);
    };
  }, [editor]);

  // Escape → onExit. A NATIVE listener: React's synthetic events do not cross
  // the frame boundary for content portaled into the preview document (009 §9
  // record 2). The event is not swallowed — the host owns global Escape
  // semantics (frame-document gestures, §7 c2); exits are idempotent (§3 s2).
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        exitRef.current?.();
      }
    };
    container.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="bldr-inline-richtext">
      {label === undefined ? null : (
        // Visually hidden, still names the contenteditable surface — the same
        // reason the field routes labels through `labelledBy` (§8 item 7).
        <span className="bldr-inline-richtext__label" id={labelId}>
          {label}
        </span>
      )}
      <RichTextEditor
        schema={INLINE_SCHEMA}
        value={value}
        path={INLINE_PATH}
        onChange={handleCommit}
        labelledBy={label === undefined ? undefined : labelId}
        hideToolbar
        onEditorReady={handleReady}
      />
    </div>
  );
}
