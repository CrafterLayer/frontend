import { useCallback, useEffect, useRef, useState } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import {
  CanvasFrame,
  DocumentView,
  useKernelSelector,
  type RenderBreakpoint,
  type Theme,
} from '@craftkit/builder-renderer';
import type { ContentDirection } from '@craftkit/builder-schema';

import '../../styles/visually-hidden.css';
// library-playground additions (2026-10-08): the frame's <html lang> follows the page.
import { useFrameLang } from '../EditorCanvas/frame-lang';
// end library-playground additions
import './PreviewMode.css';

// gsap-pixi additions (2026-10-08): engines on registered blocks play as on the published page.
const PREVIEW_SITE_ENGINES = { interactive: true } as const;
// end gsap-pixi additions

export interface PreviewModeProps {
  /** BY PROP — the shell never reads React context. */
  kernel: BuilderKernel;
  theme: Theme;
  /** View-state direction override; null/absent = the document's own direction. */
  dirOverride?: ContentDirection | null | undefined;
  /**
   * The device the person is previewing AT.
   *
   * Preview used to render at the default breakpoint whatever device was
   * selected, so a tablet override simply never appeared — the one thing
   * preview exists to show. Defaulted rather than required so every existing
   * caller keeps working, and the playground now passes its selection.
   */
  breakpoint?: RenderBreakpoint | undefined;
  /** Viewport width in CSS pixels; omitted or invalid means the available width. */
  frameWidth?: number | undefined;
  /** Escape (host or frame) triggers this too. */
  onExit: () => void;
}

/**
 * Preview mode (007 contract §5): the PUBLISH-SAFE path — CanvasFrame +
 * DocumentView with no attachment, no chrome layer, no editable wiring (p1).
 * The direction override changes only the frame rendering; the kernel is never
 * touched, so the whole round trip is zero transactions and the document stays
 * reference-identical (p2). Escape exits from ANYWHERE (p3): the listener is
 * bound at the host document for the preview's lifetime — entering preview
 * unmounts whatever had focus, so exit must not depend on where focus landed —
 * plus the frame document (keydown does not cross documents, the B2b law).
 */
export function PreviewMode({
  kernel,
  theme,
  dirOverride,
  breakpoint,
  frameWidth,
  onExit,
}: PreviewModeProps) {
  const docDir = useKernelSelector(
    kernel,
    useCallback(
      (state: ReturnType<BuilderKernel['context']['store']['getState']>): ContentDirection =>
        state.doc.dir,
      [],
    ),
  );
  const dir = dirOverride ?? docDir;
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
  const regionRef = useRef<HTMLDivElement | null>(null);
  // library-playground additions (2026-10-08): the document's language, not the flip's direction.
  useFrameLang(kernel, frame);
  // end library-playground additions

  // Mount focus: preview is a modal surface — focus moves into the region on
  // ENTRY, once. Deliberately separate from the Escape effect below: an onExit
  // identity change (a fresh inline closure per composer render) must never
  // re-steal focus from a control inside the preview (§11 convergence fix).
  useEffect(() => {
    regionRef.current?.focus();
  }, []);

  // Host-document Escape: exit works wherever focus is for the whole lifetime.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onExit();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onExit]);

  useEffect(() => {
    if (frame === null) {
      return undefined;
    }
    const frameDocument = frame.contentDocument;
    /* v8 ignore next 3 -- same-origin frames always expose a document (see CanvasFrame). */
    if (frameDocument === null) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onExit();
      }
    };
    frameDocument.addEventListener('keydown', onKeyDown);
    return () => {
      frameDocument.removeEventListener('keydown', onKeyDown);
    };
  }, [frame, onExit]);

  // Entry announcement: a live region announces MUTATIONS, so the message is
  // set after mount (rAF keeps the state write out of the effect body) using
  // the established {text, nonce} pattern.
  const [message, setMessageState] = useState({ text: '', nonce: 0 });
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setMessageState((current) => ({
        text: 'Preview — press Escape to return to editing.',
        nonce: current.nonce + 1,
      }));
    });
    return () => {
      cancelAnimationFrame(handle);
    };
  }, []);

  return (
    <div ref={regionRef} className="bldr-preview" role="region" aria-label="Preview" tabIndex={0}>
      <div
        className="bldr-preview__frame"
        style={
          frameWidth !== undefined && Number.isFinite(frameWidth) && frameWidth >= 1
            ? { inlineSize: `${String(frameWidth)}px`, maxInlineSize: '100%' }
            : undefined
        }
      >
        <CanvasFrame
          theme={theme}
          dir={dir}
          title="Preview"
          onFrame={setFrame}
          siteEngines={PREVIEW_SITE_ENGINES} /* gsap-pixi additions (2026-10-08) */
        >
          {/*
            `isCanvas={false}` is the whole difference between this and the
            canvas: a block's editing-only scaffolding — empty-state hints, drop
            affordances — must not reach the person reading the finished page.
          */}
          <DocumentView kernel={kernel} isCanvas={false} breakpoint={breakpoint} />
        </CanvasFrame>
      </div>
      <button type="button" className="bldr-preview__exit" onClick={onExit}>
        Exit preview
      </button>
      <output className="bldr-visually-hidden" aria-live="polite" aria-label="Preview messages">
        {message.text}
        {message.nonce % 2 === 1 ? '​' : ''}
      </output>
    </div>
  );
}
