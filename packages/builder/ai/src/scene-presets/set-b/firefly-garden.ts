import { definePreset, range, sharedParams } from './define';

/**
 * A night garden of fireflies. Each one drifts on a noise flow and blinks on its own clock; the
 * clocks pull toward each other (the Kuramoto model, through the mean field so it stays O(n)),
 * so the swarm slowly falls into flashing together — as real fireflies do. The pointer gathers
 * them. AdvancedBloom turns the dots into glow; grass silhouettes frame the bottom edge.
 */
export const FIREFLY_GARDEN = definePreset({
  id: 'firefly-garden',
  name: { en: 'Firefly garden', ar: 'حديقة اليراعات' },
  description: {
    en: 'Glowing fireflies drift over a night garden and slowly learn to blink together; they gather around the pointer like it is a lantern.',
    ar: 'يراعات مضيئة تسبح فوق حديقة ليلية وتتعلّم ببطء أن تومض معاً، وتتجمّع حول المؤشر كأنه فانوس.',
  },
  tags: ['interactive', 'particles', 'light', 'calm', 'background'],
  libs: ['kit', 'filters'],
  params: [
    ...sharedParams({ seed: 13 }),
    range('syncStrength', 'Blink sync', 'تزامن الوميض', 0.7, 0, 2, 0.05, 'motion'),
    range('glow', 'Glow', 'التوهّج', 1.3, 0, 3, 0.05, 'look'),
    range('attract', 'Gather at pointer', 'التجمّع عند المؤشر', 0.6, -1, 1, 0.05, 'interaction'),
    range('blink', 'Blink rate', 'سرعة الوميض', 0.6, 0.1, 2, 0.05, 'motion'),
  ],
  code: String.raw`
const p = ck.params({ palette: 'theme', seed: 13, speed: 1, density: 1, interactive: true, syncStrength: 0.7, glow: 1.3, attract: 0.6, blink: 0.6 });
const s = await ck.scene({ libs: ['filters'], pointer: false });
const P = s.PIXI, F = s.lib.filters, pal = s.palette;
const night = pal.dark ? pal.surface : pal.mix(pal.text, 0x020617, 0.6);
const sky = new P.Graphics();
const grass = new P.Graphics();
const swarm = new P.Container();
s.stage.addChild(sky, swarm, grass);
const bloom = new F.AdvancedBloomFilter({ threshold: 0.15, bloomScale: p.glow, brightness: 1.1, blur: 7, quality: 5 });
swarm.filters = [bloom];
s.onQuality((q) => { swarm.filters = q < 0.6 ? null : [bloom]; });
s.dispose(() => { swarm.filters = null; });

const halo = new P.Graphics();
for (let i = 0; i <= 10; i++) halo.circle(32, 32, 32 - i * 2.9).fill({ color: 0xffffff, alpha: i < 8 ? 0.07 : 0.6 });
const tex = s.app.renderer.generateTexture(halo);
halo.destroy();
s.dispose(() => tex.destroy(true));

const warm = pal.mix(0xe8ff9a, pal.accent, 0.22), hot = pal.mix(0xfff6c8, pal.colors[1], 0.15);
const blades = [];
for (let i = 0; i < 160; i++) blades.push({ x: s.random(), h: s.rand(0.05, 0.22), lean: s.rand(-0.04, 0.04) });
function layout(w, h) {
  sky.clear();
  for (let i = 0; i < 8; i++) sky.rect(0, (h * i) / 8, w, h / 8 + 1).fill(pal.mix(night, pal.mix(night, pal.accent, 0.25), i / 7));
  grass.clear();
  for (const b of blades) {
    const x = b.x * w, top = h * (1 - b.h);
    grass.moveTo(x - 3, h).quadraticCurveTo(x, h - (h - top) * 0.5, x + b.lean * w, top).quadraticCurveTo(x + 1, h - (h - top) * 0.45, x + 3, h).closePath();
  }
  grass.fill(pal.mix(night, 0x000000, 0.45));
}
layout(s.width, s.height);
s.onResize(layout);

const N = Math.min(400, s.count(130));
const flies = [];
for (let i = 0; i < N; i++) {
  const sp = new P.Sprite(tex);
  sp.anchor.set(0.5);
  sp.blendMode = 'add';
  sp.tint = s.random() < 0.8 ? warm : hot;
  swarm.addChild(sp);
  flies.push({ sp, x: s.rand(0, s.width), y: s.rand(s.height * 0.15, s.height * 0.9), vx: 0, vy: 0, th: s.rand(0, 6.28), w: Math.PI * 2 * p.blink * s.rand(0.8, 1.2), k: s.rand(0, 50), size: s.rand(0.25, 0.55) });
}

s.tick(({ t, dt }) => {
  const w = s.width, h = s.height, step = Math.min(dt, 0.05) * p.speed;
  let cs = 0, sn = 0;
  for (const f of flies) { cs += Math.cos(f.th); sn += Math.sin(f.th); }
  const order = Math.hypot(cs, sn) / N, psi = Math.atan2(sn, cs);
  const live = p.interactive && s.pointer.inside, px = s.pointer.x, py = s.pointer.y, reach = Math.min(w, h) * 0.45;
  for (const f of flies) {
    f.th += (f.w + p.syncStrength * 2.2 * order * Math.sin(psi - f.th)) * step;
    const a = s.noise3(f.x * 0.003, f.y * 0.003, t * 0.08 + f.k) * Math.PI * 2;
    let tvx = Math.cos(a) * 0.7 + 0.15 * s.dir, tvy = Math.sin(a) * 0.5;
    let near = 0;
    if (live) {
      const dx = px - f.x, dy = py - f.y, d = Math.hypot(dx, dy) + 0.01;
      if (d < reach) { near = 1 - d / reach; const pull = p.attract * near * 2.4; tvx += (dx / d) * pull; tvy += (dy / d) * pull; }
    }
    if (f.y < h * 0.1) tvy += 0.6;
    if (f.y > h * 0.92) tvy -= 0.6;
    f.vx += (tvx - f.vx) * 0.05;
    f.vy += (tvy - f.vy) * 0.05;
    f.x += f.vx * step * 60;
    f.y += f.vy * step * 60;
    if (f.x < -20) f.x = w + 20; else if (f.x > w + 20) f.x = -20;
    const b = Math.pow(Math.max(0, Math.sin(f.th)), 3);
    f.sp.position.set(f.x, f.y);
    f.sp.alpha = 0.06 + 0.94 * Math.min(1, b + near * 0.25);
    f.sp.scale.set(f.size * (0.6 + 0.6 * b + near * 0.3));
  }
  bloom.bloomScale = p.glow * (0.85 + 0.3 * order);
});
`,
});
