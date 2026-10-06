/*
  `particles`: a field of slowly drifting dots in the palette, linked by faint
  lines when two come close. The dots are one ParticleContainer (one draw
  call); the links are one Graphics rebuilt per frame in three alpha buckets.
  Horizontal drift runs towards the inline end, so it mirrors under RTL.
*/

import { Graphics, Particle, ParticleContainer } from 'pixi.js';

import { seedFor, seededRandom, type PixiScene } from './shared';

interface Dot {
  particle: Particle;
  vx: number;
  vy: number;
}

const LINK_BUCKETS = [0.08, 0.16, 0.28] as const;

export const particles: PixiScene = (app, _el, ctx) => {
  const random = seededRandom(seedFor('particles', ctx.count));
  const [primary, secondary, tertiary] = ctx.palette.colors;
  const tints = [primary, primary, secondary, tertiary];

  const dotShape = new Graphics().circle(16, 16, 16).fill(0xffffff);
  const dotTexture = app.renderer.generateTexture(dotShape);
  dotShape.destroy();

  const links = new Graphics();
  const field = new ParticleContainer({
    texture: dotTexture,
    dynamicProperties: { position: true, rotation: false, vertex: false, uvs: false, color: false },
  });
  app.stage.addChild(links, field);

  const dots: Dot[] = [];
  const place = (width: number, height: number) => {
    for (const dot of dots) {
      dot.particle.x = random() * width;
      dot.particle.y = random() * height;
    }
  };

  for (let i = 0; i < ctx.count; i++) {
    const radius = 1.5 + random() * 2.5;
    const particle = new Particle({
      texture: dotTexture,
      anchorX: 0.5,
      anchorY: 0.5,
      scaleX: radius / 16,
      scaleY: radius / 16,
      tint: tints[i % tints.length] ?? primary,
      alpha: 0.55 + random() * 0.4,
    });
    field.addParticle(particle);
    dots.push({
      particle,
      vx: ctx.sign * (0.06 + random() * 0.22),
      vy: (random() - 0.5) * 0.18,
    });
  }
  place(app.screen.width, app.screen.height);

  const drawLinks = () => {
    const width = app.screen.width;
    const linkDistance = Math.max(60, Math.min(150, width / 7));
    const limit = linkDistance * linkDistance;
    links.clear();
    const buckets: [number, number, number, number][][] = [[], [], []];
    for (let i = 0; i < dots.length; i++) {
      const a = dots[i];
      if (a === undefined) {
        continue;
      }
      for (let j = i + 1; j < dots.length; j++) {
        const b = dots[j];
        if (b === undefined) {
          continue;
        }
        const dx = a.particle.x - b.particle.x;
        const dy = a.particle.y - b.particle.y;
        const distance = dx * dx + dy * dy;
        if (distance < limit) {
          const closeness = 1 - distance / limit;
          const bucket = closeness > 0.66 ? 2 : closeness > 0.33 ? 1 : 0;
          buckets[bucket]?.push([a.particle.x, a.particle.y, b.particle.x, b.particle.y]);
        }
      }
    }
    buckets.forEach((segments, index) => {
      if (segments.length === 0) {
        return;
      }
      for (const [x1, y1, x2, y2] of segments) {
        links.moveTo(x1, y1).lineTo(x2, y2);
      }
      links.stroke({ width: 1, color: primary, alpha: LINK_BUCKETS[index] ?? 0.1 });
    });
  };

  const step = (ticker: { deltaTime: number }) => {
    const width = app.screen.width;
    const height = app.screen.height;
    const delta = Math.min(ticker.deltaTime, 3);
    for (const dot of dots) {
      const p = dot.particle;
      p.x += dot.vx * delta;
      p.y += dot.vy * delta;
      if (p.x < -8) p.x = width + 8;
      else if (p.x > width + 8) p.x = -8;
      if (p.y < -8) p.y = height + 8;
      else if (p.y > height + 8) p.y = -8;
    }
    drawLinks();
  };

  const onResize = (width: number, height: number) => {
    place(width, height);
    drawLinks();
  };

  drawLinks();
  app.ticker.add(step);
  app.renderer.on('resize', onResize);

  return () => {
    app.ticker.remove(step);
    app.renderer.off('resize', onResize);
    dotTexture.destroy(true);
  };
};
