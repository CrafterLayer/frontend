import { defineKit, range, sharedParams, text, toggle } from './define';
import { storyBody } from './story-shell';
import { novelRegion } from './story-tree';

const w = (en: string, ar: string) => ({ en, ar });

/**
 * Visual novel: a branching conversation between two characters drawn by `s.lib.peeps`, in a
 * painted night market. The lines, speakers, choices and the two endings live in the section's
 * tree (`<ol data-ck-dialogue>`, read with `s.lib.dialogue.fromDom`), the names in a hidden cast
 * list, the dialogue box's labels in the word list — every word is text a person or
 * page.translate edits. The code adds only staging: who stands in the light, each line's face,
 * the lanterns that relight on one ending and the fireflies that rise on the other. The accessible
 * dialogue box (`s.lib.dialogue.view`) brings Continue, numbered choices, a transcript and Play
 * again. Reduced motion: lines appear whole, nothing glides.
 */
export const VISUAL_NOVEL = defineKit({
  id: 'visual-novel',
  category: 'story',
  name: w('Visual novel dialogue', 'قصة حوارية تفاعلية'),
  description: w(
    'A branching visual-novel scene: two drawn characters talk, the visitor chooses, and the story reaches one of two endings. Lines, choices and names are editable text.',
    'مشهد قصصي حواري متفرّع: شخصيتان مرسومتان تتحاوران، والزائر يختار، فتصل القصة إلى إحدى نهايتين. الجمل والخيارات والأسماء نصوص قابلة للتعديل.',
  ),
  tags: ['interactive', 'story', 'arabic'],
  libs: ['kit', 'emitter', 'dialogue', 'peeps'],
  params: [
    ...sharedParams({ seed: 4, interactive: false }),
    text(
      'look1',
      'First character (a name picks the look)',
      'الشخصية الأولى (الاسم يحدد الشكل)',
      'Layla',
      'look',
    ),
    text(
      'look2',
      'Second character (a name picks the look)',
      'الشخصية الثانية (الاسم يحدد الشكل)',
      'Omar',
      'look',
    ),
    range(
      'typing',
      'Typing speed (letters per second, 0 = at once)',
      'سرعة الكتابة (حرف/ثانية، 0 = فوراً)',
      45,
      0,
      120,
      5,
      'motion',
    ),
    toggle(
      'portraits',
      'Portraits in the dialogue box',
      'صور الشخصيات في صندوق الحوار',
      true,
      'look',
    ),
  ],
  scene:
    "{ libs: ['emitter', 'dialogue', 'peeps'], design: { width: 1280, height: 720, align: 'top' } }",
  body: storyBody(
    String.raw`
const W = 1280, H = 720, D = s.lib.dialogue, peeps = s.lib.peeps;
s.canvas.setAttribute('aria-hidden', 'true');
// The night market: sky, moon, stalls, a string of lanterns and a bridge over the river.
const night = new P.FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: pal.mix(0x0b1236, pal.accent, 0.12) }, { offset: 1, color: pal.mix(0x3a2d5c, pal.accent, 0.12) }] });
s.dispose(() => night.destroy());
const mirror = (x) => (s.dir > 0 ? x : W - x);
const sky = new P.Graphics().rect(0, 0, W, H).fill(night);
for (const pt of s.poisson(W, 360, 40, s.count(140))) sky.circle(pt[0], pt[1], s.rand(0.7, 2)).fill({ color: 0xffffff, alpha: s.rand(0.25, 0.8) });
sky.circle(mirror(1080), 110, 44).fill(0xf6f1d6).circle(mirror(1080) + 16 * s.dir, 98, 38).cut();
const stars = new P.Graphics();
for (const pt of s.poisson(W, 300, 70, s.count(40))) stars.star(pt[0], pt[1], 4, 4, 1.5).fill(0xffffff);
stars.alpha = 0.35;
const town = new P.Graphics();
for (let i = 0; i < 9; i++) {
  const x = i * 150 - 20, h = s.rand(160, 260);
  town.rect(x, 520 - h, 130, h).fill(pal.mix(0x1a1838, pal.accent, 0.1)).rect(x + 18, 520 - h + 30, 18, 24).fill({ color: 0xffd27a, alpha: s.random() < 0.4 ? 0.7 : 0.08 });
}
const river = new P.Graphics().rect(0, 560, W, 160).fill(pal.mix(0x1c2a55, pal.accent, 0.15));
for (let y = 580; y < H; y += 24) for (let x = (y % 48) - 40; x < W; x += 110) river.moveTo(x, y).lineTo(x + 46, y).stroke({ width: 2, color: 0xffffff, alpha: 0.12 });
const ground = new P.Graphics().rect(0, 500, W, 64).fill(pal.mix(0x2a2340, pal.accent, 0.1));
const bridge = new P.Graphics().moveTo(mirror(860), 560).quadraticCurveTo(mirror(1060), 470, mirror(1260), 560).stroke({ width: 16, color: pal.mix(0x6b4f3a, pal.accent, 0.1) });
for (let k = 0; k < 9; k++) bridge.rect(mirror(880 + k * 45) - 3, 520 - Math.sin((k / 8) * Math.PI) * 36, 6, 40).fill(pal.mix(0x6b4f3a, pal.accent, 0.1));
const lanterns = [];
const rope = new P.Graphics().moveTo(0, 150).quadraticCurveTo(W / 2, 250, W, 150).stroke({ width: 2, color: 0x000000, alpha: 0.5 });
for (let i = 1; i < 9; i++) {
  const t = i / 9, x = t * W, y = 150 + Math.sin(t * Math.PI) * 50 + 6;
  const halo = new P.Graphics();
  for (let k = 5; k > 0; k--) halo.circle(0, 10, 10 + k * 10).fill({ color: gold, alpha: 0.07 });
  const body = new P.Graphics().roundRect(-11, 0, 22, 28, 8).fill(0xffffff).rect(-1, -8, 2, 8).fill(0x000000);
  halo.position.set(x, y);
  body.position.set(x, y);
  lanterns.push({ halo, body });
}
const flies = s.lib.emitter.spawn(s, 'magic', { x: W / 2, y: 400, width: W, height: 300, intensity: 0.9 });
flies.stop();
// Everything sits in one picture clipped to the 1280 × 720 frame.
const picture = new P.Container(), frame = new P.Graphics().rect(0, 0, W, H).fill(0xffffff), stage = new P.Container();
picture.addChild(sky, stars, town, ground, river, bridge, rope, ...lanterns.map((l) => l.halo), ...lanterns.map((l) => l.body), stage, flies.container);
picture.mask = frame;
s.world.addChild(picture, frame);

// The cast: names from the section's hidden list, looks from the params.
const names = {};
for (const item of root.querySelectorAll('[data-scene-part="cast"] [data-scene-value]')) names[item.getAttribute('data-scene-value')] = item.textContent.trim();
const ids = Object.keys(names).slice(0, 2);
const looks = [String(p.look1 || 'Layla'), String(p.look2 || 'Omar')];
const people = peeps.cast(ids.map((id, i) => ({ id, name: names[id] || id, seed: looks[i], color: i === 0 ? '#f59e0b' : '#38bdf8' })));
const cast = D.cast(people.members());
const at = {};
for (let i = 0; i < people.list.length; i++) {
  const c = people.list[i], faces = await peeps.textures(s, { ...c, size: 300, flip: (i === 1) === (s.dir > 0) }, ['calm', 'happy', 'sad', 'thinking', 'surprised', 'worried']).catch(() => null);
  const slot = new P.Container(), body = new P.Sprite(faces ? faces.calm : P.Texture.EMPTY);
  body.anchor.set(0.5, 1);
  slot.addChild(body);
  slot.position.set(mirror(i === 0 ? 360 : 760), 485);
  stage.addChild(slot);
  at[c.id] = { slot, body, faces, base: slot.x };
}
// What each line looks like, by node id: faces and the two endings' staging (words stay in the tree).
const FACE = { 'line-1': 'worried', 'line-2': 'sad', ask: 'thinking', fix: 'happy', fixed: 'happy', stars: 'calm', starlight: 'surprised' };
let lit = 0, rising = false, clock = 0, focus = '';
function stageFor(line) {
  focus = line.speaker;
  for (const id in at) {
    const who = at[id], me = id === line.speaker;
    who.slot.alpha = me || !line.speaker ? 1 : 0.62;
    const face = line.emotion && line.emotion !== 'calm' ? line.emotion : FACE[line.id] || 'calm';
    if (me && who.faces) who.body.texture = who.faces[face] || who.faces.calm;
  }
  lit = line.ending === 'warm' || line.id === 'fixed' ? 1 : 0;
  rising = line.ending === 'starry' || line.id === 'starlight';
  if (rising) flies.start();
  else flies.stop();
  if (!live) paintLights();
  if (calm) s.app.render();
}
function paintLights() {
  for (const l of lanterns) {
    l.halo.alpha = lit;
    l.body.tint = lit ? gold : pal.mix(0x333344, pal.surface, 0.3);
  }
  stars.alpha = rising ? 1 : 0.35;
}
const talk = D.create(D.fromDom(root), { cast, rng: s.random });
talk.on('line', stageFor);
talk.on('end', (line) => {
  const title = say('ending-' + line.ending);
  if (title) tell(title);
});
const labels = {};
for (const key of ['next', 'restart', 'choices', 'history', 'dialogue', 'end']) if (say(key)) labels[key] = say(key);
const card = part('card'), startBtn = q('[data-story-action="start"]');
let box = null;
function begin() {
  if (card) card.hidden = true;
  if (!box) box = D.view(talk, { root: part('stage') || root, reducedMotion: calm, interactive: !s.editor, speed: Number(p.typing), portraits: !!p.portraits, labels });
  else talk.restart();
  const first = box.element.querySelector('button');
  if (first) first.focus({ preventScroll: true });
}
listen(startBtn, 'click', () => {
  if (!s.editor) begin();
});
s.dispose(() => {
  if (box) box.dispose();
  talk.dispose();
});
paintLights();
if (live) {
  s.tick(({ dt }) => {
    clock += dt;
    for (const id in at) {
      const who = at[id], me = id === focus;
      who.slot.y = 485 - (me ? Math.abs(Math.sin(clock * 2.2)) * 5 : 0);
    }
    for (const l of lanterns) {
      l.halo.alpha += (lit - l.halo.alpha) * Math.min(1, dt * 2);
      l.halo.scale.set(1 + Math.sin(clock * 3 + l.body.x) * 0.04);
      l.body.tint = l.halo.alpha > 0.5 ? gold : pal.mix(0x333344, pal.surface, 0.3);
    }
    stars.alpha += ((rising ? 1 : 0.35) - stars.alpha) * Math.min(1, dt * 1.5);
  });
}
`,
    false,
  ),
  region: novelRegion({
    title: w('The night market', 'سوق الليل'),
    intro: w(
      'Layla and Omar must light the way home. Read on and choose what they do.',
      'على ليلى وعمر أن يضيئا طريق العودة. تابع القراءة واختر ما يفعلانه.',
    ),
    start: w('Begin', 'ابدأ'),
    cast: [
      { id: 'layla', name: w('Layla', 'ليلى') },
      { id: 'omar', name: w('Omar', 'عمر') },
    ],
    lines: [
      {
        speaker: 'layla',
        text: w(
          'The night market is closing, and the last lantern just went out.',
          'السوق الليلي يوشك أن يُغلق، وقد انطفأ آخر فانوس للتو.',
        ),
      },
      {
        speaker: 'omar',
        text: w(
          'Without a light, nobody will find the way home across the bridge.',
          'من دون ضوء، لن يجد أحد طريقه إلى البيت عبر الجسر.',
        ),
      },
      {
        node: 'ask',
        speaker: 'layla',
        text: w(
          'We could fix the old lantern, or ask the stars for help. What should we do?',
          'يمكننا إصلاح الفانوس القديم، أو طلب العون من النجوم. ماذا نفعل؟',
        ),
        choices: [
          { to: 'fix', text: w('Fix the old lantern', 'نصلح الفانوس القديم') },
          { to: 'stars', text: w('Ask the stars', 'نطلب العون من النجوم') },
        ],
      },
      {
        node: 'fix',
        speaker: 'omar',
        text: w(
          'I have a spare wick! Hold it steady while I light it.',
          'معي فتيل احتياطي! أمسكيه جيداً بينما أشعله.',
        ),
      },
      {
        node: 'fixed',
        speaker: 'layla',
        ending: 'warm',
        text: w(
          'The lanterns glow again, and everyone crosses the bridge together.',
          'عادت الفوانيس تضيء، وعبر الجميع الجسر معاً.',
        ),
      },
      {
        node: 'stars',
        speaker: 'layla',
        text: w(
          'Stars, if you can hear us, please light our way.',
          'أيتها النجوم، إن كنتِ تسمعيننا، فأنيري طريقنا.',
        ),
      },
      {
        node: 'starlight',
        speaker: 'omar',
        ending: 'starry',
        text: w(
          'Look! Fireflies are rising, like stars come down to guide us home.',
          'انظري! اليراعات تحلّق كأنها نجوم نزلت لتهدينا إلى البيت.',
        ),
      },
    ],
    says: {
      next: w('Continue', 'متابعة'),
      restart: w('Play again', 'العب من جديد'),
      choices: w('Choices', 'الخيارات'),
      history: w('Story so far', 'ما جرى حتى الآن'),
      dialogue: w('Dialogue', 'الحوار'),
      end: w('The end', 'النهاية'),
      'ending-warm': w('Ending: the lanterns glow again', 'النهاية: الفوانيس تضيء من جديد'),
      'ending-starry': w('Ending: the firefly path', 'النهاية: طريق اليراعات'),
    },
  }),
});
