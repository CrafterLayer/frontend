/** Focus-scoped game input. Decorative scenes pay nothing until down/axis is used. */
export interface SceneInput {
  down(code: string): boolean;
  axis(negativeCodes: readonly string[], positiveCodes: readonly string[]): -1 | 0 | 1;
  /** Virtual keys for native DOM/touch controls. Never focuses the canvas. */
  set(code: string, held: boolean): void;
  clear(): void;
}

export interface SceneInputHandle extends SceneInput {
  dispose(): void;
}

const VALID_CODE = /^[A-Za-z][A-Za-z0-9]{0,63}$/u;
const SCROLL_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export function createSceneInput(
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  editor: boolean,
): SceneInputHandle {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const native = new Set<string>();
  const virtual = new Set<string>();
  const previousTabIndex = canvas.getAttribute('tabindex');
  let enabled = false;
  let disposed = false;
  let ownsTabIndex = false;

  function clear(): void {
    native.clear();
    virtual.clear();
  }
  function onKeyDown(event: KeyboardEvent): void {
    if (
      event.target !== canvas ||
      doc.activeElement !== canvas ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    if (!VALID_CODE.test(event.code)) return;
    if (native.size < 128) native.add(event.code);
    if (SCROLL_KEYS.has(event.code)) event.preventDefault();
  }
  function onKeyUp(event: KeyboardEvent): void {
    native.delete(event.code);
  }
  function onCanvasBlur(): void {
    native.clear();
  }
  function onVisibility(): void {
    if (doc.visibilityState === 'hidden') clear();
  }
  function enable(): void {
    if (enabled || disposed || editor || win === null) return;
    enabled = true;
    if (canvas.tabIndex < 0) {
      canvas.tabIndex = 0;
      ownsTabIndex = true;
    }
    canvas.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('blur', onCanvasBlur);
    win.addEventListener('keyup', onKeyUp);
    win.addEventListener('blur', clear);
    doc.addEventListener('visibilitychange', onVisibility);
  }
  function down(code: string): boolean {
    enable();
    return !disposed && !editor && (native.has(code) || virtual.has(code));
  }
  return {
    down,
    axis(negativeCodes, positiveCodes) {
      const negative = negativeCodes.some(down);
      const positive = positiveCodes.some(down);
      return negative === positive ? 0 : positive ? 1 : -1;
    },
    set(code, held) {
      if (disposed || editor || !VALID_CODE.test(code)) return;
      enable();
      if (held) {
        if (virtual.size < 128) virtual.add(code);
      } else virtual.delete(code);
    },
    clear,
    dispose() {
      if (disposed) return;
      disposed = true;
      clear();
      if (!enabled || win === null) return;
      canvas.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('blur', onCanvasBlur);
      win.removeEventListener('keyup', onKeyUp);
      win.removeEventListener('blur', clear);
      doc.removeEventListener('visibilitychange', onVisibility);
      if (ownsTabIndex && canvas.getAttribute('tabindex') === '0') {
        if (previousTabIndex === null) canvas.removeAttribute('tabindex');
        else canvas.setAttribute('tabindex', previousTabIndex);
      }
    },
  };
}
