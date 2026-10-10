import { afterEach, describe, expect, it, vi } from 'vitest';

import { mountScripts } from '../behaviors/packs/scripts';
import type { EngineLoader } from '../engines/inject';
import {
  STUDIO_PREVIEW_MESSAGES,
  buildStudioPreviewHtml,
  studioPreviewBridge,
  studioPreviewCsp,
  studioPreviewEngines,
} from './preview-document';

/*
  pixi-studio:runtime-wiring (2026-10-10): the sandboxed Script Studio preview (DESIGN §D.3).
  The asset sources are replaced by labelled stand-ins; the bridge runs for real in jsdom.
*/

function stand(kind: string): EngineLoader {
  return () => Promise.resolve(`/* ${kind} stand-in </script> */`);
}
const loaders = {
  pixi: stand('pixi'),
  'lib-kit': stand('lib-kit'),
  'lib-filters': stand('lib-filters'),
  'lib-physics': stand('lib-physics'),
  sound: stand('sound'),
};

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('studioPreviewCsp', () => {
  it('trusted: the §D.3 policy, plus eval for the free-code runtime and blob workers for Pixi', () => {
    const csp = studioPreviewCsp('trusted');
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'unsafe-inline' 'unsafe-eval'");
    expect(csp).toContain('img-src data: blob: https:');
    expect(csp).toContain('media-src data: blob:');
    expect(csp).toContain('connect-src https: data: blob:');
    expect(studioPreviewCsp()).toBe(csp);
  });

  it('unreviewed: no network at all and no remote images', () => {
    const csp = studioPreviewCsp('unreviewed');
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain('img-src data: blob:;');
    expect(csp).not.toContain('https:;');
    expect(csp).not.toMatch(/img-src[^;]*https:/u);
  });
});

describe('studioPreviewEngines', () => {
  it('orders pixi, the libraries, then sound; libs and sound options add to what the code names', () => {
    expect(studioPreviewEngines({ code: "await ck.scene({ libs: ['filters'] });" })).toEqual([
      'pixi',
      'lib-kit',
      'lib-filters',
    ]);
    expect(
      studioPreviewEngines({ code: 'ck.root.title = "x"', libs: ['physics'], sound: true }),
    ).toEqual(['lib-physics', 'sound']);
    expect(studioPreviewEngines({ code: 'ck.root.title = "x"' })).toEqual([]);
  });
});

describe('buildStudioPreviewHtml', () => {
  it('is a full document: CSP meta, shim, inlined assets, the region with code and params, the bridge', async () => {
    const code =
      'const p = ck.params({ n: 1 }); const s = await ck.scene({ libs: [\'filters\'] }); // "q" & <b>';
    const html = await buildStudioPreviewHtml({
      code,
      params: { n: 4 },
      lang: 'ar',
      dir: 'rtl',
      themeCss: ':root{--t-accent:#0a7}</style><script>',
      loaders,
      width: 390,
    });
    expect(html.startsWith('<!doctype html>')).toBe(true);
    const doc = parse(html);
    expect(doc.documentElement.getAttribute('lang')).toBe('ar');
    expect(doc.documentElement.getAttribute('dir')).toBe('rtl');
    expect(
      doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content'),
    ).toBe(studioPreviewCsp('trusted'));
    expect(doc.querySelector('meta[name="viewport"]')?.getAttribute('content')).toContain(
      'width=390',
    );
    // The theme cannot close its <style> early.
    expect(doc.querySelectorAll('style')).toHaveLength(1);
    expect(doc.querySelector('style')?.textContent).toContain('--t-accent:#0a7');

    const engines = Array.from(doc.querySelectorAll('script[data-ck-engine]')).map((script) =>
      script.getAttribute('data-ck-engine'),
    );
    expect(engines).toEqual(['pixi', 'lib-kit', 'lib-filters']);
    // A `</script>` inside an asset is escaped, so each asset stays one element.
    expect(doc.querySelector('script[data-ck-engine="pixi"]')?.textContent).toContain(
      '<\\/script>',
    );

    const scripts = Array.from(doc.querySelectorAll('script:not([data-ck-engine])'));
    expect(scripts[0]?.textContent).toContain('function ensureCkEngines(');
    const bridge = scripts.at(-1)?.textContent ?? '';
    expect(bridge).toContain('function studioPreviewBridge(');
    expect(bridge).toContain('function mountScripts(');
    for (const type of [
      'ck-preview:params',
      'ck-preview:run',
      'ck-preview:pause',
      'ck-preview:capture',
    ]) {
      expect(bridge).toContain(type);
    }

    const region = doc.getElementById('ck-preview');
    expect(region?.getAttribute('data-ck-js')).toBe(code);
    expect(region?.getAttribute('data-ck-params')).toBe('{"n":4}');
    expect(region?.hasAttribute('data-ck-custom-code')).toBe(true);
  });

  it('uses the stricter CSP for an unreviewed entry and inlines sound data only with the engine', async () => {
    const html = await buildStudioPreviewHtml({
      code: "ck.sound.play('lib:chime');",
      trust: 'unreviewed',
      soundBank: { chime: { id: 'chime' } },
      soundAssets: { a1: 'data:audio/mpeg;base64,AAAA', bad: 'https://evil.example/x.mp3' },
      loaders,
    });
    const doc = parse(html);
    expect(
      doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content'),
    ).toBe(studioPreviewCsp('unreviewed'));
    expect(doc.querySelector('script[data-ck-engine="sound"]')).not.toBeNull();
    expect(doc.querySelector('script[data-ck-engine="pixi"]')).toBeNull();
    expect(
      JSON.parse(doc.querySelector('script[data-ck-sound-bank]')?.textContent ?? 'null'),
    ).toEqual({
      chime: { id: 'chime' },
    });
    expect(doc.querySelector('link[data-ck-sound-asset="a1"]')).not.toBeNull();
    expect(doc.querySelector('link[data-ck-sound-asset="bad"]')).toBeNull();

    const quiet = parse(
      await buildStudioPreviewHtml({ code: 'ck.root.title = "x"', soundBank: { a: {} }, loaders }),
    );
    expect(quiet.querySelector('script[data-ck-sound-bank]')).toBeNull();
    expect(quiet.querySelector('script[data-ck-engine]')).toBeNull();
  });
});

