import { count, defineKit, range, select, sharedParams, soundButton } from './define';
import { gameBody } from './game-shell';
import { gameRegion } from './game-tree';

const w = (en: string, ar: string) => ({ en, ar });

/**
 * Coin quest: a side-scrolling platformer. Run and jump across a tile level three screens wide —
 * pits, one-way planks, spikes, patrolling slimes you can stomp, a checkpoint flag — collecting
 * coins on the way to the goal flag. Tight controls: acceleration, coyote time, a jump buffer and
 * a variable jump height. Two levels (meadow, peaks) are a param; the level runs right to left on
 * an RTL page. Reduced motion: each press walks a step or makes one whole jump forward.
 */
export const PLATFORMER = defineKit({
  id: 'platformer',
  category: 'game',
  name: w('Coin quest platformer', 'لعبة منصات: رحلة العملات'),
  description: w(
    'A side-scrolling platformer: run and jump over pits, spikes and slimes, collect coins, touch the checkpoint and reach the flag. Two levels; keyboard, touch buttons, mirrored for RTL.',
    'لعبة منصات جانبية: اركض واقفز فوق الحفر والأشواك والكائنات، واجمع العملات وصولاً إلى الراية. مستويان، ولوحة مفاتيح وأزرار لمس، ومعكوسة للعربية.',
  ),
  tags: ['interactive', 'game', 'playful', 'arabic'],
  libs: ['kit', 'audio'],
  params: [
    ...sharedParams({ seed: 3, interactive: false }),
    select(
      'level',
      'Level',
      'المستوى',
      'meadow',
      [
        ['meadow', 'Meadow (gentle)', 'المرج (سهل)'],
        ['peaks', 'Peaks (harder)', 'القمم (أصعب)'],
      ],
      'interaction',
    ),
    count('lives', 'Lives', 'المحاولات', 3, 1, 9, 'interaction'),
    range('jump', 'Jump height', 'ارتفاع القفزة', 1, 0.8, 1.3, 0.05, 'motion'),
    soundButton(),
  ],
  scene: "{ libs: ['audio'], design: { width: 1280, height: 848 }, pointer: true }",
  body: gameBody(String.raw`
const STATS = ['coins', 'lives'];
const TS = 48;
// One tile per character: # ground, = plank (land from above), ^ spikes, c coin, e slime,
// p start, k checkpoint, g goal flag. Three screens wide, fifteen tiles tall.
const LEVELS = {
  meadow: [
    '............................................................',
    '............................................................',
    '............................................................',
    '............................................................',
    '............................................................',
    '............................................................',
    '............................................................',
    '............................................................',
    '............................................................',
    '................cccc.....c.........ccc..cc..ccc.............',
    '.....ccc....cc..====....................==.=====......cc....',
    '.........................=.....cc.#####.....................',
    '..p...............^..e##.....k..e.#####.....^^^....e.....g..',
    '############..##########...############...##################',
    '############..##########...############...##################',
  ],
  peaks: [
    '............................................................',
    '............................................................',
    '............................................................',
    '............................................................',
    '............................................................',
    '............................................................',
    '............................................................',
    '............................................................',
    '.....................c...............ccc.....c..............',
    '.........cc.......cc===......c.......===..c.===.............',
    '....cc...==.............c...===..........###........ccc.....',
    '.................###.....................###................',
    '..p....^......e..###.....^.e...#.k..e.^^.###......e..^.e..g.',
    '#########...########...#####...#############...#############',
    '#########...########...#####...#############...#############',
  ],
};
const legend = { '#': { solid: true }, '=': { solid: true, plank: true }, '^': { kind: 'spike' }, c: { kind: 'coin' }, e: { kind: 'enemy' }, p: { kind: 'player' }, k: { kind: 'checkpoint' }, g: { kind: 'goal' } };
const rows = LEVELS[p.level] || LEVELS.meadow;
const COLS = rows[0].length, ROWS = rows.length, LW = COLS * TS;
const lifeMax = Math.round(p.lives), jumpV = 900 * Math.sqrt(p.jump);

const grid = [], coins = [], foes = [], spikes = [];
let spawn = [TS * 2.5, TS * 13], goal = [LW - TS * 2.5, TS * 13], check = null;
for (let r = 0; r < ROWS; r++) {
  const cells = [];
  for (let c = 0; c < COLS; c++) {
    const ch = rows[r].charAt(c), info = legend[ch] || {};
    cells.push(info.solid ? (info.plank ? '=' : '#') : '.');
    const x = c * TS + TS / 2, foot = (r + 1) * TS;
    if (info.kind === 'player') spawn = [x, foot];
    else if (info.kind === 'coin') coins.push({ x, y: r * TS + TS / 2, on: true, g: null });
    else if (info.kind === 'enemy') foes.push({ x0: x, y: foot, x, vx: -70, alive: true, g: null, ph: s.rand(0, 6) });
    else if (info.kind === 'checkpoint') check = { x, y: foot, on: false };
    else if (info.kind === 'goal') goal = [x, foot];
    else if (info.kind === 'spike') spikes.push([c, r]);
  }
  grid.push(cells);
}
function at(c, r) {
  if (c < 0 || c >= COLS) return '#';
  if (r < 0 || r >= ROWS) return '.';
  return grid[r][c];
}

// The sky, two hill ridges that scroll slower than the level, and the level itself.
const soil = pal.mix(pal.surface, pal.text, 0.2), wood = pal.mix(gold, pal.surface, 0.4);
backdrop(pal.mix(pal.surface, pal.accent, 0.3), pal.mix(pal.surface, pal.colors[1], 0.42));
function ridge(color, base, amp, k, seedY) {
  const c = new P.Container(), g = new P.Graphics(), len = W + LW * k + 80, pts = [0, H];
  for (let x = 0; x <= len; x += 40) pts.push(x, base + s.noise2(x * 0.0021, seedY) * amp + s.noise2(x * 0.009, seedY + 3) * amp * 0.25);
  pts.push(len, H);
  g.poly(pts).fill(color);
  c.addChild(g);
  c.k = k;
  field.addChild(c);
  return c;
}
const clouds = new P.Container();
clouds.k = 0.08;
for (let i = 0; i < s.count(9); i++) {
  const g = new P.Graphics(), cx = s.rand(0, W + LW * 0.08), cy = s.rand(60, 260), r = s.rand(26, 48);
  g.circle(cx, cy, r).circle(cx + r * 0.9, cy + 6, r * 0.75).circle(cx - r * 0.9, cy + 8, r * 0.65).fill({ color: 0xffffff, alpha: 0.22 });
  clouds.addChild(g);
}
field.addChild(clouds);
const layers = [clouds, ridge(pal.mix(pal.surface, pal.accent, 0.42), 430, 90, 0.18, 1), ridge(pal.mix(pal.surface, pal.colors[4], 0.5), 520, 70, 0.4, 5)];

const lvl = new P.Container();
field.addChild(lvl);
const tiles = new P.Graphics();
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const t = grid[r][c], x = c * TS, y = r * TS;
    if (t === '#') {
      tiles.rect(x, y, TS, TS).fill(soil);
      tiles.rect(x + s.rand(6, 30), y + s.rand(16, 36), 6, 4).fill({ color: pal.text, alpha: 0.08 });
      if (at(c, r - 1) !== '#') tiles.roundRect(x - 1, y - 2, TS + 2, 14, 5).fill(leaf).rect(x + 8, y + 10, 4, 6).fill(leaf).rect(x + 30, y + 10, 4, 5).fill(leaf);
    } else if (t === '=') {
      tiles.roundRect(x + 2, y, TS - 4, 16, 6).fill(wood).rect(x + 6, y + 6, TS - 12, 2).fill({ color: pal.surface, alpha: 0.35 });
    }
  }
}
for (const sp of spikes) {
  const x = sp[0] * TS, y = (sp[1] + 1) * TS;
  for (let i = 0; i < 3; i++) tiles.poly([x + 4 + i * 14, y, x + 11 + i * 14, y - 26, x + 18 + i * 14, y]).fill(danger);
}
lvl.addChild(tiles);
const pole = new P.Graphics().rect(goal[0] - 3, goal[1] - 168, 6, 168).fill(pal.text).circle(goal[0], goal[1] - 172, 7).fill(gold);
const flag = new P.Graphics().poly([0, 0, 74, 18, 0, 40]).fill(gold);
flag.position.set(goal[0] + 3, goal[1] - 164);
lvl.addChild(pole, flag);
const mark = new P.Graphics();
if (check) mark.rect(check.x - 2, check.y - 96, 4, 96).fill(pal.muted);
const pennant = new P.Graphics().poly([0, 0, 40, 12, 0, 24]).fill(0xffffff);
if (check) pennant.position.set(check.x + 2, check.y - 94);
pennant.visible = !!check;
lvl.addChild(mark, pennant);
const coinShape = new P.GraphicsContext().circle(0, 0, 14).fill(gold).circle(0, 0, 8.5).stroke({ width: 3, color: pal.mix(gold, 0xffffff, 0.45) });
const slimeShape = new P.GraphicsContext().roundRect(-21, -30, 42, 30, 14).fill(pal.mix(danger, pal.colors[4], 0.3)).circle(-8, -18, 5.5).fill(0xffffff).circle(8, -18, 5.5).fill(0xffffff).circle(-7, -17, 2.6).fill(pal.surface).circle(9, -17, 2.6).fill(pal.surface);
s.dispose(() => { coinShape.destroy(); slimeShape.destroy(); });
for (const k of coins) { k.g = new P.Graphics(coinShape); k.g.position.set(k.x, k.y); lvl.addChild(k.g); }
for (const f of foes) { f.g = new P.Graphics(slimeShape); lvl.addChild(f.g); }
const hero = new P.Container();
const heroBody = new P.Graphics().roundRect(-17, -46, 34, 46, 13).fill(pal.accent).roundRect(-11, -24, 22, 16, 7).fill({ color: 0xffffff, alpha: 0.22 });
const eyes = new P.Graphics().circle(-1, -34, 6).fill(0xffffff).circle(11, -34, 6).fill(0xffffff).circle(2, -33, 3).fill(pal.surface).circle(14, -33, 3).fill(pal.surface);
hero.addChild(heroBody, eyes);
lvl.addChild(hero);

const box = { x: 0, y: 0, w: 34, h: 46 };
let vx = 0, vy = 0, ground = false, coyote = 0, buffer = 0, jumpWas = false, facing = 1, squash = 0;
let lives = 0, got = 0, safe = 0, cam = 0, back = spawn, clock = 0;
function approach(v, to, amount) {
  return v < to ? Math.min(to, v + amount) : Math.max(to, v - amount);
}
function moveX(dx) {
  box.x += dx;
  const top = Math.floor(box.y / TS), bot = Math.floor((box.y + box.h - 1) / TS);
  if (dx > 0) {
    const c = Math.floor((box.x + box.w) / TS);
    for (let r = top; r <= bot; r++) if (at(c, r) === '#') { box.x = c * TS - box.w; return true; }
  } else if (dx < 0) {
    const c = Math.floor(box.x / TS);
    for (let r = top; r <= bot; r++) if (at(c, r) === '#') { box.x = (c + 1) * TS; return true; }
  }
  return false;
}
function moveY(dy) {
  const before = box.y + box.h;
  box.y += dy;
  const l = Math.floor(box.x / TS), rt = Math.floor((box.x + box.w - 1) / TS);
  if (dy > 0) {
    const r = Math.floor((box.y + box.h) / TS);
    for (let c = l; c <= rt; c++) {
      const t = at(c, r);
      if (t === '#' || (t === '=' && before <= r * TS + 1)) { box.y = r * TS - box.h; return 1; }
    }
  } else if (dy < 0) {
    const r = Math.floor(box.y / TS);
    for (let c = l; c <= rt; c++) if (at(c, r) === '#') { box.y = (r + 1) * TS; return -1; }
  }
  return 0;
}
function place(spot) {
  box.x = spot[0] - box.w / 2;
  box.y = spot[1] - box.h;
  vx = vy = 0;
  ground = false;
}
function follow(dt) {
  const target = Math.max(0, Math.min(LW - W, box.x + box.w / 2 - W * 0.42));
  cam = dt <= 0 ? target : cam + (target - cam) * Math.min(1, dt * 6);
}
function reset() {
  lives = lifeMax;
  got = 0;
  safe = 0;
  back = spawn;
  if (check) check.on = false;
  for (const k of coins) k.on = true;
  for (const f of foes) { f.x = f.x0; f.vx = -70; f.alive = true; }
  place(spawn);
  follow(0);
  sync();
}
function sync() {
  hud('coins', got + '/' + coins.length);
  hud('lives', lives);
}
function hurt() {
  if (safe > 0 || mode !== 'running') return;
  lives -= 1;
  burst(box.x + box.w / 2, box.y + box.h / 2, danger, 24);
  sfx('hit');
  sync();
  if (lives <= 0) return end(false);
  safe = 1.6;
  place(back);
}
function step(dt) {
  clock += dt;
  const dirIn = s.input.axis(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']) * s.dir;
  const jumpHeld = s.input.down('Space') || s.input.down('ArrowUp') || s.input.down('KeyW');
  if (jumpHeld && !jumpWas) buffer = 0.13;
  jumpWas = jumpHeld;
  if (dirIn) {
    vx = approach(vx, dirIn * 330, (ground ? 2400 : 1500) * dt);
    facing = dirIn;
  } else vx = approach(vx, 0, (ground ? 2600 : 500) * dt);
  coyote = ground ? 0.1 : coyote - dt;
  buffer -= dt;
  if (buffer > 0 && coyote > 0) {
    vy = -jumpV;
    buffer = coyote = 0;
    ground = false;
    squash = -0.22;
    sfx('jump');
  }
  if (!jumpHeld && vy < -380) vy = -380;
  vy = Math.min(1100, vy + 2300 * dt);
  if (moveX(vx * dt)) vx = 0;
  const hit = moveY(vy * dt);
  if (hit === 1) {
    if (!ground && vy > 520) squash = 0.2;
    ground = true;
    vy = 0;
  } else {
    ground = false;
    if (hit === -1) vy = 0;
  }
  if (safe > 0) safe -= dt;
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  for (const k of coins) {
    if (!k.on || Math.abs(k.x - cx) > 30 || Math.abs(k.y - cy) > 36) continue;
    k.on = false;
    got += 1;
    burst(k.x, k.y, gold, 14);
    sfx('coin');
    sync();
  }
  for (const sp of spikes) {
    const x = sp[0] * TS + 6, y = sp[1] * TS + TS * 0.5;
    if (box.x < x + TS - 12 && box.x + box.w > x && box.y + box.h > y && box.y < y + TS * 0.5) hurt();
  }
  if (mode !== 'running') return;
  for (const f of foes) {
    if (!f.alive) continue;
    const ahead = Math.floor((f.x + Math.sign(f.vx) * 24) / TS), row = Math.floor((f.y - 8) / TS);
    if (at(ahead, row) === '#' || at(ahead, row + 1) === '.') f.vx = -f.vx;
    f.x += f.vx * dt;
    if (Math.abs(f.x - cx) < 36 && box.y + box.h > f.y - 30 && box.y < f.y) {
      if (vy > 60 && box.y + box.h < f.y - 12) {
        f.alive = false;
        vy = -640;
        burst(f.x, f.y - 15, pal.colors[4], 18);
        sfx('powerup');
      } else hurt();
      if (mode !== 'running') return;
    }
  }
  if (box.y > ROWS * TS + 80) {
    safe = 0;
    hurt();
    if (mode !== 'running') return;
  }
  if (check && !check.on && Math.abs(cx - check.x) < 30 && box.y + box.h > check.y - 100) {
    check.on = true;
    back = [check.x, check.y];
    sfx('powerup');
    tell(say('checkpoint'));
  }
  if (Math.abs(cx - goal[0]) < 34 && box.y + box.h > goal[1] - 170) return end(true);
  follow(dt);
}
function manual(code) {
  if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
    const side = facing * s.dir > 0 ? 'ArrowRight' : 'ArrowLeft';
    s.input.set(side, true);
    hold(code, 0.3);
    for (let t = 0; t < 1.4 && !ground && mode === 'running'; t += 0.05) advance(0.05);
    s.input.set(side, false);
  } else hold(code, 0.22);
}
function point() {}
function idle(dt) {
  clock += mode === 'running' ? 0 : dt;
  squash *= Math.max(0, 1 - dt * 10);
  for (const f of foes) f.ph += dt * 6;
}
function draw() {
  for (const layer of [lvl, ...layers]) {
    const k = layer === lvl ? 1 : layer.k;
    layer.scale.x = s.dir;
    layer.x = s.dir > 0 ? -cam * k : W + cam * k;
  }
  hero.position.set(box.x + box.w / 2, box.y + box.h);
  hero.scale.set(facing * (1 + squash * 0.6), 1 - squash);
  hero.alpha = safe > 0 && Math.floor(safe * 10) % 2 === 0 ? 0.35 : 1;
  for (const k of coins) {
    k.g.visible = k.on;
    k.g.scale.x = Math.cos(clock * 4 + k.x * 0.01);
  }
  for (const f of foes) {
    f.g.visible = f.alive;
    f.g.position.set(f.x, f.y);
    f.g.scale.set(f.vx > 0 ? -1 : 1, 1 + Math.sin(f.ph) * 0.06);
  }
  flag.skew.y = Math.sin(clock * 3) * 0.08;
  pennant.tint = check && check.on ? leaf : pal.muted;
}
`),
  region: gameRegion({
    title: w('Coin quest', 'رحلة العملات'),
    intro: w(
      'Run and jump to the flag, collecting coins. Jump on slimes, dodge the spikes and pits. Arrows or A/D to run; Up, W or Space to jump.',
      'اركض واقفز حتى الراية واجمع العملات. اقفز فوق الكائنات وتفادَ الأشواك والحفر. الأسهم أو A/D للركض، والسهم الأعلى أو W أو المسافة للقفز.',
    ),
    stats: [
      { key: 'coins', label: w('Coins', 'العملات'), value: '0/22' },
      { key: 'lives', label: w('Lives', 'المحاولات'), value: '3' },
    ],
    keys: ['ArrowLeft', 'ArrowRight'],
    actions: [{ key: 'Space', label: w('Jump', 'اقفز') }],
    says: {
      won: w('You reached the flag!', 'وصلت إلى الراية!'),
      checkpoint: w('Checkpoint reached.', 'وصلت إلى نقطة الحفظ.'),
    },
  }),
});
