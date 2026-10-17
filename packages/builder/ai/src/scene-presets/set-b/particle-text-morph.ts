import { definePreset, range, select, sharedParams, text } from './define';

/**
 * Particles that ARE the words. Each phrase is drawn whole on a 2D canvas (the browser shapes
 * Arabic, so letters stay joined), sized so its ink holds about one pixel per particle, and
 * ~1,600 particles spring onto that even grid. Each shape holds before it morphs to the next
 * (phrase one, phrase two, a ring, a galaxy) by scroll, by time or by hover, so the words read
 * crisply; a region at rest shows phrase one. The pointer blows them apart and they settle back.
 * The reduced-motion still is phrase one, formed.
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
const N = Math.min(4000, s.count(1600 * Math.min(2, Math.max(1, Math.sqrt((s.width * s.height) / 230400)))));

// sample a whole phrase from a 2D canvas: the browser shapes it, nothing is split by letter.
// The canvas is sized so its ink holds about one pixel per particle: every particle gets its own
// point on an even grid, and the letters read as crisp dotted strokes at any stage size.
function draw(phrase, W, H) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  if (!x) return null;
  let fam = 'system-ui, sans-serif';
  try { fam = getComputedStyle(ck.root).fontFamily || fam; } catch (e) { /* default face */ }
  let size = H * 0.72;
  x.direction = s.rtl ? 'rtl' : 'ltr';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = '900 ' + size + 'px ' + fam;
  const m = x.measureText(phrase).width;
  if (m > W * 0.9) { size *= (W * 0.9) / m; x.font = '900 ' + size + 'px ' + fam; }
  x.fillStyle = '#fff';
  x.fillText(phrase, W / 2, H / 2);
  return x.getImageData(0, 0, W, H).data;
}
function sample(phrase, w, h) {
  const out = [];
  if (typeof document === 'undefined') return out;
  let k = 3, W = 0, H = 0, d = null;
  for (let pass = 0; pass < 2; pass++) {
    W = Math.max(48, Math.round(w / k));
    H = Math.max(24, Math.round(h / k));
    d = draw(phrase, W, H);
    if (!d) return out;
    let ink = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 128) ink++;
    const q = Math.sqrt(ink / (N * 1.1));
    if (ink === 0 || Math.abs(q - 1) < 0.12) break;
    k = Math.min(12, Math.max(1, k * q));
  }
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (d[(yy * W + xx) * 4 + 3] > 128) out.push([((xx + 0.5) * w) / W, ((yy + 0.5) * h) / H]);
  out.cell = w / W;
  return out;
}
function fill(pts) {
  if (pts.length < 24) return null;
  const sh = s.shuffle(pts.slice()), out = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const q = sh[i % sh.length], j = (pts.cell || 3) * (i >= sh.length ? 0.5 : 0.28);
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
function hold(x) {
  const i = Math.floor(x), f = Math.min(1, Math.max(0, (x - i - 0.45) / 0.55));
  return i + f * f * (3 - 2 * f);
}
s.tick(({ t, dt }) => {
  // Damping scales with the step, so a slow frame rate settles the words as fast as a quick one.
  const live = p.interactive && s.pointer.inside, step = Math.min(dt * 60, 3) * p.speed, damp = Math.pow(0.86, Math.max(1, step));
  // Each shape holds, then morphs (a half-formed blend reads as a cloud): by scroll once the
  // region passes the middle of the viewport (at rest it shows phrase one), or every 5 s.
  let target = 0;
  if (p.morphOn === 'scroll') target = hold(Math.min(1, Math.max(0, (s.scroll.progress - 0.5) * 2.2)) * 3);
  else if (p.morphOn === 'time') target = hold(((t * p.speed) / 5) % 4);
  else target = live ? 1 : 0;
  mph = s.reducedMotion ? 0 : p.morphOn === 'time' ? target : mph + (target - mph) * Math.min(1, dt * 3);
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
    d.vx = (d.vx + ax * step) * damp;
    d.vy = (d.vy + ay * step) * damp;
    d.x += d.vx * step;
    d.y += d.vy * step;
    d.q.x = d.x;
    d.q.y = d.y;
  }
});
`,
});
