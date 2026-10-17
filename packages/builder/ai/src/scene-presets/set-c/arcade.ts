import { count, defineKit, range, sharedParams, soundButton } from './define';
import { gameBody } from './game-shell';
import { gameRegion } from './game-tree';

const w = (en: string, ar: string) => ({ en, ar });

/**
 * Star collector: a top-down collect-and-avoid arcade. Steer a glowing orb with the arrows / WASD,
 * the on-screen pad or by holding a finger on the playfield; collect the stars, dodge the comets
 * that bounce around (one more joins every few stars), before the clock runs out. Lives, a timer,
 * a goal and the comet count are params; stars twinkle, the orb leaves a short trail, a hit
 * blinks and sparks. Reduced motion: each key or tap moves the orb one short hop.
 */
export const ARCADE = defineKit({
  id: 'arcade',
  category: 'game',
  name: w('Star collector arcade', 'لعبة جامع النجوم'),
  description: w(
    'A top-down arcade game: steer with arrows, the pad or a finger, collect the stars, dodge the bouncing comets before time runs out. Lives, timer, goal and comets are settings.',
    'لعبة أركيد من الأعلى: حرّك الكرة بالأسهم أو الأزرار أو بإصبعك، واجمع النجوم وتفادَ المذنّبات قبل انتهاء الوقت. المحاولات والوقت والهدف وعدد المذنّبات إعدادات.',
  ),
  tags: ['interactive', 'game', 'playful', 'arabic'],
  libs: ['kit', 'audio'],
  params: [
    ...sharedParams({ seed: 7, interactive: false }),
    count('goal', 'Stars to win', 'النجوم المطلوبة للفوز', 12, 3, 40, 'interaction'),
    count('lives', 'Lives', 'المحاولات', 3, 1, 9, 'interaction'),
    count(
      'time',
      'Time limit (seconds, 0 = none)',
      'الوقت (بالثواني، 0 = بلا حد)',
      60,
      0,
      300,
      'interaction',
    ),
    count('comets', 'Comets at the start', 'المذنّبات في البداية', 3, 0, 10, 'interaction'),
    range('steer', 'Orb speed', 'سرعة الكرة', 1, 0.5, 2, 0.05, 'motion'),
    soundButton(),
  ],
  scene: "{ libs: ['audio'], design: { width: 1280, height: 848 }, pointer: true }",
  body: gameBody(String.raw`
const STATS = ['stars', 'lives', 'time'];
const goal = Math.round(p.goal), lifeMax = Math.round(p.lives), limit = Math.round(p.time);

// The night field: a gradient, three soft nebulae, a seeded sky of dots.
const back = backdrop(pal.mix(pal.surface, pal.accent, 0.16), pal.mix(pal.surface, pal.colors[4], 0.1));
for (let i = 0; i < 3; i++) {
  const c = [pal.accent, gold, pal.colors[4]][i], r = s.rand(220, 360), cx = s.rand(0.15, 0.85) * W, cy = s.rand(0.2, 0.8) * H;
  for (let k = 6; k > 0; k--) back.circle(cx + k * 6, cy, (r * k) / 6).fill({ color: c, alpha: 0.02 });
}
for (const pt of s.poisson(W - 40, H - 40, 38, s.count(220))) back.circle(pt[0] + 20, pt[1] + 20, s.rand(0.8, 2.2)).fill({ color: pal.text, alpha: s.rand(0.12, 0.45) });

// Stars to collect (three on the field at once), comets, the orb and its trail.
const starShape = new P.GraphicsContext().star(0, 0, 5, 30, 14).fill({ color: gold, alpha: 0.22 }).star(0, 0, 5, 19, 8.5).fill(gold).circle(0, 0, 4).fill({ color: 0xffffff, alpha: 0.85 });
const cometShape = new P.GraphicsContext().star(0, 0, 9, 31, 19).fill(danger).circle(0, 0, 13).fill(pal.mix(danger, pal.surface, 0.45)).circle(-5, -5, 4).fill({ color: 0xffffff, alpha: 0.5 });
s.dispose(() => { starShape.destroy(); cometShape.destroy(); });
const stars = [], comets = [], trail = [];
for (let i = 0; i < 3; i++) {
  const g = new P.Graphics(starShape);
  field.addChild(g);
  stars.push({ g, x: 0, y: 0, on: false, ph: s.rand(0, 6) });
}
for (let i = 0; i < 10; i++) {
  const g = new P.Graphics(cometShape);
  field.addChild(g);
  comets.push({ g, x: 0, y: 0, vx: 0, vy: 0, on: false, spin: s.rand(-2, 2) });
}
for (let i = 0; i < 7; i++) {
  const g = new P.Graphics().circle(0, 0, 15 - i * 1.6).fill({ color: pal.accent, alpha: 0.32 - i * 0.04 });
  field.addChild(g);
  trail.push(g);
}
const orb = new P.Container();
orb.addChild(new P.Graphics().circle(0, 0, 36).fill({ color: pal.accent, alpha: 0.18 }), new P.Graphics().circle(0, 0, 19).fill(pal.accent).stroke({ width: 3, color: pal.mix(pal.accent, 0xffffff, 0.55) }), new P.Graphics().circle(-6, -6, 5.5).fill({ color: 0xffffff, alpha: 0.75 }));
field.addChild(orb);

let x = 0, y = 0, vx = 0, vy = 0, got = 0, lives = 0, left = 0, safe = 0, clock = 0, aim = null;
const past = [];
function freeSpot(min) {
  for (let tries = 0; tries < 40; tries++) {
    const cx = s.rand(70, W - 70), cy = s.rand(70, H - 70);
    if (Math.hypot(cx - x, cy - y) < min) continue;
    if (stars.some((t) => t.on && Math.hypot(t.x - cx, t.y - cy) < 120)) continue;
    if (comets.some((c) => c.on && Math.hypot(c.x - cx, c.y - cy) < 90)) continue;
    return [cx, cy];
  }
  return [s.rand(70, W - 70), s.rand(70, H - 70)];
}
function placeStar(t) {
  const spot = freeSpot(220);
  t.x = spot[0];
  t.y = spot[1];
  t.on = true;
}
function addComet() {
  const c = comets.find((k) => !k.on);
  if (!c) return;
  const spot = freeSpot(360), a = s.rand(0, Math.PI * 2), v = s.rand(120, 210);
  c.x = spot[0];
  c.y = spot[1];
  c.vx = Math.cos(a) * v;
  c.vy = Math.sin(a) * v;
  c.on = true;
}
function reset() {
  x = W / 2;
  y = H / 2 + 120;
  vx = vy = 0;
  got = 0;
  lives = lifeMax;
  left = limit;
  safe = 0;
  aim = null;
  past.length = 0;
  for (const c of comets) c.on = false;
  for (const t of stars) t.on = false;
  for (let i = 0; i < Math.min(3, goal); i++) placeStar(stars[i]);
  for (let i = 0; i < Math.round(p.comets); i++) addComet();
  sync();
}
function sync() {
  hud('stars', got + '/' + goal);
  hud('lives', lives);
  hud('time', limit > 0 ? Math.ceil(left) : '∞');
}
function step(dt) {
  clock += dt;
  let ax = s.input.axis(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']);
  let ay = s.input.axis(['ArrowUp', 'KeyW'], ['ArrowDown', 'KeyS']);
  if (s.pointer.down && aim) {
    aim[0] = s.pointer.x;
    aim[1] = s.pointer.y - FY;
  } else if (!calm) aim = null;
  if (aim && !ax && !ay) {
    const dx = aim[0] - x, dy = aim[1] - y, d = Math.hypot(dx, dy);
    if (d > 8) {
      ax = dx / d;
      ay = dy / d;
    }
  }
  const n = Math.max(1, Math.hypot(ax, ay)), top = 430 * p.steer;
  vx += ((ax / n) * top - vx) * Math.min(1, dt * 9);
  vy += ((ay / n) * top - vy) * Math.min(1, dt * 9);
  x = Math.max(24, Math.min(W - 24, x + vx * dt));
  y = Math.max(24, Math.min(H - 24, y + vy * dt));
  for (const c of comets) {
    if (!c.on) continue;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (c.x < 32 || c.x > W - 32) { c.vx = -c.vx; c.x = Math.max(32, Math.min(W - 32, c.x)); }
    if (c.y < 32 || c.y > H - 32) { c.vy = -c.vy; c.y = Math.max(32, Math.min(H - 32, c.y)); }
    if (safe <= 0 && Math.hypot(c.x - x, c.y - y) < 44) {
      lives -= 1;
      safe = 1.6;
      c.vx = -c.vx;
      c.vy = -c.vy;
      burst(x, y, danger, 26);
      sfx('hit');
      sync();
      if (lives <= 0) return end(false);
    }
  }
  if (safe > 0) safe -= dt;
  for (const t of stars) {
    if (!t.on || Math.hypot(t.x - x, t.y - y) > 46) continue;
    got += 1;
    t.on = false;
    burst(t.x, t.y, gold, 20);
    sfx('coin');
    sync();
    if (got >= goal) return end(true);
    if (stars.filter((k) => k.on).length + got < goal) placeStar(t);
    if (got % 3 === 0) addComet();
  }
  if (limit > 0) {
    left = Math.max(0, left - dt);
    sync();
    if (left <= 0) return end(false);
  }
  past.unshift(x, y);
  if (past.length > 28) past.length = 28;
}
function manual(code) {
  aim = null;
  hold(code, 0.16);
}
function point(px, py) {
  aim = [px, py];
  if (calm) {
    advance(0.18);
    aim = null;
  }
}
function idle(dt) {
  for (const t of stars) t.ph += dt;
  for (const c of comets) c.g.rotation += c.spin * dt;
}
function draw() {
  orb.position.set(x, y);
  orb.alpha = safe > 0 && Math.floor(safe * 10) % 2 === 0 ? 0.35 : 1;
  for (const t of stars) {
    t.g.visible = t.on;
    t.g.position.set(t.x, t.y);
    t.g.rotation = Math.sin(t.ph * 0.8) * 0.25;
    t.g.scale.set(1 + Math.sin(t.ph * 3) * 0.08);
  }
  for (const c of comets) {
    c.g.visible = c.on;
    c.g.position.set(c.x, c.y);
  }
  trail.forEach((g, i) => {
    const at = (i + 1) * 4;
    g.visible = past.length > at + 1;
    if (g.visible) g.position.set(past[at], past[at + 1]);
  });
}
`),
  region: gameRegion({
    title: w('Star collector', 'جامع النجوم'),
    intro: w(
      'Collect the stars and dodge the comets before time runs out. Steer with the arrow keys, the buttons or your finger.',
      'اجمع النجوم وتفادَ المذنّبات قبل أن ينتهي الوقت. تحرّك بالأسهم أو بالأزرار أو بإصبعك.',
    ),
    stats: [
      { key: 'stars', label: w('Stars', 'النجوم'), value: '0/12' },
      { key: 'lives', label: w('Lives', 'المحاولات'), value: '3' },
      { key: 'time', label: w('Time', 'الوقت'), value: '60' },
    ],
    keys: ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'],
    cross: true,
  }),
});
