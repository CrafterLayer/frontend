import { definePreset, range, select, sharedParams, text } from './define';

/**
 * Particles that ARE the words. Each phrase is drawn whole on a 2D canvas (the browser shapes
 * Arabic, so letters stay joined), its pixels sampled into targets, and ~1,600 particles spring
 * between phrase one, phrase two, a ring and a galaxy — by scroll, by time, or by hover. The
 * pointer blows them apart and they settle back. The reduced-motion still is phrase one, formed.
 */
export const PARTICLE_TEXT_MORPH = definePreset({
  id: 'particle-text-morph',
  name: { en: 'Particle text morph', ar: 'تحوّل النص الجزيئي' },
  description: {
    en: 'Your words built from particles that scatter at the pointer and reform, morphing from phrase to phrase, a ring and a galaxy as you scroll. Arabic stays joined.',
    ar: 'كلماتك مبنية من جزيئات تتناثر عند المؤشر ثم تعود، وتتحوّل من عبارة إلى أخرى ثم إلى حلقة ومجرّة مع التمرير، والعربية تبقى متصلة.',
  },
  tags: ['interactive', 'particles', 'text', 'arabic', 'hero'],
  libs: ['kit'],
  params: [
    ...sharedParams({ seed: 21 }),
    text('text', 'First phrase', 'العبارة الأولى', '', 'look', {
      en: 'Empty: «إبداع» in Arabic pages, "Create" otherwise.',
      ar: 'فارغة: «إبداع» في الصفحات العربية و"Create" في غيرها.',
    }),
    text('text2', 'Second phrase', 'العبارة الثانية', '', 'look'),
    range('particleSize', 'Particle size', 'حجم الجزيء', 2.2, 1, 6, 0.1, 'look'),
    range('dispersion', 'Dispersion', 'التشتّت', 1, 0, 3, 0.05, 'interaction'),
    select(
      'morphOn',
      'Morph on',
      'التحوّل عند',
      'scroll',
      [
        ['scroll', 'Scroll', 'التمرير'],
        ['time', 'Time', 'الوقت'],
        ['hover', 'Hover', 'المرور بالمؤشر'],
      ],
      'motion',
    ),
  ],
  code: String.raw`
const p = ck.params({ palette: 'theme', seed: 21, speed: 1, density: 1, interactive: true, text: '', text2: '', particleSize: 2.2, dispersion: 1, morphOn: 'scroll' });
const s = await ck.scene({ libs: [], pointer: false });
const P = s.PIXI, pal = s.palette;
const phrases = [p.text || (s.rtl ? 'إبداع' : 'Create'), p.text2 || (s.rtl ? 'بلا حدود' : 'No limits')];
const N = Math.min(4000, s.count(1600));

// sample a whole phrase from a 2D canvas: the browser shapes it, nothing is split by letter
function sample(phrase, w, h) {
  const out = [];
  if (typeof document === 'undefined') return out;
  const W = Math.max(96, Math.round(w / 3)), H = Math.max(48, Math.round(h / 3));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  if (!x) return out;
  let fam = 'system-ui, sans-serif';
  try { fam = getComputedStyle(ck.root).fontFamily || fam; } catch (e) { /* default face */ }
  let size = H * 0.62;
  x.direction = s.rtl ? 'rtl' : 'ltr';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = '800 ' + size + 'px ' + fam;
  const m = x.measureText(phrase).width;
  if (m > W * 0.88) { size *= (W * 0.88) / m; x.font = '800 ' + size + 'px ' + fam; }
  x.fillStyle = '#fff';
  x.fillText(phrase, W / 2, H / 2);
  const d = x.getImageData(0, 0, W, H).data;
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (d[(yy * W + xx) * 4 + 3] > 128) out.push([((xx + 0.5) * w) / W, ((yy + 0.5) * h) / H]);
  return out;
}
function fill(pts) {
  if (pts.length < 24) return null;
  const sh = s.shuffle(pts.slice()), out = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const q = sh[i % sh.length], j = i >= sh.length ? 1.2 : 0;
    out[i * 2] = q[0] + s.rand(-j, j);
    out[i * 2 + 1] = q[1] + s.rand(-j, j);
  }
  return out;
}
function ring(w, h) {
  const out = new Float32Array(N * 2), R = Math.min(w, h) * 0.32;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 * s.dir, r = R * (1 + 0.08 * s.noise2(Math.cos(a) * 2, Math.sin(a) * 2)) + s.rand(-6, 6);
    out[i * 2] = w / 2 + Math.cos(a) * r;
    out[i * 2 + 1] = h / 2 + Math.sin(a) * r;
  }
  return out;
}
function galaxy(w, h) {
  const out = new Float32Array(N * 2), R = Math.min(w, h) * 0.42;
  for (let i = 0; i < N; i++) {
    const u = s.random(), arm = (i % 3) * 2.094, a = (arm + u * 5.5) * s.dir, r = R * Math.sqrt(u);
    out[i * 2] = w / 2 + Math.cos(a) * r + s.rand(-10, 10) * u;
    out[i * 2 + 1] = h / 2 + Math.sin(a) * r * 0.62 + s.rand(-10, 10) * u;
  }
  return out;
}
let sets = [];
function build(w, h) {
  const a = fill(sample(phrases[0], w, h)), b = fill(sample(phrases[1], w, h));
  sets = [a || ring(w, h), b || galaxy(w, h), ring(w, h), galaxy(w, h)];
}
build(s.width, s.height);
s.onResize(build);

const disc = new P.Graphics().circle(8, 8, 8).fill(0xffffff);
const tex = s.app.renderer.generateTexture(disc);
disc.destroy();
s.dispose(() => tex.destroy(true));
const pc = new P.ParticleContainer({ dynamicProperties: { position: true, vertex: false, color: false, rotation: false, uvs: false } });
s.stage.addChild(pc);
const dots = [];
for (let i = 0; i < N; i++) {
  const x = s.reducedMotion ? sets[0][i * 2] : s.rand(0, s.width), y = s.reducedMotion ? sets[0][i * 2 + 1] : s.rand(0, s.height);
  const k = (p.particleSize / 8) * s.rand(0.6, 1.2);
  const q = new P.Particle({ texture: tex, x, y, anchorX: 0.5, anchorY: 0.5, scaleX: k, scaleY: k, tint: pal.mix(pal.colors[0], pal.colors[i % 2 ? 1 : 4], s.random()), alpha: s.rand(0.6, 1) });
  pc.addParticle(q);
  dots.push({ q, x, y, vx: 0, vy: 0 });
}
pc.boundsArea = new P.Rectangle(0, 0, s.width, s.height);
s.onResize((w, h) => { pc.boundsArea = new P.Rectangle(0, 0, w, h); });

let mph = 0;
s.tick(({ t, dt }) => {
  const live = p.interactive && s.pointer.inside, step = Math.min(dt * 60, 3) * p.speed;
  let target = 0;
  if (p.morphOn === 'scroll') target = Math.min(1, Math.max(0, s.scroll.progress)) * 3;
  else if (p.morphOn === 'time') target = ((t * p.speed) / 5) % 4;
  else target = live ? 1 : 0;
  mph = s.reducedMotion ? 0 : mph + (target - mph) * Math.min(1, dt * 3);
  const i0 = Math.floor(mph) % 4, i1 = (i0 + 1) % 4, f = mph - Math.floor(mph), e = f * f * (3 - 2 * f);
  const A = sets[i0], B = sets[i1], R = 90 * p.dispersion, px = s.pointer.x, py = s.pointer.y;
  for (let i = 0; i < N; i++) {
    const d = dots[i];
    const tx = A[i * 2] + (B[i * 2] - A[i * 2]) * e, ty = A[i * 2 + 1] + (B[i * 2 + 1] - A[i * 2 + 1]) * e;
    let ax = (tx - d.x) * 0.06, ay = (ty - d.y) * 0.06;
    if (live && R > 0) {
      const dx = d.x - px, dy = d.y - py, d2 = dx * dx + dy * dy;
      if (d2 < R * R) { const dist = Math.sqrt(d2) + 0.01, k = (1 - dist / R) * 6 * p.dispersion; ax += (dx / dist) * k; ay += (dy / dist) * k; }
    }
    ax += s.noise3(d.x * 0.01, d.y * 0.01, t * 0.3) * 0.08;
    d.vx = (d.vx + ax * step) * 0.86;
    d.vy = (d.vy + ay * step) * 0.86;
    d.x += d.vx * step;
    d.y += d.vy * step;
    d.q.x = d.x;
    d.q.y = d.y;
  }
});
`,
});
