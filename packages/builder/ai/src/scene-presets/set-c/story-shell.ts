/*
  The story shell (2026-10-13): plain JavaScript the story kits share, joined into each kit's code
  like the game shell. STORY_HEAD finds the section's words and hooks; MOOD_PAINTER draws a
  layered landscape for a mood token — the `data-scene-value` a page or chapter carries in the
  tree (dawn, day, dusk, night, rain, snow, forest, sea) — so a person changes a page's weather
  by editing that one word, and adds a page by copying one.

  paintMood(name, w, h) returns { view, layers, m, ground, at }: a Container w × h design units
  (sky, sun or moon, stars, clouds, far ridge, mid ridge or sea, near ground and a prop), its
  parallax layers ({ c, k }, far to near), the mood's own settings, the ground line, and where a
  character stands. weather(scene) starts the mood's particles (s.lib.emitter presets) once.
  Every gradient it makes ends with the scene.
*/

/** Words, hooks and cleanup: what every story kit reads first. */
export const STORY_HEAD = String.raw`
// ── CraftKit story kit shell: words and hooks from the section ──
const P = s.PIXI, pal = s.palette, root = ck.root, calm = s.reducedMotion, live = !s.editor && !calm;
const gold = pal.mix(pal.colors[1], 0xfbbf24, 0.75);
const q = (sel) => root.querySelector(sel);
const part = (name) => q('[data-scene-part="' + name + '"]');
function say(key) {
  const item = q('[data-scene-part="says"] [data-scene-value="' + key + '"]');
  return item ? item.textContent.replace(/\s+/g, ' ').trim() : '';
}
const listen = (node, type, fn, options) => {
  if (!node) return;
  node.addEventListener(type, fn, options);
  s.dispose(() => node.removeEventListener(type, fn, options));
};
const statusLine = q('[data-story-status]');
let told = '';
function tell(text) {
  if (!statusLine || !text || text === told) return;
  told = text;
  statusLine.textContent = text;
}
`;

