import type { ScriptParamSpec } from '@craftkit/builder-schema';

import {
  count,
  defineKit,
  el,
  sharedParams,
  soundButton,
  text,
  toggle,
  type KitLang,
} from './define';
import { gameBody } from './game-shell';
import { gameRegion } from './game-tree';

const w = (en: string, ar: string) => ({ en, ar });

/** The default questions: the question, the right answer, then the others, split by |. */
const QUESTIONS: readonly (readonly [string, string])[] = [
  [
    'Which planet is known as the Red Planet? | Mars | Venus | Jupiter | Mercury',
    'أي كوكب يُعرف بالكوكب الأحمر؟ | المريخ | الزهرة | المشتري | عطارد',
  ],
  [
    'How many legs does a spider have? | Eight | Six | Ten | Four',
    'كم رِجلاً للعنكبوت؟ | ثماني أرجل | ست أرجل | عشر أرجل | أربع أرجل',
  ],
  [
    'What do bees make? | Honey | Milk | Silk | Wool',
    'ماذا يصنع النحل؟ | العسل | الحليب | الحرير | الصوف',
  ],
  [
    'Which is the largest ocean on Earth? | The Pacific | The Atlantic | The Indian | The Arctic',
    'ما أكبر محيط على الأرض؟ | المحيط الهادئ | المحيط الأطلسي | المحيط الهندي | المحيط المتجمد الشمالي',
  ],
  [
    'Which gas do plants take in to make their food? | Carbon dioxide | Oxygen | Helium | Nitrogen',
    'ما الغاز الذي تأخذه النباتات لتصنع غذاءها؟ | ثاني أكسيد الكربون | الأكسجين | الهيليوم | النيتروجين',
  ],
];

const QUESTION_HELP = w(
  'Question | right answer | wrong answers, all split by |',
  'السؤال | الإجابة الصحيحة | الإجابات الخاطئة، تفصل بينها |',
);

function questionParams(): ScriptParamSpec[] {
  const specs: ScriptParamSpec[] = [];
  for (let at = 0; at < 6; at += 1) {
    specs.push(
      text(
        `question${String(at + 1)}`,
        `Question ${String(at + 1)}`,
        `السؤال ${String(at + 1)}`,
        QUESTIONS[at]?.[0] ?? '',
        'look',
        QUESTION_HELP,
      ),
    );
  }
  return specs;
}

const ARABIC_QUESTIONS = Object.fromEntries(
  QUESTIONS.map(([, ar], at) => [`question${String(at + 1)}`, ar]),
);

/** The question panel over the playfield: its words are filled from the params by the code. */
function quizPanel(lang: KitLang) {
  return [
    el('div', 'ck-kit-quiz', { 'data-scene-part': 'quiz', hidden: 'hidden' }, [
      el('p', 'ck-kit-qnum', { 'data-scene-part': 'progress' }),
      el('h3', 'ck-kit-q', { 'data-scene-part': 'question' }),
      el('div', 'ck-kit-answers', {
        'data-scene-part': 'answers',
        role: 'group',
        'aria-label': lang === 'ar' ? 'الإجابات' : 'Answers',
      }),
      el('p', 'ck-kit-feedback', { 'data-scene-part': 'feedback' }),
      el(
        'button',
        'ck-kit-go',
        { 'data-game-action': 'next', hidden: 'hidden' },
        lang === 'ar' ? 'السؤال التالي' : 'Next question',
      ),
    ]),
  ];
}

