import type { SceneProbeFrameResult } from './scene-probe-report';

/**
 * One probe pass in the host page (creative-power Phase 2 E, 2026-10-12): mount the probe's
 * preview document in a sandboxed iframe (`allow-scripts` only — the Studio preview's own policy,
 * an opaque origin with no access to the editor), wait for its `ck-preview:probe` report, remove
 * the frame. Resolves, never rejects: a frame that never reports is a `timeout`.
 *
 * The frame is laid out at the pass's viewport size, fixed at the window's corner, behind the page
 * and inert. It stays INSIDE the viewport and is never fully transparent, on purpose: Chromium
 * stops rendering a cross-origin frame that is off-screen, and does not composite one at
 * `opacity: 0` — its WebGL work then piles up and reading the canvas back stalls for seconds
 * (measured 2026-10-12: ~8 s at opacity 0, ~1 s at 0.01, software WebGL).
 *
 * Self-contained (no module-scope reference), so a browser test can hand this very function to
 * `page.evaluate` (whose single argument leaves `signal` undefined).
 */

export interface SceneProbeFrameArgs {
  /** The probe document (`buildStudioPreviewHtml({ …, probe })`). */
  readonly html: string;
  readonly width: number;
  readonly height: number;
  /** Give up after this long (the document's own deadline is a little earlier). */
  readonly timeoutMs: number;
}

export function runSceneProbeFrame(
  args: SceneProbeFrameArgs,
  signal?: AbortSignal,
): Promise<SceneProbeFrameResult> {
  return new Promise<SceneProbeFrameResult>(function probe(resolve): void {
    const doc = document;
    const view = doc.defaultView ?? window;
    if (signal?.aborted === true) {
      resolve({ status: 'aborted', report: null, failure: 'Stopped before the scene ran.' });
      return;
    }
    const frame = doc.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('title', 'Scene check');
    frame.tabIndex = -1;
    const style = frame.style;
    style.position = 'fixed';
    style.left = '0';
    style.top = '0';
    style.width = `${String(args.width)}px`;
    style.height = `${String(args.height)}px`;
    style.border = '0';
    style.opacity = '0.01';
    style.pointerEvents = 'none';
    style.zIndex = '-1';
    let settled = false;
    function finish(result: SceneProbeFrameResult): void {
      if (settled) return;
      settled = true;
      view.clearTimeout(timer);
      view.removeEventListener('message', onMessage);
      if (signal !== undefined) signal.removeEventListener('abort', onAbort);
      frame.remove();
      resolve(result);
    }
    function onMessage(event: MessageEvent): void {
      if (event.source === null || event.source !== frame.contentWindow) return;
      const data = event.data as { type?: unknown; report?: unknown; failure?: unknown } | null;
      if (data === null || typeof data !== 'object' || data.type !== 'ck-preview:probe') return;
      if (data.report !== null && typeof data.report === 'object') {
        finish({ status: 'done', report: data.report as never });
      } else {
        const failure = typeof data.failure === 'string' ? data.failure : 'No report.';
        finish({ status: 'failed', report: null, failure });
      }
    }
    function onAbort(): void {
      finish({ status: 'aborted', report: null, failure: 'Stopped while the scene ran.' });
    }
    function late(): void {
      finish({
        status: 'timeout',
        report: null,
        failure: `The scene did not report within ${String(args.timeoutMs)} ms.`,
      });
    }
    // Same-process frames share the main thread: a heavy scene starves timers, not frames.
    const end = Date.now() + args.timeoutMs;
    function watch(): void {
      if (settled) return;
      if (Date.now() >= end) late();
      else view.requestAnimationFrame(watch);
    }
    const timer = view.setTimeout(late, args.timeoutMs);
    view.requestAnimationFrame(watch);
    view.addEventListener('message', onMessage);
    if (signal !== undefined) signal.addEventListener('abort', onAbort);
    frame.srcdoc = args.html;
    doc.body.appendChild(frame);
  });
}
