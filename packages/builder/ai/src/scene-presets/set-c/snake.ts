import { count, defineKit, sharedParams, soundButton, toggle } from './define';
import { gameBody } from './game-shell';
import { gameRegion } from './game-tree';

const w = (en: string, ar: string) => ({ en, ar });

/**
 * Snake: the classic on a 32 × 18 grid. Steer with the arrows / WASD, the pad, a swipe, or a tap
 * beside the head; each piece of fruit grows the snake by one. Walls end the run or wrap around
 * (a param), the fruit to win is a param (or endless), the best score is kept for the session.
 * The body glides between cells and shades along the palette. Reduced motion: turn-based — each
 * press moves the snake one cell.
 */
export const SNAKE = defineKit({
  id: 'snake',
  category: 'game',
  name: w('Snake', 'لعبة الثعبان'),
  description: w(
    'Classic snake: steer with keys, a swipe, a tap or the pad, eat fruit to grow, avoid yourself (and the walls). Fruit to win, walls or wrap, best score kept.',
    'لعبة الثعبان الكلاسيكية: وجّهه بالأسهم أو بالسحب أو باللمس أو بالأزرار، وكُل الثمار لينمو، وتجنّب جسمه (والجدران). عدد الثمار للفوز والجدران إعدادات.',
  ),
  tags: ['interactive', 'game', 'playful', 'arabic'],
  libs: ['kit', 'audio'],
  params: [
    ...sharedParams({ seed: 13, interactive: false }),
    count(
      'goal',
      'Fruit to win (0 = endless)',
      'الثمار المطلوبة للفوز (0 = بلا نهاية)',
      20,
      0,
      200,
      'interaction',
    ),
    toggle(
      'walls',
      'Walls end the run (off: wrap around)',
      'الجدران تُنهي اللعب (إيقافه: العبور للجهة الأخرى)',
      true,
      'interaction',
    ),
    soundButton(),
  ],
  scene: "{ libs: ['audio'], design: { width: 1280, height: 848 }, pointer: true }",
  body: gameBody(String.raw`
const STATS = ['score', 'best'];
const C = 40, GW = 32, GH = 18, RATE = 7, goal = Math.round(p.goal);
const back = backdrop(pal.mix(pal.surface, pal.colors[4], 0.14), pal.mix(pal.surface, pal.accent, 0.1));
for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if ((x + y) % 2 === 0) back.rect(x * C, y * C, C, C).fill({ color: pal.text, alpha: 0.035 });
const ramp = [];
for (let i = 0; i < 24; i++) ramp.push(pal.mix(pal.accent, pal.colors[4], i / 23));
const fruit = new P.Container();
fruit.addChild(new P.Graphics().circle(0, 3, 15).fill(danger).circle(-5, -2, 4).fill({ color: 0xffffff, alpha: 0.45 }), new P.Graphics().ellipse(6, -14, 8, 4).fill(leaf).rect(-1, -16, 3, 8).fill(pal.mix(leaf, pal.surface, 0.4)));
const bodyG = new P.Graphics(), headG = new P.Graphics();
field.addChild(fruit, bodyG, headG);

let snake = [], prev = [], dir = [1, 0], queue = [], food = [0, 0], acc = 0, score = 0, best = 0, clock = 0, grow = 0;
function freeCell() {
  for (let tries = 0; tries < 400; tries++) {
    const c = [s.int(1, GW - 2), s.int(1, GH - 2)];
    if (!snake.some((b) => b[0] === c[0] && b[1] === c[1])) return c;
  }
  return [0, 0];
}
function reset() {
  const d = s.dir > 0 ? 1 : -1, cx = Math.floor(GW / 2), cy = Math.floor(GH / 2);
  snake = [0, 1, 2, 3].map((i) => [cx - i * d, cy]);
  prev = snake.map((b) => b.slice());
  dir = [d, 0];
  queue = [];
  acc = 0;
  score = 0;
  grow = 0;
  food = freeCell();
  sync();
}
function sync() {
  hud('score', goal > 0 ? score + '/' + goal : score);
  hud('best', best);
}
function turn(dx, dy) {
  const last = queue.length ? queue[queue.length - 1] : dir;
  if ((dx === -last[0] && dy === -last[1]) || (dx === last[0] && dy === last[1]) || queue.length > 2) return;
  queue.push([dx, dy]);
}
function turnFor(code) {
  if (code === 'ArrowLeft' || code === 'KeyA') turn(-1, 0);
  else if (code === 'ArrowRight' || code === 'KeyD') turn(1, 0);
  else if (code === 'ArrowUp' || code === 'KeyW') turn(0, -1);
  else if (code === 'ArrowDown' || code === 'KeyS') turn(0, 1);
}
function move() {
  if (queue.length) dir = queue.shift();
  prev = snake.map((b) => b.slice());
  let hx = snake[0][0] + dir[0], hy = snake[0][1] + dir[1];
  if (hx < 0 || hy < 0 || hx >= GW || hy >= GH) {
    if (p.walls) return die();
    hx = (hx + GW) % GW;
    hy = (hy + GH) % GH;
  }
  const tail = grow > 0 ? snake.length : snake.length - 1;
  for (let i = 0; i < tail; i++) if (snake[i][0] === hx && snake[i][1] === hy) return die();
  // Each segment glides from where it was (prev[i]) to the cell ahead of it.
  snake.unshift([hx, hy]);
  if (grow > 0) {
    grow -= 1;
    prev.push(prev[prev.length - 1].slice());
  } else snake.pop();
  if (hx === food[0] && hy === food[1]) {
    score += 1;
    grow += 1;
    if (score > best) best = score;
    burst(hx * C + C / 2, hy * C + C / 2, danger, 16);
    sfx('coin');
    sync();
    if (goal > 0 && score >= goal) return end(true);
    food = freeCell();
  }
}
function die() {
  burst(snake[0][0] * C + C / 2, snake[0][1] * C + C / 2, pal.accent, 24);
  sfx('hit');
  sync();
  end(false);
}
const was = {};
function step(dt) {
  clock += dt;
  for (const code of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']) {
    const now = s.input.down(code);
    if (now && !was[code]) turnFor(code);
    was[code] = now;
  }
  acc += dt * RATE;
  while (acc >= 1 && mode === 'running') {
    acc -= 1;
    move();
  }
}
function manual(code) {
  turnFor(code);
  acc = 0;
  move();
}
let swipe = null;
function point(px, py) {
  swipe = [px, py];
  if (calm) {
    tapTurn(px, py);
    manual('');
  }
}
function tapTurn(px, py) {
  const hx = snake[0][0] * C + C / 2, hy = snake[0][1] * C + C / 2;
  if (dir[0] !== 0) turn(0, py < hy ? -1 : 1);
  else turn(px < hx ? -1 : 1, 0);
}
s.pointer.onUp((ptr) => {
  if (!swipe || mode !== 'running' || calm) return;
  const dx = ptr.x - swipe[0], dy = ptr.y - FY - swipe[1];
  if (Math.max(Math.abs(dx), Math.abs(dy)) > 36) {
    if (Math.abs(dx) > Math.abs(dy)) turn(dx > 0 ? 1 : -1, 0);
    else turn(0, dy > 0 ? 1 : -1);
  } else tapTurn(swipe[0], swipe[1]);
  swipe = null;
});
function idle(dt) {
  if (mode !== 'running') clock += dt;
}
function draw() {
  const t = live && mode === 'running' ? Math.min(1, acc) : 1;
  bodyG.clear();
  const n = snake.length, r = C * 0.42;
  const at = (i) => {
    const a = prev[i] || snake[i], b = snake[i];
    const jump = Math.abs(a[0] - b[0]) > 1 || Math.abs(a[1] - b[1]) > 1;
    const k = jump ? 1 : t;
    return [(a[0] + (b[0] - a[0]) * k) * C + C / 2, (a[1] + (b[1] - a[1]) * k) * C + C / 2];
  };
  for (let i = n - 1; i >= 0; i--) {
    const pt = at(i), color = ramp[Math.min(ramp.length - 1, Math.floor((i / Math.max(1, n - 1)) * (ramp.length - 1)))];
    bodyG.circle(pt[0], pt[1], r * (1 - (i / n) * 0.25)).fill(color);
    if (i > 0) {
      const q2 = at(i - 1);
      if (Math.abs(q2[0] - pt[0]) <= C && Math.abs(q2[1] - pt[1]) <= C) bodyG.moveTo(pt[0], pt[1]).lineTo(q2[0], q2[1]).stroke({ width: r * 1.7 * (1 - (i / n) * 0.25), color, cap: 'round' });
    }
  }
  const h = at(0), ex = -dir[1] * 9, ey = dir[0] * 9;
  headG.clear().circle(h[0] + dir[0] * 7 + ex, h[1] + dir[1] * 7 + ey, 6).circle(h[0] + dir[0] * 7 - ex, h[1] + dir[1] * 7 - ey, 6).fill(0xffffff).circle(h[0] + dir[0] * 9 + ex, h[1] + dir[1] * 9 + ey, 3).circle(h[0] + dir[0] * 9 - ex, h[1] + dir[1] * 9 - ey, 3).fill(pal.surface);
  fruit.position.set(food[0] * C + C / 2, food[1] * C + C / 2);
  fruit.scale.set(live ? 1 + Math.sin(clock * 5) * 0.07 : 1);
}
`),
  region: gameRegion({
    title: w('Snake', 'الثعبان'),
    intro: w(
      'Eat the fruit to grow, and never bite your own tail. Steer with the arrow keys, a swipe, a tap beside the head or the buttons.',
      'كُل الثمار لتطول، ولا تعضّ ذيلك أبداً. وجّه الثعبان بالأسهم أو بالسحب أو بلمسة بجانب رأسه أو بالأزرار.',
    ),
    stats: [
      { key: 'score', label: w('Fruit', 'الثمار'), value: '0/20' },
      { key: 'best', label: w('Best', 'الأفضل'), value: '0' },
    ],
    keys: ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'],
    cross: true,
    says: { won: w('What a long snake!', 'يا له من ثعبان طويل!') },
  }),
});
