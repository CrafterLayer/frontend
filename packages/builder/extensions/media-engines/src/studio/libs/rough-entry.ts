import type { Drawable, OpSet } from 'roughjs/bin/core';
import rough from 'roughjs/bin/rough';

interface PixiGraphics {
  moveTo(x: number, y: number): PixiGraphics;
  lineTo(x: number, y: number): PixiGraphics;
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number): PixiGraphics;
  fill(style: string | Readonly<Record<string, unknown>>): PixiGraphics;
  stroke(style: string | Readonly<Record<string, unknown>>): PixiGraphics;
}

function drawOps(graphics: PixiGraphics, set: OpSet): void {
  for (const operation of set.ops) {
    const data = operation.data;
    if (operation.op === 'move') graphics.moveTo(data[0] ?? 0, data[1] ?? 0);
    else if (operation.op === 'lineTo') graphics.lineTo(data[0] ?? 0, data[1] ?? 0);
    else {
      graphics.bezierCurveTo(
        data[0] ?? 0,
        data[1] ?? 0,
        data[2] ?? 0,
        data[3] ?? 0,
        data[4] ?? 0,
        data[5] ?? 0,
      );
    }
  }
}

/** Replay a roughjs drawable into a Pixi v8 Graphics path. */
function drawRough(graphics: PixiGraphics, drawable: Drawable): PixiGraphics {
  const options = drawable.options;
  for (const set of drawable.sets) {
    drawOps(graphics, set);
    if (set.type === 'path' && options.stroke !== 'none') {
      graphics.stroke({ color: options.stroke, width: options.strokeWidth });
    } else if (set.type === 'fillPath' && options.fill !== undefined && options.fill !== 'none') {
      graphics.fill(options.fill);
    } else if (set.type === 'fillSketch' && options.fill !== undefined && options.fill !== 'none') {
      graphics.stroke({ color: options.fill, width: options.fillWeight });
    }
  }
  return graphics;
}

export function createRoughLibrary() {
  return Object.freeze({ generator: rough.generator.bind(rough), drawRough });
}