const QUIZ_CSS = [
  '.ck-kit-quiz{position:absolute;top:50%;translate:0 -50%;max-height:84%;inset-inline-end:3.5%;width:min(58%,36rem);pointer-events:auto;overflow:auto;display:flex;flex-direction:column;gap:.55rem;padding:clamp(.8rem,2.4vw,1.4rem);border-radius:1.2rem;background:color-mix(in oklab,var(--t-surface) 90%,transparent);border:1px solid color-mix(in oklab,var(--t-accent) 35%,transparent);backdrop-filter:blur(8px)}',
  '.ck-kit-qnum{margin:0;font-size:.85rem;color:var(--t-text-muted)}',
  '.ck-kit-q{margin:0;font-size:clamp(1.05rem,2.4vw,1.5rem);line-height:1.3}',
  '.ck-kit-answers{display:grid;gap:.45rem}',
  '.ck-kit .ck-kit-answer{display:flex;gap:.6rem;align-items:center;text-align:start;width:100%;min-height:2.75rem;font-size:clamp(.9rem,1.8vw,1.05rem)}',
  '.ck-kit-num{flex:none;display:inline-grid;place-items:center;width:1.6em;height:1.6em;border-radius:.45rem;font-size:.8em;font-weight:700;background:var(--t-accent);color:var(--t-surface)}',
  '.ck-kit .ck-kit-right{background:color-mix(in oklab,var(--t-surface) 55%,var(--t-accent));border-color:var(--t-accent);font-weight:700}',
  '.ck-kit .ck-kit-wrong{opacity:.6;text-decoration:line-through}',
  '.ck-kit .ck-kit-answer:disabled{cursor:default}',
  '.ck-kit .ck-kit-right:disabled{opacity:1}',
  '.ck-kit-feedback{margin:0;min-height:1.4em;font-weight:600}',
  '.ck-kit-quiz .ck-kit-go{align-self:flex-start}',
  '@media (max-width:820px){.ck-kit-quizzer{padding-bottom:17rem}.ck-kit-quiz{top:7.5rem;translate:none;max-height:calc(100% - 8rem);inset-inline:.5rem;width:auto}}',
].join('\n');

/**
 * Quiz: a multiple-choice quiz. Up to six questions are params (`question1`…`question6`: the
 * question, the right answer, then the wrong ones, split by |), so page.translate and a person
 * edit them like any words; answers are shuffled, a per-question timer is optional, and the
 * pass mark decides won or lost. The questions and answers are real buttons over the playfield;
 * the canvas holds a host drawn by `s.lib.peeps` whose face answers yours, and a path of stones
 * that light up per question. Number keys 1–6 answer while the panel has focus. Calm by nature:
 * reduced motion changes only the sparks and the host's bob.
 */
