import { definePreset, image, range, SET_B_PHOTOS, sharedParams, toggle } from './define';

/**
 * A photo under water. Pointer strokes and taps stamp expanding ripples into a half-size
 * displacement field (a RenderTexture that relaxes toward neutral grey at the viscosity rate);
 * a tap also fires a Shockwave ring. Idle, soft rain keeps the surface alive. Without the photo
 * (a host without CORS) the water lies over a palette wash instead.
 */
export const LIQUID_CURSOR_RIPPLE = definePreset({
  id: 'liquid-cursor-ripple',
  name: { en: 'Liquid cursor ripple', ar: 'تموّج المؤشر السائل' },
  description: {
    en: 'Your photo turns to water: the pointer leaves expanding ripples, a tap sends a shockwave, and gentle rain falls when nobody touches it.',
    ar: 'صورتك تصبح ماءً: يترك المؤشر تموّجات تتسع، ويرسل النقر موجة صدمية، ويهطل مطر خفيف حين لا يلمسها أحد.',
  },
  tags: ['interactive', 'photo', 'light', 'hero', 'calm'],
  libs: ['kit', 'filters'],
  params: [
    ...sharedParams({ seed: 3 }),
    image('image', 'Image', 'الصورة', SET_B_PHOTOS.poolSea),
    range('viscosity', 'Viscosity', 'اللزوجة', 0.94, 0.8, 0.99, 0.01, 'motion'),
    range('rippleSize', 'Ripple size', 'حجم التموّج', 70, 20, 160, 1, 'interaction'),
    range('refraction', 'Refraction', 'الانكسار', 36, 0, 80, 1, 'look'),
    toggle('rain', 'Idle rain', 'مطر عند السكون', true, 'motion'),
  ],
  code: String.raw`
const p = ck.params({ palette: 'theme', seed: 3, speed: 1, density: 1, interactive: true, image: '${SET_B_PHOTOS.poolSea}', viscosity: 0.94, rippleSize: 70, refraction: 36, rain: true });
const s = await ck.scene({ libs: ['filters'], pointer: false });
const P = s.PIXI, F = s.lib.filters, pal = s.palette;
const Q = 0.5;

// a 64px "dimple" brush: red/green hold the outward offset, premultiplied by its soft alpha
const N = 64, data = new Uint8Array(N * N * 4);
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const dx = (x + 0.5) / (N / 2) - 1, dy = (y + 0.5) / (N / 2) - 1, r = Math.sqrt(dx * dx + dy * dy);
    const a = r < 1 ? Math.pow(1 - r, 1.2) : 0, w = Math.sin(Math.min(r, 1) * Math.PI) * 0.5, i = (y * N + x) * 4;
    data[i] = Math.round((0.5 + (dx / (r + 0.001)) * w) * 255 * a);
    data[i + 1] = Math.round((0.5 + (dy / (r + 0.001)) * w) * 255 * a);
    data[i + 2] = Math.round(128 * a);
    data[i + 3] = Math.round(255 * a);
  }
}
const brushTex = new P.Texture({ source: new P.BufferImageSource({ resource: data, width: N, height: N, alphaMode: 'premultiplied-alpha' }) });
s.dispose(() => brushTex.destroy(true));

const rt = s.rt(Math.ceil(s.width * Q), Math.ceil(s.height * Q));
const world = new P.Container();
s.stage.addChild(world);
const field = new P.Sprite(rt);
field.scale.set(1 / Q);
world.addChild(field);
const pic = new P.Container();
world.addChild(pic);
const wash = new P.Graphics();
pic.addChild(wash);
let tex = null;
try { tex = await s.texture(p.image); } catch (e) { tex = null; }
const photo = tex ? new P.Sprite(tex) : null;
if (photo) { photo.anchor.set(0.5); pic.addChild(photo); }

const stamp = new P.Container();
const calm = new P.Graphics();
stamp.addChild(calm);
const brushes = [];
for (let i = 0; i < 28; i++) {
  const b = new P.Sprite(brushTex);
  b.anchor.set(0.5);
  b.visible = false;
  brushes.push(b);
  stamp.addChild(b);
}
const blobs = [];
for (let i = 0; i < 6; i++) blobs.push({ x: s.random(), y: s.random(), r: s.rand(0.2, 0.5), c: pal.colors[i % 5] });

function layout(w, h) {
  wash.clear().rect(0, 0, w, h).fill(pal.surface);
  for (const b of blobs) wash.circle(b.x * w, b.y * h, b.r * Math.max(w, h)).fill({ color: b.c, alpha: 0.35 });
  if (photo) { photo.scale.set(Math.max(w / tex.width, h / tex.height) * 1.06); photo.position.set(w / 2, h / 2); }
  rt.resize(Math.ceil(w * Q), Math.ceil(h * Q));
  for (const b of brushes) b.visible = false;
  calm.alpha = 1;
  calm.clear().rect(0, 0, Math.ceil(w * Q), Math.ceil(h * Q)).fill(0x808080);
  s.app.renderer.render({ container: stamp, target: rt, clear: true });
  pic.filterArea = new P.Rectangle(0, 0, w, h);
}
layout(s.width, s.height);
s.onResize(layout);

const disp = new P.DisplacementFilter({ sprite: field, scale: p.refraction });
const shock = new F.ShockwaveFilter({ center: { x: 0, y: 0 }, amplitude: 22, wavelength: 140, speed: 420, brightness: 1.08, radius: -1, time: 9 });
pic.filters = p.interactive ? [disp, shock] : [disp];
s.dispose(() => { pic.filters = null; });

const live = [];
function drop(x, y, size, strength, life) {
  live.push({ x: x * Q, y: y * Q, size: size * Q, a: strength, age: 0, life });
  if (live.length > brushes.length) live.shift();
}
s.pointer.onDown(() => {
  if (!p.interactive || !s.pointer.inside) return;
  shock.center = { x: s.pointer.x, y: s.pointer.y };
  shock.time = 0;
  drop(s.pointer.x, s.pointer.y, p.rippleSize * 1.6, 1, 1.4);
});

let lx = -1, ly = -1, rainT = 0;
s.tick(({ t, dt }) => {
  const w = s.width, h = s.height, step = dt * p.speed;
  if (p.interactive && s.pointer.inside) {
    const x = s.pointer.x, y = s.pointer.y;
    if (lx >= 0) {
      const n = Math.min(4, Math.floor(Math.hypot(x - lx, y - ly) / 18));
      for (let i = 1; i <= n; i++) drop(lx + ((x - lx) * i) / n, ly + ((y - ly) * i) / n, p.rippleSize * 0.7, 0.45, 0.9);
    }
    lx = x;
    ly = y;
  } else lx = -1;
  rainT -= step;
  if (p.rain && (rainT <= 0 || s.reducedMotion)) {
    const k = s.reducedMotion ? s.count(6) : 1;
    for (let i = 0; i < k; i++) drop(s.rand(0, w), s.rand(0, h), p.rippleSize * s.rand(0.6, 1.4), 0.6, 1.2);
    rainT = s.rand(0.25, 0.7) / (p.density * s.quality);
  }
  calm.alpha = s.reducedMotion ? 0 : Math.min(1, (1 - p.viscosity) * Math.max(1, dt * 60));
  for (let i = 0; i < brushes.length; i++) {
    const b = brushes[i], d = live[i];
    b.visible = !!d;
    if (!d) continue;
    const u = s.reducedMotion ? 0.45 : d.age / d.life;
    b.position.set(d.x, d.y);
    b.width = b.height = d.size * (0.4 + u * 2.2);
    b.alpha = d.a * (1 - u);
  }
  for (const d of live) d.age += step;
  for (let i = live.length - 1; i >= 0; i--) if (live[i].age > live[i].life) live.splice(i, 1);
  s.app.renderer.render({ container: stamp, target: rt, clear: false });
  disp.scale.x = disp.scale.y = p.refraction * (0.85 + 0.15 * Math.sin(t * 0.7));
  shock.time += step;
  shock.enabled = shock.time < 3;
});
`,
});
