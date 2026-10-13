import { definePreset, range, sharedParams, toggle } from './define';

/**
 * A field of dots on springs. The pointer bends the grid toward it (or pushes it away with a
 * negative force) and lights the dots it touches; a tap sends a shock ring through the field.
 * Idle, the grid has real presence: dots in the theme's ink, a slow noise swell, and a gentle
 * wave whose crests travel toward the inline end, lifting and lighting the dots in the accent
 * (the pointer still outshines it). One ParticleContainer of one texture: thousands of dots at
 * little cost.
 */
export const MAGNETIC_DOT_GRID = definePreset({
  id: 'magnetic-dot-grid',
  name: { en: 'Magnetic dot grid', ar: 'شبكة النقاط المغناطيسية' },
  description: {
    en: 'A grid of dots on springs that bends toward the pointer, glows where it is touched and ripples on tap. Calm noise swell when idle.',
    ar: 'شبكة نقاط على نوابض تنحني نحو المؤشر وتتوهّج حيث يلمسها وتتموّج عند النقر، مع موجة ضجيج هادئة حين يسكن.',
  },
  tags: ['interactive', 'geometric', 'background', 'hero', 'calm'],
  libs: ['kit'],
  params: [
    ...sharedParams({ seed: 7 }),
    range('spacing', 'Spacing', 'المسافة بين النقاط', 26, 12, 64, 1, 'look'),
    range('radius', 'Dot size', 'حجم النقطة', 2.2, 0.5, 6, 0.1, 'look'),
    range(
      'force',
      'Pull (negative pushes)',
      'الجذب (السالب يدفع)',
      0.6,
      -1,
      1,
      0.05,
      'interaction',
    ),
    range('springiness', 'Springiness', 'المرونة', 0.12, 0.02, 0.4, 0.01, 'motion'),
    toggle('ripple', 'Ripple on tap', 'تموّج عند النقر', true, 'interaction'),
  ],
  code: String.raw`
const p = ck.params({ palette: 'theme', seed: 7, speed: 1, density: 1, interactive: true, spacing: 26, radius: 2.2, force: 0.6, springiness: 0.12, ripple: true });
const s = await ck.scene({ libs: [], pointer: false });
const P = s.PIXI, pal = s.palette;
const disc = new P.Graphics().circle(16, 16, 16).fill(0xffffff);
const dotTex = s.app.renderer.generateTexture(disc);
disc.destroy();
s.dispose(() => dotTex.destroy(true));
// ink -> accent -> a brighter accent (darker on a light surface): idle dots sit low, the pointer goes high
const ink = pal.mix(pal.muted, pal.text, 0.35), peak = pal.dark ? pal.colors[1] : pal.colors[4];
const shades = [];
for (let i = 0; i < 16; i++) { const t = i / 15; shades.push(t < 0.5 ? pal.mix(ink, pal.accent, t * 2) : pal.mix(pal.accent, peak, (t - 0.5) * 2)); }
const pc = new P.ParticleContainer({ dynamicProperties: { position: true, vertex: true, color: true, rotation: false, uvs: false } });
s.stage.addChild(pc);
let dots = [];
let sp = p.spacing;
const ripples = [];

function build(w, h) {
  pc.removeParticles();
  dots = [];
  sp = Math.max(p.spacing, Math.sqrt((w * h) / s.count(1800)));
  const cols = Math.floor(w / sp) + 1, rows = Math.floor(h / sp) + 1;
  const ox = (w - (cols - 1) * sp) / 2, oy = (h - (rows - 1) * sp) / 2;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const hx = ox + i * sp, hy = oy + j * sp;
      const q = new P.Particle({ texture: dotTex, x: hx, y: hy, anchorX: 0.5, anchorY: 0.5, tint: shades[0] });
      pc.addParticle(q);
      dots.push({ q, hx, hy, x: hx, y: hy, vx: 0, vy: 0 });
    }
  }
  pc.boundsArea = new P.Rectangle(0, 0, w, h);
  pc.update();
}
build(s.width, s.height);
s.onResize(build);

s.pointer.onDown(() => {
  if (p.interactive && p.ripple && s.pointer.inside) ripples.push({ x: s.pointer.x, y: s.pointer.y, t: s.time.t });
});

const base = (p.radius * 2) / 32;
s.tick(({ t, dt }) => {
  const live = p.interactive && s.pointer.inside;
  const px = s.pointer.x, py = s.pointer.y;
  const reach = sp * 7, reach2 = reach * reach;
  const k = p.springiness, damp = 0.86;
  const step = Math.min(dt * 60, 3) * p.speed;
  const wk = (Math.PI * 2) / (sp * 10), wt = t * 1.6 * p.speed, wc = Math.cos(0.6) * s.dir, ws = Math.sin(0.6);
  for (let r = ripples.length - 1; r >= 0; r--) if (t - ripples[r].t > 2.2) ripples.splice(r, 1);
  for (const d of dots) {
    // the idle wave: crests travel toward the inline end and lift the dots they cross
    const w = Math.pow(0.5 + 0.5 * Math.sin((d.hx * wc + d.hy * ws) * wk - wt), 4);
    let fx = (d.hx + w * sp * 0.08 * s.dir - d.x) * k, fy = (d.hy - w * sp * 0.2 - d.y) * k;
    // and a slow noise swell under it
    const n = s.noise3(d.hx * 0.004 - t * 0.15 * p.speed * s.dir, d.hy * 0.004, t * 0.1);
    let glow = 0.2 + (n + 1) * 0.08 + w * 0.32;
    if (live) {
      const dx = px - d.x, dy = py - d.y, d2 = dx * dx + dy * dy;
      if (d2 < reach2) {
        const dist = Math.sqrt(d2) + 0.001, f = 1 - dist / reach;
        const pull = p.force * f * f * sp * 0.08;
        fx += (dx / dist) * pull;
        fy += (dy / dist) * pull;
        glow += f * 0.9;
      }
    }
    for (const rp of ripples) {
      const age = t - rp.t, R = age * 520 * p.speed, dx = d.x - rp.x, dy = d.y - rp.y;
      const dist = Math.sqrt(dx * dx + dy * dy) + 0.001, band = 1 - Math.abs(dist - R) / (sp * 2.5);
      if (band > 0) {
        const a = band * (1 - age / 2.2) * sp * 0.35;
        fx += (dx / dist) * a;
        fy += (dy / dist) * a;
        glow += band * 0.8;
      }
    }
    d.vx = (d.vx + fx) * damp;
    d.vy = (d.vy + fy) * damp;
    d.x += d.vx * step;
    d.y += d.vy * step;
    const off = Math.min(1, Math.hypot(d.x - d.hx, d.y - d.hy) / sp);
    const g = Math.min(1, glow + off * 0.6);
    const sc = base * (0.85 + g * 1.1 + n * 0.1);
    d.q.x = d.x;
    d.q.y = d.y;
    d.q.scaleX = sc;
    d.q.scaleY = sc;
    d.q.tint = shades[Math.min(15, (g * 15) | 0)];
    d.q.alpha = 0.6 + g * 0.4;
  }
});
`,
});
