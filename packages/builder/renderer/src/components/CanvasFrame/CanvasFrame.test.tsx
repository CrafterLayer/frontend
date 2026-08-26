import { act, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';

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
});
