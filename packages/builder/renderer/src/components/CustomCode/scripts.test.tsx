import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CustomCodeNode } from '@craftkit/builder-schema';

import { CustomCode } from './CustomCode';

/*
  Free-code mode (2026-10-09): the region's own script, as the renderer hands it on.
  The pack that evaluates it is tested in behaviors/packs/scripts.test.ts; here is what is
  CustomCode's: the attribute contract, and WHEN the script runs on a React host.
*/

function tree(children: CustomCodeNode[] = []) {
  return { kind: 'root' as const, children };
}

const paragraph = (text: string): CustomCodeNode => ({ kind: 'element', tag: 'p', text });

type Win = Window & { log?: string[]; ckJsGuard?: unknown };
const win = () => document.defaultView as unknown as Win;
const GUARD = 'ck-js-guard';

beforeEach(() => {
  win().log = [];
  delete win().ckJsGuard;
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  document.head.innerHTML = '';
});

describe('CustomCode — the script attribute contract', () => {
  it('puts the code on the region as data-ck-js with the node id, and writes no <script>', () => {
    const { container } = render(
      <CustomCode hostId="n1" tree={tree([paragraph('hi')])} js="ck.root.dataset.x = '1';" />,
    );
    const region = container.querySelector('[data-ck-custom-code]');

    expect(region?.getAttribute('data-ck-js')).toBe("ck.root.dataset.x = '1';");
    expect(region?.getAttribute('data-ck-js-id')).toBe('n1');
    expect(container.querySelector('script')).toBeNull();
  });

  it.each([undefined, '', '   \n\t '])('writes no attribute for an empty script (%j)', (js) => {
    const { container } = render(<CustomCode hostId="n1" tree={tree()} js={js} />);
    const region = container.querySelector('[data-ck-custom-code]');

    expect(region?.hasAttribute('data-ck-js')).toBe(false);
    expect(region?.hasAttribute('data-ck-js-id')).toBe(false);
  });

  it('round-trips awkward code through the static markup and the HTML parser', () => {
    const code = 'if (a < 1 && b > 2) { x = "q"; y = \'s\'; } // </script>\nconst t = `${1}`;';
    const html = renderToStaticMarkup(<CustomCode hostId="n1" tree={tree()} js={code} />);
    const parsed = new DOMParser().parseFromString(html, 'text/html');

    expect(html).not.toContain('</script>');
    expect(parsed.querySelector('[data-ck-js]')?.getAttribute('data-ck-js')).toBe(code);
  });

  it('renders the same region on the canvas and in the static markup', () => {
    const code = 'void 0;';
    const canvas = render(
      <CustomCode hostId="n1" tree={tree([paragraph('hi')])} js={code} isCanvas={false} />,
    );
    const region = canvas.container.querySelector('[data-ck-custom-code]');
    // After mount the runtime adds its own bookkeeping (the mount mark, `position: relative` on a
    // static region); the contract under test is the markup React renders, which is the rest.
    region?.removeAttribute('data-ck-js-mounted');
    region?.removeAttribute('style');
    const staticHtml = renderToStaticMarkup(
      <CustomCode hostId="n1" tree={tree([paragraph('hi')])} js={code} />,
    );

    const normal = (html: string) => html.replaceAll(/\s+/gu, ' ').trim();
    expect(normal(staticHtml)).toBe(normal(region?.outerHTML ?? 'MISSING'));
  });
});

describe('CustomCode — when the script runs', () => {
  const script = (name: string) =>
    `window.log.push('run ${name}'); ck.onDispose(() => window.log.push('dispose ${name}'));`;

  it('runs once on mount and disposes on unmount', () => {
    const { unmount } = render(<CustomCode hostId="n1" tree={tree()} js={script('a')} />);
    expect(win().log).toEqual(['run a']);
    unmount();
    expect(win().log).toEqual(['run a', 'dispose a']);
  });

  it('does NOT restart when only the tree changes — editing text must not tear down a running scene', () => {
    const { rerender } = render(
      <CustomCode hostId="n1" tree={tree([paragraph('one')])} js={script('a')} />,
    );
    rerender(<CustomCode hostId="n1" tree={tree([paragraph('two')])} js={script('a')} />);
    rerender(<CustomCode hostId="n1" tree={tree([paragraph('three')])} js={script('a')} />);
    expect(win().log).toEqual(['run a']);
  });

  it('disposes the old script and runs the new one when the CODE changes', () => {
    const { rerender } = render(<CustomCode hostId="n1" tree={tree()} js={script('a')} />);
    rerender(<CustomCode hostId="n1" tree={tree()} js={script('b')} />);
    expect(win().log).toEqual(['run a', 'dispose a', 'run b']);
  });

  it('stops the script when the code is emptied', () => {
    const { rerender, container } = render(
      <CustomCode hostId="n1" tree={tree()} js={script('a')} />,
    );
    rerender(<CustomCode hostId="n1" tree={tree()} js="" />);
    expect(win().log).toEqual(['run a', 'dispose a']);
    expect(container.querySelector('[data-ck-custom-code]')?.hasAttribute('data-ck-js')).toBe(
      false,
    );
  });

  it('gives the script the editor flag on the canvas and clears nothing on the live page', () => {
    const code = "ck.root.setAttribute('data-editor', String(ck.editor));";
    const canvas = render(<CustomCode hostId="n1" tree={tree()} js={code} isCanvas />);
    const live = render(<CustomCode hostId="n2" tree={tree()} js={code} />);

    expect(
      canvas.container.querySelector('[data-ck-custom-code]')?.getAttribute('data-editor'),
    ).toBe('true');
    expect(live.container.querySelector('[data-ck-custom-code]')?.getAttribute('data-editor')).toBe(
      'false',
    );
  });

  it('marks the region on the canvas when the script throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(
      <CustomCode hostId="n1" tree={tree()} js="throw new Error('bad scene');" isCanvas />,
    );
    await new Promise((done) => setTimeout(done, 0));
    expect(container.querySelector('[data-ck-custom-code]')?.getAttribute('data-ck-js-error')).toBe(
      'bad scene',
    );
    expect(console.error).toHaveBeenCalledWith(
      '[ck-js]',
      'n1',
      expect.objectContaining({ message: 'bad scene' }),
    );
  });

  it('applies the crash guard on the canvas only, and a paused boot runs nothing', () => {
    localStorage.setItem(GUARD, '1');
    const code = "ck.root.setAttribute('data-ran', '1');";
    const canvas = render(<CustomCode hostId="n1" tree={tree()} js={code} isCanvas />);
    const region = canvas.container.querySelector('[data-ck-custom-code]');

    expect(region?.hasAttribute('data-ran')).toBe(false);
    expect(region?.getAttribute('data-ck-js-error')).toBe(
      'Scripts paused after the editor froze last time',
    );

    // The published page does not use the guard: the stale flag changes nothing there.
    const live = render(<CustomCode hostId="n2" tree={tree()} js={code} />);
    expect(live.container.querySelector('[data-ck-custom-code]')?.getAttribute('data-ran')).toBe(
      '1',
    );
  });
});
