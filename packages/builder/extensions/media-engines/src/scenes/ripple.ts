/*
  `ripple`: the first image, covering the scene, with a displacement ripple
  that follows the pointer and settles when it stops. Pointer input is read
  from the scene's parent section, so the HTML content over the scene keeps
  every click; the canvas itself never needs to be hit.
  With no image the scene draws the palette surface and the ripple has
  nothing to bend, so it stays calm.
*/

import { DisplacementFilter, Graphics, Sprite } from 'pixi.js';

import { coverSprite, rippleMapTexture, trackPointer, type PixiScene } from './shared';

const MAX_STRENGTH = 42;

export const ripple: PixiScene = (app, el, ctx) => {
  const ring = new Sprite(rippleMapTexture(el.ownerDocument));
  ring.anchor.set(0.5);
  const ground = new Graphics();
  const texture = ctx.textures[0];
  const image = texture === undefined ? undefined : new Sprite(texture);

  // The map sits under the ground (it needs a place in the graph for its transform).
  app.stage.addChild(ring, ground);
  if (image !== undefined) {
    app.stage.addChild(image);
  }

  const displacement = new DisplacementFilter({ sprite: ring, scale: 0 });
  if (image !== undefined) {
    image.filters = [displacement];
  }

  const layout = () => {
    const width = app.screen.width;
    const height = app.screen.height;
    ground.clear().rect(0, 0, width, height).fill(ctx.palette.background);
    if (image !== undefined) {
      coverSprite(image, width, height, 1.04);
    }
    ring.position.set(width / 2, height / 2);
    ring.scale.set(Math.max(width, height) / 900);
  };

  const pointer = trackPointer(ctx.pointerHost);
  let strength = 0;
  let spread = 0.4;
  let lastX = 0;
  let lastY = 0;

  const step = (ticker: { deltaMS: number }) => {
    const seconds = Math.min(ticker.deltaMS, 50) / 1000;
    const width = app.screen.width;
    const height = app.screen.height;
    if (pointer.active) {
      const x = ((pointer.x + 1) / 2) * width;
      const y = ((pointer.y + 1) / 2) * height;
      const moved = Math.hypot(x - lastX, y - lastY);
      lastX = x;
      lastY = y;
      ring.x += (x - ring.x) * Math.min(1, seconds * 10);
      ring.y += (y - ring.y) * Math.min(1, seconds * 10);
      if (moved > 0.5) {
        strength = Math.min(MAX_STRENGTH, strength + moved * 0.6);
        spread = Math.min(1.2, spread + seconds * 0.8);
      }
    }
    strength *= Math.max(0, 1 - seconds * 2.2);
    spread += (0.4 - spread) * Math.min(1, seconds * 1.5);
    ring.scale.set((Math.max(width, height) / 900) * (0.6 + spread));
    displacement.scale.x = strength;
    displacement.scale.y = strength;
  };

  layout();
  app.ticker.add(step);
  app.renderer.on('resize', layout);

  return () => {
    app.ticker.remove(step);
    app.renderer.off('resize', layout);
    pointer.dispose();
    if (image !== undefined) {
      image.filters = [];
    }
    displacement.destroy();
    ring.texture.destroy(true);
  };
};
