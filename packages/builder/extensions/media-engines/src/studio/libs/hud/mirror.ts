/*
  The keyboard and screen-reader path of `s.lib.hud` (game libraries, 2026-10-12).

  Every canvas widget gets a native DOM counterpart in one panel inside the scene's region: a
  <meter> for a bar, <input type=range> for a slider, <button>, <input type=checkbox>, a <ul>
  for a list, a <p> for text. They are visually hidden until one takes focus — a Tab press shows
  exactly the control being operated — and they drive the same widget and callback as the
  pointer. On the editor canvas they are disabled. Colours come from the site tokens.
*/

const STYLE_ID = 'ck-hud-style';
const CSS = `
.ck-hud-a11y{position:absolute;z-index:4;inset-inline-start:.5rem;inset-block-end:.5rem;display:flex;flex-direction:column;gap:.35rem;max-inline-size:calc(100% - 1rem);font:inherit;color:var(--t-text,#f8fafc)}
.ck-hud-a11y>*{display:flex;align-items:center;gap:.5rem;padding:.4rem .7rem;border-radius:.75rem;background:color-mix(in oklab,var(--t-surface,#0f172a) 88%,transparent);border:1px solid color-mix(in oklab,var(--t-accent,#7c3aed) 55%,transparent)}
.ck-hud-a11y>:not(:focus-within){position:absolute;inline-size:1px;block-size:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.ck-hud-a11y button,.ck-hud-a11y input{font:inherit;min-block-size:2.75rem;accent-color:var(--t-accent,#7c3aed)}
.ck-hud-a11y button{padding:.4rem .9rem;border-radius:.6rem;color:var(--t-surface,#0f172a);background:var(--t-accent,#7c3aed);border:0}
.ck-hud-a11y :focus-visible{outline:3px solid var(--t-accent,#7c3aed);outline-offset:2px}
`;

export interface MirrorPanel {
  readonly element: HTMLElement;
  add<T extends HTMLElement>(row: T): T;
  remove(): void;
}

export function createMirrorPanel(root: HTMLElement, label: string): MirrorPanel {
  const doc = root.ownerDocument;
  if (doc.getElementById(STYLE_ID) === null) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    doc.head.appendChild(style);
  }
  const panel = doc.createElement('div');
  panel.className = 'ck-hud-a11y';
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', label);
  panel.setAttribute('data-ck-hud', '');
  root.appendChild(panel);
  return {
    element: panel,
    add(row) {
      panel.appendChild(row);
      return row;
    },
    remove() {
      panel.remove();
    },
  };
}

/** A labelled row: `<label><span>Label</span>control</label>` (or a div for non-controls). */
export function mirrorRow(
  doc: Document,
  label: string,
  control: HTMLElement,
  labelled = true,
): HTMLElement {
  const row = doc.createElement(labelled ? 'label' : 'div');
  const name = doc.createElement('span');
  name.textContent = label;
  row.append(name, control);
  return row;
}

/** Listen on a DOM element until the returned function is called. */
export function listen(target: EventTarget, type: string, fn: () => void): () => void {
  target.addEventListener(type, fn);
  return () => {
    target.removeEventListener(type, fn);
  };
}