describe('studioPreviewBridge (in the frame)', () => {
  function frame() {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const win = iframe.contentWindow as Window & typeof globalThis;
    const doc = win.document;
    doc.body.innerHTML =
      '<div id="ck-preview" data-ck-custom-code="" data-ck-js-id="preview"></div>';
    const posted: Record<string, unknown>[] = [];
    vi.spyOn(win.parent, 'postMessage').mockImplementation((message: unknown) => {
      posted.push(message as Record<string, unknown>);
    });
    return { iframe, win, doc, posted };
  }

  function send(win: Window, data: unknown, source: unknown = win.parent): void {
    const MessageEventConstructor = (win as Window & { MessageEvent: typeof MessageEvent })
      .MessageEvent;
    win.dispatchEvent(new MessageEventConstructor('message', { data, source: source as Window }));
  }

  it('announces itself, applies params (re-running the region) and re-runs on demand', () => {
    const { win, doc, posted } = frame();
    const mounts: number[] = [];
    const disposes: number[] = [];
    studioPreviewBridge(
      win,
      function mount() {
        mounts.push(mounts.length);
        return function dispose() {
          disposes.push(disposes.length);
        };
      },
      false,
    );
    expect(posted).toContainEqual({ type: STUDIO_PREVIEW_MESSAGES.ready });
    send(win, { type: 'ck-preview:params', values: { n: 9 } });
    expect(doc.getElementById('ck-preview')?.getAttribute('data-ck-params')).toBe('{"n":9}');
    send(win, { type: 'ck-preview:params', values: {} });
    expect(doc.getElementById('ck-preview')?.hasAttribute('data-ck-params')).toBe(false);
    send(win, { type: 'ck-preview:run' });
    expect(mounts).toHaveLength(2);
    expect(disposes).toHaveLength(1);
  });

  it('ignores messages that are not from its parent', () => {
    const { win, doc } = frame();
    studioPreviewBridge(win, () => () => undefined, false);
    send(win, { type: 'ck-preview:params', values: { n: 1 } }, null);
    expect(doc.getElementById('ck-preview')?.hasAttribute('data-ck-params')).toBe(false);
  });

  it('reports a script error with its line, via the scripts pack', async () => {
    const { win, doc, posted } = frame();
    doc
      .getElementById('ck-preview')
      ?.setAttribute('data-ck-js', 'const a = 1;\nconst b = 2;\nthrow new Error("boom on three");');
    vi.spyOn(win.console, 'error').mockImplementation(() => undefined);
    studioPreviewBridge(win, mountScripts, false);
    await new Promise((done) => setTimeout(done, 0));
    const error = posted.find((message) => message['type'] === STUDIO_PREVIEW_MESSAGES.error);
    expect(error?.['message']).toBe('boom on three');
    // jsdom's stack carries the sourceURL line when it can; when it does, it is the author's line.
    if (error?.['line'] !== null) expect(error?.['line']).toBe(3);
  });

  it('simulates reduced motion for the script when asked', async () => {
    const { win, doc } = frame();
    doc
      .getElementById('ck-preview')
      ?.setAttribute(
        'data-ck-js',
        'ck.root.setAttribute("data-reduced", String(ck.reducedMotion));',
      );
    studioPreviewBridge(win, mountScripts, true);
    await new Promise((done) => setTimeout(done, 0));
    expect(doc.getElementById('ck-preview')?.getAttribute('data-reduced')).toBe('true');
  });

  it('holds animation frames while paused and releases them on resume', () => {
    const { win } = frame();
    studioPreviewBridge(win, () => () => undefined, false);
    send(win, { type: 'ck-preview:pause' });
    const id = win.requestAnimationFrame(() => undefined);
    expect(id).toBeLessThan(0);
    send(win, { type: 'ck-preview:pause', paused: false });
    expect(win.requestAnimationFrame(() => undefined)).toBeGreaterThanOrEqual(0);
  });
});
