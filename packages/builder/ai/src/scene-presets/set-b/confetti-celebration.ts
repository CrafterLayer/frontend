import { definePreset, range, select, sharedParams, soundToggle } from './define';

/**
 * A celebration. Two cannons at the bottom corners fire a palette salvo when the section scrolls
 * into view (or on a loop), and every tap inside pops a burst at the pointer. Paper is rectangles,
 * ribbons and dots in the palette, flipping as it falls (a pulsing scale list) and spinning.
 * Between salvos a light drift of paper keeps falling, swaying and flipping, so the stage is never
 * empty.
 * Sound is OFF by default; turned on, a burst plays the bank's 'pop' only after a visitor gesture.
 * Reduced motion: a still scatter of settled confetti.
 */
export const CONFETTI_CELEBRATION = definePreset({
  id: 'confetti-celebration',
  name: { en: 'Confetti celebration', ar: 'احتفال القصاصات' },
  description: {
    en: 'Palette confetti fired from two cannons when the section comes into view, plus a burst wherever you tap. Optional pop sound, muted until a visitor turns it on.',
    ar: 'قصاصات ملوّنة بألوان الموقع تنطلق من مدفعين حين يظهر القسم، مع دفقة حيث تنقر. صوت فرقعة اختياري مكتوم حتى يشغّله الزائر.',
  },
  tags: ['interactive', 'particles', 'bold', 'hero'],
  libs: ['kit', 'emitter'],
  sound: true,
  params: [
    ...sharedParams({ seed: 29 }),
    select(
      'trigger',
      'Fire when',
      'الإطلاق عند',
      'enter',
      [
        ['enter', 'Section enters view', 'ظهور القسم'],
        ['loop', 'Every few seconds', 'كل بضع ثوانٍ'],
        ['click', 'Only on tap', 'عند النقر فقط'],
      ],
      'interaction',
    ),
    range('spread', 'Spread', 'الانتشار', 70, 10, 180, 1, 'look'),
    range('gravity', 'Gravity', 'الجاذبية', 1, 0, 3, 0.05, 'motion'),
    soundToggle(),
  ],
  code: String.raw`
const p = ck.params({ palette: 'theme', seed: 29, speed: 1, density: 1, interactive: true, trigger: 'enter', spread: 70, gravity: 1, sound: false });
const s = await ck.scene({ libs: ['emitter'], pointer: false });
const P = s.PIXI, E = s.lib.emitter, pal = s.palette;
// one sheet: a column per palette colour (paper, ribbon, dot), so every frame shares one source
const sheetG = new P.Graphics();
for (let i = 0; i < 5; i++) {
  const c = pal.colors[i], x = i * 20;
  sheetG.rect(x, 0, 14, 7).fill(c).roundRect(x, 10, 5, 18, 2).fill(c).circle(x + 5, 36, 5).fill(c);
}
const sheet = s.app.renderer.generateTexture(sheetG);
sheetG.destroy();
const texs = [];
for (let i = 0; i < 5; i++) {
  const x = i * 20;
  for (const f of [[x, 0, 14, 7], [x, 10, 5, 18], [x, 31, 10, 10]]) texs.push(new P.Texture({ source: sheet.source, frame: new P.Rectangle(f[0], f[1], f[2], f[3]) }));
}
s.dispose(() => { for (const t of texs) t.destroy(false); sheet.destroy(true); });

if (s.reducedMotion) {
  // the still frame: confetti already settled, scattered by poisson so nothing overlaps
  const g = new P.Graphics();
  s.stage.addChild(g);
  s.still(() => {
    for (const pt of s.poisson(s.width, s.height, 34, s.count(160))) {
      const a = s.rand(0, Math.PI), cs = Math.cos(a), sn = Math.sin(a), w = s.rand(4, 8), h = s.rand(2, 4);
      const x = pt[0], y = pt[1];
      g.poly([x - cs * w + sn * h, y - sn * w - cs * h, x + cs * w + sn * h, y + sn * w - cs * h, x + cs * w - sn * h, y + sn * w + cs * h, x - cs * w - sn * h, y - sn * w + cs * h]).fill(s.pick(pal.colors));
    }
  });
  return;
}

const layer = new P.ParticleContainer({ dynamicProperties: { position: true, rotation: true, vertex: true, uvs: true, color: true } });
s.stage.addChild(layer);
const per = Math.min(400, s.count(140));
function cannon(angle, spread) {
  return new E.Emitter(layer, {
    lifetime: { min: 2.2, max: 3.6 },
    frequency: 0.004,
    particlesPerWave: Math.max(1, Math.ceil(per / 30)),
    emitterLifetime: 0.12,
    maxParticles: per,
    addAtBack: false,
    emit: false,
    pos: { x: 0, y: 0 },
    behaviors: [
      { type: 'alpha', config: { alpha: { list: [{ value: 1, time: 0 }, { value: 1, time: 0.75 }, { value: 0, time: 1 }] } } },
      { type: 'scale', config: { scale: { list: [{ value: 1, time: 0 }, { value: 0.3, time: 0.15 }, { value: 1, time: 0.3 }, { value: 0.3, time: 0.45 }, { value: 1, time: 0.6 }, { value: 0.3, time: 0.75 }, { value: 1, time: 0.9 }, { value: 0.6, time: 1 }] }, minMult: 0.6 } },
      { type: 'moveAcceleration', config: { accel: { x: 0, y: 900 * p.gravity }, minStart: 520, maxStart: 1050, rotate: false, maxSpeed: 0 } },
      { type: 'rotation', config: { accel: 0, minSpeed: -540, maxSpeed: 540, minStart: angle - spread / 2, maxStart: angle + spread / 2 } },
      { type: 'spawnPoint', config: {} },
      { type: 'textureRandom', config: { textures: texs } },
    ],
  });
}
const left = cannon(-60, p.spread), right = cannon(-120, p.spread), pop = cannon(-90, Math.min(300, p.spread * 2.2));

// the drift: a few dozen papers always falling under the salvos (one texture source, so one draw)
const driftLayer = new P.ParticleContainer({ dynamicProperties: { position: true, rotation: true, vertex: true, uvs: false, color: false } });
s.stage.addChildAt(driftLayer, 0);
const drift = [];
let DW = s.width, DH = s.height;
function seedDrift(w, h) {
  DW = w;
  DH = h;
  driftLayer.removeParticles();
  drift.length = 0;
  const n = Math.min(160, s.count(Math.round(24 + (w * h) / 6000)));
  for (let i = 0; i < n; i++) {
    const q = new P.Particle({ texture: s.pick(texs), x: s.rand(0, w), y: s.rand(-20, h), anchorX: 0.5, anchorY: 0.5, rotation: s.rand(0, 6.28), alpha: s.rand(0.55, 0.9) });
    driftLayer.addParticle(q);
    drift.push({ q, x: q.x, y: q.y, vy: s.rand(26, 58), sway: s.rand(8, 26), ph: s.rand(0, 6.28), spin: s.rand(-2.2, 2.2), flip: s.rand(1.5, 3.5), k: s.rand(0.7, 1.15) });
  }
  driftLayer.boundsArea = new P.Rectangle(0, 0, w, h);
  driftLayer.update();
}
seedDrift(s.width, s.height);
s.onResize(seedDrift);
s.dispose(() => { left.destroy(); right.destroy(); pop.destroy(); });

let armed = false, fired = false, loopT = 0;
function burst(em, x, y) {
  em.updateSpawnPos(x, y);
  em.resetPositionTracking();
  em.emit = true;
}
function salvo() {
  // each cannon stays in its own corner, aimed inward (the pair is symmetric in either direction)
  burst(left, 0, s.height);
  burst(right, s.width, s.height);
  if (p.sound && armed) ck.sound.play('pop', { volume: 0.45 });
}
s.pointer.onDown(() => {
  armed = true;
  if (!p.interactive || !s.pointer.inside) return;
  burst(pop, s.pointer.x, s.pointer.y);
  if (p.sound) ck.sound.play('pop', { volume: 0.5, rate: s.rand(0.9, 1.15) });
});

s.tick(({ dt }) => {
  if (s.scroll.visible) {
    if (p.trigger === 'enter' && !fired) { fired = true; salvo(); }
    if (p.trigger === 'loop') { loopT -= dt * p.speed; if (loopT <= 0) { loopT = 4; salvo(); } }
  }
  const d = dt * p.speed, fall = Math.max(0.35, p.gravity) * d;
  for (const o of drift) {
    o.y += o.vy * fall;
    o.ph += d * 1.4;
    if (o.y > DH + 20) { o.y = -20; o.x = s.rand(0, DW); }
    o.q.x = o.x + Math.sin(o.ph) * o.sway;
    o.q.y = o.y;
    o.q.rotation += o.spin * d;
    o.q.scaleX = o.k;
    o.q.scaleY = o.k * (0.3 + 0.7 * Math.abs(Math.cos(o.ph * o.flip)));
  }
  left.update(d);
  right.update(d);
  pop.update(d);
});
`,
});
