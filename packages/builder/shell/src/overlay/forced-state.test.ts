import { describe, expect, it } from 'vitest';

import { canvasStateToken, createForcedStatePreview } from './forced-state';

describe('forced state preview (DESIGN §A.7)', () => {
  it('maps engine states to the canvas attribute tokens', () => {
    expect(canvasStateToken('default')).toBeNull();
    expect(canvasStateToken('hover')).toBe('hover');
    expect(canvasStateToken('focus')).toBe('focus-visible');
    expect(canvasStateToken('active')).toBe('active');
    expect(canvasStateToken('open')).toBe('open');
    expect(canvasStateToken('group-hover')).toBe('hover');
  });

  it('stamps data-ck-state on the element and removes it again', () => {
    const element = document.createElement('a');
    const preview = createForcedStatePreview();
    preview.apply(element, 'hover');
    expect(element).toHaveAttribute('data-ck-state', 'hover');
    preview.apply(element, 'default');
    expect(element).not.toHaveAttribute('data-ck-state');
  });

  it('moves the stamp when the focused element changes', () => {
    const first = document.createElement('a');
    const second = document.createElement('a');
    const preview = createForcedStatePreview();
    preview.apply(first, 'active');
    preview.apply(second, 'active');
    expect(first).not.toHaveAttribute('data-ck-state');
    expect(second).toHaveAttribute('data-ck-state', 'active');
    preview.clear();
    expect(second).not.toHaveAttribute('data-ck-state');
  });

  it('stamps group-hover on the nearest .group ancestor', () => {
    const group = document.createElement('div');
    group.className = 'group';
    const child = document.createElement('span');
    group.append(child);
    const preview = createForcedStatePreview();
    preview.apply(child, 'group-hover');
    expect(group).toHaveAttribute('data-ck-state', 'hover');
    expect(child).not.toHaveAttribute('data-ck-state');
  });

  it('keeps tokens it did not write', () => {
    const element = document.createElement('a');
    element.setAttribute('data-ck-state', 'open');
    const preview = createForcedStatePreview();
    preview.apply(element, 'hover');
    expect(element.getAttribute('data-ck-state')).toBe('open hover');
    preview.clear();
    expect(element.getAttribute('data-ck-state')).toBe('open');
  });
});
