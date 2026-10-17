import type { CSSProperties } from 'react';

/** A usable zoom: finite and positive, else 1. */
export function normalizeZoom(zoom: number): number {
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

export interface CanvasFrameStyles {
  /** The scrolled viewport's footprint; undefined at full width and zoom 1. */
  viewport: CSSProperties | undefined;
  /** The frame shell's authored width and zoom transform; undefined when it needs none. */
  frameShell: CSSProperties | undefined;
}

/**
 * B3a device width + visual zoom, as layout styles (007 §6). The frame shell
 * keeps the AUTHORED width exact (`frameWidth` px, or full width) and scales
 * by `zoom`; the viewport takes the zoomed footprint so the column scrolls
 * the visual size. Zoom never changes the authored width or the breakpoint.
 */
export function canvasFrameStyles(frameWidth: number | undefined, zoom: number): CanvasFrameStyles {
  const validFrameWidth =
    frameWidth !== undefined && Number.isFinite(frameWidth) && frameWidth >= 1
      ? frameWidth
      : undefined;
  const viewport =
    validFrameWidth !== undefined
      ? { inlineSize: `${String(validFrameWidth * zoom)}px` }
      : zoom === 1
        ? undefined
        : { inlineSize: `${String(zoom * 100)}%` };
  const frameShell = {
    ...(validFrameWidth === undefined
      ? zoom === 1
        ? {}
        : { inlineSize: `${String(100 / zoom)}%` }
      : { inlineSize: `${String(validFrameWidth)}px` }),
    ...(zoom === 1
      ? {}
      : {
          blockSize: `${String(100 / zoom)}%`,
          transform: `scale(${String(zoom)})`,
        }),
  };
  return {
    viewport,
    frameShell: Object.keys(frameShell).length > 0 ? frameShell : undefined,
  };
}
