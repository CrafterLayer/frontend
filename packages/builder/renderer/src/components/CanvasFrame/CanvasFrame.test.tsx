import { act, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

// gsap-pixi additions (2026-10-08): the frame mounts the document engines through this seam.
const engines = vi.hoisted(() => ({
  calls: [] as { root: Element; interactive: boolean }[],
  dispose: [] as ReturnType<typeof vi.fn>[],
}));
vi.mock('../../engines/document-engines', () => ({
  mountDocumentEngines: (root: Element, options: { interactive: boolean }) => {
    engines.calls.push({ root, interactive: options.interactive });
    const dispose = vi.fn();
    engines.dispose.push(dispose);
    return dispose;
  },
}));

import { TEXT_BIDI_CANVAS_CSS } from '../../bidi';
import { darkTheme, lightTheme } from '../../themes';
import { CanvasFrame } from './CanvasFrame';

function frameDocumentOf(name: string): Document {
  const frame = screen.getByTitle<HTMLIFrameElement>(name);
  const frameDocument = frame.contentDocument;
  if (frameDocument === null) {
    throw new Error('iframe has no contentDocument in this environment');
  }
  return frameDocument;
}

describe('CanvasFrame', () => {
  it('mirrors each host style exactly once under StrictMode double-invoked effects', async () => {
    // StrictMode mounts → cleans up → remounts effects in dev; the cleanup must
    // remove its clones or every host stylesheet would be mirrored twice.
    const marker = document.createElement('style');
    marker.textContent = '.strict-marker { color: rebeccapurple; }';
    document.head.appendChild(marker);
    try {
      render(
        <StrictMode>
          <CanvasFrame theme={lightTheme} dir="ltr">
            <p>content</p>
          </CanvasFrame>
        </StrictMode>,
      );
      await waitFor(() => {
        const clones = Array.from(frameDocumentOf('Preview').head.querySelectorAll('style')).filter(
          (style) => style.textContent.includes('strict-marker'),
        );
        expect(clones).toHaveLength(1);
      });
    } finally {
      marker.remove();
    }
  });

  it('portals children into the frame body and names the frame accessibly', async () => {
    render(
      <CanvasFrame theme={lightTheme} dir="ltr">
        <p>Inside the frame</p>
      </CanvasFrame>,
    );
    await waitFor(() => {
      expect(frameDocumentOf('Preview').body.textContent).toContain('Inside the frame');
    });
  });

  it('injects the managed token style and rewrites it on theme switch (SC-004, no reload)', async () => {
    const { rerender } = render(
      <CanvasFrame theme={lightTheme} dir="ltr">
        <p>content</p>
      </CanvasFrame>,
    );
    await waitFor(() => {
      expect(frameDocumentOf('Preview').getElementById('bldr-theme-tokens')?.textContent).toContain(
        '--t-surface: #ffffff;',
      );
    });

    const bodyBefore = frameDocumentOf('Preview').body;
    rerender(
      <CanvasFrame theme={darkTheme} dir="ltr">
        <p>content</p>
      </CanvasFrame>,
    );
    await waitFor(() => {
      expect(frameDocumentOf('Preview').getElementById('bldr-theme-tokens')?.textContent).toContain(
        '--t-surface: #0b1120;',
      );
    });
    expect(frameDocumentOf('Preview').body).toBe(bodyBefore); // same document — no reload
  });

  it('carries the document direction on the frame root and follows flips', async () => {
    const { rerender } = render(
      <CanvasFrame theme={lightTheme} dir="ltr">
        <p>content</p>
      </CanvasFrame>,
    );
    await waitFor(() => {
      expect(frameDocumentOf('Preview').documentElement.getAttribute('dir')).toBe('ltr');
    });
    rerender(
      <CanvasFrame theme={lightTheme} dir="rtl">
        <p>content</p>
      </CanvasFrame>,
    );
    await waitFor(() => {
      expect(frameDocumentOf('Preview').documentElement.getAttribute('dir')).toBe('rtl');
    });
  });

  it('mirrors host styles into the frame, including styles injected AFTER mount', async () => {
    const preExisting = document.createElement('style');
    preExisting.textContent = '.pre { color: red; }';
    document.head.appendChild(preExisting);

    render(
      <CanvasFrame theme={lightTheme} dir="ltr">
        <p>content</p>
      </CanvasFrame>,
    );
    await waitFor(() => {
      const styles = [...frameDocumentOf('Preview').head.querySelectorAll('style')].map(
        (styleNode) => styleNode.textContent,
      );
      expect(styles).toContain('.pre { color: red; }');
    });

    const injected = document.createElement('style');
    injected.textContent = '.post { color: blue; }';
    act(() => {
      document.head.appendChild(injected);
    });
    await waitFor(() => {
      const styles = [...frameDocumentOf('Preview').head.querySelectorAll('style')].map(
        (styleNode) => styleNode.textContent,
      );
      expect(styles).toContain('.post { color: blue; }');
    });

    preExisting.remove();
    injected.remove();
  });

  // ── block-parts (2026-10-06) ──
  it('injects the text-direction style exactly once, under StrictMode and across rerenders and remounts', async () => {
    const tree = (theme: typeof lightTheme, dir: 'ltr' | 'rtl') => (
      <StrictMode>
        <CanvasFrame theme={theme} dir={dir}>
          <p>The site grows.</p>
        </CanvasFrame>
      </StrictMode>
    );
    const first = render(tree(lightTheme, 'rtl'));
    await waitFor(() => {
      const styles = frameDocumentOf('Preview').head.querySelectorAll('style#ck-text-bidi');
      expect(styles).toHaveLength(1);
      expect(styles[0]?.textContent).toBe(TEXT_BIDI_CANVAS_CSS);
    });
    first.rerender(tree(darkTheme, 'ltr'));
    first.rerender(tree(lightTheme, 'rtl'));
    await waitFor(() => {
      expect(frameDocumentOf('Preview').documentElement.getAttribute('dir')).toBe('rtl');
    });
    expect(frameDocumentOf('Preview').head.querySelectorAll('style#ck-text-bidi')).toHaveLength(1);
    first.unmount();

    render(tree(lightTheme, 'rtl'));
    await waitFor(() => {
      expect(frameDocumentOf('Preview').head.querySelectorAll('style#ck-text-bidi')).toHaveLength(
        1,
      );
    });
  });
  // ── /block-parts ──

  // gsap-pixi additions (2026-10-08)
  it('mounts the document engines on the frame body only when asked, keyed on the mode', async () => {
    engines.calls.length = 0;
    engines.dispose.length = 0;
    const tree = (siteEngines?: { interactive: boolean }) => (
      <CanvasFrame theme={lightTheme} dir="rtl" siteEngines={siteEngines}>
        <section data-ck-scene="particles">
          <h2>مرحبا</h2>
        </section>
      </CanvasFrame>
    );
    const view = render(tree());
    await waitFor(() => {
      expect(frameDocumentOf('Preview').body.textContent).toContain('مرحبا');
    });
    expect(engines.calls).toEqual([]);

    view.rerender(tree({ interactive: false }));
    await waitFor(() => {
      expect(engines.calls).toHaveLength(1);
    });
    expect(engines.calls[0]?.root).toBe(frameDocumentOf('Preview').body);
    expect(engines.calls[0]?.interactive).toBe(false);

    // A fresh object with the same mode never re-mounts.
    view.rerender(tree({ interactive: false }));
    expect(engines.calls).toHaveLength(1);

    view.rerender(tree({ interactive: true }));
    await waitFor(() => {
      expect(engines.calls).toHaveLength(2);
    });
    expect(engines.dispose[0]).toHaveBeenCalledTimes(1);
    expect(engines.calls[1]?.interactive).toBe(true);

    view.unmount();
    expect(engines.dispose[1]).toHaveBeenCalledTimes(1);
  });
});
