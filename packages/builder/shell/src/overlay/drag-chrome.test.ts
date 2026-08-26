import { describe, expect, it } from 'vitest';

import { createDragChrome } from './drag-chrome';

describe('createDragChrome (006 contract §1 s2)', () => {
  it('creates its three elements once and repositions them — allocation-free path', () => {
    const layer = document.createElement('div');
    const chrome = createDragChrome(layer);
    expect(layer.children).toHaveLength(3);

    chrome.showGhost({ width: 120, height: 40 }, 'Section');
    chrome.moveGhost(50, 60);
    chrome.moveGhost(80, 90);
    expect(layer.children).toHaveLength(3); // still three — nothing allocated per move
    const ghost = layer.querySelector<HTMLElement>('.bldr-drag-ghost');
    expect(ghost?.style.transform).toBe('translate(90px, 100px)'); // +10 offset
    expect(ghost?.textContent).toBe('Section');

    chrome.showTarget(
      { x: 5, y: 200, width: 300, height: 2 },
      { x: 0, y: 100, width: 320, height: 200 },
    );
    const indicator = layer.querySelector<HTMLElement>('.bldr-drop-indicator');
    const parent = layer.querySelector<HTMLElement>('.bldr-drop-parent');
    expect(indicator?.style.visibility).toBe('visible');
    expect(indicator?.style.transform).toBe('translate(5px, 200px)');
    expect(parent?.style.visibility).toBe('visible');

    chrome.hideTarget();
    expect(indicator?.style.visibility).toBe('hidden');
    expect(ghost?.style.visibility).toBe('visible'); // ghost survives target loss

    chrome.hideAll();
    expect(ghost?.style.visibility).toBe('hidden');

    chrome.dispose();
    expect(layer.children).toHaveLength(0);
  });

  it('hides the parent highlight when no parent box is provided', () => {
    const layer = document.createElement('div');
    const chrome = createDragChrome(layer);
    chrome.showTarget({ x: 0, y: 0, width: 10, height: 2 }, undefined);
    expect(layer.querySelector<HTMLElement>('.bldr-drop-parent')?.style.visibility).toBe('hidden');
    expect(layer.querySelector<HTMLElement>('.bldr-drop-indicator')?.style.visibility).toBe(
      'visible',
    );
    chrome.dispose();
  });
});
