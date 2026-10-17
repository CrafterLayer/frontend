import { count, defineKit, select, sharedParams, soundButton, toggle } from './define';
import { gameBody } from './game-shell';
import { gameRegion } from './game-tree';

const w = (en: string, ar: string) => ({ en, ar });

/**
 * Memory match: turn two cards at a time and find every pair. Tap or click a card, or move the
 * highlight with the arrows and turn it with Space or the Turn button. Ten drawn symbols (no
 * images fetched) in palette colours; cards flip, matches glow and spark. The number of pairs,
 * an optional time limit and a first peek are params. Fully playable under reduced motion: cards
 * turn instantly, and a pair that does not match turns back on the next move.
 */
export const MEMORY = defineKit({
  id: 'memory',
  category: 'game',
  name: w('Memory match', 'لعبة الذاكرة'),
  description: w(
    'A memory card game: turn two cards at a time and find every pair of drawn symbols. Tap, click or keyboard; pairs, a time limit and a first peek are settings.',
    'لعبة بطاقات الذاكرة: اقلب بطاقتين في كل مرة واعثر على كل زوج من الرموز. باللمس أو الفأرة أو لوحة المفاتيح، وعدد الأزواج والوقت ونظرة البداية إعدادات.',
  ),
  tags: ['interactive', 'game', 'playful', 'arabic'],
  libs: ['kit', 'audio'],
  params: [
    ...sharedParams({ seed: 21, interactive: false }),
    select(
      'pairs',
      'Pairs',
      'الأزواج',
      '8',
      [
        ['6', '6 pairs (12 cards)', '6 أزواج (12 بطاقة)'],
        ['8', '8 pairs (16 cards)', '8 أزواج (16 بطاقة)'],
        ['10', '10 pairs (20 cards)', '10 أزواج (20 بطاقة)'],
      ],
      'interaction',
    ),
    count(
      'time',
      'Time limit (seconds, 0 = none)',
      'الوقت (بالثواني، 0 = بلا حد)',
      0,
      0,
      300,
      'interaction',
    ),
    toggle(
      'peek',
      'Show all cards for a moment first',
      'عرض كل البطاقات لحظة في البداية',
      false,
      'interaction',
    ),
    soundButton(),
  ],
  scene: "{ libs: ['audio'], design: { width: 1280, height: 848 }, pointer: true }",
  body: gameBody(String.raw`
const STATS = ['pairs', 'moves', 'time'];
const pairs = Number(p.pairs) || 8, limit = Math.round(p.time);
const cols = pairs === 10 ? 5 : 4, rowsN = Math.ceil((pairs * 2) / cols);
const back = backdrop(pal.mix(pal.surface, pal.accent, 0.1), pal.mix(pal.surface, pal.colors[4], 0.18));
for (const pt of s.poisson(W, H, 64, s.count(90))) back.circle(pt[0], pt[1], 3).fill({ color: pal.accent, alpha: 0.08 });

const gapX = 18, gapY = 16, ch = Math.min(150, (H - 70 - gapY * (rowsN - 1)) / rowsN), cw = ch * 0.76;
const ox = (W - cols * cw - gapX * (cols - 1)) / 2, oy = (H - rowsN * ch - gapY * (rowsN - 1)) / 2;
const hues = [pal.accent, gold, danger, leaf, pal.colors[4], pal.mix(pal.accent, gold, 0.5), pal.mix(danger, gold, 0.45), pal.mix(leaf, pal.accent, 0.5), pal.mix(pal.colors[4], danger, 0.5), pal.mix(pal.text, pal.accent, 0.35)];
// Ten symbols drawn around 0,0 at radius r.
function symbol(g, id, r, color) {
  if (id === 0) g.circle(0, 0, r).fill(color).circle(0, 0, r * 0.45).fill({ color: 0xffffff, alpha: 0.35 });
  else if (id === 1) g.poly([0, -r, r * 0.95, r * 0.75, -r * 0.95, r * 0.75]).fill(color);
  else if (id === 2) g.roundRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6, r * 0.25).fill(color);
  else if (id === 3) g.star(0, 0, 5, r, r * 0.45).fill(color);
  else if (id === 4) g.circle(-r * 0.45, -r * 0.25, r * 0.5).circle(r * 0.45, -r * 0.25, r * 0.5).fill(color).poly([-r * 0.92, -r * 0.05, r * 0.92, -r * 0.05, 0, r * 0.95]).fill(color);
  else if (id === 5) g.circle(0, 0, r).fill(color).circle(r * 0.45, -r * 0.3, r * 0.82).cut();
  else if (id === 6) {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4, c = Math.cos(a), sn = Math.sin(a);
      g.poly([c * r * 0.62 - sn * r * 0.14, sn * r * 0.62 + c * r * 0.14, c * r * 1.05, sn * r * 1.05, c * r * 0.62 + sn * r * 0.14, sn * r * 0.62 - c * r * 0.14]).fill(color);
    }
    g.circle(0, 0, r * 0.55).fill(color);
  } else if (id === 7) {
    for (let k = 0; k < 6; k++) g.circle(Math.cos((k * Math.PI) / 3) * r * 0.55, Math.sin((k * Math.PI) / 3) * r * 0.55, r * 0.42).fill(color);
    g.circle(0, 0, r * 0.32).fill(0xffffff);
  } else if (id === 8) g.poly([r * 0.2, -r, -r * 0.6, r * 0.1, -r * 0.05, r * 0.1, -r * 0.25, r, r * 0.6, -r * 0.15, r * 0.05, -r * 0.15]).fill(color);
  else g.circle(0, r * 0.25, r * 0.65).fill(color).poly([-r * 0.6, r * 0.05, 0, -r, r * 0.6, r * 0.05]).fill(color);
  return g;
}
const cardFace = pal.mix(pal.surface, 0xffffff, 0.86), cardBack = pal.mix(pal.accent, pal.surface, 0.25);
const cards = [];
for (let i = 0; i < pairs * 2; i++) {
  const c = new P.Container(), backSide = new P.Graphics(), faceSide = new P.Graphics(), glowSide = new P.Graphics();
  backSide.roundRect(-cw / 2, -ch / 2, cw, ch, 14).fill(cardBack).roundRect(-cw / 2 + 7, -ch / 2 + 7, cw - 14, ch - 14, 10).stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
  for (let k = -2; k <= 2; k++) backSide.circle(0, k * ch * 0.16, cw * 0.06).fill({ color: 0xffffff, alpha: 0.25 });
  faceSide.roundRect(-cw / 2, -ch / 2, cw, ch, 14).fill(cardFace).stroke({ width: 2, color: pal.mix(cardFace, pal.text, 0.15) });
  glowSide.roundRect(-cw / 2 - 5, -ch / 2 - 5, cw + 10, ch + 10, 18).stroke({ width: 4, color: gold });
  c.addChild(glowSide, backSide, faceSide);
  c.position.set(ox + (i % cols) * (cw + gapX) + cw / 2, oy + Math.floor(i / cols) * (ch + gapY) + ch / 2);
  field.addChild(c);
  cards.push({ c, backSide, faceSide, glowSide, id: 0, up: false, done: false, t: 0 });
}
const cursorBox = new P.Graphics().roundRect(-cw / 2 - 8, -ch / 2 - 8, cw + 16, ch + 16, 20).stroke({ width: 4, color: pal.text });
field.addChild(cursorBox);

let first = null, second = null, shut = 0, moves = 0, found = 0, clock = 0, left = 0, peek = 0, cursor = 0, keys = false;
const was = {};
function pressed(code) {
  const now = s.input.down(code), edge = now && !was[code];
  was[code] = now;
  return edge;
}
function reset() {
  const ids = [];
  for (let k = 0; k < pairs; k++) ids.push(k, k);
  const deck = s.shuffle(ids);
  cards.forEach((card, i) => {
    card.id = deck[i];
    card.up = card.done = false;
    card.t = 0;
    card.faceSide.clear().roundRect(-cw / 2, -ch / 2, cw, ch, 14).fill(cardFace).stroke({ width: 2, color: pal.mix(cardFace, pal.text, 0.15) });
    symbol(card.faceSide, card.id, Math.min(cw, ch) * 0.3, hues[card.id % hues.length]);
  });
  first = second = null;
  shut = moves = found = clock = 0;
  left = limit;
  peek = p.peek && live ? 1.6 : 0;
  cursor = 0;
  sync();
}
function sync() {
  hud('pairs', found + '/' + pairs);
  hud('moves', moves);
  hud('time', limit > 0 ? Math.ceil(left) : Math.floor(clock));
}
function closePair() {
  if (first) first.up = false;
  if (second) second.up = false;
  first = second = null;
  shut = 0;
}
function turn(i) {
  const card = cards[i];
  if (!card || card.done || card.up || peek > 0) return;
  if (second) closePair();
  card.up = true;
  sfx('blip');
  if (!first) {
    first = card;
    return;
  }
  second = card;
  moves += 1;
  if (first.id === second.id) {
    first.done = second.done = true;
    found += 1;
    burst(first.c.x, first.c.y, gold, 14);
    burst(second.c.x, second.c.y, gold, 14);
    sfx('coin');
    tell(say('match') + ' ' + found + '/' + pairs);
    first = second = null;
    sync();
    if (found === pairs) end(true);
    return;
  }
  shut = 0.9;
  tell(say('miss'));
  sync();
}
function moveCursor(code) {
  keys = true;
  const dx = code === 'ArrowRight' || code === 'KeyD' ? 1 : code === 'ArrowLeft' || code === 'KeyA' ? -1 : 0;
  const dy = code === 'ArrowDown' || code === 'KeyS' ? 1 : code === 'ArrowUp' || code === 'KeyW' ? -1 : 0;
  const col = Math.max(0, Math.min(cols - 1, (cursor % cols) + dx * s.dir)), row = Math.max(0, Math.min(rowsN - 1, Math.floor(cursor / cols) + dy));
  cursor = Math.min(cards.length - 1, row * cols + col);
}
function step(dt) {
  clock += dt;
  if (peek > 0) peek -= dt;
  if (shut > 0) {
    shut -= dt;
    if (shut <= 0) closePair();
  }
  for (const code of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']) if (pressed(code)) moveCursor(code);
  if (pressed('Space')) {
    keys = true;
    turn(cursor);
  }
  if (limit > 0) {
    left = Math.max(0, left - dt);
    if (left <= 0 && mode === 'running') {
      sync();
      return end(false);
    }
  }
  sync();
}
function manual(code) {
  if (code === 'Space') {
    keys = true;
    turn(cursor);
  } else moveCursor(code);
}
function point(px, py) {
  const i = cards.findIndex((card) => Math.abs(card.c.x - px) < cw / 2 && Math.abs(card.c.y - py) < ch / 2);
  if (i < 0) return;
  keys = false;
  cursor = i;
  turn(i);
}
function idle(dt) {
  for (const card of cards) {
    const goal = card.up || card.done || peek > 0 ? 1 : 0;
    card.t += Math.sign(goal - card.t) * Math.min(Math.abs(goal - card.t), dt * 6);
  }
}
function draw() {
  for (const card of cards) {
    if (!live) card.t = card.up || card.done ? 1 : 0;
    const showFace = card.t > 0.5;
    card.c.scale.x = Math.max(0.02, Math.abs(Math.cos(card.t * Math.PI)));
    card.faceSide.visible = showFace;
    card.backSide.visible = !showFace;
    card.glowSide.visible = card.done;
    card.c.alpha = card.done ? 0.82 : 1;
  }
  const at = cards[cursor];
  cursorBox.visible = keys && mode === 'running' && !!at;
  if (at) cursorBox.position.set(at.c.x, at.c.y);
}
`),
  region: gameRegion({
    title: w('Memory match', 'لعبة الذاكرة'),
    intro: w(
      'Turn two cards at a time and find every matching pair. Tap a card, or move with the arrow keys and turn it with Space or the Turn button.',
      'اقلب بطاقتين في كل مرة واعثر على كل زوج متطابق. المس البطاقة، أو تنقّل بالأسهم واقلبها بالمسافة أو بزر «اقلب».',
    ),
    stats: [
      { key: 'pairs', label: w('Pairs', 'الأزواج'), value: '0/8' },
      { key: 'moves', label: w('Moves', 'الحركات'), value: '0' },
      { key: 'time', label: w('Time', 'الوقت'), value: '0' },
    ],
    keys: ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'],
    cross: true,
    actions: [{ key: 'Space', label: w('Turn', 'اقلب') }],
    says: {
      won: w('All pairs found!', 'وجدت كل الأزواج!'),
      lost: w('Time is up.', 'انتهى الوقت.'),
      match: w('A match!', 'زوج متطابق!'),
      miss: w('Not a match.', 'غير متطابقتين.'),
    },
  }),
});
