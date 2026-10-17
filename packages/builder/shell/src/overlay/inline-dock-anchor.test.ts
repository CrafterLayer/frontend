import { describe, expect, it } from 'vitest';

import {
  RICH_TEXT_ACTION_LABELS_AR,
  RICH_TEXT_ACTION_LABELS_EN,
  inlineDockElement,
  localizeRichActions,
  measureInlineDock,
  withDockFallback,
} from './inline-dock-anchor';

function boxed(element: HTMLElement, rect: { x: number; y: number; width: number; height: number }) {
  element.getBoundingClientRect = () => new DOMRect(rect.x, rect.y, rect.width, rect.height);
  return element;
}

describe('the docked formatting bar (block-parts)', () => {
  it('docks at the contenteditable surface inside the edited element, else the element', () => {
    const edited = document.createElement('section');
    document.body.append(edited);
    expect(inlineDockElement(edited)).toBe(edited);
    const surface = document.createElement('div');
    surface.setAttribute('contenteditable', 'true');
    edited.append(surface);
    expect(inlineDockElement(edited)).toBe(surface);

    boxed(surface, { x: 12, y: 80, width: 300, height: 48 });
    expect(measureInlineDock(edited)).toEqual({ box: { x: 12, y: 80, width: 300, height: 48 } });
    edited.remove();
  });

  it('has no anchor for a detached element, a missing one, or an unlaid-out box', () => {
    expect(measureInlineDock(undefined)).toBeNull();
    const detached = boxed(document.createElement('div'), { x: 1, y: 1, width: 10, height: 10 });
    expect(measureInlineDock(detached)).toBeNull();
    const flat = boxed(document.createElement('div'), { x: 0, y: 0, width: 0, height: 0 });
    document.body.append(flat);
    expect(measureInlineDock(flat)).toBeNull();
    flat.remove();
  });

  it('prefers the selection and falls back to the dock only when the selection has nothing', () => {
    const dock = { box: { x: 0, y: 100, width: 200, height: 40 } };
    const selection = { box: { x: 30, y: 110, width: 40, height: 18 } };
    expect(withDockFallback(() => selection, () => dock)()).toBe(selection);
    expect(withDockFallback(() => null, () => dock)()).toBe(dock);
    expect(withDockFallback(null, () => dock)()).toBe(dock);
  });

  it('names the actions in the editor language and keeps unknown ids as reported', () => {
    const run = () => undefined;
    const actions = [
      { id: 'bold', label: 'Bold', pressed: false, run },
      { id: 'bulletList', label: 'Bulleted list', pressed: true, run },
      { id: 'highlight', label: 'Highlight', run },
    ];
    expect(localizeRichActions(actions, RICH_TEXT_ACTION_LABELS_AR).map((a) => a.label)).toEqual([
      'عريض',
      'قائمة نقطية',
      'Highlight',
    ]);
    const english = localizeRichActions(actions, RICH_TEXT_ACTION_LABELS_EN);
    expect(english.map((a) => a.label)).toEqual(['Bold', 'Bulleted list', 'Highlight']);
    // State and behaviour pass through untouched.
    expect(english[1]?.pressed).toBe(true);
    expect(english[0]?.run).toBe(run);
  });
});
