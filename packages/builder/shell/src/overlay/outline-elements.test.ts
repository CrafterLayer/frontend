import { describe, expect, it } from 'vitest';

import type { NodeRect } from '../rects';
import { createOutline } from './outline-elements';

const rect = (x: number, y: number, width = 100, height = 50): NodeRect => ({
  nodeId: 'n',
  x,
  y,
  width,
  height,
  version: 0,
});

describe('createOutline (005 R6)', () => {
  it('positions via transform + size, reveals, and hides — reusing ONE element', () => {
    const layer = document.createElement('div');
    const outline = createOutline(layer, 'selection');
    expect(layer.children).toHaveLength(1);
    expect(outline.element.getAttribute('aria-hidden')).toBe('true');

    outline.show(rect(10, 20), 'Hero');
    expect(outline.element.style.transform).toBe('translate(10px, 20px)');
    expect(outline.element.style.width).toBe('100px');
    expect(outline.element.style.height).toBe('50px');
    expect(outline.element.style.visibility).toBe('visible');
    expect(outline.element.querySelector('.bldr-outline__label')?.textContent).toBe('Hero');

    outline.show(rect(30, 40), 'Hero'); // sweep: same element, new position, no re-creation
    expect(layer.children).toHaveLength(1);
    expect(outline.element.style.transform).toBe('translate(30px, 40px)');

    outline.hide();
    expect(outline.element.style.visibility).toBe('hidden');
  });

  it('marks the chrome kind on the class for styling', () => {
    const layer = document.createElement('div');
    expect(createOutline(layer, 'hover').element.className).toContain('bldr-outline--hover');
    expect(createOutline(layer, 'selection').element.className).toContain(
      'bldr-outline--selection',
    );
  });
});
