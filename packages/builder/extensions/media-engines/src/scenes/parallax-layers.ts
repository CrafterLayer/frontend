/*
  `parallax-layers`: the scene's images as depth layers.
  - The first image is the far layer, covering the whole scene (it is also the
    fallback the reader saw before the engine loaded, so the swap is seamless).
  - Every further image floats nearer, as a card spread along the inline axis
    (starting at the inline start: the right edge under RTL).
  - Nearer layers move more with the pointer and with scroll; a slow idle drift
    runs towards the inline end, so it mirrors under RTL.
  With no images, palette bands stand in for the layers.
*/

import { Container, Graphics, Sprite } from 'pixi.js';

import { coverSprite, scrollProgress, trackPointer, type PixiScene } from './shared';

interface Layer {
  node: Container;
  depth: number;
  baseX: number;
  baseY: number;
}

const POINTER_TRAVEL = 28;
const SCROLL_TRAVEL = 60;

export const parallaxLayers: PixiScene = (app, el, ctx) => {
  const root = new Container();
  app.stage.addChild(root);
  const layers: Layer[] = [];

  const build = () => {
    for (const layer of layers) {
      layer.node.destroy({ children: true });
    }
    layers.length = 0;
    root.removeChildren();

    const width = app.screen.width;
    const height = app.screen.height;
    const textures = ctx.textures;

    if (textures.length === 0) {
      ctx.palette.colors.forEach((color, index) => {
        const depth = (index + 1) / 3;
        const band = new Graphics()
          .ellipse(0, 0, width * (0.7 - index * 0.15), height * (0.35 - index * 0.06))
          .fill({ color, alpha: 0.35 + index * 0.15 });
        band.position.set(width / 2, height * (0.45 + index * 0.18));
        root.addChild(band);
        layers.push({ node: band, depth, baseX: band.x, baseY: band.y });
      });
      return;
    }

    const [farTexture, ...nearTextures] = textures;
    if (farTexture !== undefined) {
      const far = new Sprite(farTexture);
      coverSprite(far, width, height, 1.12);
      root.addChild(far);
      layers.push({ node: far, depth: 0.25, baseX: far.x, baseY: far.y });
    }

    const count = nearTextures.length;
    nearTextures.forEach((texture, index) => {
      const depth = 0.45 + (0.55 * (index + 1)) / count;
      const card = new Sprite(texture);
      card.anchor.set(0.5);
      const targetHeight = height * (0.28 + 0.18 * depth);
      card.scale.set(targetHeight / Math.max(texture.height, 1));
      const slot = (index + 0.5) / count;
      const inlineX = ctx.sign === 1 ? slot * width : (1 - slot) * width;
      const y = height * (0.35 + (0.3 * ((index * 7) % 3)) / 2);
      card.position.set(inlineX, y);
      root.addChild(card);
      layers.push({ node: card, depth, baseX: inlineX, baseY: y });
    });
  };

  const pointer = trackPointer(ctx.pointerHost);
  const current = { x: 0, y: 0, scroll: 0 };
  let elapsed = 0;

  const place = () => {
    for (const layer of layers) {
      const drift = ctx.sign * Math.sin(elapsed * 0.15) * 10 * layer.depth;
      layer.node.x = layer.baseX - current.x * POINTER_TRAVEL * layer.depth + drift;
      layer.node.y =
        layer.baseY -
        current.y * POINTER_TRAVEL * layer.depth +
        current.scroll * SCROLL_TRAVEL * layer.depth;
    }
  };

  const step = (ticker: { deltaMS: number }) => {
    const seconds = Math.min(ticker.deltaMS, 50) / 1000;
    elapsed += seconds;
    const ease = Math.min(1, seconds * 4);
    const targetX = pointer.active ? pointer.x : 0;
    const targetY = pointer.active ? pointer.y : 0;
    current.x += (targetX - current.x) * ease;
    current.y += (targetY - current.y) * ease;
    current.scroll += (scrollProgress(el, ctx.win) - current.scroll) * ease;
    place();
  };

  const onResize = () => {
    build();
    place();
  };

  build();
  current.scroll = scrollProgress(el, ctx.win);
  place();
  app.ticker.add(step);
  app.renderer.on('resize', onResize);

  return () => {
    app.ticker.remove(step);
    app.renderer.off('resize', onResize);
    pointer.dispose();
  };
};
