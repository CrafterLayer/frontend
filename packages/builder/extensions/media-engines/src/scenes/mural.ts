/*
  `mural` — the owner's «جدارية»: the scene's images tiled into a wall of
  strips that pans slowly, each row at its own pace, under a gentle
  DisplacementFilter so the wall breathes like paint on plaster.

  Each row is a strip of images at one height (widths follow each image's own
  aspect, so nothing is cropped or stretched), repeated twice so it can wrap
  without a seam. Rows pan towards the inline end (mirrored under RTL); odd
  rows run a little slower so the wall has depth. With no images, palette
  tiles stand in.
*/

import { Container, DisplacementFilter, Graphics, Sprite, type Texture } from 'pixi.js';

import { noiseMapTexture, seedFor, seededRandom, type PixiScene } from './shared';

interface Row {
  strip: Container;
  /** Length of one copy of the sequence, in px. */
  period: number;
  speed: number;
  offset: number;
}

const GAP = 10;

export const mural: PixiScene = (app, el, ctx) => {
  const random = seededRandom(seedFor('mural', ctx.textures.length));
  // Bottom to top: the displacement map (it must sit in the scene graph for its
  // transform), the surface colour that hides it and fills the gaps, the wall.
  const map = new Sprite(noiseMapTexture(el.ownerDocument, random));
  const ground = new Graphics();
  const wall = new Container();
  app.stage.addChild(map, ground, wall);
  const displacement = new DisplacementFilter({ sprite: map, scale: { x: 14, y: 10 } });
  wall.filters = [displacement];

  const rows: Row[] = [];

  const tile = (index: number, height: number): Container => {
    const texture: Texture | undefined = ctx.textures[index % Math.max(ctx.textures.length, 1)];
    if (texture !== undefined) {
      const sprite = new Sprite(texture);
      sprite.scale.set(height / Math.max(texture.height, 1));
      return sprite;
    }
    const color = ctx.palette.colors[index % ctx.palette.colors.length] ?? ctx.palette.colors[0];
    const width = height * (0.8 + ((index * 13) % 7) / 10);
    return new Graphics().roundRect(0, 0, width, height, 14).fill({ color, alpha: 0.85 });
  };

  const build = () => {
    for (const row of rows) {
      row.strip.destroy({ children: true });
    }
    rows.length = 0;

    const width = app.screen.width;
    const height = app.screen.height;
    ground.clear().rect(0, 0, width, height).fill(ctx.palette.background);
    const rowCount = height > 720 ? 3 : 2;
    const rowHeight = (height - GAP * (rowCount + 1)) / rowCount;
    const sourceCount = Math.max(ctx.textures.length, 3);

    for (let r = 0; r < rowCount; r++) {
      const strip = new Container();
      strip.y = GAP + r * (rowHeight + GAP);
      wall.addChild(strip);

      // One copy must be at least as wide as the scene, so the second copy covers the wrap.
      const sequence: Container[] = [];
      let period = 0;
      let index = r;
      while (period < width + rowHeight || sequence.length < sourceCount) {
        const node = tile(index, rowHeight);
        sequence.push(node);
        period += node.width + GAP;
        index += 1;
        if (sequence.length > 64) {
          break;
        }
      }
      let x = 0;
      for (let copy = 0; copy < 2; copy++) {
        for (const original of sequence) {
          const node = copy === 0 ? original : tile(sequence.indexOf(original) + r, rowHeight);
          node.x = x;
          strip.addChild(node);
          x += node.width + GAP;
        }
      }
      rows.push({
        strip,
        period,
        speed: (r % 2 === 0 ? 14 : 9) + random() * 4,
        offset: random() * period,
      });
    }
  };

  const place = () => {
    for (const row of rows) {
      const shift = ((row.offset % row.period) + row.period) % row.period;
      // LTR: the wall travels towards the inline end (rightwards); RTL mirrors it.
      row.strip.x = ctx.sign === 1 ? shift - row.period : -shift;
    }
  };

  const step = (ticker: { deltaMS: number }) => {
    const seconds = Math.min(ticker.deltaMS, 50) / 1000;
    for (const row of rows) {
      row.offset += row.speed * seconds;
    }
    map.x += ctx.sign * 12 * seconds;
    map.y += 6 * seconds;
    place();
  };

  const onResize = () => {
    build();
    place();
  };

  build();
  place();
  app.ticker.add(step);
  app.renderer.on('resize', onResize);

  return () => {
    app.ticker.remove(step);
    app.renderer.off('resize', onResize);
    wall.filters = [];
    displacement.destroy();
    map.texture.destroy(true);
  };
};