export const QUIZ = defineKit({
  id: 'quiz',
  category: 'game',
  name: w('Quiz', 'مسابقة أسئلة'),
  description: w(
    'A multiple-choice quiz: questions and answers are settings, answers shuffle, an optional timer, a pass mark, and a drawn host who reacts to every answer.',
    'مسابقة اختيار من متعدد: الأسئلة والإجابات إعدادات، والإجابات تُخلط، مع مؤقت اختياري ودرجة نجاح، ومضيف مرسوم يتفاعل مع كل إجابة.',
  ),
  tags: ['interactive', 'game', 'education', 'arabic'],
  libs: ['kit', 'audio', 'peeps'],
  params: [
    ...sharedParams({ seed: 9, interactive: false }),
    ...questionParams(),
    count(
      'time',
      'Seconds per question (0 = no timer)',
      'ثوانٍ لكل سؤال (0 = بلا مؤقت)',
      20,
      0,
      120,
      'interaction',
    ),
    count('pass', 'Pass mark (%)', 'درجة النجاح (%)', 60, 0, 100, 'interaction'),
    toggle('shuffle', 'Shuffle the questions', 'خلط ترتيب الأسئلة', false, 'interaction'),
    text(
      'host',
      'Host character (a name picks the look; empty = none)',
      'شخصية المضيف (الاسم يحدد الشكل؛ فارغ = بلا مضيف)',
      'Noor',
      'look',
    ),
    soundButton(),
  ],
  scene: "{ libs: ['audio', 'peeps'], design: { width: 1280, height: 848 }, pointer: true }",
  body: gameBody(String.raw`
const STATS = ['score', 'time'];
const limit = Math.round(p.time), passMark = Math.round(p.pass);
const panel = part('quiz'), progress = part('progress'), questionEl = part('question'), answers = part('answers'), feedback = part('feedback');
const nextBtn = q('[data-game-action="next"]'), nextText = nextBtn ? nextBtn.textContent : '';
const deck = [p.question1, p.question2, p.question3, p.question4, p.question5, p.question6]
  .map((value) => String(value || '').split('|').map((bit) => bit.trim()).filter(Boolean))
  .filter((parts) => parts.length >= 3);

const back = backdrop(pal.mix(pal.surface, pal.accent, 0.2), pal.mix(pal.surface, pal.colors[4], 0.12));
const HX = W * (s.dir > 0 ? 0.22 : 0.78);
for (let k = 9; k > 0; k--) back.circle(HX, 330, 36 * k).fill({ color: gold, alpha: 0.022 });
// The host stands behind a desk; the stones below light up, one per question.
const host = new P.Sprite();
host.anchor.set(0.5, 1);
host.position.set(HX, 560);
field.addChild(host);
const desk = new P.Graphics().roundRect(HX - 170, 500, 340, 120, 18).fill(pal.mix(pal.surface, pal.accent, 0.45)).roundRect(HX - 170, 520, 340, 14, 6).fill(gold).roundRect(HX - 150, 548, 300, 56, 12).fill({ color: pal.surface, alpha: 0.25 });
field.addChild(desk);
const stones = [];
for (let i = 0; i < Math.max(1, deck.length); i++) {
  const g = new P.Graphics().circle(0, 0, 15).fill(0xffffff);
  const t = deck.length > 1 ? i / (deck.length - 1) : 0.5;
  g.position.set(HX + (t - 0.5) * 300 * s.dir, 662 - Math.sin(t * Math.PI) * 14);
  field.addChild(g);
  stones.push({ g, state: 'todo' });
}
const faces = String(p.host || '').trim() ? await s.lib.peeps.textures(s, { seed: String(p.host), size: 300, flip: s.dir < 0 }, ['calm', 'happy', 'sad', 'thinking']).catch(() => null) : null;

let order = [], index = 0, score = 0, picked = false, left = 0, current = [], clock = 0, mood = 'calm';
function ask() {
  const item = order[index];
  picked = false;
  left = limit;
  mood = 'thinking';
  current = s.shuffle(item.slice(1).map((value, k) => ({ value, right: k === 0 })));
  if (progress) progress.textContent = say('question') + ' ' + (index + 1) + ' ' + say('of') + ' ' + order.length;
  if (questionEl) questionEl.textContent = item[0];
  if (answers) {
    answers.replaceChildren();
    current.forEach((choice, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ck-kit-btn ck-kit-answer';
      b.setAttribute('data-scene-value', String(k));
      const num = document.createElement('span');
      num.className = 'ck-kit-num';
      num.textContent = String(k + 1);
      const words = document.createElement('span');
      words.textContent = choice.value;
      b.append(num, words);
      answers.appendChild(b);
    });
  }
  if (feedback) feedback.textContent = '';
  if (nextBtn) {
    nextBtn.hidden = true;
    nextBtn.textContent = index + 1 < order.length ? nextText : say('finish') || nextText;
  }
  stones.forEach((st, i) => {
    if (i === index) st.state = 'now';
  });
  sync();
}
function focusAnswer() {
  const first = answers && answers.querySelector('button');
  if (first) first.focus({ preventScroll: true });
}
function reveal(k) {
  if (picked) return;
  picked = true;
  const right = current.find((c) => c.right), ok = k >= 0 && current[k] && current[k].right;
  if (answers) {
    [...answers.children].forEach((b, i) => {
      b.disabled = true;
      if (current[i] && current[i].right) b.classList.add('ck-kit-right');
      else if (i === k) b.classList.add('ck-kit-wrong');
    });
  }
  const st = stones[index];
  if (ok) {
    score += 1;
    mood = 'happy';
    if (st) {
      st.state = 'right';
      burst(st.g.x, st.g.y, gold, 18);
    }
    sfx('coin');
  } else {
    mood = 'sad';
    if (st) st.state = 'wrong';
    sfx('hit');
  }
  const line = ok ? say('right') : say(k < 0 ? 'timeout' : 'wrong') + ' ' + (right ? right.value : '');
  if (feedback) feedback.textContent = line;
  tell(line);
  if (nextBtn) {
    nextBtn.hidden = false;
    nextBtn.focus({ preventScroll: true });
  }
  sync();
  if (calm) paint();
}
function next() {
  if (!picked || mode !== 'running') return;
  index += 1;
  if (index >= order.length) {
    mood = score * 100 >= passMark * order.length ? 'happy' : 'sad';
    return end(score * 100 >= passMark * order.length);
  }
  ask();
  focusAnswer();
  if (calm) paint();
}
listen(answers, 'click', (e) => {
  const b = e.target && e.target.closest ? e.target.closest('button') : null;
  if (!b || s.editor || mode !== 'running') return;
  reveal(Number(b.getAttribute('data-scene-value')));
});
listen(panel, 'keydown', (e) => {
  const k = /^(?:Digit|Numpad)([1-6])$/.exec(e.code);
  if (k && !picked && mode === 'running') reveal(Number(k[1]) - 1);
});
listen(nextBtn, 'click', () => {
  if (!s.editor) next();
});
function reset() {
  order = deck.length ? (p.shuffle ? s.shuffle(deck) : deck.slice()) : [['?', '…', '…']];
  index = 0;
  score = 0;
  for (const st of stones) st.state = 'todo';
  ask();
}
function sync() {
  hud('score', score + '/' + order.length);
  hud('time', limit > 0 ? Math.ceil(left) : '∞');
}
function step(dt) {
  clock += dt;
  if (limit > 0 && !picked) {
    left = Math.max(0, left - dt);
    sync();
    if (left <= 0) reveal(-1);
  }
}
function manual() {}
function point() {}
function idle(dt) {
  clock += mode === 'running' ? 0 : dt;
}
function draw() {
  const hide = mode !== 'running';
  if (panel && panel.hidden !== hide) {
    panel.hidden = hide;
    if (!hide && !picked) focusAnswer();
  }
  if (faces) {
    const tex = faces[mood] || faces.calm;
    if (host.texture !== tex) host.texture = tex;
  }
  host.y = 560 + (live ? Math.sin(clock * 2) * 4 : 0);
  stones.forEach((st, i) => {
    st.g.tint = st.state === 'right' ? gold : st.state === 'wrong' ? pal.muted : st.state === 'now' ? pal.accent : pal.mix(pal.surface, pal.text, 0.3);
    st.g.scale.set(st.state === 'now' && live ? 1 + Math.sin(clock * 4) * 0.08 : 1);
    st.g.alpha = st.state === 'todo' ? 0.6 : 1;
    if (i === index && st.state === 'todo' && mode === 'running') st.state = 'now';
  });
}
`),
  region: {
    ...gameRegion(
      {
        title: w('Quick quiz', 'مسابقة سريعة'),
        intro: w(
          'Answer each question before the timer runs out. Pick an answer with a click, a tap or the number keys.',
          'أجب عن كل سؤال قبل أن ينتهي المؤقت. اختر الإجابة بنقرة أو لمسة أو بأرقام لوحة المفاتيح.',
        ),
        stats: [
          { key: 'score', label: w('Score', 'النتيجة'), value: '0/5' },
          { key: 'time', label: w('Time', 'الوقت'), value: '20' },
        ],
        keys: [],
        bare: true,
        className: 'ck-kit-quizzer',
        overlay: quizPanel,
        says: {
          won: w('Well done!', 'أحسنت!'),
          lost: w('Keep practising!', 'واصل التدريب!'),
          question: w('Question', 'السؤال'),
          of: w('of', 'من'),
          right: w('Correct!', 'إجابة صحيحة!'),
          wrong: w('Not quite. The answer is', 'ليست هذه. الإجابة الصحيحة:'),
          timeout: w('Time is up. The answer is', 'انتهى الوقت. الإجابة الصحيحة:'),
          finish: w('See my score', 'اعرض نتيجتي'),
        },
      },
      QUIZ_CSS,
    ),
    params: { ar: ARABIC_QUESTIONS },
  },
});
