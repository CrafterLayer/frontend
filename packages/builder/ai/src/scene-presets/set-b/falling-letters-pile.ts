import { definePreset, range, sharedParams, text, toggle } from './define';

/**
 * Words as physical objects. Each WORD (never a letter — Arabic stays joined) becomes a pill-shaped
 * matter-js body that drops in, collides and piles up at the bottom of the section; the visitor
 * can grab one and throw it (mouse or touch). The only set-B preset that takes pointer capture
 * (`pointer: true`): dragging is the point. Reduced motion settles the pile before the first frame.
 */
export const FALLING_LETTERS_PILE = definePreset({
  id: 'falling-letters-pile',
  name: { en: 'Falling words pile', ar: 'كومة الكلمات المتساقطة' },
  description: {
    en: 'Your words drop in as solid pills, bounce and pile up with real physics; grab one and throw it. Arabic words stay whole and joined.',
    ar: 'كلماتك تسقط كحبّات صلبة وترتد وتتكوّم بفيزياء حقيقية، أمسك واحدة وارمها. الكلمات العربية تبقى كاملة ومتصلة.',
  },
  tags: ['interactive', 'physics', 'text', 'arabic', 'bold'],
  libs: ['kit', 'physics'],
  params: [
    ...sharedParams({ seed: 31 }),
    text('words', 'Words', 'الكلمات', '', 'look', {
      en: 'Separated by spaces. Empty: six words in the page language.',
      ar: 'مفصولة بمسافات. فارغة: ست كلمات بلغة الصفحة.',
    }),
    range('gravity', 'Gravity', 'الجاذبية', 1, 0, 3, 0.05, 'motion'),
    range('restitution', 'Bounce', 'الارتداد', 0.35, 0, 0.9, 0.05, 'motion'),
    toggle('throwable', 'Throwable', 'قابلة للرمي', true, 'interaction'),
    range('size', 'Size', 'الحجم', 1, 0.5, 2, 0.05, 'look'),
  ],
  code: String.raw`
const p = ck.params({ palette: 'theme', seed: 31, speed: 1, density: 1, interactive: true, words: '', gravity: 1, restitution: 0.35, throwable: true, size: 1 });
const s = await ck.scene({ libs: ['physics'], pointer: true });
const P = s.PIXI, M = s.lib.physics, pal = s.palette;
const list = s.words(p.words || (s.rtl ? 'صمّم ابنِ أطلق ألهم أبدع جرّب' : 'Design Build Launch Inspire Create Play'));
const engine = M.Engine.create({ gravity: { x: 0, y: p.gravity, scale: 0.001 } });
s.dispose(() => { M.Composite.clear(engine.world, false); M.Engine.clear(engine); });

let walls = [];
function bounds(w, h) {
  if (walls.length) M.Composite.remove(engine.world, walls);
  const T = 200;
  walls = [
    M.Bodies.rectangle(w / 2, h + T / 2, w * 3, T, { isStatic: true }),
    M.Bodies.rectangle(-T / 2, h / 2 - h, T, h * 4, { isStatic: true }),
    M.Bodies.rectangle(w + T / 2, h / 2 - h, T, h * 4, { isStatic: true }),
  ];
  M.Composite.add(engine.world, walls);
}
bounds(s.width, s.height);

const fs = Math.max(18, Math.min(64, s.width / 16)) * p.size;
const total = Math.max(list.length, Math.min(60, s.count(list.length * 3)));
const tiles = [];
for (let i = 0; i < total; i++) {
  const word = list[i % list.length], kind = i % 3;
  const fg = kind === 0 ? pal.surface : kind === 1 ? pal.text : pal.accent;
  const tag = s.text(word, { fontSize: fs, fontWeight: '800', fill: fg });
  tag.anchor.set(0.5);
  const bw = Math.max(tag.width, word.length * fs * 0.45) + fs * 1.1, bh = fs * 1.55;
  const box = new P.Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
  if (kind === 0) box.fill(pal.accent);
  else if (kind === 1) box.fill(pal.colors[1]);
  else box.fill(pal.surface).stroke({ width: Math.max(2, fs * 0.06), color: pal.accent });
  const c = new P.Container();
  c.addChild(box, tag);
  s.stage.addChild(c);
  const u = (i * 0.618034) % 1;
  const x = s.width * (s.dir > 0 ? 0.12 + 0.76 * u : 0.88 - 0.76 * u);
  const body = M.Bodies.rectangle(x, -bh - i * bh * 0.9, bw, bh, { chamfer: { radius: bh * 0.45 }, restitution: p.restitution, friction: 0.4, frictionAir: 0.012, angle: s.rand(-0.4, 0.4) });
  M.Composite.add(engine.world, body);
  tiles.push({ c, body });
}
s.onResize((w, h) => {
  bounds(w, h);
  for (const t of tiles) if (t.body.position.x > w - 10 || t.body.position.y > h) M.Body.setPosition(t.body, { x: Math.min(w - 40, Math.max(40, t.body.position.x)), y: Math.min(h - 40, t.body.position.y) });
});

// reduced motion: settle the pile now, so the single frame shows it at rest
if (s.reducedMotion) for (let i = 0; i < 420; i++) M.Engine.update(engine, 1000 / 60);

let grab = null, gx = 0, gy = 0, lpx = s.pointer.x, lpy = s.pointer.y, tvx = 0, tvy = 0;
s.pointer.onDown(() => {
  if (!p.interactive || !s.pointer.inside || s.reducedMotion) return;
  const hit = M.Query.point(tiles.map((t) => t.body), { x: s.pointer.x, y: s.pointer.y })[0];
  if (!hit) return;
  grab = hit;
  gx = s.pointer.x - hit.position.x;
  gy = s.pointer.y - hit.position.y;
  tvx = 0;
  tvy = 0;
});
s.pointer.onUp(() => {
  if (!grab) return;
  const k = p.throwable ? 1.15 : 0;
  M.Body.setVelocity(grab, { x: Math.max(-40, Math.min(40, tvx * k)), y: Math.max(-40, Math.min(40, tvy * k)) });
  grab = null;
});

s.tick(({ dt }) => {
  if (grab) {
    tvx = s.pointer.x - lpx;
    tvy = s.pointer.y - lpy;
    M.Body.setPosition(grab, { x: s.pointer.x - gx, y: s.pointer.y - gy });
    M.Body.setVelocity(grab, { x: tvx, y: tvy });
    M.Body.setAngularVelocity(grab, grab.angularVelocity * 0.9);
  }
  lpx = s.pointer.x;
  lpy = s.pointer.y;
  // matter divides by the previous step: never feed it a zero step
  const ms = Math.min(dt, 1 / 30) * 1000 * p.speed;
  if (!s.reducedMotion && ms > 0.5) M.Engine.update(engine, ms);
  for (const t of tiles) {
    t.c.position.set(t.body.position.x, t.body.position.y);
    t.c.rotation = t.body.angle;
  }
});
`,
});
