import { defineKit, sharedParams, toggle } from './define';
import { storyBody } from './story-shell';
import { scrollRegion } from './story-tree';

const w = (en: string, ar: string) => ({ en, ar });

/**
 * Scroll story: chapters the visitor reads by scrolling. Each chapter is an element in the
 * section's tree (heading, text, mood word); the canvas paints a band behind each one in that
 * mood, in design units fitted to the section's width, with a plant that grows from seed to tree
 * chapter by chapter. While the section scrolls, each band's layers part in depth (far slow, near
 * fast), a journey marker follows `s.scroll.progress` down the inline-start edge, and the status
 * names the chapter in view. The page scroll stays the visitor's: nothing is captured or scrolled
 * by code. Reduced motion: every band is a finished still picture.
 */
export const SCROLL_STORY = defineKit({
  id: 'scroll-story',
  category: 'story',
  name: w('Scroll story', 'قصة بالتمرير'),
  description: w(
    'A scrollytelling story: chapters of text over painted landscapes, one mood per chapter, layers that part in depth as you scroll and a plant that grows from seed to tree.',
    'قصة تُقرأ بالتمرير: فصول من النص فوق مناظر مرسومة، لكل فصل جوّه، وطبقات تتباعد في العمق مع التمرير، ونبتة تكبر من بذرة إلى شجرة.',
  ),
  tags: ['interactive', 'story', 'scroll', 'arabic'],
  libs: ['kit', 'emitter'],
  params: [
    ...sharedParams({ seed: 12, interactive: false }),
    toggle('weather', 'Weather and fireflies', 'الطقس واليراعات', true, 'motion'),
    toggle(
      'plant',
      'A plant that grows chapter by chapter',
      'نبتة تكبر فصلاً بعد فصل',
      true,
      'look',
    ),
  ],
  scene: "{ libs: ['emitter'], design: { width: 1280, height: 720, fit: 'width', align: 'top' } }",
  body: storyBody(String.raw`
const W = 1280;
const chapters = Array.from(root.querySelectorAll('[data-scene-part="chapter"]')).slice(0, 24);
const total = Math.max(1, chapters.length);
const moodOf = (i) => {
  const v = chapters[i] ? chapters[i].getAttribute('data-scene-value') : '';
  return MOODS[v] ? v : MOOD_NAMES[i % MOOD_NAMES.length];
};
s.canvas.setAttribute('aria-hidden', 'true');
const stage = new P.Container(), trail = new P.Graphics(), marker = new P.Graphics();
for (let k = 4; k > 0; k--) marker.circle(0, 0, 6 + k * 5).fill({ color: gold, alpha: 0.1 });
marker.circle(0, 0, 7).fill(gold);
s.world.addChild(stage, trail, marker);
const edge = s.dir > 0 ? 34 : W - 34;
let bands = [], active = -1, span = 1;

// A plant from seed (t = 0) to tree (t = 1), standing at x, y.
function plant(t, x, y) {
  const g = new P.Graphics(), stem = 18 + t * 230, leafC = pal.mix(0x3f9b52, pal.accent, 0.15);
  g.ellipse(x, y + 4, 34 + t * 60, 9).fill({ color: 0x000000, alpha: 0.18 });
  if (t < 0.15) return g.ellipse(x, y - 6, 12, 8).fill(pal.mix(0x8a5a2b, pal.surface, 0.2)).moveTo(x, y - 12).quadraticCurveTo(x + 6 * s.dir, y - 26, x + 14 * s.dir, y - 30).stroke({ width: 4, color: leafC, cap: 'round' });
  g.moveTo(x, y).quadraticCurveTo(x - 10 * s.dir, y - stem * 0.5, x, y - stem).stroke({ width: 5 + t * 16, color: t > 0.6 ? 0x6b4a2b : leafC, cap: 'round' });
  const leaves = Math.round(2 + t * 5);
  for (let i = 0; i < leaves; i++) {
    const ly = y - stem * (0.3 + (i / leaves) * 0.6), side = i % 2 ? 1 : -1;
    g.ellipse(x + side * (14 + t * 12), ly, 14 + t * 8, 7 + t * 3).fill(leafC);
  }
  if (t > 0.6) for (const c of [[0, -1.05, 0.5], [-0.32, -0.9, 0.36], [0.32, -0.92, 0.38], [0, -1.3, 0.34]]) g.circle(x + c[0] * stem, y + c[1] * stem, c[2] * stem * 0.7).fill(pal.mix(leafC, 0x1f5130, 0.25));
  return g;
}
function build() {
  for (const b of bands) {
    if (b.scene.rain) b.scene.rain.destroy();
    b.scene.view.destroy({ children: true });
  }
  for (const f of fills.splice(0)) f.destroy();
  bands = [];
  const k = s.design ? s.design.scale : 1, top = root.getBoundingClientRect().top;
  chapters.forEach((chapter, i) => {
    const r = chapter.getBoundingClientRect(), y = (r.top - top) / k, h = Math.max(240, r.height / k);
    const sc = paintMood(moodOf(i), W, h);
    const clip = new P.Graphics().rect(0, 0, W, h).fill(0xffffff);
    sc.view.addChild(clip);
    sc.view.mask = clip;
    if (p.plant) {
      // Across from the chapter's panel (panels alternate sides).
      const side = i % 2 === 0 ? 0.72 : 0.28, px = s.dir > 0 ? W * side : W * (1 - side);
      const g = plant(total > 1 ? i / (total - 1) : 1, px, sc.at[1] - 8);
      sc.view.addChildAt(g, sc.view.children.length - 1);
      sc.layers.push({ c: g, k: 0.9 });
    }
    sc.view.y = y;
    stage.addChild(sc.view);
    if (p.weather) weather(sc, W, h);
    bands.push({ scene: sc, y, h });
  });
  span = bands.length ? bands[bands.length - 1].y + bands[bands.length - 1].h : 1;
  trail.clear();
  for (let y = 20; y < span - 20; y += 26) trail.circle(edge, y, 2.5).fill({ color: 0xffffff, alpha: 0.45 });
  marker.position.set(edge, 40);
  follow();
}
// The chapter in view (the one under the viewport's middle), as a polite status.
function follow() {
  const k = s.design ? s.design.scale : 1, rr = root.getBoundingClientRect(), view = (globalThis.innerHeight || 800) / k;
  const mid = (view / 2) * k - rr.top;
  let now = 0;
  bands.forEach((b, i) => {
    if (mid / k >= b.y) now = i;
    if (live) {
      const d = (b.y + b.h / 2 - mid / k) / view;
      for (const layer of b.scene.layers) layer.c.y = d * layer.k * 70;
    }
  });
  if (now !== active) {
    active = now;
    tell(say('chapter') + ' ' + (now + 1) + ' ' + say('of') + ' ' + total);
  }
}
build();
s.onResize(() => build());
if (live) {
  s.tick(() => {
    if (!s.scroll.visible) return;
    follow();
    marker.y = 40 + Math.max(0, Math.min(1, s.scroll.progress)) * (span - 80);
  });
} else {
  listen(globalThis, 'scroll', follow, { passive: true });
}
`),
  region: scrollRegion({
    title: w("A seed's journey", 'رحلة بذرة'),
    hint: w('Scroll to follow the story ↓', 'مرّر لتتابع القصة ↓'),
    chapters: [
      {
        mood: 'dawn',
        title: w('A seed wakes up', 'بذرة تستيقظ'),
        text: w(
          'At dawn, a tiny seed felt the first warm light and decided it was time to grow.',
          'عند الفجر، شعرت بذرة صغيرة بأول ضوء دافئ، فقررت أن الوقت قد حان لتنمو.',
        ),
      },
      {
        mood: 'day',
        title: w('Reaching for the sun', 'نحو الشمس'),
        text: w(
          'All day long it stretched toward the sky, one green leaf at a time.',
          'طوال النهار امتدت نحو السماء، ورقة خضراء بعد ورقة.',
        ),
      },
      {
        mood: 'rain',
        title: w('The rain helps', 'المطر يساعد'),
        text: w(
          'Then the rain came, and every drop was a drink that made it stronger.',
          'ثم جاء المطر، فكانت كل قطرة شربة تزيدها قوة.',
        ),
      },
      {
        mood: 'night',
        title: w('A tree under the stars', 'شجرة تحت النجوم'),
        text: w(
          'By night, the seed had become a young tree, resting under a sky full of stars.',
          'وفي الليل، صارت البذرة شجرة فتية تستريح تحت سماء مليئة بالنجوم.',
        ),
      },
    ],
  }),
});
