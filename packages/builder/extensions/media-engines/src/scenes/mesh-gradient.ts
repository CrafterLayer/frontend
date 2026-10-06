/*
  `mesh-gradient`: a few large palette-coloured blobs on the surface colour,
  heavily blurred into a mesh gradient and grained with NoiseFilter, drifting
  on slow Lissajous paths. The blur runs at half resolution: it is a gradient,
  so nobody can tell, and it is the single most expensive pass in any scene.
*/

import { BlurFilter, Container, Graphics, NoiseFilter } from 'pixi.js';

import { seedFor, seededRandom, type PixiScene } from './shared';

interface Blob {
  shape: Graphics;
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  phase: number;
}

export const meshGradient: PixiScene = (app, _el, ctx) => {
  const random = seededRandom(seedFor('mesh-gradient', ctx.count));
  const { colors, background, dark } = ctx.palette;
  const blobCount = Math.max(3, Math.min(6, Math.round(ctx.count / 18)));

  const ground = new Graphics();
  const field = new Container();
  app.stage.addChild(ground, field);

  const blur = new BlurFilter({ strength: 60, quality: 3 });
  blur.resolution = 0.5;
  const grain = new NoiseFilter({ noise: 0.06, seed: random() });
  field.filters = [blur];
  app.stage.filters = [grain];

  const blobs: Blob[] = [];
  for (let i = 0; i < blobCount; i++) {
    const shape = new Graphics();
    shape.alpha = dark ? 0.55 : 0.7;
    field.addChild(shape);
    blobs.push({
      shape,
      ax: 0.18 + random() * 0.22,
      ay: 0.14 + random() * 0.2,
      fx: 0.00005 + random() * 0.00008,
      fy: 0.00004 + random() * 0.00007,
      phase: random() * Math.PI * 2,
    });
  }

  let elapsed = 0;

  const layout = () => {
    const width = app.screen.width;
    const height = app.screen.height;
    const span = Math.max(width, height);
    ground.clear().rect(0, 0, width, height).fill(background);
    blur.strength = Math.max(24, Math.min(96, span / 9));
    blobs.forEach((blob, index) => {
      const radius = span * (0.22 + ((index * 37) % 17) / 100);
      blob.shape
        .clear()
        .circle(0, 0, radius)
        .fill(colors[index % colors.length] ?? colors[0]);
    });
  };

  const place = () => {
    const width = app.screen.width;
    const height = app.screen.height;
    for (const blob of blobs) {
      const t = elapsed;
      blob.shape.x =
        width / 2 + ctx.sign * Math.sin(t * blob.fx * 1000 + blob.phase) * blob.ax * width;
      blob.shape.y =
        height / 2 + Math.cos(t * blob.fy * 1000 + blob.phase * 1.3) * blob.ay * height;
    }
  };

  const step = (ticker: { deltaMS: number }) => {
    elapsed += Math.min(ticker.deltaMS, 50) / 1000;
    place();
  };

  const onResize = () => {
    layout();
    place();
  };

  layout();
  place();
  app.ticker.add(step);
  app.renderer.on('resize', onResize);

  return () => {
    app.ticker.remove(step);
    app.renderer.off('resize', onResize);
    field.filters = [];
    app.stage.filters = [];
    blur.destroy();
    grain.destroy();
  };
};
