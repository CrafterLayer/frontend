import { definePreset, range, select, sharedParams } from './define';

/**
 * Starlings. Hundreds to two thousand boids (separation, alignment, cohesion over a spatial hash)
 * swirl around a wandering focus; the pointer is a hawk they scatter from. The first frame is a
 * murmuration ribbon already, so the reduced-motion still reads as one.
 */
export const BOIDS_MURMURATION = definePreset({
  id: 'boids-murmuration',
  name: { en: 'Boids murmuration', ar: 'سرب الزرازير' },
  description: {
    en: 'A murmuration of starlings that flocks, folds and swirls across the section and scatters from the pointer like a hawk.',
    ar: 'سرب زرازير يتجمّع وينطوي ويدور عبر القسم، ويتفرّق من المؤشر كأنه صقر.',
  },
  tags: ['interactive', 'particles', 'generative', 'hero', 'background'],
  libs: ['kit'],
  params: [
    ...sharedParams({ seed: 11 }),
    range('separation', 'Separation', 'التباعد', 1.2, 0, 3, 0.05, 'motion'),
    range('alignment', 'Alignment', 'المحاذاة', 1, 0, 3, 0.05, 'motion'),
    range('cohesion', 'Cohesion', 'التماسك', 0.9, 0, 3, 0.05, 'motion'),
    range('fearRadius', 'Fear radius', 'نطاق الخوف', 150, 0, 400, 5, 'interaction'),
    select(
      'shape',
      'Shape',
      'الشكل',
      'bird',
      [
        ['bird', 'Bird', 'طائر'],
        ['arrow', 'Arrow', 'سهم'],
        ['dot', 'Dot', 'نقطة'],
      ],
      'look',
    ),
  ],
  code: String.raw`
const p = ck.params({ palette: 'theme', seed: 11, speed: 1, density: 1, interactive: true, separation: 1.2, alignment: 1, cohesion: 0.9, fearRadius: 150, shape: 'bird' });
const s = await ck.scene({ libs: [], pointer: false });
const P = s.PIXI, pal = s.palette;
const g = new P.Graphics();
if (p.shape === 'dot') g.circle(8, 8, 6).fill(0xffffff);
else if (p.shape === 'arrow') g.poly([0, 2, 16, 8, 0, 14, 4, 8]).fill(0xffffff);
else g.moveTo(0, 0).quadraticCurveTo(8, 6, 16, 8).quadraticCurveTo(8, 10, 0, 16).quadraticCurveTo(5, 8, 0, 0).fill(0xffffff);
const tex = s.app.renderer.generateTexture(g);
g.destroy();
s.dispose(() => tex.destroy(true));

const pc = new P.ParticleContainer({ dynamicProperties: { position: true, rotation: true, color: true, vertex: false, uvs: false } });
s.stage.addChild(pc);
const dense = pal.text, thin = pal.mix(pal.text, pal.accent, 0.55);
const N = Math.min(2000, s.count(650));
const birds = [];
const ph = s.rand(0, 6.28);
for (let i = 0; i < N; i++) {
  // a murmuration ribbon: a sinuous band whose thickness swells and pinches
  const u = s.random();
  const bx = s.width * (0.12 + 0.76 * u), by = s.height * (0.46 + 0.16 * Math.sin(u * 5.5 + ph));
  const thick = s.height * (0.03 + 0.13 * Math.pow(Math.sin(u * Math.PI), 2) * (0.6 + 0.4 * s.noise2(u * 3, 2)));
  const off = (s.random() + s.random() - 1) * thick;
  const tan = Math.atan2(s.height * 0.16 * 5.5 * Math.cos(u * 5.5 + ph), s.width * 0.76) + (s.dir > 0 ? 0 : Math.PI);
  const x = bx - Math.sin(tan) * off, y = by + Math.cos(tan) * off;
  const q = new P.Particle({ texture: tex, x, y, anchorX: 0.5, anchorY: 0.5, rotation: tan, scaleX: 0.55, scaleY: 0.55, tint: dense });
  pc.addParticle(q);
  birds.push({ q, x, y, vx: Math.cos(tan) * 2.4, vy: Math.sin(tan) * 2.4 });
}
pc.boundsArea = new P.Rectangle(0, 0, s.width, s.height);
s.onResize((w, h) => { pc.boundsArea = new P.Rectangle(0, 0, w, h); });

const R = 38, sep = 14, grid = new Map();
function key(x, y) { return (Math.floor(x / R) + 4) * 8192 + Math.floor(y / R) + 4; }
s.tick(({ t, dt }) => {
  const w = s.width, h = s.height, step = Math.min(dt * 60, 3) * p.speed;
  grid.clear();
  for (const b of birds) {
    const k = key(b.x, b.y);
    let cell = grid.get(k);
    if (!cell) { cell = []; grid.set(k, cell); }
    cell.push(b);
  }
  const fear = p.interactive && s.pointer.inside, fx = s.pointer.x, fy = s.pointer.y, fr = p.fearRadius;
  // a wandering focus keeps the flock folding when nobody chases it
  const ax = w * (0.5 + 0.32 * s.noise2(t * 0.05 * p.speed, 3) * s.dir), ay = h * (0.45 + 0.25 * s.noise2(t * 0.05 * p.speed, 7));
  for (const b of birds) {
    let n = 0, sx = 0, sy = 0, mvx = 0, mvy = 0, cx = 0, cy = 0;
    const gx = Math.floor(b.x / R) + 4, gy = Math.floor(b.y / R) + 4;
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const cell = grid.get((gx + ox) * 8192 + gy + oy);
        if (!cell) continue;
        for (const o of cell) {
          if (o === b || n > 28) continue;
          const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 > R * R) continue;
          n++;
          mvx += o.vx; mvy += o.vy; cx += o.x; cy += o.y;
          if (d2 < sep * sep) { const d = Math.sqrt(d2) + 0.01; sx -= (dx / d) * (sep - d); sy -= (dy / d) * (sep - d); }
        }
      }
    }
    let vx = b.vx, vy = b.vy;
    if (n) {
      vx += (mvx / n - vx) * 0.05 * p.alignment + (cx / n - b.x) * 0.0016 * p.cohesion;
      vy += (mvy / n - vy) * 0.05 * p.alignment + (cy / n - b.y) * 0.0016 * p.cohesion;
    }
    vx += sx * 0.03 * p.separation + (ax - b.x) * 0.00012;
    vy += sy * 0.03 * p.separation + (ay - b.y) * 0.00012;
    if (fear && fr > 0) {
      const dx = b.x - fx, dy = b.y - fy, d2 = dx * dx + dy * dy;
      if (d2 < fr * fr) { const d = Math.sqrt(d2) + 0.01, k = (1 - d / fr) * 1.4; vx += (dx / d) * k; vy += (dy / d) * k; }
    }
    const v = Math.sqrt(vx * vx + vy * vy) + 0.0001, lim = v > 4.2 ? 4.2 / v : v < 1.6 ? 1.6 / v : 1;
    b.vx = vx * lim;
    b.vy = vy * lim;
    b.x += b.vx * step;
    b.y += b.vy * step;
    if (b.x < -20) b.x += w + 40; else if (b.x > w + 20) b.x -= w + 40;
    if (b.y < -20) b.y += h + 40; else if (b.y > h + 20) b.y -= h + 40;
    b.q.x = b.x;
    b.q.y = b.y;
    b.q.rotation = Math.atan2(b.vy, b.vx);
    b.q.tint = n > 8 ? dense : thin;
  }
});
`,
});
