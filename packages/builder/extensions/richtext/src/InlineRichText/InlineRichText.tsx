import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { Editor } from '@tiptap/react';

import { richText, type InlineEditorProps, type RichTextDoc } from '@craftkit/builder-schema';

import { RichTextEditor } from '../RichTextField/RichTextEditor';
import { subscribeBubbleReports } from './bubble-reporting';
import {
  liveViewOf,
  selectionAnchorOf,
  type SelectionAnchorReport,
  type SelectionAnchorSource,
} from './selection-anchor';
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
   * The selection channel (§5 b1): a deferred frame-viewport anchor source
   * whenever the bubble should show, `null` whenever it should not — reported
   * on every selection update, after every transaction, on focus/blur, and
   * once on unmount so a bubble is never stranded. Geometry is read only when
   * the frame-coalesced canvas channel later invokes the source.
   */
  onSelectionChange?: ((report: SelectionAnchorReport | null) => void) | undefined;
  /** Canvas-owned formatting host; focus inside it still belongs to this edit. */
  formattingMenuElement?: Element | null | undefined;
  /** Frame-side Tab asks the canvas to focus its first enabled formatting action. */
  requestFormattingMenuFocus?: InlineEditorProps['requestFormattingMenuFocus'];
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
  requestFormattingMenuFocus,
  formattingMenuElement,
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
  const requestFormattingMenuFocusRef = useRef(requestFormattingMenuFocus);
  useEffect(() => {
    commitRef.current = onCommit;
    exitRef.current = onExit;
    selectionRef.current = onSelectionChange;
    readyRef.current = onEditorReady;
    requestFormattingMenuFocusRef.current = requestFormattingMenuFocus;
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

  /*
    The session opens ON this surface (the built-in surface's law): take focus
    once per editor instance, unless something else in the frame already has
    it. Without this, an editor instance that replaced the one the canvas put
    the caret in (React StrictMode mounts effects twice in development, and
    tiptap recreates its view then) opened with focus on the frame's body:
    a double-click showed the editor but typing went nowhere. A pointer entry
    still places the caret afterwards (the canvas applies it after mount).
  */
  useEffect(() => {
    if (editor === null) {
      return;
    }
    const view = liveViewOf(editor);
    if (view === null || view.hasFocus()) {
      return;
    }
    const frameDocument = view.dom.ownerDocument;
    const active = frameDocument.activeElement;
    if (active !== null && active !== frameDocument.body) {
      return;
    }
    view.focus();
  }, [editor]);

  /*
    The caret goes where the person double-clicked (walk 2026-10-08: it
    opened at the start of the document, on the H2, every time). The canvas
    places a DOM caret at the click point when this surface appears, but
    ProseMirror, on focus, writes ITS selection (the document start) back to
    the DOM about 20ms later. So when focus arrives, the DOM caret — if it is
    inside this editor — is adopted into the editor's own selection first.
  */
  useEffect(() => {
    if (editor === null || editor.isDestroyed) {
      return undefined;
    }
    let dom: HTMLElement;
    try {
      dom = editor.view.dom;
    } catch {
      return undefined;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const adopt = () => {
      timer = undefined;
      const view = liveViewOf(editor);
      if (view === null) return;
      const selection = view.dom.ownerDocument.getSelection();
      const anchor = selection?.anchorNode;
      if (selection === null || anchor === null || anchor === undefined || !view.dom.contains(anchor)) return;
      let pos: number;
      try {
        pos = view.posAtDOM(anchor, selection.anchorOffset);
      } catch {
        return;
      }
      if (!selection.isCollapsed || pos === view.state.selection.from) return;
      editor.commands.setTextSelection(pos);
    };
    const onFocus = () => {
      timer ??= setTimeout(adopt, 0);
    };
    dom.addEventListener('focus', onFocus);
    if (dom.ownerDocument.activeElement === dom) onFocus();
    return () => {
      dom.removeEventListener('focus', onFocus);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [editor]);

  // Selection visibility is synchronous; geometry stays deferred until the
  // canvas's frame-coalesced anchor channel invokes this source.
  useEffect(() => {
    if (editor === null) {
      return;
    }
    const report = () => {
      const notify = selectionRef.current;
      if (notify === undefined) {
        return;
      }
      if (!shouldShowBubble(editor, formattingMenuElement)) {
        notify(null);
        return;
      }
      const source: SelectionAnchorSource = {
        measure: () =>
          shouldShowBubble(editor, formattingMenuElement) ? selectionAnchorOf(editor) : null,
      };
      notify(source);
    };
    const unsubscribe = subscribeBubbleReports({ editor, formattingMenuElement, report });
    return () => {
      unsubscribe();
      // Editing ended: never leave a stranded bubble (§5 b1).
      selectionRef.current?.(null);
    };
  }, [editor, formattingMenuElement]);

  // Capture ONLY the cross-document forward-Tab bridge before ProseMirror's
  // keymaps can consume it (for example inside a list). Every other editing key
  // remains on the existing bubble-phase path below.
  useEffect(() => {
    const container = containerRef.current;
    if (container === null || editor === null) {
      return undefined;
    }
    const onKeyDownCapture = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const request = requestFormattingMenuFocusRef.current;
      if (request === undefined) {
        return;
      }
      const moved = request(() => {
        liveViewOf(editor)?.focus();
      });
      if (!moved) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    container.addEventListener('keydown', onKeyDownCapture, true);
    return () => {
      container.removeEventListener('keydown', onKeyDownCapture, true);
    };
  }, [editor]);

  // Native containment: React's synthetic events do not cross the frame
  // boundary for content portaled into the preview document (009 §9 record 2).
  // Canvas gesture listeners live on that SAME frame document, so every
  // ordinary editing key and pointer gesture stops here. Escape remains the
  // session-level law: this surface exits and lets the host's idempotent exit
  // listener see it too. Nothing is default-cancelled — caret movement and
  // drag-to-select remain the browser/editor's own behavior.
  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        exitRef.current?.();
        return;
      }
      event.stopPropagation();
    };
    const stop = (event: Event) => {
      event.stopPropagation();
    };
    container.addEventListener('keydown', onKeyDown);
    container.addEventListener('click', stop);
    container.addEventListener('pointerdown', stop);
    container.addEventListener('dblclick', stop);
    return () => {
      container.removeEventListener('keydown', onKeyDown);
      container.removeEventListener('click', stop);
      container.removeEventListener('pointerdown', stop);
      container.removeEventListener('dblclick', stop);
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
        /*
          Editing happens IN the page, so it writes in the page's prose context.
          `.bldr-richtext` is the renderer's own prose stylesheet — the one the
          published output uses — so the surface cannot drift from the result.
          Naming the class (rather than copying its rules) is what keeps a
          single source: a margin changed in the renderer moves both at once.
        */
        surfaceClassName="bldr-richtext"
        onEditorReady={handleReady}
      />
    </div>
  );
}
