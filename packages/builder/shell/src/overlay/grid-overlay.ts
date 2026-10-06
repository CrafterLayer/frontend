import './overlay.css';

/*
  ── Grid tracks on the canvas (style-manager DESIGN.md §E "Visual flex/grid")

  While the Layout sector is open and the focused element is a grid, its
  column and row tracks are drawn over it, so a person editing
  `grid-cols-[1fr_2fr]` sees the tracks they are shaping. Read from the
  computed style — `grid-template-columns` resolves to used track sizes in px
  — so what is drawn is what the browser laid out, gaps included.

  Columns run in the PAGE direction: on an RTL page the first track is the
  rightmost one. Geometry is measured, physical, layer-local.
*/

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface GridMetrics {
  readonly columns: readonly number[];
  readonly rows: readonly number[];
  readonly columnGap: number;
  readonly rowGap: number;
  readonly padding: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
}

/** `"120px 240.5px"` → [120, 240.5]; anything unresolved (`none`, `auto`) → []. */
export function parseTrackList(value: string): number[] {
  return value
    .trim()
    .split(/\s+/u)
    .map((part) => /^(-?\d*\.?\d+)px$/u.exec(part))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]));
}

/** The track boxes of a grid laid out at `rect`, columns in the page direction. */
export function gridTrackBoxes(rect: Box, metrics: GridMetrics, dir: 'ltr' | 'rtl'): Box[] {
  const top = rect.y + metrics.padding.top;
  const innerWidth = rect.width - metrics.padding.left - metrics.padding.right;
  const innerHeight = rect.height - metrics.padding.top - metrics.padding.bottom;
  const boxes: Box[] = [];
  let offset = 0;
  for (const width of metrics.columns) {
    const x =
      dir === 'rtl'
        ? rect.x + metrics.padding.left + innerWidth - offset - width
        : rect.x + metrics.padding.left + offset;
    boxes.push({ x, y: top, width, height: innerHeight });
    offset += width + metrics.columnGap;
  }
  let rowOffset = 0;
  for (const height of metrics.rows) {
    boxes.push({ x: rect.x + metrics.padding.left, y: top + rowOffset, width: innerWidth, height });
    rowOffset += height + metrics.rowGap;
  }
  return boxes;
}

/** Read a grid's metrics from the canvas, or `undefined` when it is not a grid. */
export function readGridMetrics(element: HTMLElement): GridMetrics | undefined {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  if (!style?.display.includes('grid')) return undefined;
  const px = (value: string) => {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : 0;
  };
  return {
    columns: parseTrackList(style.gridTemplateColumns),
    rows: parseTrackList(style.gridTemplateRows),
    columnGap: px(style.columnGap),
    rowGap: px(style.rowGap),
    padding: {
      top: px(style.paddingTop),
      right: px(style.paddingRight),
      bottom: px(style.paddingBottom),
      left: px(style.paddingLeft),
    },
  };
}

export interface GridOverlay {
  show(rect: Box, metrics: GridMetrics, dir: 'ltr' | 'rtl'): void;
  hide(): void;
  dispose(): void;
}

export function createGridOverlay(layer: HTMLElement): GridOverlay {
  const doc = layer.ownerDocument;
  const pool: HTMLElement[] = [];
  const hide = () => {
    for (const track of pool) track.style.visibility = 'hidden';
  };
  return {
    show(rect, metrics, dir) {
      const boxes = gridTrackBoxes(rect, metrics, dir);
      const columns = metrics.columns.length;
      while (pool.length < boxes.length) {
        const track = doc.createElement('div');
        track.setAttribute('aria-hidden', 'true');
        layer.append(track);
        pool.push(track);
      }
      pool.forEach((track, at) => {
        const box = boxes[at];
        if (box === undefined) {
          track.style.visibility = 'hidden';
          return;
        }
        track.className = `bldr-grid-track bldr-grid-track--${at < columns ? 'column' : 'row'}`;
        track.style.transform = `translate(${String(box.x)}px, ${String(box.y)}px)`;
        track.style.width = `${String(box.width)}px`;
        track.style.height = `${String(box.height)}px`;
        track.style.visibility = 'visible';
      });
    },
    hide,
    dispose() {
      for (const track of pool) track.remove();
      pool.length = 0;
    },
  };
}
