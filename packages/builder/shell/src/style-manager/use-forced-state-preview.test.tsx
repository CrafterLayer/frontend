import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { StyleState } from '@craftkit/builder-schema';

import { findCanvasElement, useForcedStatePreview } from './use-forced-state-preview';

afterEach(cleanup);

function Probe({ element, state }: { readonly element: HTMLElement; readonly state: StyleState }) {
  useForcedStatePreview(document, element, state);
  return null;
}

describe('useForcedStatePreview', () => {
  it('stamps the state on the canvas element and removes it when the state returns to Default', () => {
    const element = document.createElement('a');
    document.body.append(element);
    const { rerender, unmount } = render(<Probe element={element} state="hover" />);
    expect(element.getAttribute('data-ck-state')).toBe('hover');
    rerender(<Probe element={element} state="focus" />);
    expect(element.getAttribute('data-ck-state')).toBe('focus-visible');
    rerender(<Probe element={element} state="default" />);
    expect(element.hasAttribute('data-ck-state')).toBe(false);
    rerender(<Probe element={element} state="active" />);
    unmount();
    expect(element.hasAttribute('data-ck-state')).toBe(false);
    element.remove();
  });

  it('finds a tree element by its data-ck-path inside its region', () => {
    document.body.innerHTML =
      '<div data-bldr-node="r1"><h2 data-ck-path="0.1">A</h2></div><div data-bldr-node="r2"><h2 data-ck-path="0.1">B</h2></div>';
    expect(findCanvasElement(document, 'r2', [0, 1])?.textContent).toBe('B');
    document.body.innerHTML = '';
  });
});
