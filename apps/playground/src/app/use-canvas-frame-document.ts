import { useEffect, useState } from 'react';

/** Where `EditorCanvas` draws its page: the iframe inside its viewport. */
export const CANVAS_FRAME_SELECTOR = '[data-testid="bldr-canvas-viewport"] iframe';

/**
 * The canvas iframe's document, followed as the canvas mounts, unmounts and
 * remounts (another fixture, the code view, a preview and back).
 *
 * The canvas does not hand its frame out, and the style panel's forced-state
 * preview and Interactions → Preview both need the DOM the person is looking
 * at, so the host finds it the way a person would: by where it is drawn.
 */
export function useCanvasFrameDocument(host: Document = document): Document | null {
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  useEffect(() => {
    let current: HTMLIFrameElement | null = null;
    const read = (): void => {
      const frame = host.querySelector<HTMLIFrameElement>(CANVAS_FRAME_SELECTOR);
      if (frame !== current) {
        current?.removeEventListener('load', read);
        current = frame;
        current?.addEventListener('load', read);
      }
      const next = frame?.contentDocument ?? null;
      setFrameDocument((previous) => (previous === next ? previous : next));
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(host.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      current?.removeEventListener('load', read);
    };
  }, [host]);
  return frameDocument;
}
