import { count, defineKit, sharedParams, soundButton, toggle } from './define';
import { gameBody } from './game-shell';
import { gameRegion } from './game-tree';

const w = (en: string, ar: string) => ({ en, ar });

/**
 * Catch the falling: move a basket along the ground and catch the fruit and stars that fall,
 * but not the rocks. A missed fruit or a caught rock costs a life; the fall quickens as the
 * basket fills. Arrows / A-D, the buttons, the mouse or a finger move the basket. The catch goal,
 * lives and the rocks are params. Reduced motion: each press moves the basket and plays one
 * short, still-rendered step.
 */
export const CATCH = defineKit({
  id: 'catch',
  category: 'game',
  name: w('Catch the falling fruit', 'لعبة التقاط الثمار'),
  description: w(
    'Move a basket to catch falling fruit and stars while dodging rocks; the fall speeds up as you go. Keys, mouse, touch or buttons; goal, lives and rocks are settings.',
    'حرّك السلة لتلتقط الثمار والنجوم المتساقطة وتتجنّب الحجارة، وتزداد السرعة كلما تقدّمت. لوحة مفاتيح أو فأرة أو لمس أو أزرار، والهدف والمحاولات والحجارة إعدادات.',
  ),
  tags: ['interactive', 'game', 'playful', 'arabic'],
  libs: ['kit', 'audio'],
  params: [
    ...sharedParams({ seed: 17, interactive: false }),
    count('goal', 'Catches to win', 'الالتقاطات المطلوبة للفوز', 20, 5, 100, 'interaction'),
    count('lives', 'Lives', 'المحاولات', 3, 1, 9, 'interaction'),
    toggle('rocks', 'Falling rocks to avoid', 'حجارة متساقطة يجب تجنّبها', true, 'interaction'),
    soundButton(),
  ],
  scene: "{ libs: ['audio'], design: { width: 1280, height: 848 }, pointer: true }",
  body: gameBody(String.raw`
const STATS = ['caught', 'lives'];
const goal = Math.round(p.goal), lifeMax = Math.round(p.lives), BY = 612;
const back = backdrop(pal.mix(pal.surface, pal.accent, 0.26), pal.mix(pal.surface, gold, 0.24));
const sx = s.dir > 0 ? 1060 : 220;
for (let k = 6; k > 0; k--) back.circle(sx, 150, 22 * k).fill({ color: gold, alpha: 0.05 });
back.circle(sx, 150, 52).fill({ color: gold, alpha: 0.8 });
const hills = [0, H];
for (let x = 0; x <= W; x += 32) hills.push(x, 520 + Math.sin(x * 0.006 * s.dir + 1) * 40 + Math.sin(x * 0.017) * 12);
hills.push(W, H);
back.poly(hills).fill(pal.mix(pal.surface, pal.colors[4], 0.45));
back.rect(0, BY + 30, W, H - BY - 30).fill(pal.mix(pal.surface, leaf, 0.35)).rect(0, BY + 30, W, 8).fill(leaf);
// Good things (three fruits and a star) and the rock, each one shared shape.
const SHAPES = [
  new P.GraphicsContext().circle(0, 2, 20).fill(gold).circle(-6, -4, 5).fill({ color: 0xffffff, alpha: 0.45 }).ellipse(7, -19, 9, 4).fill(leaf),
  new P.GraphicsContext().circle(0, 2, 18).fill(danger).circle(-6, -3, 4).fill({ color: 0xffffff, alpha: 0.4 }).rect(-1, -20, 3, 8).fill(pal.mix(leaf, pal.surface, 0.4)).ellipse(6, -17, 7, 3.5).fill(leaf),
  new P.GraphicsContext().ellipse(0, 4, 16, 20).fill(leaf).circle(0, -12, 11).fill(leaf).circle(-5, 0, 4).fill({ color: 0xffffff, alpha: 0.35 }),
  new P.GraphicsContext().star(0, 0, 5, 22, 10).fill(pal.mix(gold, 0xffffff, 0.25)).circle(0, 0, 5).fill({ color: 0xffffff, alpha: 0.7 }),
];
const ROCK = new P.GraphicsContext().poly([-20, 8, -14, -14, 4, -20, 20, -8, 18, 14, -4, 20]).fill(pal.mix(pal.text, pal.surface, 0.55)).poly([-8, -8, 4, -12, 8, -2]).fill({ color: 0xffffff, alpha: 0.15 });
s.dispose(() => { for (const shape of SHAPES) shape.destroy(); ROCK.destroy(); });
const items = [];
for (let i = 0; i < 16; i++) {
  const g = new P.Graphics();
  field.addChild(g);
  items.push({ g, on: false, x: 0, y: 0, vy: 0, spin: 0, good: true });
}
const basketW = 150;
const basket = new P.Graphics();
const wicker = pal.mix(gold, pal.surface, 0.3);
basket.poly([-basketW / 2, -30, basketW / 2, -30, basketW / 2 - 16, 28, -basketW / 2 + 16, 28]).fill(wicker);
for (let k = -2; k <= 2; k++) basket.moveTo(k * 26, -26).lineTo(k * 22, 26).stroke({ width: 3, color: pal.mix(wicker, pal.surface, 0.35) });
basket.rect(-basketW / 2 + 8, -4, basketW - 16, 3).fill({ color: pal.surface, alpha: 0.25 }).roundRect(-basketW / 2 - 6, -38, basketW + 12, 12, 6).fill(pal.mix(wicker, 0xffffff, 0.2));
field.addChild(basket);

let bx = W / 2, caught = 0, lives = 0, clock = 0, gapT = 0, keyAt = -9;
function spawn() {
  const it = items.find((k) => !k.on);
  if (!it) return;
  it.good = !p.rocks || s.random() > 0.28;
  it.g.context = it.good ? SHAPES[s.int(0, SHAPES.length - 1)] : ROCK;
  it.x = s.rand(60, W - 60);
  it.y = -30;
  it.vy = 210 + Math.min(260, caught * 12) + s.rand(-30, 40);
  it.spin = s.rand(-2, 2);
  it.g.rotation = 0;
  it.on = true;
}
function reset() {
  bx = W / 2;
  caught = 0;
  lives = lifeMax;
  gapT = 0.6;

  for (const it of items) it.on = false;
  sync();
}
function sync() {
  hud('caught', caught + '/' + goal);
  hud('lives', lives);
}
function lose(x, y) {
  lives -= 1;
  burst(x, y, danger, 16);
  sfx('hit');
  sync();
  if (lives <= 0) end(false);
}
function step(dt) {
  clock += dt;
  const axis = s.input.axis(['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']);
  if (axis) {
    bx += axis * 820 * dt;
    keyAt = clock;
  } else if (clock - keyAt > 0.6 && s.pointer.inside && s.pointer.active) {
    const ty = s.pointer.y - FY;
    if (ty > 0 && ty < H) bx += (s.pointer.x - bx) * Math.min(1, dt * 14);
  }
  bx = Math.max(basketW / 2, Math.min(W - basketW / 2, bx));
  gapT -= dt;
  if (gapT <= 0) {
    gapT = Math.max(0.42, 0.95 - caught * 0.02) * s.rand(0.8, 1.2);
    spawn();
  }
  for (const it of items) {
    if (!it.on) continue;
    it.y += it.vy * dt;
    it.g.rotation += it.spin * dt;
    if (it.y > BY - 40 && it.y < BY + 6 && Math.abs(it.x - bx) < basketW / 2 - 6) {
      it.on = false;
      if (it.good) {
        caught += 1;
        burst(it.x, BY - 30, gold, 12);
        sfx('coin');
        sync();
        if (caught >= goal) return end(true);
      } else {
        lose(it.x, BY - 30);
        if (mode !== 'running') return;
      }
    } else if (it.y > H + 30) {
      it.on = false;
      if (it.good) {
        lose(it.x, H - 20);
        if (mode !== 'running') return;
      }
    }
  }
}
function manual(code) {
  hold(code, 0.2);
}
function point(px) {
  if (calm) {
    bx = Math.max(basketW / 2, Math.min(W - basketW / 2, px));
    advance(0.25);
    return;
  }
  keyAt = -9;
}
function idle() {}
function draw() {
  basket.position.set(bx, BY);
  for (const it of items) {
    it.g.visible = it.on;
    it.g.position.set(it.x, it.y);
  }
}
`),
  region: gameRegion({
    title: w('Catch the fruit', 'التقط الثمار'),
    intro: w(
      'Catch the falling fruit and stars in your basket, and let the rocks fall past. Move with the arrow keys, the buttons, the mouse or your finger.',
      'التقط الثمار والنجوم المتساقطة بسلّتك، ودع الحجارة تسقط بعيداً. تحرّك بالأسهم أو بالأزرار أو بالفأرة أو بإصبعك.',
    ),
    stats: [
      { key: 'caught', label: w('Caught', 'التُقط'), value: '0/20' },
      { key: 'lives', label: w('Lives', 'المحاولات'), value: '3' },
    ],
    keys: ['ArrowLeft', 'ArrowRight'],
    says: { won: w('Basket full!', 'امتلأت السلّة!') },
  }),
});
