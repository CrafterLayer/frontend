/**
 * Replay an element's motion on the canvas — the Interactions panel's
 * Preview button (style-manager DESIGN.md §B.3, §B.4).
 *
 * The canvas shows final states (its region carries `data-ck-still`), and a
 * preset plays there only while the element carries `data-ck-play`. A CSS
 * animation restarts only when it is removed for one style pass, so this
 * drops the attribute, flushes styles, and sets a fresh nonce. It touches the
 * canvas DOM only — never the document — so a preview is not an edit and
 * leaves nothing to undo. The runtime watches `data-ck-play` on the canvas
 * and builds the DOM-rebuilding presets (split text, typewriter, meteors)
 * for the length of the preview.
 *
 * Returns a stop function; the preview also ends by itself after `ms`.
 */
export function replayMotion(element: Element, ms = 2400): () => void {
  const view = element.ownerDocument.defaultView;
  element.removeAttribute('data-ck-play');
  // Reading a layout property flushes styles: the "one pass without" a restart needs.
  if ((element as HTMLElement).offsetWidth < 0) return () => undefined;
  const nonce = String(Date.now());
  element.setAttribute('data-ck-play', nonce);
  let stopped = false;
  function stop(): void {
    if (stopped) return;
    stopped = true;
    if (view !== null) view.clearTimeout(timer);
    if (element.getAttribute('data-ck-play') === nonce) element.removeAttribute('data-ck-play');
  }
  const timer = view === null ? 0 : view.setTimeout(stop, ms);
  return stop;
}