/** The mood landscapes the picture book and the scroll story paint. */
export const MOOD_PAINTER = String.raw`
// ── Moods: a layered landscape per word (dawn, day, dusk, night, rain, snow, forest, sea) ──
const MOODS = {
  dawn: { sky: [0x2e3a6e, 0xffb08a], orb: 0xffcf73, orbAt: [0.72, 0.56], stars: 0.25, clouds: 3, far: 0x6a5a92, mid: 0x86689a, near: 0x4f6b55, prop: 'house', weather: 'petals', face: 'calm' },
  day: { sky: [0x58a8f0, 0xd2efff], orb: 0xfff2a8, orbAt: [0.8, 0.2], clouds: 5, far: 0x7fb0c8, mid: 0x6aa36a, near: 0x5b9a4c, prop: 'trees', face: 'happy' },
  dusk: { sky: [0x2c1d4d, 0xff7d5c], orb: 0xff9f5a, orbAt: [0.3, 0.56], clouds: 3, far: 0x4a2f5f, mid: 0x5b3a5e, near: 0x2e3b39, prop: 'house', face: 'thinking' },
  night: { sky: [0x0a1030, 0x27386a], orb: 0xf3efcf, orbAt: [0.8, 0.2], moon: true, stars: 1, clouds: 1, far: 0x1c2550, mid: 0x212e5e, near: 0x151f3d, prop: 'house', weather: 'magic', face: 'calm' },
  rain: { sky: [0x495361, 0x9aa4b0], clouds: 8, far: 0x5a6472, mid: 0x4e5c6a, near: 0x3d5a48, prop: 'trees', weather: 'rain', face: 'sad' },
  snow: { sky: [0x9db4d4, 0xe9f1fb], orb: 0xffffff, orbAt: [0.25, 0.24], clouds: 2, far: 0xb7c5da, mid: 0xd2dceb, near: 0xf2f6fb, prop: 'trees', weather: 'snow', face: 'surprised' },
  forest: { sky: [0x78c3a3, 0xe0f4d0], orb: 0xfff1ad, orbAt: [0.2, 0.18], clouds: 2, far: 0x4c8a69, mid: 0x3c7357, near: 0x2b5d42, prop: 'forest', weather: 'leaves', face: 'happy' },
  sea: { sky: [0x63b2de, 0xd6f0fb], orb: 0xffe6a0, orbAt: [0.72, 0.26], clouds: 3, far: 0x5a8db6, mid: 0x3d7aab, near: 0xe6d3a1, prop: 'sea', face: 'happy' },
};
const MOOD_NAMES = Object.keys(MOODS);
const tone = (c) => pal.mix(c, pal.accent, 0.14);
const fills = [];
s.dispose(() => {
  for (const f of fills) f.destroy();
});
// Every layer reaches past the picture's edges, so parallax never shows a seam.
function ridge(g, w, h, base, amp, freq, seed, color) {
  const pts = [-120, h + 200];
  for (let x = -120; x <= w + 120; x += 40) pts.push(x, base + s.noise2(x * freq, seed) * amp + s.noise2(x * freq * 4, seed + 7) * amp * 0.2);
  pts.push(w + 120, h + 200);
  return g.poly(pts).fill(color);
}
function paintMood(name, w, h) {
  const m = MOODS[name] || MOODS.day, view = new P.Container(), layers = [], mirror = (x) => (s.dir > 0 ? x : w - x);
  const fill = new P.FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: tone(m.sky[0]) }, { offset: 1, color: tone(m.sky[1]) }] });
  fills.push(fill);
  view.addChild(new P.Graphics().rect(-120, -200, w + 240, h + 400).fill(fill));
  const ground = h - 140;
  // Sky: stars, the sun or the moon with its halo, clouds that drift.
  const sky = new P.Graphics();
  if (m.stars) for (const pt of s.poisson(w, ground - 120, 44, s.count(Math.round(120 * m.stars)))) sky.circle(pt[0], pt[1], s.rand(0.8, 2.3)).fill({ color: 0xffffff, alpha: s.rand(0.3, 0.9) * m.stars });
  if (m.orb) {
    const ox = mirror(w * m.orbAt[0]), oy = (ground - 60) * m.orbAt[1] + 40;
    for (let k = 7; k > 0; k--) sky.circle(ox, oy, 46 + k * 22).fill({ color: m.orb, alpha: 0.035 });
    sky.circle(ox, oy, 46).fill(m.orb);
    if (m.moon) sky.circle(ox + 18 * s.dir, oy - 12, 40).cut();
  }
  const clouds = new P.Graphics();
  for (let i = 0; i < m.clouds; i++) {
    const cx = s.rand(0, w), cy = s.rand(40, ground * 0.45), r = s.rand(26, 52), a = name === 'rain' ? 0.55 : 0.3;
    const c = name === 'rain' ? pal.mix(0x6b7280, pal.surface, 0.2) : 0xffffff;
    clouds.circle(cx, cy, r).circle(cx + r * 0.95, cy + 8, r * 0.75).circle(cx - r * 0.95, cy + 10, r * 0.7).circle(cx + r * 0.3, cy - r * 0.45, r * 0.7).fill({ color: c, alpha: a });
  }
  view.addChild(sky, clouds);
  layers.push({ c: sky, k: 0.08 }, { c: clouds, k: 0.18, drift: 6 });
  // Far ridge, then the mid ridge (or the sea), then the near ground with its prop.
  const far = ridge(new P.Graphics(), w, h, ground - 150, 70, 0.0024, name.length, tone(m.far));
  const mid = new P.Graphics();
  if (m.prop === 'sea') {
    mid.rect(-120, ground - 70, w + 240, h).fill(tone(m.mid));
    for (let y = ground - 50; y < h; y += 26) for (let x = -40; x < w + 40; x += 90) mid.moveTo(x, y).quadraticCurveTo(x + 22, y - 7, x + 44, y).stroke({ width: 2, color: 0xffffff, alpha: 0.25 });
    const bx = mirror(w * 0.3);
    mid.poly([bx - 50, ground - 46, bx + 50, ground - 46, bx + 34, ground - 26, bx - 34, ground - 26]).fill(pal.mix(gold, pal.surface, 0.4)).rect(bx - 2, ground - 110, 4, 64).fill(pal.text).poly([bx + 2 * s.dir, ground - 108, bx + 40 * s.dir, ground - 56, bx + 2 * s.dir, ground - 56]).fill(0xffffff);
  } else ridge(mid, w, h, ground - 70, 40, 0.004, name.length + 3, tone(m.mid));
  const near = new P.Graphics();
  if (m.prop === 'sea') ridge(near, w, h, ground + 18, 14, 0.003, 9, tone(m.near));
  else ridge(near, w, h, ground, 18, 0.003, 11, tone(m.near));
  if (m.prop === 'forest' || m.prop === 'trees') {
    const many = m.prop === 'forest' ? 16 : 5, trunk = pal.mix(tone(m.near), 0x3b2a1a, 0.6);
    for (let i = 0; i < many; i++) {
      const tx = s.rand(20, w - 20), ty = ground - 66 + s.rand(-10, 16), th = s.rand(70, 130), col = pal.mix(tone(m.mid), 0x1f5130, m.prop === 'forest' ? 0.4 : 0.15);
      if (Math.abs(tx - mirror(w * 0.68)) < 110) continue;
      mid.rect(tx - 4, ty - 10, 8, 26).fill(trunk);
      if (m.prop === 'forest') mid.poly([tx, ty - th, tx + th * 0.32, ty - 4, tx - th * 0.32, ty - 4]).fill(col).poly([tx, ty - th * 1.25, tx + th * 0.24, ty - th * 0.5, tx - th * 0.24, ty - th * 0.5]).fill(col);
      else mid.circle(tx, ty - th * 0.45, th * 0.32).fill(col).circle(tx + th * 0.18, ty - th * 0.6, th * 0.22).fill(col);
    }
  }
  if (m.prop === 'house') {
    const hx = mirror(w * 0.16), hy = ground + 6, lit = name === 'night' || name === 'dusk' || name === 'dawn';
    near.rect(hx - 60, hy - 80, 120, 80).fill(pal.mix(tone(m.near), 0xffffff, 0.12)).poly([hx - 76, hy - 78, hx, hy - 140, hx + 76, hy - 78]).fill(pal.mix(tone(m.far), 0x000000, 0.25)).rect(hx - 16, hy - 40, 32, 40).fill(pal.mix(tone(m.near), 0x000000, 0.3)).rect(hx + 24, hy - 64, 24, 24).fill(lit ? 0xffd27a : pal.mix(tone(m.near), 0xffffff, 0.35));
    if (lit) for (let k = 4; k > 0; k--) near.circle(hx + 36, hy - 52, 14 + k * 10).fill({ color: 0xffd27a, alpha: 0.06 });
  }
  view.addChild(far, mid, near);
  layers.push({ c: far, k: 0.3 }, { c: mid, k: 0.55 }, { c: near, k: 0.9 });
  return { view, layers, m, ground, at: [mirror(w * 0.68), ground + 12], name };
}
function weather(scene, w, h) {
  const kind = scene.m.weather;
  if (!kind || scene.rain) return scene.rain;
  const area = kind === 'magic' ? { x: w / 2, y: scene.ground - 80, width: w, height: 260 } : { x: w / 2, y: -20, width: w + 80, height: h + 40 };
  scene.rain = s.lib.emitter.spawn(s, kind, { parent: scene.view, intensity: kind === 'rain' ? 0.9 : 0.7, ...area });
  return scene.rain;
}
`;

/** A story kit's whole body: the head, the painter when it needs one, then the kit. */
export function storyBody(story: string, moods = true): string {
  return [STORY_HEAD.trim(), ...(moods ? [MOOD_PAINTER.trim()] : []), story.trim()].join('\n');
}
