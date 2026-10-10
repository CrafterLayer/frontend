import { definePreset, image, range, SET_B_PHOTOS, sharedParams } from './define';

/**
 * A landscape in depth. The photo is the far sky on a PerspectiveMesh that tilts toward the
 * pointer; 3–7 fbm ridgelines in atmospheric colour stand in front of it, each drifting by its
 * depth with scroll and pointer. Depth of field racks focus through the layers as the section
 * scrolls (KawaseBlur per layer, TiltShift over all; the governor drops TiltShift first).
 */
export const SCROLL_PARALLAX_DEPTH = definePreset({
  id: 'scroll-parallax-depth',
  name: { en: 'Scroll parallax depth', ar: 'عمق المنظر مع التمرير' },
  description: {
    en: 'A photo horizon with layered ridgelines that part in depth as you scroll, tilt toward the pointer, and rack focus from far to near.',
    ar: 'أفق من صورتك تتقدّمه طبقات من التلال تتباعد بعمقها مع التمرير، وتميل نحو المؤشر، وينتقل تركيزها من البعيد إلى القريب.',
  },
  tags: ['interactive', 'photo', 'hero', 'background', 'calm'],
  libs: ['kit', 'filters'],
  params: [
    ...sharedParams({ seed: 9 }),
    image('image', 'Far image', 'الصورة البعيدة', SET_B_PHOTOS.wadiRum),
    range('layers', 'Layers', 'الطبقات', 5, 3, 7, 1, 'look'),
    range('depthRange', 'Depth', 'العمق', 1, 0, 2, 0.05, 'motion'),
    range('tiltMax', 'Tilt', 'الميل', 6, 0, 20, 0.5, 'interaction'),
    range('dof', 'Depth of field', 'عمق الميدان', 0.7, 0, 1, 0.05, 'look'),
  ],
  code: String.raw`
const p = ck.params({ palette: 'theme', seed: 9, speed: 1, density: 1, interactive: true, image: '${SET_B_PHOTOS.wadiRum}', layers: 5, depthRange: 1, tiltMax: 6, dof: 0.7 });
const s = await ck.scene({ libs: ['filters'], pointer: false });
const P = s.PIXI, F = s.lib.filters, pal = s.palette;
let tex = null;
try { tex = await s.texture(p.image); } catch (e) { tex = null; }

const root = new P.Container();
s.stage.addChild(root);
const sky = new P.Graphics();
root.addChild(sky);
const mesh = tex ? new P.PerspectiveMesh({ texture: tex, verticesX: s.quality < 1 ? 6 : 12, verticesY: s.quality < 1 ? 6 : 12 }) : null;
if (mesh) root.addChild(mesh);
const L = Math.max(3, Math.min(7, Math.round(p.layers)));
const far = pal.mix(pal.colors[1], pal.surface, 0.55), near = pal.mix(pal.colors[4], pal.text, 0.5);
const ridges = [];
for (let i = 0; i < L; i++) {
  const g = new P.Graphics();
  const blur = new F.KawaseBlurFilter({ strength: 0, quality: 3 });
  g.filters = [blur];
  root.addChild(g);
  ridges.push({ g, blur, z: (i + 1) / L, ph: s.rand(0, 100), col: pal.mix(far, near, Math.pow((i + 1) / L, 1.3)) });
}
const dust = new P.Graphics();
root.addChild(dust);
const motes = [];
for (let i = 0; i < s.count(70); i++) motes.push({ x: s.random(), y: s.random(), r: s.rand(0.6, 2.4), z: s.rand(0.3, 1) });
const tilt = new F.TiltShiftFilter({ blur: 14 * p.dof, gradientBlur: 520, start: { x: 0, y: s.height * 0.55 }, end: { x: s.width, y: s.height * 0.55 } });
function useTilt(q) { root.filters = p.dof > 0.05 && q >= 0.75 ? [tilt] : null; }
useTilt(s.quality);
s.onQuality(useTilt);
s.dispose(() => { root.filters = null; });

let cover = 1;
function layout(w, h) {
  sky.clear().rect(0, 0, w, h).fill(pal.mix(pal.surface, pal.colors[1], 0.35));
  if (mesh) cover = Math.max(w / tex.width, h / tex.height) * 1.18;
  tilt.start = { x: 0, y: h * 0.55 };
  tilt.end = { x: w, y: h * 0.55 };
  for (const r of ridges) {
    const base = h * (0.5 + r.z * 0.36), amp = h * (0.2 - r.z * 0.08), fq = 0.0026 / (0.55 + r.z);
    r.g.clear().moveTo(-120, h * 1.4);
    for (let x = -120; x <= w + 120; x += 10) r.g.lineTo(x, base - amp * (0.5 + 0.5 * s.fbm(x * fq + r.ph, r.ph, 4)));
    r.g.lineTo(w + 120, h * 1.4).closePath().fill(r.col);
  }
}
layout(s.width, s.height);
s.onResize(layout);

let prog = s.scroll.progress, tx = 0, ty = 0;
s.tick(({ t, dt }) => {
  const w = s.width, h = s.height, D = p.depthRange;
  const e = s.reducedMotion ? 1 : Math.min(1, dt * 5);
  prog += (s.scroll.progress - prog) * e;
  const live = p.interactive && s.pointer.inside;
  const ux = live ? (s.pointer.x / w) * 2 - 1 : Math.sin(t * 0.13 * p.speed) * 0.3 * s.dir;
  const uy = live ? (s.pointer.y / h) * 2 - 1 : Math.cos(t * 0.11 * p.speed) * 0.2;
  tx += (ux - tx) * e;
  ty += (uy - ty) * e;
  const lift = (prog - 0.5) * h * 0.5 * D;
  if (mesh) {
    const W = tex.width, H = tex.height, k = p.tiltMax / 100, a = tx * k * H, b = ty * k * W;
    mesh.setCorners(b, a, W - b, -a, W + b, H + a, -b, H - a);
    mesh.scale.set(cover);
    mesh.position.set((w - W * cover) / 2 - tx * 18 * D, (h - H * cover) / 2 - lift * 0.15 - ty * 10 * D);
  }
  const focus = 0.2 + Math.min(1, Math.max(0, prog)) * 0.75;
  for (const r of ridges) {
    r.g.x = -tx * 46 * r.z * D;
    r.g.y = -lift * r.z - ty * 16 * r.z * D;
    const blur = Math.abs(r.z - focus) * 9 * p.dof;
    r.blur.strength = blur;
    r.blur.enabled = blur > 0.4;
  }
  dust.clear();
  for (const m of motes) {
    const x = ((m.x * w + t * 8 * m.z * p.speed * s.dir - tx * 70 * m.z * D) % w + w) % w;
    const y = ((m.y * h - lift * m.z * 1.4 + Math.sin(t * 0.5 + m.x * 9) * 6) % h + h) % h;
    dust.circle(x, y, m.r * m.z).fill({ color: pal.surface, alpha: 0.35 + 0.4 * m.z });
  }
});
`,
});
