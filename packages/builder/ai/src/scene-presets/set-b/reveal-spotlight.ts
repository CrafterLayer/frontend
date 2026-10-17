import { definePreset, image, range, SET_B_PHOTOS, sharedParams, toggle } from './define';

/**
 * A dark veil over a hidden photo. The pointer (or a finger) is a soft torch: a noise-edged hole
 * erased from the veil, with a short comet trail behind it. Idle, the torch wanders on its own.
 * The veil is drawn into a RenderTexture each frame and the hole cut with the 'erase' blend.
 */
export const REVEAL_SPOTLIGHT = definePreset({
  id: 'reveal-spotlight',
  name: { en: 'Reveal spotlight', ar: 'كشّاف الكشف' },
  description: {
    en: 'A dark veil hides a photo; the pointer becomes a soft torch with a noise-edged glow that reveals what lies beneath, and wanders by itself when idle.',
    ar: 'ستار داكن يخفي صورة، ويصبح المؤشر مصباحاً ناعماً بحواف متموّجة يكشف ما تحته، ويتجوّل وحده حين يسكن.',
  },
  tags: ['interactive', 'photo', 'light', 'hero', 'bold'],
  libs: ['kit'],
  params: [
    ...sharedParams({ seed: 5 }),
    image('image', 'Hidden image', 'الصورة المخفية', SET_B_PHOTOS.petraDeir),
    range('radius', 'Torch radius', 'نصف قطر المصباح', 170, 40, 400, 5, 'interaction'),
    range('softness', 'Softness', 'النعومة', 0.6, 0, 1, 0.05, 'look'),
    range('darkness', 'Veil darkness', 'عتمة الستار', 0.9, 0.5, 1, 0.01, 'look'),
    toggle('idleWander', 'Wander when idle', 'التجوّل عند السكون', true, 'motion'),
  ],
  code: String.raw`
const p = ck.params({ palette: 'theme', seed: 5, speed: 1, density: 1, interactive: true, image: '${SET_B_PHOTOS.petraDeir}', radius: 170, softness: 0.6, darkness: 0.9, idleWander: true });
const s = await ck.scene({ libs: [], pointer: false });
const P = s.PIXI, pal = s.palette;
let tex = null;
try { tex = await s.texture(p.image); } catch (e) { tex = null; }

const under = new P.Container();
s.stage.addChild(under);
const art = new P.Graphics();
under.addChild(art);
const photo = tex ? new P.Sprite(tex) : null;
if (photo) { photo.anchor.set(0.5); under.addChild(photo); }
const spots = [];
for (let i = 0; i < 9; i++) spots.push({ x: s.random(), y: s.random(), r: s.rand(0.08, 0.3), c: pal.colors[i % 5] });

// the torch: a soft disc whose hard core shrinks as softness grows
const core = 1 - p.softness * 0.85;
const disc = new P.Graphics();
for (let i = 0; i <= 12; i++) disc.circle(64, 64, 64 - (64 - 64 * core) * (i / 12)).fill({ color: 0xffffff, alpha: 0.3 });
const brushTex = s.app.renderer.generateTexture(disc);
disc.destroy();
s.dispose(() => brushTex.destroy(true));

const veil = new P.Container();
const shade = new P.Graphics();
veil.addChild(shade);
const holes = [];
for (let i = 0; i < 7; i++) {
  const b = new P.Sprite(brushTex);
  b.anchor.set(0.5);
  b.blendMode = 'erase';
  holes.push(b);
  veil.addChild(b);
}
const rt = s.rt(s.width, s.height);
const cover = new P.Sprite(rt);
s.stage.addChild(cover);
const ink = pal.dark ? pal.surface : pal.mix(pal.text, 0x000000, 0.45);

function layout(w, h) {
  art.clear().rect(0, 0, w, h).fill(pal.surface);
  for (const o of spots) art.circle(o.x * w, o.y * h, o.r * Math.max(w, h)).fill({ color: o.c, alpha: 0.55 });
  if (photo) { photo.scale.set(Math.max(w / tex.width, h / tex.height)); photo.position.set(w / 2, h / 2); }
  rt.resize(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
}
layout(s.width, s.height);
s.onResize(layout);

let sx = s.width * (s.dir > 0 ? 0.62 : 0.38), sy = s.height * 0.45;
const trail = [];
s.tick(({ t, dt }) => {
  const w = s.width, h = s.height;
  let tx = w * (s.dir > 0 ? 0.62 : 0.38), ty = h * 0.45;
  if (p.interactive && s.pointer.inside) { tx = s.pointer.x; ty = s.pointer.y; }
  else if (p.idleWander && !s.reducedMotion) {
    tx = w * (0.5 + 0.34 * s.noise2(t * 0.09 * p.speed, 1.7) * s.dir);
    ty = h * (0.5 + 0.3 * s.noise2(t * 0.08 * p.speed, 9.1));
  }
  const k = s.reducedMotion ? 1 : Math.min(1, dt * 7);
  sx += (tx - sx) * k;
  sy += (ty - sy) * k;
  trail.unshift({ x: sx, y: sy });
  if (trail.length > 24) trail.pop();
  shade.clear().rect(0, 0, w, h).fill({ color: ink, alpha: p.darkness });
  const rad = p.radius * (1 + 0.06 * Math.sin(t * 1.3 * p.speed)) * Math.min(1.3, Math.max(0.45, Math.min(w, h) / 600));
  for (let i = 0; i < holes.length; i++) {
    const b = holes[i], tr = trail[Math.min(trail.length - 1, i * 3)];
    const wob = rad * 0.18;
    b.position.set(tr.x + s.noise3(i * 1.7, t * 0.6, 4) * wob, tr.y + s.noise3(i * 2.3, t * 0.6, 8) * wob);
    b.scale.set((rad * (1 - i * 0.11)) / 64);
    b.alpha = i === 0 ? 1 : 0.55 - i * 0.06;
  }
  s.app.renderer.render({ container: veil, target: rt, clear: true });
});
`,
});
