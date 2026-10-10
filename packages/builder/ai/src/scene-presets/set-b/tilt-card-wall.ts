import { definePreset, range, SET_B_PHOTOS, sharedParams, text } from './define';

const CARD_PHOTOS = [
  SET_B_PHOTOS.wadiRum,
  SET_B_PHOTOS.petraDeir,
  SET_B_PHOTOS.oliveGrove,
  SET_B_PHOTOS.poolSea,
  SET_B_PHOTOS.petraTomb,
  SET_B_PHOTOS.plantation,
].join(', ');

/**
 * A wall of photo cards in 2.5D. Each card is a PerspectiveMesh whose four corners are projected
 * from a real rotation, so the cards near the pointer tilt toward it, lift, and catch a moving
 * specular sheen; one soft shadow layer sits beneath them all. Idle, a noise wave rolls across the
 * wall toward the inline end. Cards are laid out from the inline start (mirrored in RTL).
 */
export const TILT_CARD_WALL = definePreset({
  id: 'tilt-card-wall',
  name: { en: 'Tilt card wall', ar: 'جدار البطاقات المائلة' },
  description: {
    en: 'A wall of photo cards in 2.5D that tilt toward the pointer, lift, and catch a moving sheen, with a slow wave rolling across when idle.',
    ar: 'جدار من بطاقات الصور بأبعاد ونصف تميل نحو المؤشر وترتفع ويلمع عليها بريق متحرك، وتسري عليها موجة هادئة حين تسكن.',
  },
  tags: ['interactive', 'photo', 'geometric', 'hero', 'bold'],
  libs: ['kit'],
  params: [
    ...sharedParams({ seed: 4 }),
    text('images', 'Images (comma separated)', 'الصور (مفصولة بفواصل)', CARD_PHOTOS, 'look'),
    range('columns', 'Columns', 'الأعمدة', 5, 2, 10, 1, 'look'),
    range('tiltMax', 'Tilt', 'الميل', 16, 0, 35, 0.5, 'interaction'),
    range('sheen', 'Sheen', 'اللمعان', 0.6, 0, 1, 0.05, 'look'),
    range('gap', 'Gap', 'الفراغ', 18, 0, 60, 1, 'look'),
  ],
  code: String.raw`
const p = ck.params({ palette: 'theme', seed: 4, speed: 1, density: 1, interactive: true, images: '${CARD_PHOTOS}', columns: 5, tiltMax: 16, sheen: 0.6, gap: 18 });
const s = await ck.scene({ libs: [], pointer: false });
const P = s.PIXI, pal = s.palette;
const urls = s.words(String(p.images).split(',').join(' ')).slice(0, 12);
const made = [];
let texs = (await Promise.all(urls.map((u) => s.texture(u).catch(() => null)))).filter(Boolean);
if (!texs.length) {
  // no photo reachable: palette cards, so the wall still stands
  for (let i = 0; i < 5; i++) {
    const g = new P.Graphics().rect(0, 0, 300, 400).fill(pal.colors[i]);
    for (let j = 0; j < 4; j++) g.circle(s.rand(0, 300), s.rand(0, 400), s.rand(60, 180)).fill({ color: pal.colors[(i + j + 1) % 5], alpha: 0.5 });
    made.push(s.app.renderer.generateTexture(g));
    g.destroy();
  }
  texs = made;
}
const glint = new P.Graphics();
for (let i = 0; i <= 10; i++) glint.circle(64, 64, 64 - i * 5.6).fill({ color: 0xffffff, alpha: 0.1 });
const glintTex = s.app.renderer.generateTexture(glint);
glint.destroy();

const wall = new P.Container();
s.stage.addChild(wall);
const shadow = new P.Graphics();
shadow.filters = [new P.BlurFilter({ strength: 10 })];
wall.addChild(shadow);
const deck = new P.Container();
wall.addChild(deck);
let cards = [];
let cw = 100, ch = 130;

function build(w, h) {
  for (const c of cards) { c.m.destroy(); c.glow.destroy(); c.tx.destroy(false); }
  cards = [];
  const gap = p.gap * Math.min(1, w / 900 + 0.3);
  const cols = Math.max(2, Math.min(10, Math.round(p.columns * Math.sqrt(p.density) * (w < 640 ? 0.6 : 1))));
  cw = (w - gap * (cols + 1)) / cols;
  ch = cw * 1.3;
  const rows = Math.max(1, Math.min(s.count(6), Math.ceil((h - gap) / (ch + gap))));
  const oy = (h - (rows * ch + (rows - 1) * gap)) / 2;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const src = texs[(j * cols + i) % texs.length], ar = cw / ch;
      const sw = Math.min(src.width, src.height * ar), sh = sw / ar;
      const tx = new P.Texture({ source: src.source, frame: new P.Rectangle(src.frame.x + (src.width - sw) / 2, src.frame.y + (src.height - sh) / 2, sw, sh) });
      const m = new P.PerspectiveMesh({ texture: tx, verticesX: s.quality < 1 ? 4 : 8, verticesY: s.quality < 1 ? 4 : 8 });
      const x = s.dir > 0 ? gap + i * (cw + gap) : w - gap - cw - i * (cw + gap);
      const glow = new P.Sprite(glintTex);
      glow.anchor.set(0.5);
      glow.blendMode = 'add';
      deck.addChild(m, glow);
      cards.push({ m, glow, tx, i, j, x, y: oy + j * (ch + gap), sw, sh, rx: 0, ry: 0, lift: 0 });
    }
  }
}
build(s.width, s.height);
s.onResize(build);
s.dispose(() => {
  for (const c of cards) c.tx.destroy(false);
  glintTex.destroy(true);
  for (const m of made) m.destroy(true);
});

function project(c, X, Y, out) {
  const cy = Math.cos(c.ry), sy = Math.sin(c.ry), cx = Math.cos(c.rx), sx = Math.sin(c.rx);
  const X1 = X * cy, Z1 = -X * sy, Y2 = Y * cx - Z1 * sx, Z2 = Y * sx + Z1 * cx, f = c.sw * 2.4, q = f / (f + Z2);
  out.push(X1 * q, Y2 * q);
}
s.tick(({ t, dt }) => {
  const w = s.width, h = s.height, k = (p.tiltMax * Math.PI) / 180;
  const live = p.interactive && s.pointer.inside, px = s.pointer.x, py = s.pointer.y;
  const e = s.reducedMotion ? 1 : Math.min(1, dt * 8);
  shadow.clear();
  for (const c of cards) {
    const mx = c.x + cw / 2, my = c.y + ch / 2;
    let rx, ry, lift = 0;
    if (live) {
      const dx = (px - mx) / w, dy = (py - my) / h, fall = Math.exp(-(dx * dx + dy * dy) * 7);
      ry = -dx * fall * k * 2.4;
      rx = dy * fall * k * 2.4;
      lift = fall;
    } else {
      ry = s.noise3(c.i * 0.35 - t * 0.2 * p.speed * s.dir, c.j * 0.35, t * 0.05) * k * 0.6;
      rx = s.noise3(c.i * 0.35, c.j * 0.35 + 7, t * 0.05) * k * 0.4;
    }
    c.rx += (rx - c.rx) * e;
    c.ry += (ry - c.ry) * e;
    c.lift += (lift - c.lift) * e;
    const pts = [], hw = c.sw / 2, hh = c.sh / 2;
    project(c, -hw, -hh, pts); project(c, hw, -hh, pts); project(c, hw, hh, pts); project(c, -hw, hh, pts);
    for (let n = 0; n < 8; n += 2) { pts[n] += hw; pts[n + 1] += hh; }
    c.m.setCorners(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
    const sc = (cw / c.sw) * (1 + c.lift * 0.06);
    c.m.scale.set(sc);
    c.m.position.set(mx - hw * sc, my - hh * sc);
    const off = 8 + c.lift * 16, poly = [];
    for (let n = 0; n < 8; n += 2) poly.push(c.m.x + pts[n] * sc + off * 0.4, c.m.y + pts[n + 1] * sc + off);
    shadow.poly(poly).fill({ color: pal.dark ? 0x000000 : pal.text, alpha: 0.16 + c.lift * 0.1 });
    const gx = Math.max(-0.22, Math.min(0.22, -Math.sin(c.ry) * 1.2)), gy = Math.max(-0.22, Math.min(0.22, Math.sin(c.rx) * 1.2));
    c.glow.position.set(mx + gx * cw, my + gy * ch);
    c.glow.scale.set((cw * 0.5) / 128);
    c.glow.alpha = p.sheen * Math.min(0.9, 0.12 + c.lift * 0.5 + (Math.abs(c.rx) + Math.abs(c.ry)) * 1.2);
  }
});
`,
});
