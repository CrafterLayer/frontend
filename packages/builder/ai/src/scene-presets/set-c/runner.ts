import { count, defineKit, range, sharedParams, soundButton } from './define';
import { gameBody } from './game-shell';
import { gameRegion } from './game-tree';

const w = (en: string, ar: string) => ({ en, ar });

/**
 * Dash runner: an endless runner. The runner sprints on its own; jump (Space, Up, W, a tap or the
 * Jump button — hold for a higher jump) over crates and pillars, stay low under the swooping
 * birds, grab coin arcs. The pace ramps up the longer you last; the best distance is kept for the
 * session. A finish distance (or endless), lives and the ramp are params; the run heads left on an
 * RTL page. Reduced motion: each jump or step is one short, still-rendered move.
 */
export const RUNNER = defineKit({
  id: 'runner',
  category: 'game',
  name: w('Dash runner', 'لعبة العدّاء'),
  description: w(
    'An endless runner: jump crates and pillars, stay low under birds, grab coins while the pace ramps up. Best distance kept; finish line or endless; tap, keys or button to jump.',
    'لعبة جري لا تنتهي: اقفز فوق الصناديق والأعمدة وابقَ منخفضاً تحت الطيور واجمع العملات بينما تزداد السرعة. يُحفظ أفضل رقم، مع خط نهاية أو جري بلا نهاية.',
  ),
  tags: ['interactive', 'game', 'playful', 'arabic'],
  libs: ['kit', 'audio'],
  params: [
    ...sharedParams({ seed: 11, interactive: false }),
    count(
      'goal',
      'Finish line (metres, 0 = endless)',
      'خط النهاية (بالأمتار، 0 = بلا نهاية)',
      600,
      0,
      5000,
      'interaction',
    ),
    count('lives', 'Lives', 'المحاولات', 1, 1, 5, 'interaction'),
    range('ramp', 'Speed-up', 'تزايد السرعة', 1, 0, 2, 0.05, 'motion'),
    soundButton(),
  ],
  scene: "{ libs: ['audio'], design: { width: 1280, height: 848 }, pointer: true }",
  body: gameBody(String.raw`
const STATS = ['distance', 'coins', 'best'];
const GY = 596, RX = 250, goal = Math.round(p.goal), lifeMax = Math.round(p.lives);
backdrop(pal.mix(pal.surface, pal.accent, 0.28), pal.mix(pal.surface, gold, 0.3));
const lane = new P.Container();
field.addChild(lane);
// Far peaks, near hills and the ground's tufts: each a strip one period wider than the field.
function strip(k, period, paint) {
  const g = new P.Graphics();
  paint(g, W + period);
  g.k = k;
  g.period = period;
  lane.addChild(g);
  return g;
}
const sun = new P.Graphics().circle(980, 170, 70).fill({ color: gold, alpha: 0.85 }).circle(980, 170, 110).fill({ color: gold, alpha: 0.12 });
lane.addChild(sun);
const layers = [
  strip(0.08, 640, (g, len) => {
    const pts = [0, GY];
    for (let x = 0; x <= len; x += 80) pts.push(x, 330 + Math.abs(Math.sin(x * 0.0098)) * -120 + Math.sin(x * 0.031) * 18);
    pts.push(len, GY);
    g.poly(pts).fill(pal.mix(pal.surface, pal.accent, 0.4));
  }),
  strip(0.3, 520, (g, len) => {
    const pts = [0, GY];
    for (let x = 0; x <= len; x += 26) pts.push(x, 470 + Math.sin(x * (Math.PI * 2 / 520)) * 34 + Math.sin(x * (Math.PI * 4 / 520)) * 10);
    pts.push(len, GY);
    g.poly(pts).fill(pal.mix(pal.surface, pal.colors[4], 0.55));
  }),
  strip(1, 128, (g, len) => {
    g.rect(0, GY, len, H - GY).fill(pal.mix(pal.surface, pal.text, 0.18)).rect(0, GY, len, 10).fill(leaf);
    for (let x = 0; x < len; x += 128) g.rect(x + 20, GY + 26, 46, 6).fill({ color: pal.text, alpha: 0.1 }).rect(x + 84, GY + 58, 28, 6).fill({ color: pal.text, alpha: 0.08 }).poly([x + 70, GY, x + 76, GY - 12, x + 82, GY]).fill(leaf);
  }),
];
const crate = pal.mix(gold, pal.surface, 0.35);
const KINDS = [
  { w: 52, h: 52, air: 0, shape: new P.GraphicsContext().roundRect(-26, -52, 52, 52, 6).fill(crate).rect(-20, -46, 40, 40).stroke({ width: 4, color: pal.mix(crate, pal.surface, 0.4) }).moveTo(-20, -46).lineTo(20, -6).stroke({ width: 4, color: pal.mix(crate, pal.surface, 0.4) }) },
  { w: 40, h: 100, air: 0, shape: new P.GraphicsContext().roundRect(-20, -100, 40, 100, 12).fill(danger).roundRect(-12, -88, 8, 70, 4).fill({ color: 0xffffff, alpha: 0.18 }) },
  { w: 106, h: 48, air: 0, shape: new P.GraphicsContext().roundRect(-53, -48, 50, 48, 6).fill(crate).roundRect(3, -48, 50, 48, 6).fill(crate).rect(-47, -42, 38, 36).stroke({ width: 4, color: pal.mix(crate, pal.surface, 0.4) }).rect(9, -42, 38, 36).stroke({ width: 4, color: pal.mix(crate, pal.surface, 0.4) }) },
  { w: 60, h: 34, air: 132, shape: new P.GraphicsContext().ellipse(0, -17, 26, 15).fill(danger).poly([-8, -22, 14, -54, 20, -20]).fill(pal.mix(danger, pal.surface, 0.3)).circle(14, -21, 4).fill(0xffffff).poly([24, -18, 38, -14, 24, -10]).fill(gold) },
];
const coinShape = new P.GraphicsContext().circle(0, 0, 13).fill(gold).circle(0, 0, 7.5).stroke({ width: 3, color: pal.mix(gold, 0xffffff, 0.45) });
s.dispose(() => { for (const k of KINDS) k.shape.destroy(); coinShape.destroy(); });
const blocks = [], coins = [];
for (let i = 0; i < 8; i++) {
  const g = new P.Graphics();
  lane.addChild(g);
  blocks.push({ g, on: false, x: 0, kind: KINDS[0] });
}
for (let i = 0; i < 14; i++) {
  const g = new P.Graphics(coinShape);
  lane.addChild(g);
  coins.push({ g, on: false, x: 0, y: 0 });
}
// The runner: a body, a head and four limbs that swing with the stride.
const runner = new P.Container();
const limb = (color, x, y, len) => {
  const g = new P.Graphics().roundRect(-5, 0, 10, len, 5).fill(color);
  g.position.set(x, y);
  return g;
};
const shade = pal.mix(pal.accent, pal.surface, 0.35);
const legBack = limb(shade, -4, -30, 30), armBack = limb(shade, -2, -58, 26);
const legFront = limb(pal.accent, 4, -30, 30), armFront = limb(pal.accent, 6, -58, 26);
const torso = new P.Graphics().roundRect(-15, -66, 30, 40, 12).fill(pal.accent);
const head = new P.Graphics().circle(2, -82, 15).fill(pal.mix(pal.accent, 0xffffff, 0.55)).circle(9, -84, 3).fill(pal.surface);
runner.addChild(legBack, armBack, torso, legFront, armFront, head);
runner.x = RX;
lane.addChild(runner);

let y = GY, vy = 0, ground = true, coyote = 0, buffer = 0, jumpWas = false, speed = 0, run = 0, timer = 0, next = 0, got = 0;
let lives = 0, safe = 0, stride = 0, best = 0, clock = 0, tapped = false;
function metres() {
  return Math.floor(run / 50);
}
function spawn() {
  const b = blocks.find((k) => !k.on);
  if (!b) return;
  const pick = clock < 6 ? s.int(0, 1) : s.int(0, KINDS.length - 1);
  b.kind = KINDS[pick];
  b.g.context = b.kind.shape;
  b.x = W + 80;
  b.on = true;
  if (s.random() < 0.45) {
    const n = s.int(3, 5);
    for (let i = 0; i < n; i++) {
      const c = coins.find((k) => !k.on);
      if (!c) break;
      c.on = true;
      c.x = b.x + (i - (n - 1) / 2) * 46;
      c.y = GY - (b.kind.air ? 40 : b.kind.h + 70) - Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 40;
    }
  }
}
function reset() {
  y = GY;
  vy = 0;
  ground = true;
  run = 0;
  timer = 0;
  next = 1.2;
  got = 0;
  clock = 0;
  speed = 430;
  lives = lifeMax;
  safe = 0;
  for (const b of blocks) b.on = false;
  for (const c of coins) c.on = false;
  sync();
}
function sync() {
  hud('distance', metres() + (goal > 0 ? '/' + goal : ''));
  hud('coins', got);
  hud('best', best);
}
function crash() {
  if (safe > 0) return;
  lives -= 1;
  burst(RX, y - 40, danger, 26);
  sfx('hit');
  if (lives <= 0) {
    if (metres() > best) {
      best = metres();
      tell(say('best'));
    }
    sync();
    return end(false);
  }
  safe = 1.5;
  sync();
}
function step(dt) {
  clock += dt;
  speed = 430 * Math.min(2.2, 1 + (p.ramp * Math.min(clock, 90)) / 45);
  const move = speed * dt;
  run += move;
  stride += move / 38;
  const jumpHeld = s.input.down('Space') || s.input.down('ArrowUp') || s.input.down('KeyW') || (s.pointer.down && tapped);
  if (jumpHeld && !jumpWas) buffer = 0.12;
  jumpWas = jumpHeld;
  coyote = ground ? 0.08 : coyote - dt;
  buffer -= dt;
  if (buffer > 0 && coyote > 0) {
    vy = -960;
    ground = false;
    buffer = coyote = 0;
    sfx('jump');
  }
  if (!jumpHeld && vy < -420) vy = -420;
  vy += 2800 * dt;
  y += vy * dt;
  if (y >= GY) {
    if (!ground) burst(RX, GY, pal.muted, 6);
    y = GY;
    vy = 0;
    ground = true;
  }
  if (!s.pointer.down) tapped = false;
  timer += dt;
  if (timer >= next) {
    timer = 0;
    next = s.rand(0.85, 1.55);
    spawn();
  }
  if (safe > 0) safe -= dt;
  for (const b of blocks) {
    if (!b.on) continue;
    b.x -= move;
    if (b.x < -140) { b.on = false; continue; }
    const k = b.kind, bottom = GY - k.air, top = bottom - k.h;
    if (Math.abs(b.x - RX) < k.w / 2 + 12 && y - 70 < bottom - 6 && y > top + 6) {
      b.on = false;
      crash();
      if (mode !== 'running') return;
    }
  }
  for (const c of coins) {
    if (!c.on) continue;
    c.x -= move;
    if (c.x < -40) { c.on = false; continue; }
    if (Math.abs(c.x - RX) < 32 && c.y > y - 92 && c.y < y + 10) {
      c.on = false;
      got += 1;
      burst(c.x, c.y, gold, 10);
      sfx('coin');
    }
  }
  if (metres() > best && lives > 0 && goal === 0) best = metres();
  sync();
  if (goal > 0 && metres() >= goal) {
    if (metres() > best) best = metres();
    sync();
    return end(true);
  }
}
function manual(code) {
  if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
    hold(code, 0.25);
    for (let t = 0; t < 1.2 && !ground && mode === 'running'; t += 0.05) advance(0.05);
  } else advance(0.35);
}
function point(px, py) {
  if (calm) {
    if (py < H / 2) manual('Space');
    else advance(0.35);
    return;
  }
  tapped = true;
}
function idle(dt) {
  if (mode !== 'running') stride += dt * 0.6;
}
function draw() {
  lane.scale.x = s.dir;
  lane.x = s.dir > 0 ? 0 : W;
  for (const g of layers) g.x = -((run * g.k) % g.period);
  for (const b of blocks) {
    b.g.visible = b.on;
    b.g.x = b.x;
    b.g.y = GY - b.kind.air;
  }
  for (const c of coins) {
    c.g.visible = c.on;
    c.g.position.set(c.x, c.y);
  }
  runner.y = y;
  runner.alpha = safe > 0 && Math.floor(safe * 10) % 2 === 0 ? 0.35 : 1;
  const swing = ground ? Math.sin(stride) * 0.9 : -0.6;
  legFront.rotation = swing;
  legBack.rotation = ground ? -swing : 0.9;
  armFront.rotation = -swing * 0.8;
  armBack.rotation = swing * 0.8;
  runner.rotation = ground ? 0 : Math.max(-0.25, Math.min(0.2, vy / 3000));
}
`),
  region: gameRegion({
    title: w('Dash runner', 'العدّاء'),
    intro: w(
      'Jump the crates and pillars, stay low under the birds, and run as far as you can. Space, Up, a tap or the Jump button — hold for a higher jump.',
      'اقفز فوق الصناديق والأعمدة، وابقَ منخفضاً تحت الطيور، واركض أبعد ما تستطيع. المسافة أو السهم الأعلى أو لمسة أو زر القفز، واضغط مطوّلاً لقفزة أعلى.',
    ),
    stats: [
      { key: 'distance', label: w('Metres', 'الأمتار'), value: '0/600' },
      { key: 'coins', label: w('Coins', 'العملات'), value: '0' },
      { key: 'best', label: w('Best', 'الأفضل'), value: '0' },
    ],
    keys: [],
    actions: [{ key: 'Space', label: w('Jump', 'اقفز') }],
    says: {
      won: w('You crossed the finish line!', 'عبرت خط النهاية!'),
      lost: w('You tripped!', 'تعثّرت!'),
      best: w('New best distance!', 'أفضل مسافة جديدة!'),
    },
  }),
});
