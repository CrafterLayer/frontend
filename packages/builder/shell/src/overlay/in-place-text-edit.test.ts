import { afterEach, describe, expect, it, vi } from 'vitest';

import { IN_PLACE_TEXT_CLASS, beginInPlaceTextEdit } from './in-place-text-edit';

afterEach(() => {
  document.body.replaceChildren();
});

function mount(text = 'Overview', singleLine = true) {
  const button = document.createElement('button');
  const reactText = document.createTextNode(text);
  button.append(reactText);
  document.body.append(button);
  const onCommit = vi.fn((_text: string) => ({ ok: true }) as const);
  const onEnd = vi.fn();
  const session = beginInPlaceTextEdit({
    element: button,
    storedText: text,
    singleLine,
    label: 'Tab label',
    onCommit,
    onEnd,
  });
  const surface = button.querySelector<HTMLElement>(`.${IN_PLACE_TEXT_CLASS}`)!;
  const key = (name: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });
    surface.dispatchEvent(event);
    return event;
  };
  return { button, reactText, onCommit, onEnd, session, surface, key };
}

describe('beginInPlaceTextEdit', () => {
  it('swaps in a focused, named editing span and puts React’s own node back on commit', () => {
    const h = mount();
    expect(h.surface).toHaveAttribute('contenteditable', 'plaintext-only');
    expect(h.surface).toHaveAttribute('aria-label', 'Tab label');
    expect(document.activeElement).toBe(h.surface);
    expect(h.button.contains(h.reactText)).toBe(false);

    h.surface.textContent = 'Summary';
    h.key('Enter');
    expect(h.onCommit).toHaveBeenCalledExactlyOnceWith('Summary');
    expect(h.onEnd).toHaveBeenCalledWith('committed', 'keyboard');
    // The very same text node React created, untouched.
    expect(h.button.firstChild).toBe(h.reactText);
    expect(h.reactText.nodeValue).toBe('Overview');
    expect(h.button.hasAttribute('data-bldr-inline-editing')).toBe(false);
  });

  it('Escape cancels without writing; keys never reach the canvas', () => {
    const h = mount();
    const outside = vi.fn();
    document.addEventListener('keydown', outside);
    h.surface.textContent = 'Nope';
    h.key('ArrowLeft');
    h.key('Escape');
    document.removeEventListener('keydown', outside);
    expect(outside).not.toHaveBeenCalled();
    expect(h.onCommit).not.toHaveBeenCalled();
    expect(h.onEnd).toHaveBeenCalledWith('cancelled', 'keyboard');
    expect(h.session.isOpen()).toBe(false);
  });

  it('an unchanged text ends as unchanged, without a write', () => {
    const h = mount();
    h.key('Enter');
    expect(h.onCommit).not.toHaveBeenCalled();
    expect(h.onEnd).toHaveBeenCalledWith('unchanged', 'keyboard');
  });

  it('Space is typed by the session, so a button part never activates', () => {
    const h = mount('Ab');
    const space = h.key(' ');
    expect(space.defaultPrevented).toBe(true);
    expect(h.surface.textContent).toBe('Ab ');
  });

  it('a refusal is reported and the stored text shows again', () => {
    const h = mount();
    h.onCommit.mockReturnValueOnce({ ok: false, message: 'Too long' } as never);
    h.surface.textContent = 'x'.repeat(80);
    h.session.commit();
    expect(h.onEnd).toHaveBeenCalledWith('rejected', 'api', 'Too long');
    expect(h.button.textContent).toBe('Overview');
  });

  it('single-line parts fold typed line breaks; blur commits', () => {
    const h = mount('One');
    h.surface.textContent = 'One\nTwo';
    h.surface.blur();
    expect(h.onCommit).toHaveBeenCalledExactlyOnceWith('One Two');
    expect(h.onEnd).toHaveBeenCalledWith('committed', 'blur');
  });
});
