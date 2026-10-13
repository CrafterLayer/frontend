import { defineKit, sharedParams, text, toggle } from './define';
import { storyBody } from './story-shell';
import { bookRegion } from './story-tree';

const w = (en: string, ar: string) => ({ en, ar });

/**
 * Picture book: a bedtime story told page by page. Each page is an element in the section's tree
 * — its heading, its text and a mood word (dawn, day, dusk, night, rain, snow, forest, sea) — and
 * the canvas paints that mood as a layered landscape (sky, sun or moon, ridges, a prop, weather
 * from the emitter presets) with the hero, drawn by `s.lib.peeps`, whose face follows the mood,
 * and a lantern that glows a little brighter on every page. Pages cross-fade over about a second,
 * the layers drift gently with the pointer, and Read aloud speaks the page (speechSynthesis, page
 * language, only after the press). Previous / Next / Start again and the arrow keys navigate;
 * nothing advances on its own. Reduced motion: no fade or drift, the same pages.
 */
export const PICTURE_BOOK = defineKit({
  id: 'picture-book',
  category: 'story',
  name: w('Picture book story', 'قصة مصوّرة'),
  description: w(
    'A bedtime picture book: pages of words with a painted landscape per mood, a hero whose face follows the story, gentle fades and an optional read-aloud. Edit pages as text.',
    'كتاب مصوّر لقصة قبل النوم: صفحات بكلماتها ومنظر مرسوم لكل جوّ، وبطل تتبدّل ملامحه مع القصة، وانتقالات هادئة وقراءة بصوت عالٍ اختيارية. الصفحات نصوص قابلة للتعديل.',
  ),
  tags: ['interactive', 'story', 'calm', 'arabic'],
  libs: ['kit', 'emitter', 'peeps'],
  params: [
    ...sharedParams({ seed: 8, speed: 1, interactive: false }),
    text(
      'hero',
      'Hero (a name picks the look; empty = none)',
      'البطل (الاسم يحدد الشكل؛ فارغ = بلا بطل)',
      'Layla',
      'look',
    ),
    toggle('weather', 'Weather and fireflies', 'الطقس واليراعات', true, 'motion'),
    toggle(
      'lantern',
      'A lantern that brightens page by page',
      'فانوس يزداد ضوؤه صفحة بعد صفحة',
      true,
      'look',
    ),
  ],
  scene: "{ libs: ['emitter', 'peeps'], design: { width: 1280, height: 720, align: 'top' } }",
  body: storyBody(String.raw`
const W = 1280, H = 720;
const pages = Array.from(root.querySelectorAll('[data-scene-part="page"]')).slice(0, 32);
const total = Math.max(1, pages.length);
const moodOf = (i) => {
  const v = pages[i] ? pages[i].getAttribute('data-scene-value') : '';
  return MOODS[v] ? v : MOOD_NAMES[i % MOOD_NAMES.length];
};
s.canvas.setAttribute('aria-hidden', 'true');
// The picture: the mood scenes, then the hero and the lantern, clipped to the 1280 × 720 frame.
const picture = new P.Container(), stage = new P.Container(), frame = new P.Graphics().rect(0, 0, W, H).fill(0xffffff);
picture.addChild(stage);
picture.mask = frame;
s.world.addChild(picture, frame);
const scenes = {};
function sceneFor(name) {
  if (!scenes[name]) {
    const sc = paintMood(name, W, H);
    sc.view.alpha = 0;
    stage.addChild(sc.view);
    scenes[name] = sc;
  }
  return scenes[name];
}
const hero = new P.Sprite();
hero.anchor.set(0.5, 1);
const lamp = new P.Container(), lampGlow = new P.Graphics(), lampBody = new P.Graphics();
for (let k = 8; k > 0; k--) lampGlow.circle(0, 0, 10 + k * 12).fill({ color: gold, alpha: 0.05 });
lampBody.rect(-1.5, -40, 3, 14).fill(pal.text).roundRect(-13, -28, 26, 34, 7).fill(pal.mix(gold, 0xffffff, 0.35)).roundRect(-9, -22, 18, 22, 5).fill(gold).rect(-15, 4, 30, 5).fill(pal.text);
lamp.addChild(lampGlow, lampBody);
lamp.visible = !!p.lantern;
picture.addChild(hero, lamp);
const faces = String(p.hero || '').trim() ? await s.lib.peeps.textures(s, { seed: String(p.hero), size: 300, flip: s.dir < 0 }, ['calm', 'happy', 'sad', 'thinking', 'surprised']).catch(() => null) : null;
hero.visible = !!faces;

const back = q('[data-story-action="back"]'), next = q('[data-story-action="next"]');
const voice = q('[data-story-voice]'), speech = globalThis.speechSynthesis;
let shown = null, current = 0, reading = false, clock = 0, glow = 1;
function speak(i) {
  if (!speech || s.editor) return;
  speech.cancel();
  if (!reading || !pages[i]) return;
  const u = new SpeechSynthesisUtterance(pages[i].textContent.replace(/\s+/g, ' ').trim());
  u.lang = s.lang;
  u.rate = 0.9;
  speech.speak(u);
}
function show(i) {
  current = i;
  pages.forEach((page, k) => {
    page.hidden = k !== i;
  });
  const sc = sceneFor(moodOf(i));
  shown = sc;
  for (const key in scenes) {
    const other = scenes[key];
    if (!live) other.view.alpha = other === sc ? 1 : 0;
    if (other === sc) {
      if (p.weather) {
        const rain = weather(sc, W, H);
        if (rain) rain.start();
      }
    } else if (other.rain) other.rain.stop();
  }
  if (faces) hero.texture = faces[sc.m.face] || faces.calm;
  hero.position.set(sc.at[0], H + 6);
  lamp.position.set(sc.at[0] - 125 * s.dir, H - 120);
  glow = 0.45 + (total > 1 ? i / (total - 1) : 1) * 0.75;
  lampGlow.scale.set(glow);
  if (back) back.disabled = i === 0;
  if (next) next.disabled = i === total - 1;
  tell(say('page') + ' ' + (i + 1) + ' ' + say('of') + ' ' + total);
  speak(i);
  if (calm) s.app.render();
}
const story = s.story(pages.length ? pages.map((page, i) => ({ id: 'page-' + (i + 1), enter: () => show(i) })) : [{ id: 'page-1', enter: () => show(0) }]);
for (const action of ['back', 'next', 'reset']) {
  listen(q('[data-story-action="' + action + '"]'), 'click', () => {
    if (!s.editor) story[action]();
  });
}
// The arrow keys turn the page while focus is in the section (mirrored right to left).
listen(root, 'keydown', (e) => {
  if (s.editor || (e.code !== 'ArrowRight' && e.code !== 'ArrowLeft')) return;
  const forward = (e.code === 'ArrowRight') === (s.dir > 0);
  if (forward ? story.next() : story.back()) e.preventDefault();
});
if (voice) {
  voice.hidden = !speech;
  listen(voice, 'click', () => {
    if (s.editor) return;
    reading = !reading;
    voice.setAttribute('aria-pressed', String(reading));
    speak(current);
  });
}
s.dispose(() => {
  if (speech) speech.cancel();
});
if (live) {
  s.tick(({ dt }) => {
    clock += dt * p.speed;
    const nx = s.pointer.active ? s.pointer.nx - 0.5 : 0;
    for (const key in scenes) {
      const sc = scenes[key], target = sc === shown ? 1 : 0;
      sc.view.alpha += (target - sc.view.alpha) * Math.min(1, dt * 2.6);
      sc.view.visible = sc.view.alpha > 0.01;
      if (!sc.view.visible) continue;
      for (const layer of sc.layers) {
        const want = -nx * layer.k * 36 + (layer.drift ? Math.sin(clock * 0.07) * layer.drift * 8 : 0);
        layer.c.x += (want - layer.c.x) * Math.min(1, dt * 3);
      }
    }
    hero.scale.set(1, 1 + Math.sin(clock * 1.7) * 0.012);
    lampGlow.scale.set(glow * (1 + Math.sin(clock * 2.3) * 0.04));
  });
}
`),
  region: bookRegion({
    title: w('The little lantern', 'الفانوس الصغير'),
    pages: [
      {
        mood: 'dusk',
        title: w('The sun goes down', 'الشمس تغيب'),
        text: w(
          'As the sun slipped behind the hills, Layla found a little lantern by the gate. It was cold and dark.',
          'حين غابت الشمس خلف التلال، وجدت ليلى فانوساً صغيراً عند البوابة. كان بارداً ومطفأً.',
        ),
      },
      {
        mood: 'forest',
        title: w('Into the woods', 'في الغابة'),
        text: w(
          'She carried it through the whispering woods, where the leaves sang her a quiet song.',
          'حملته عبر الغابة الهامسة، حيث غنّت لها الأوراق أغنية هادئة.',
        ),
      },
      {
        mood: 'rain',
        title: w('A soft rain', 'مطر خفيف'),
        text: w(
          'A soft rain began to fall. Layla held the lantern close, and it glowed, just a little.',
          'بدأ مطر خفيف يتساقط. ضمّت ليلى الفانوس إليها، فأضاء قليلاً.',
        ),
      },
      {
        mood: 'sea',
        title: w('By the sea', 'عند البحر'),
        text: w(
          'At the edge of the sea, the waves hushed and hummed, and the lantern grew warmer.',
          'عند شاطئ البحر همست الأمواج ودندنت، وازداد الفانوس دفئاً.',
        ),
      },
      {
        mood: 'night',
        title: w('Goodnight', 'تصبحين على خير'),
        text: w(
          'Home at last, the lantern shone like a small star. Goodnight, Layla. Goodnight, little lantern.',
          'وأخيراً في البيت، أضاء الفانوس كنجمة صغيرة. تصبحين على خير يا ليلى، وتصبح على خير أيها الفانوس الصغير.',
        ),
      },
    ],
  }),
});
