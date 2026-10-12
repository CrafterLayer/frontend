import { definePreset, range, sharedParams, toggle } from './define';

/**
 * Sparks rising off a fire below the section. A particle emitter (CloudKid config) streams
 * embers from the bottom edge, colour-ramped white-hot → ember → ash, leaning with the wind; a
 * heat-haze DisplacementFilter (a vertically tileable noise map scrolling upward) shimmers the
 * air; the pointer stirs a vortex in the sparks. The emitter is pre-warmed so the first frame —
 * and the reduced-motion still — is already full.
 */
export const EMBER_STORM = definePreset({
  id: 'ember-storm',
  name: { en: 'Ember storm', ar: 'عاصفة الجمر' },
  description: {
    en: 'Embers and sparks rise from the bottom edge through shimmering heat haze, leaning with the wind; the pointer stirs them into a swirl.',
    ar: 'جمرات وشرارات تتصاعد من الحافة السفلية عبر وهج حراري متراقص وتميل مع الريح، ويحرّكها المؤشر في دوامة.',
  },
  tags: ['interactive', 'particles', 'light', 'bold', 'hero'],
  libs: ['kit', 'emitter'],
  params: [
    ...sharedParams({ seed: 17 }),
    range('rate', 'Rate', 'المعدّل', 1, 0.2, 3, 0.05, 'motion'),
    range('heat', 'Heat haze', 'الوهج الحراري', 0.6, 0, 1, 0.05, 'look'),
    range('wind', 'Wind', 'الريح', 0.25, -1, 1, 0.05, 'motion'),
    toggle('fire', 'Fire colours (off: palette)', 'ألوان النار (الإيقاف: لوحة الألوان)', true, 'look'),
  ],
  code: String.raw`
const p = ck.params({ palette: 'theme', seed: 17, speed: 1, density: 1, interactive: true, rate: 1, heat: 0.6, wind: 0.25, fire: true });
const s = await ck.scene({ libs: ['emitter'], pointer: false });
const P = s.PIXI, E = s.lib.emitter, pal = s.palette;
const hot = p.fire ? ['#fff7d6', '#ffd166', '#ff7a3d', '#8f1d3a'] : [pal.hex(1), pal.hex(0), pal.hex(4), pal.hex(3)];

const spark = new P.Graphics();
for (let i = 0; i <= 6; i++) spark.ellipse(12, 4, 12 - i * 1.4, 4 - i * 0.45).fill({ color: 0xffffff, alpha: 0.22 });
const sparkTex = s.app.renderer.generateTexture(spark);
spark.destroy();

// heat haze: a noise map that tiles vertically (sampled around a cylinder), scrolled upward
const NS = 128, nd = new Uint8Array(NS * NS * 4);
for (let y = 0; y < NS; y++) {
  const a = (y / NS) * Math.PI * 2;
  for (let x = 0; x < NS; x++) {
    const i = (y * NS + x) * 4;
    nd[i] = 128 + 127 * s.noise3(x * 0.05, Math.cos(a) * 1.6, Math.sin(a) * 1.6);
    nd[i + 1] = 128 + 127 * s.noise3(x * 0.05 + 40, Math.cos(a) * 1.6, Math.sin(a) * 1.6);
    nd[i + 2] = 128;
    nd[i + 3] = 255;
  }
}
const hazeTex = new P.Texture({ source: new P.BufferImageSource({ resource: nd, width: NS, height: NS }) });
hazeTex.source.addressMode = 'repeat';
const haze = new P.Sprite(hazeTex);
haze.renderable = false;
s.stage.addChild(haze);
s.dispose(() => { sparkTex.destroy(true); hazeTex.destroy(true); });

const layer = new P.Container();
s.stage.addChild(layer);
const glow = new P.Graphics();
glow.blendMode = 'add';
const sparks = new P.ParticleContainer({ boundsArea: s.app.screen, dynamicProperties: { position: true, rotation: true, vertex: true, color: true, uvs: false } });
sparks.blendMode = 'add';
layer.addChild(glow, sparks);
const disp = new P.DisplacementFilter({ sprite: haze, scale: 22 * p.heat });
layer.filters = p.heat > 0.02 ? [disp] : null;
s.dispose(() => { layer.filters = null; });

const max = Math.min(1500, s.count(520));
let em = null;
function make(w, h) {
  if (em) em.destroy();
  em = new E.Emitter(sparks, {
    lifetime: { min: 1.6, max: 3.6 },
    frequency: 2.6 / max / p.rate,
    emitterLifetime: -1,
    maxParticles: max,
    addAtBack: false,
    pos: { x: 0, y: 0 },
    behaviors: [
      { type: 'alpha', config: { alpha: { list: [{ value: 0, time: 0 }, { value: 1, time: 0.08 }, { value: 0.85, time: 0.6 }, { value: 0, time: 1 }] } } },
      { type: 'scale', config: { scale: { list: [{ value: 1, time: 0 }, { value: 0.3, time: 1 }] }, minMult: 0.35 } },
      { type: 'color', config: { color: { list: [{ value: hot[0], time: 0 }, { value: hot[1], time: 0.2 }, { value: hot[2], time: 0.55 }, { value: hot[3], time: 1 }] } } },
      { type: 'moveAcceleration', config: { accel: { x: p.wind * 70 * s.dir, y: -50 }, minStart: 70, maxStart: 240, rotate: true, maxSpeed: 420 } },
      { type: 'rotationStatic', config: { min: 255, max: 285 } },
      { type: 'spawnShape', config: { type: 'rect', data: { x: -40, y: h + 6, w: w + 80, h: 12 } } },
      { type: 'textureSingle', config: { texture: sparkTex } },
    ],
  });
  // pre-warm: the first frame is already a storm
  for (let i = 0; i < 60; i++) em.update(0.06);
  glow.clear();
  for (let i = 0; i < 10; i++) glow.rect(0, h - (h * 0.3 * (i + 1)) / 10, w, (h * 0.3) / 10).fill({ color: hot[2], alpha: 0.05 * (1 - i / 10) });
  haze.width = w;
  haze.height = h * 1.5;
}
make(s.width, s.height);
s.onResize(make);
s.dispose(() => { if (em) em.destroy(); });

s.tick(({ t, dt }) => {
  if (s.reducedMotion) return;
  const step = dt * p.speed;
  em.update(step);
  haze.y = (haze.y - step * 60) % (s.height * 1.5);
  glow.alpha = 0.75 + 0.25 * s.noise2(t * 2.2, 0.5);
  if (p.interactive && s.pointer.inside) {
    const px = s.pointer.x, py = s.pointer.y, R = 140;
    for (const c of sparks.particleChildren) {
      const dx = c.x - px, dy = c.y - py, d = Math.hypot(dx, dy) + 0.01;
      if (d < R) { const k = (1 - d / R) * 220 * step; c.x += (-dy / d) * k * s.dir + (dx / d) * k * 0.3; c.y += (dx / d) * k * s.dir + (dy / d) * k * 0.3; }
    }
  }
});
`,
});
