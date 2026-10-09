import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import type { ContentDirection } from '@craftkit/builder-schema';

import { TEXT_BIDI_CANVAS_CSS, TEXT_BIDI_STYLE_ID } from '../../bidi';
import { mountDocumentEngines } from '../../engines/document-engines'; // gsap-pixi additions (2026-10-08)
import { themeToCssVars, type Theme } from '../../resolve/theme';

export interface CanvasFrameProps {
  /** Complete token assignment; switching recolors the frame live (FR-008). */
  theme: Theme;
  /** Document content direction — independent of the host UI's direction (FR-009). */
  dir: ContentDirection;
  /** Accessible name of the preview frame. */
  title?: string;
  /**
   * Edit-mode cooperation (005 contract §2): reports the mounted iframe element
   * once its document is ready, and null on unmount — the shell builds its
   * geometry index and chrome from it. Absent ⇒ behavior identical to 004.
   */
  onFrame?: ((frame: HTMLIFrameElement | null) => void) | undefined;
  // gsap-pixi additions (2026-10-08)
  /**
   * Mount the engines (scene, timeline, Lottie) that REGISTERED blocks' markers name, on the
   * frame body (`mountDocumentEngines`): `interactive: false` on the editor canvas (they run, but
   * never restructure the DOM or take pointer input), `true` in Preview. customCode regions mount
   * their own. Absent ⇒ no engine outside customCode (behaviour identical to before).
   */
  siteEngines?: { readonly interactive: boolean } | undefined;
  // end gsap-pixi additions
  children: ReactNode;
}

const TOKEN_STYLE_ID = 'bldr-theme-tokens';

/**
 * The isolation boundary document content renders into (FR-018): a same-origin
 * iframe that mirrors the host page's stylesheets (initial copy + observer for
 * dev-server style injection), injects one managed token style and one text
 * direction style (`TEXT_BIDI_CSS`), carries the
 * document direction on its root, and portals children into its body. Built
 * in-repo by decision (research R3) — the reference vendor pass arrives with the
 * canvas-editing milestone.
 */
export function CanvasFrame({
  theme,
  dir,
  title = 'Preview',
  onFrame,
  siteEngines,
  children,
}: CanvasFrameProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [frameBody, setFrameBody] = useState<HTMLElement | null>(null);
  // Latest-callback ref so the mount effect (deliberately []-dep) never re-runs
  // when a caller passes a fresh onFrame identity.
  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  });

  // Mount: prepare the frame document and start mirroring host styles.
  useEffect(() => {
    const frame = frameRef.current;
    const frameDocument = frame?.contentDocument ?? null;
    /* v8 ignore next 3 -- same-origin frames always expose a document after mount;
       the guard exists for exotic hosts (sandboxed embeds), unreachable in tests. */
    if (frame === null || frameDocument === null) {
      return;
    }

    const mirrored = new Map<Node, Node>();
    const mirror = (styleNode: Node) => {
      if (mirrored.has(styleNode)) {
        return;
      }
      const clone = styleNode.cloneNode(true);
      frameDocument.head.appendChild(clone);
      mirrored.set(styleNode, clone);
    };
    const isStyleNode = (node: Node): boolean =>
      node.nodeName === 'STYLE' ||
      (node.nodeName === 'LINK' && (node as HTMLLinkElement).rel === 'stylesheet');

    for (const node of Array.from(frame.ownerDocument.head.children)) {
      if (isStyleNode(node)) {
        mirror(node);
      }
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (isStyleNode(node)) {
            mirror(node);
          }
        });
        mutation.removedNodes.forEach((node) => {
          const clone = mirrored.get(node);
          if (clone !== undefined) {
            clone.parentNode?.removeChild(clone);
            mirrored.delete(node);
          }
        });
      }
    });
    observer.observe(frame.ownerDocument.head, { childList: true });

    setFrameBody(frameDocument.body);
    onFrameRef.current?.(frame);
    return () => {
      onFrameRef.current?.(null);
      observer.disconnect();
      // Remove this invocation's clones so StrictMode's dev-only
      // mount→cleanup→remount cycle cannot accumulate duplicates.
      for (const clone of mirrored.values()) {
        clone.parentNode?.removeChild(clone);
      }
      mirrored.clear();
    };
  }, []);

  // Theme: one managed style element, rewritten on switch — no reload (SC-004).
  useEffect(() => {
    const frameDocument = frameRef.current?.contentDocument ?? null;
    /* v8 ignore next 3 -- unreachable in same-origin environments (see mount effect). */
    if (frameDocument === null) {
      return;
    }
    let tokenStyle = frameDocument.getElementById(TOKEN_STYLE_ID);
    if (tokenStyle === null) {
      tokenStyle = frameDocument.createElement('style');
      tokenStyle.id = TOKEN_STYLE_ID;
      frameDocument.head.appendChild(tokenStyle);
    }
    tokenStyle.textContent = themeToCssVars(theme);
  }, [theme, frameBody]);

  // ── block-parts (2026-10-06) ──
  // Text direction (block-parts DESIGN §2.11): one managed style that gives
  // every text element its own base direction, so an English line on an RTL
  // page keeps its full stop at the end. Looked up by id before it is created,
  // so StrictMode's double effects and remounts never add a second copy.
  useEffect(() => {
    const frameDocument = frameRef.current?.contentDocument ?? null;
    /* v8 ignore next 3 -- unreachable in same-origin environments (see mount effect). */
    if (frameDocument === null) {
      return;
    }
    let bidiStyle = frameDocument.getElementById(TEXT_BIDI_STYLE_ID);
    if (bidiStyle === null) {
      bidiStyle = frameDocument.createElement('style');
      bidiStyle.id = TEXT_BIDI_STYLE_ID;
      frameDocument.head.appendChild(bidiStyle);
    }
    bidiStyle.textContent = TEXT_BIDI_CANVAS_CSS;
  }, [frameBody]);
  // ── /block-parts ──

  // Direction: the frame ROOT carries the document dir (host UI dir untouched).
  useEffect(() => {
    const frameDocument = frameRef.current?.contentDocument ?? null;
    /* v8 ignore next -- unreachable in same-origin environments (see mount effect). */
    if (frameDocument !== null) {
      frameDocument.documentElement.setAttribute('dir', dir);
    }
  }, [dir, frameBody]);

  // gsap-pixi additions (2026-10-08): engines on registered blocks, keyed on the mode only, so a
  // caller's fresh object identity never re-mounts them.
  const engineMode = siteEngines === undefined ? undefined : siteEngines.interactive;
  useEffect(() => {
    if (frameBody === null || engineMode === undefined) {
      return undefined;
    }
    return mountDocumentEngines(frameBody, { interactive: engineMode });
  }, [frameBody, engineMode]);
  // end gsap-pixi additions

  return (
    <iframe
      ref={frameRef}
      title={title}
      style={{ border: '0', display: 'block', inlineSize: '100%', blockSize: '100%' }}
    >
      {frameBody === null ? null : createPortal(children, frameBody)}
    </iframe>
  );
}
