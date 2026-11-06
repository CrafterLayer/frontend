import { createPaintPage, PAINT_TOOLS, type PaintPageOptions } from './paint/page';
import { colorName, palette, PALETTES } from './paint/palettes';
import { wireSwatches } from './paint/swatches';

export const PAINT_VERSION = '1.0.0';

/**
 * `s.lib.paint` (colouring book, 2026-11-05): a colouring page a 4-to-8-year-old can use with a
 * finger. `page(s, { art, width, height })` draws line art (an SVG from `s.lib.stickers.lineArt`,
 * a data: image URL or a texture) over a paint layer: the bucket fills a shape up to its lines
 * (q-floodfill), the brush and eraser draw perfect-freehand strokes, with undo, redo, clear and a
 * PNG export. `swatches(ck.root, page)` wires the author's colour, tool and undo buttons.
 * `palette(name)` lists kid-friendly colours. Plain JavaScript; it never imports Pixi.
 */
export function createPaintLibrary() {
  return Object.freeze({
    version: PAINT_VERSION,
    tools: PAINT_TOOLS,
    palettes: PALETTES,
    palette: (name?: string) => palette(name),
    colorName: (hex: string) => (typeof hex === 'string' ? colorName(hex) : undefined),
    page: (target: unknown, options: PaintPageOptions) => createPaintPage(target, options),
    swatches: (root: unknown, page: unknown, colours?: unknown) =>
      wireSwatches(root, page, colours),
  });
}
