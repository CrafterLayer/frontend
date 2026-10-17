import { count, defineKit, range, sharedParams, soundButton, toggle } from './define';
import { gameBody } from './game-shell';
import { gameRegion } from './game-tree';

const w = (en: string, ar: string) => ({ en, ar });

/**
 * Brick breaker: classic breakout. Move the paddle with the arrows / A-D, the buttons, the mouse
 * or a finger; launch the ball (Space, a tap or the Launch button — it also launches itself after
 * a moment); the angle follows where the ball meets the paddle and the ball speeds up a little
 * with every brick. Rows, columns, lives, tough (two-hit) top rows and the paddle width are
 * params; bricks shade across the palette, mirrored on an RTL page. Reduced motion: each press
 * moves the paddle and plays a short, still-rendered step.
 */
export const BREAKOUT = defineKit({
  id: 'breakout',
  category: 'game',
  name: w('Brick breaker', 'لعبة تكسير الطوب'),
  description: w(
    'Classic breakout: bounce the ball off your paddle to clear a palette wall of bricks, some needing two hits. Keys, mouse, touch or buttons; rows, columns and lives are settings.',
    'لعبة تكسير الطوب الكلاسيكية: ارتد بالكرة عن المضرب لتهدم جداراً بألوان الموقع، وبعض الطوب يحتاج ضربتين. لوحة مفاتيح أو فأرة أو لمس أو أزرار، والصفوف والأعمدة والمحاولات إعدادات.',
  ),
  tags: ['interactive', 'game', 'playful', 'arabic'],
  libs: ['kit', 'audio'],
  params: [
    ...sharedParams({ seed: 5, interactive: false }),
    count('rows', 'Brick rows', 'صفوف الطوب', 5, 2, 8, 'look'),
    count('columns', 'Brick columns', 'أعمدة الطوب', 10, 4, 14, 'look'),
    count('lives', 'Lives', 'المحاولات', 3, 1, 9, 'interaction'),
    toggle('tough', 'Two-hit top rows', 'صفوف علوية تحتاج ضربتين', true, 'interaction'),
    range('paddle', 'Paddle width', 'عرض المضرب', 1, 0.6, 1.6, 0.05, 'interaction'),
    soundButton(),
  ],
  scene: "{ libs: ['audio'], design: { width: 1280, height: 848 }, pointer: true }",
  body: gameBody(String.raw`
const STATS = ['score', 'lives'];
const rowsN = Math.round(p.rows), colsN = Math.round(p.columns), lifeMax = Math.round(p.lives);
const back = backdrop(pal.mix(pal.surface, pal.accent, 0.12), pal.mix(pal.surface, pal.colors[4], 0.16));
for (let x = 40; x < W; x += 40) back.rect(x, 0, 1, H).fill({ color: pal.text, alpha: 0.04 });
for (let y = 40; y < H; y += 40) back.rect(0, y, W, 1).fill({ color: pal.text, alpha: 0.04 });

const gap = 8, left = 60, topY = 64, bw = (W - left * 2 - gap * (colsN - 1)) / colsN, bh = 30;
const tones = pal.ramp(colsN), bricks = [];
for (let r = 0; r < rowsN; r++) {
  for (let c = 0; c < colsN; c++) {
    const tone = pal.mix(tones[s.dir > 0 ? c : colsN - 1 - c], pal.surface, r * 0.07);
    const g = new P.Container(), crack = new P.Graphics();
    g.addChild(new P.Graphics().roundRect(0, 0, bw, bh, 8).fill(tone).roundRect(4, 3, bw - 8, 7, 4).fill({ color: 0xffffff, alpha: 0.25 }), crack);
    crack.moveTo(bw * 0.3, 0).lineTo(bw * 0.45, bh * 0.5).lineTo(bw * 0.38, bh).moveTo(bw * 0.45, bh * 0.5).lineTo(bw * 0.7, bh * 0.35).stroke({ width: 2.5, color: pal.surface, alpha: 0.7 });
    g.position.set(left + c * (bw + gap), topY + r * (bh + gap));
    field.addChild(g);
    bricks.push({ g, crack, x: g.x, y: g.y, tone, max: p.tough && r < Math.max(1, Math.floor(rowsN / 3)) ? 2 : 1, hits: 0 });
  }
}
const PY = 650, pw = 170 * p.paddle, BR = 11;
const paddle = new P.Graphics().roundRect(-pw / 2, -9, pw, 18, 9).fill(pal.accent).roundRect(-pw / 2 + 8, -6, pw - 16, 5, 3).fill({ color: 0xffffff, alpha: 0.35 });
const glow = new P.Graphics().ellipse(0, 0, pw * 0.7, 26).fill({ color: pal.accent, alpha: 0.12 });
const ghosts = [0, 1, 2].map((i) => {
  const g = new P.Graphics().circle(0, 0, BR - i * 2).fill({ color: gold, alpha: 0.22 - i * 0.06 });
  field.addChild(g);
  return g;
});
const ball = new P.Graphics().circle(0, 0, BR).fill(gold).circle(-3, -3, 3.5).fill({ color: 0xffffff, alpha: 0.7 });
field.addChild(glow, paddle, ball);

let px = W / 2, bx = 0, by = 0, vx = 0, vy = 0, stuck = true, wait = 0, speed = 0, score = 0, lives = 0, left2 = 0, trail = [], keyAt = -9, clock = 0;
function serve() {
  stuck = true;
  wait = 2.5;
  bx = px;
  by = PY - 9 - BR;
  vx = vy = 0;
  trail = [];
}
function launch() {
  if (!stuck) return;
  stuck = false;
  const a = s.rand(-0.45, 0.45);
  vx = Math.sin(a) * speed;
  vy = -Math.cos(a) * speed;
  sfx('blip');
}
function reset() {
  score = 0;
  lives = lifeMax;
  speed = 540;
  px = W / 2;
  left2 = bricks.length;
  for (const b of bricks) {
    b.hits = 0;
    b.g.visible = true;
    b.crack.visible = false;
  }
  serve();
  sync();
}
function sync() {
  hud('score', score);
  hud('lives', lives);
}
function hitBrick(b) {
  b.hits += 1;
  if (b.hits < b.max) {
    b.crack.visible = true;
    sfx('blip');
    return;
  }
  b.g.visible = false;
  left2 -= 1;
  score += b.max * 10;
  speed = Math.min(540 * 1.7, speed * 1.02);
  burst(b.x + bw / 2, b.y + bh / 2, b.tone, 12);
  sfx('hit');
  sync();
}
function step(dt) {
  clock += dt;
  const axis = s.input.axis(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']);
  if (axis) {
    px += axis * 900 * dt;
    keyAt = clock;
  } else if (clock - keyAt > 0.6 && s.pointer.inside && s.pointer.active) {
    const ty = s.pointer.y - FY;
    if (ty > 0 && ty < H) px += (s.pointer.x - px) * Math.min(1, dt * 18);
  }
  px = Math.max(pw / 2 + 8, Math.min(W - pw / 2 - 8, px));
  if (stuck) {
    bx = px;
    wait -= dt;
    if (s.input.down('Space') || s.input.down('ArrowUp') || s.input.down('KeyW') || wait <= 0) launch();
    return;
  }
  const n = Math.max(1, Math.ceil((speed * dt) / 8)), h = dt / n;
  for (let i = 0; i < n; i++) {
    bx += vx * h;
    by += vy * h;
    if (bx < BR) { bx = BR; vx = Math.abs(vx); sfx('click'); }
    if (bx > W - BR) { bx = W - BR; vx = -Math.abs(vx); sfx('click'); }
    if (by < BR) { by = BR; vy = Math.abs(vy); sfx('click'); }
    if (vy > 0 && by + BR >= PY - 9 && by + BR <= PY + 12 && Math.abs(bx - px) <= pw / 2 + BR) {
      const t = Math.max(-1, Math.min(1, (bx - px) / (pw / 2)));
      const a = t * 1.05;
      vx = Math.sin(a) * speed;
      vy = -Math.cos(a) * speed;
      by = PY - 9 - BR;
      sfx('blip');
    }
    for (const b of bricks) {
      if (!b.g.visible || bx + BR < b.x || bx - BR > b.x + bw || by + BR < b.y || by - BR > b.y + bh) continue;
      const ox = Math.min(bx + BR - b.x, b.x + bw - (bx - BR)), oy = Math.min(by + BR - b.y, b.y + bh - (by - BR));
      if (ox < oy) vx = bx < b.x + bw / 2 ? -Math.abs(vx) : Math.abs(vx);
      else vy = by < b.y + bh / 2 ? -Math.abs(vy) : Math.abs(vy);
      hitBrick(b);
      const k = speed / Math.hypot(vx, vy);
      vx *= k;
      vy *= k;
      break;
    }
    if (left2 <= 0) return end(true);
  }
  trail.unshift(bx, by);
  if (trail.length > 12) trail.length = 12;
  if (by > H + 30) {
    lives -= 1;
    burst(bx, H - 10, danger, 20);
    sfx('lose');
    sync();
    if (lives <= 0) return end(false);
    serve();
  }
}
function manual(code) {
  if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
    launch();
    advance(0.3);
  } else hold(code, 0.18);
}
function point(x) {
  if (calm) {
    px = Math.max(pw / 2 + 8, Math.min(W - pw / 2 - 8, x));
    launch();
    advance(0.3);
    return;
  }
  keyAt = -9;
  launch();
}
function idle(dt) {
  glow.alpha = 0.8 + Math.sin(clock * 3) * 0.2;
}
function draw() {
  paddle.position.set(px, PY);
  glow.position.set(px, PY + 4);
  ball.position.set(bx, by);
  ghosts.forEach((g, i) => {
    const at = (i + 1) * 4;
    g.visible = !stuck && trail.length > at + 1;
    if (g.visible) g.position.set(trail[at], trail[at + 1]);
  });
}
`),
  region: gameRegion({
    title: w('Brick breaker', 'محطّم الطوب'),
    intro: w(
      'Clear the wall: keep the ball in play with your paddle. Arrows, A/D, the mouse or your finger move it; Space, a tap or Launch sends the ball.',
      'اهدم الجدار وأبقِ الكرة في اللعب بالمضرب. حرّكه بالأسهم أو A/D أو الفأرة أو بإصبعك، وأطلق الكرة بالمسافة أو بلمسة أو بزر الإطلاق.',
    ),
    stats: [
      { key: 'score', label: w('Score', 'النقاط'), value: '0' },
      { key: 'lives', label: w('Lives', 'المحاولات'), value: '3' },
    ],
    keys: ['ArrowLeft', 'ArrowRight'],
    actions: [{ key: 'Space', label: w('Launch', 'أطلق') }],
    says: { won: w('Wall cleared!', 'هدمت الجدار!') },
  }),
});
