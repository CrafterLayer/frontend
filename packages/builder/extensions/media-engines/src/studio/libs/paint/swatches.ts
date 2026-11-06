/*
  DOM controls for a colouring page (`paint.swatches`, 2026-11-05).

  The buttons are the scene author's markup inside ck.root, so they are real, focusable,
  labelled controls; this helper only wires them. Inside the root it is given (never the whole
  document) it finds `data-paint-color` (a colour, a palette index, or empty for the next palette
  colour), `data-paint-tool` (fill | brush | eraser) and `data-paint-action` (undo | redo |
  clear), clicks drive the page, and `aria-pressed` follows the current colour and tool while
  `aria-disabled` marks undo/redo with nothing to do (never `disabled`, which would drop the
  keyboard focus of the child who just pressed it). Colour buttons without a background or a
  label get the palette colour and its name. Everything is removed on dispose, and with the page.
*/

import { colorName, palette as namedPalette } from './palettes';
import type { PaintPage } from './page';
import { hexColor } from './raster';

export interface PaintSwatches {
  /** Re-reads the page state into aria-pressed / aria-disabled. */
  sync(): void;
  dispose(): void;
}

function isRoot(value: unknown): value is ParentNode {
  return typeof (value as { querySelectorAll?: unknown } | null)?.querySelectorAll === 'function';
}

function isPage(value: unknown): value is PaintPage {
  const v = value as Partial<PaintPage> | null;
  return (
    typeof v?.setColor === 'function' && typeof v.on === 'function' && typeof v.undo === 'function'
  );
}

export function wireSwatches(root: unknown, target: unknown, palette?: unknown): PaintSwatches {
  if (!isRoot(root)) {
    throw new TypeError('paint.swatches needs a root element (ck.root) as its first argument');
  }
  const scope = root;
  if (!isPage(target)) throw new TypeError('paint.swatches needs a page from paint.page');
  const page: PaintPage = target;
  const colours =
    palette === undefined
      ? page.palette
      : Array.isArray(palette)
        ? palette.map(hexColor).filter((c): c is string => c !== undefined)
        : namedPalette(palette);

  const swatches = new Map<HTMLElement, string>();
  const tools = new Map<HTMLElement, string>();
  const actions = new Map<HTMLElement, string>();
  let next = 0;
  for (const el of scope.querySelectorAll<HTMLElement>('[data-paint-color]')) {
    const value = (el.getAttribute('data-paint-color') ?? '').trim();
    const hex =
      hexColor(value) ??
      (/^\d+$/.test(value) ? colours[Number(value)] : value === '' ? colours[next++] : undefined);
    if (hex === undefined) continue;
    swatches.set(el, hex);
    if (el.style.background === '' && el.style.backgroundColor === '')
      el.style.backgroundColor = hex;
    if (!el.hasAttribute('aria-label') && el.textContent.trim() === '') {
      el.setAttribute('aria-label', colorName(hex) ?? hex);
    }
  }
  for (const el of scope.querySelectorAll<HTMLElement>('[data-paint-tool]')) {
    tools.set(el, el.getAttribute('data-paint-tool') ?? '');
  }
  for (const el of scope.querySelectorAll<HTMLElement>('[data-paint-action]')) {
    actions.set(el, el.getAttribute('data-paint-action') ?? '');
  }

  function sync(): void {
    for (const [el, hex] of swatches) el.setAttribute('aria-pressed', String(hex === page.color));
    for (const [el, name] of tools) el.setAttribute('aria-pressed', String(name === page.tool));
    for (const [el, name] of actions) {
      if (name === 'undo') el.setAttribute('aria-disabled', String(!page.canUndo));
      else if (name === 'redo') el.setAttribute('aria-disabled', String(!page.canRedo));
    }
  }

  const wired: [HTMLElement, string, (event: Event) => void][] = [];
  const wire = (el: HTMLElement, run: () => void) => {
    const click = () => {
      run();
      sync();
    };
    wired.push([el, 'click', click]);
    // A div or span used as a button still answers the keyboard.
    if (el.tagName !== 'BUTTON' && el.tagName !== 'INPUT') {
      if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
      if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
      wired.push([
        el,
        'keydown',
        (event) => {
          const key = (event as KeyboardEvent).key;
          if (key === 'Enter' || key === ' ') {
            event.preventDefault();
            click();
          }
        },
      ]);
    }
  };
  for (const [el, hex] of swatches) {
    wire(el, () => {
      page.setColor(hex);
      // Picking a colour while erasing means "paint with this".
      if (page.tool === 'eraser') page.setTool('brush');
    });
  }
  for (const [el, name] of tools) wire(el, () => page.setTool(name));
  for (const [el, name] of actions) {
    wire(el, () => {
      if (name === 'undo') page.undo();
      else if (name === 'redo') page.redo();
      else if (name === 'clear') page.clear();
    });
  }
  for (const [el, type, fn] of wired) el.addEventListener(type, fn);

  const off = [
    page.on('state', sync),
    page.on('change', sync),
    page.on('dispose', () => {
      dispose();
    }),
  ];
  let disposed = false;
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    for (const [el, type, fn] of wired) el.removeEventListener(type, fn);
    for (const unsubscribe of off) unsubscribe();
  }
  sync();
  return { sync, dispose };
}
