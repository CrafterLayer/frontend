/*
  The creative planner (creative agent, 2026-10-12).

  Before a scene writer starts, a deterministic pass reads the brief — in Arabic or English — and
  decides what the piece IS: a platformer, a maze adventure, a visual novel, a picture book, an
  arcade game or an art-directed scene. From that it picks the Studio libraries that actually
  serve it (tile worlds for levels, dialogue/Ink for conversations, anim rigs for characters, fx
  for game feel and atmosphere), the mechanics and story beats to cover, the effects that fit the
  setting (fireflies in a forest, bubbles underwater, snow in winter) and the character states to
  animate. Characters named in the brief and the project's story bible become the cast.

  It is a planning aid, not authority: the result is rendered as a `data` context fragment
  ("CREATIVE BRIEF") beside the section contract. No model call, no network, same input → same
  brief, so it costs nothing and never contradicts itself between section writers.
*/

import { compileKeyword, readRequestWords, requestHasKeyword } from '../skills/keyword-match';
import type { CreativeCharacterV1, CreativeMemoryV1 } from './creative-memory';
import { creativeSlug } from './creative-memory';

export type CreativeKind = 'game' | 'story' | 'scene';

export type CreativeGenre =
  | 'platformer'
  | 'maze-adventure'
  | 'arcade'
  | 'puzzle'
  | 'physics-toy'
  | 'visual-novel'
  | 'picture-book'
  | 'chapter-story'
  | 'mural';

/** The non-kit Studio libraries the planner may recommend (a subset of STUDIO_LIB_KEYS). */
export type CreativeLib =
  'anim' | 'fx' | 'dialogue' | 'ink' | 'tilemap' | 'physics' | 'filters' | 'viewport';

export interface CreativeBeat {
  readonly id: string;
  readonly purpose: string;
}

export interface CreativeBriefV1 {
  readonly schemaVersion: 1;
  readonly kind: CreativeKind;
  readonly genre: CreativeGenre;
  readonly language: 'ar' | 'en';
  readonly libs: readonly CreativeLib[];
  readonly mechanics: readonly string[];
  readonly beats: readonly CreativeBeat[];
  /** fx presets and weather kinds that fit the setting. */
  readonly effects: readonly string[];
  readonly weather: readonly string[];
  /** anim rig states the cast needs. */
  readonly animation: readonly string[];
  readonly settings: readonly string[];
  readonly cast: readonly CreativeCharacterV1[];
  readonly accessibility: readonly string[];
  readonly checks: readonly string[];
}

export interface CreativePlannerOptions {
  readonly memory?: CreativeMemoryV1;
  /** The page language when known; otherwise read from the request's script. */
  readonly lang?: string;
}

interface GenreRule {
  readonly genre: CreativeGenre;
  readonly kind: CreativeKind;
  readonly keywords: readonly string[];
  readonly libs: readonly CreativeLib[];
  readonly mechanics: readonly string[];
  readonly effects: readonly string[];
  readonly animation: readonly string[];
}

/* Order matters: the first rule whose keywords match wins, most specific first. */
const GENRES: readonly [GenreRule, ...GenreRule[]] = [
  {
    genre: 'platformer',
    kind: 'game',
    keywords: [
      'platformer',
      'platform game',
      'side scroller',
      'jump and run',
      'لعبة منصات',
      'منصات',
      'لعبة قفز',
      'ماريو',
    ],
    libs: ['tilemap', 'anim', 'fx'],
    mechanics: [
      'run and jump with gravity, coyote time and a jump buffer (world.move + onGround)',
      'collect pickups found with world.find and cleared with world.set',
      'hazards and a reachable exit; lives or a timer',
      'follow camera clamped to the level',
    ],
    effects: ['dust', 'coin', 'hit', 'levelup'],
    animation: ['idle', 'run', 'jump', 'hurt', 'celebrate'],
  },
  {
    genre: 'maze-adventure',
    kind: 'game',
    keywords: [
      'maze',
      'dungeon',
      'top down',
      'top-down',
      'rpg',
      'adventure game',
      'treasure hunt',
      'متاهة',
      'زنزانة',
      'لعبة مغامرة',
      'مغامرات',
      'البحث عن الكنز',
      'كنز',
    ],
    libs: ['tilemap', 'anim', 'fx', 'dialogue'],
    mechanics: [
      'grid or free movement blocked by solid tiles',
      'keys, doors and treasure placed with legend markers',
      'a character to talk to with one meaningful choice',
      'win on reaching the goal; restart resets the map',
    ],
    effects: ['sparkle', 'coin', 'magic'],
    animation: ['idle', 'walk', 'talk', 'celebrate'],
  },
  {
    genre: 'visual-novel',
    kind: 'story',
    keywords: [
      'visual novel',
      'branching story',
      'branching',
      'choose your own',
      'dialogue',
      'dialog',
      'conversation',
      'رواية مرئية',
      'قصة متفرعة',
      'قصة بخيارات',
      'خيارات',
      'اختيارات',
      'حوار',
      'حوارات',
      'محادثة',
    ],
    libs: ['dialogue', 'anim', 'fx'],
    mechanics: [
      'dialogue graph with speakers from the cast and a polite live region',
      'at least two meaningful choices that set variables',
      'two or more endings decided by those variables',
      'save/restore and replay',
    ],
    effects: ['sparkle', 'magic'],
    animation: ['idle', 'talk', 'think', 'wave', 'celebrate'],
  },
  {
    genre: 'picture-book',
    kind: 'story',
    keywords: [
      'picture book',
      'bedtime story',
      'fairy tale',
      'children story',
      'kids story',
      'for kids',
      'for children',
      'قصة أطفال',
      'قصص أطفال',
      'للأطفال',
      'حكاية',
      'حكايات',
      'قبل النوم',
      'خرافية',
    ],
    libs: ['dialogue', 'anim', 'fx'],
    mechanics: [
      'large readable pages with one idea each',
      'gentle choices or tap-to-discover moments',
      'narration plus short character lines',
      'a warm ending and replay',
    ],
    effects: ['sparkle', 'magic', 'heal'],
    animation: ['idle', 'wave', 'talk', 'celebrate'],
  },
  {
    genre: 'chapter-story',
    kind: 'story',
    keywords: [
      'interactive story',
      'playable story',
      'visual narrative',
      'chapter scene',
      'story',
      'قصة تفاعلية',
      'قصص تفاعلية',
      'قصة بصرية',
      'مشاهد قصصية',
      'قصة',
    ],
    libs: ['dialogue', 'anim', 'fx'],
    mechanics: [
      's.story chapters or a dialogue graph with manual navigation',
      'one discovery or choice that changes what follows',
      'a clear ending and replay',
    ],
    effects: ['sparkle'],
    animation: ['idle', 'walk', 'talk'],
  },
  {
    genre: 'physics-toy',
    kind: 'game',
    keywords: ['physics', 'bounce', 'stack', 'catapult', 'pinball', 'فيزياء', 'ارتداد', 'مقلاع'],
    libs: ['physics', 'fx', 'anim'],
    mechanics: [
      'Matter bodies stepped in s.fixedTick',
      'aim or drag input with a keyboard alternative',
      'score and reset',
    ],
    effects: ['hit', 'dust', 'confetti'],
    animation: ['idle', 'celebrate'],
  },
  {
    genre: 'puzzle',
    kind: 'game',
    keywords: [
      'puzzle',
      'match three',
      'memory game',
      'matching game',
      'sliding puzzle',
      'لغز',
      'ألغاز',
      'لعبة ذاكرة',
      'مطابقة',
    ],
    libs: ['anim', 'fx'],
    mechanics: [
      'a grid of focusable pieces',
      'clear win condition and move counter',
      'hint and restart',
    ],
    effects: ['sparkle', 'confetti', 'hit'],
    animation: ['idle', 'celebrate', 'think'],
  },
  {
    genre: 'arcade',
    kind: 'game',
    keywords: [
      'game',
      'arcade',
      'runner',
      'endless',
      'shooter',
      'space game',
      'racing',
      'collect',
      'لعبة',
      'ألعاب',
      'سباق',
      'سيارات',
      'فضاء',
      'جمع',
    ],
    libs: ['anim', 'fx'],
    mechanics: [
      'objective, controls and ready/running/paused/won/lost states',
      'difficulty that rises over time',
      'score, lives or a timer in the DOM status',
    ],
    effects: ['hit', 'coin', 'explosion', 'sparkle'],
    animation: ['idle', 'run', 'hurt', 'celebrate'],
  },
  {
    genre: 'mural',
    kind: 'scene',
    keywords: [
      'mural',
      'generative art',
      'scene',
      'animated background',
      'جدارية',
      'جداريات',
      'فن توليدي',
      'مشهد',
    ],
    libs: ['fx', 'anim'],
    mechanics: [
      'one focal area and depth layers',
      'ambient motion through s.tick',
      'a complete still frame for reduced motion',
    ],
    effects: [],
    animation: [],
  },
];

/** A brief that names no genre is an art-directed scene. */
const FALLBACK_GENRE: GenreRule = GENRES.find(({ genre }) => genre === 'mural') ?? GENRES[0];

interface SettingRule {
  readonly id: string;
  readonly keywords: readonly string[];
  readonly weather: readonly string[];
  readonly effects: readonly string[];
}

const SETTINGS: readonly SettingRule[] = [
  {
    id: 'forest',
    keywords: ['forest', 'woods', 'jungle', 'garden', 'غابة', 'غابات', 'حديقة', 'أشجار'],
    weather: ['leaves', 'fireflies'],
    effects: ['sparkle'],
  },
  {
    id: 'sea',
    keywords: [
      'sea',
      'ocean',
      'underwater',
      'beach',
      'river',
      'بحر',
      'محيط',
      'تحت الماء',
      'شاطئ',
      'نهر',
    ],
    weather: ['bubbles'],
    effects: ['splash'],
  },
  {
    id: 'desert',
    keywords: ['desert', 'sand', 'dunes', 'صحراء', 'رمال', 'كثبان'],
    weather: ['embers'],
    effects: ['dust'],
  },
  {
    id: 'winter',
    keywords: ['winter', 'snow', 'ice', 'frozen', 'شتاء', 'ثلج', 'ثلوج', 'جليد'],
    weather: ['snow'],
    effects: ['sparkle'],
  },
  {
    id: 'rain',
    keywords: ['rain', 'storm', 'rainy', 'مطر', 'أمطار', 'عاصفة', 'ممطر'],
    weather: ['rain'],
    effects: ['splash'],
  },
  {
    id: 'night',
    keywords: [
      'night',
      'stars',
      'moon',
      'space',
      'galaxy',
      'ليل',
      'ليلة',
      'نجوم',
      'قمر',
      'فضاء',
      'مجرة',
    ],
    weather: ['stars'],
    effects: ['sparkle'],
  },
  {
    id: 'fire',
    keywords: ['fire', 'volcano', 'dragon', 'lava', 'نار', 'بركان', 'تنين', 'حمم'],
    weather: ['embers'],
    effects: ['fire', 'explosion'],
  },
  {
    id: 'magic',
    keywords: [
      'magic',
      'wizard',
      'fairy',
      'spell',
      'enchanted',
      'سحر',
      'سحري',
      'ساحر',
      'جنية',
      'تعويذة',
    ],
    weather: ['fireflies'],
    effects: ['magic', 'sparkle'],
  },
  {
    id: 'city',
    keywords: ['city', 'street', 'town', 'مدينة', 'شارع', 'حارة'],
    weather: [],
    effects: ['dust'],
  },
];

const ARABIC = /[؀-ۿ]/u;

/* Names the brief gives: "named Layla", "called Omar", "اسمه عمر", "اسمها ليلى", «ليلى». */
/*
  The Arabic pattern names a character after a naming verb (اسمه، يدعى) or a hero descriptor
  (بطلها، البطل). A descriptor's word is the character's kind, not its name, when a naming verb
  follows it: «بطلها ثعلب اسمه رومي» casts رومي, never «ثعلب». Group 1 is the named form,
  group 2 the descriptor form; positions keep the brief's own order.
*/
const NAME_PATTERNS: readonly RegExp[] = [
  /\b(?:named|called)\s+([A-Z][\p{L}'-]{1,30})/gu,
  /(?:(?:اسمه|اسمها|يدعى|تدعى|يسمى|تسمى)\s+([ء-ي]{2,20})|(?:بطلها|بطله|البطل|البطلة)\s+([ء-ي]{2,20})(?![ء-ي])(?!\s+(?:اسمه|اسمها|يدعى|تدعى|يسمى|تسمى)))/gu,
  /[«"]([\p{L}][\p{L} '-]{1,30})[»"]/gu,
];

function matches(words: ReturnType<typeof readRequestWords>, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => requestHasKeyword(words, compileKeyword(keyword)));
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

function castFromRequest(request: string): CreativeCharacterV1[] {
  const names: string[] = [];
  for (const pattern of NAME_PATTERNS) {
    for (const match of request.matchAll(pattern)) {
      const name = (match[1] ?? match[2] ?? '').trim();
      if (name !== '' && !names.includes(name)) names.push(name);
    }
  }
  return names.slice(0, 6).map((name, index) => ({
    id: creativeSlug(name),
    name,
    role: index === 0 ? 'hero' : 'supporting',
  }));
}

function beatsFor(kind: CreativeKind, genre: CreativeGenre, arabic: boolean): CreativeBeat[] {
  if (kind === 'game') {
    return [
      {
        id: 'onboard',
        purpose: arabic
          ? 'علّم الهدف والتحكم خلال أول خمس ثوانٍ'
          : 'teach the goal and controls in the first five seconds',
      },
      {
        id: 'loop',
        purpose: arabic
          ? 'حلقة لعب ممتعة: تحرك، اجمع، تجنب'
          : 'a satisfying core loop: move, collect, avoid',
      },
      {
        id: 'escalate',
        purpose: arabic ? 'صعوبة متصاعدة أو مستوى ثانٍ' : 'rising difficulty or a second section',
      },
      {
        id: 'resolve',
        purpose: arabic
          ? 'فوز أو خسارة واضحة مع إعادة كاملة'
          : 'clear win or loss with a full restart',
      },
    ];
  }
  if (kind === 'story') {
    const branching = genre === 'visual-novel' || genre === 'picture-book';
    return [
      {
        id: 'opening',
        purpose: arabic
          ? 'عرّف العالم والبطل في لقطة قوية'
          : 'introduce the world and hero in one strong image',
      },
      { id: 'inciting', purpose: arabic ? 'حدث يغيّر كل شيء' : 'an event that changes everything' },
      {
        id: 'choice',
        purpose: arabic
          ? 'اختيار له عواقب يحفظ في متغير'
          : 'a choice with consequences stored in a variable',
      },
      {
        id: 'climax',
        purpose: arabic
          ? 'ذروة تستخدم ما اختاره القارئ'
          : 'a climax that uses what the reader chose',
      },
      {
        id: 'endings',
        purpose: branching
          ? arabic
            ? 'نهايتان على الأقل وزر إعادة'
            : 'two or more endings and a replay button'
          : arabic
            ? 'نهاية مُرضية وزر إعادة'
            : 'a satisfying ending and replay',
      },
    ];
  }
  return [
    {
      id: 'focus',
      purpose: arabic
        ? 'نقطة تركيز واحدة ومساحة سلبية للنص'
        : 'one focal point and negative space for the copy',
    },
    { id: 'ambient', purpose: arabic ? 'حركة محيطية هادئة' : 'calm ambient motion' },
    {
      id: 'response',
      purpose: arabic
        ? 'استجابة لطيفة للمؤشر دون سرقة النقرات'
        : 'gentle pointer response that never steals clicks',
    },
  ];
}

const ACCESSIBILITY_EN = [
  'objective, controls and story text live in the DOM; the canvas is decoration or role=img with a label',
  'keyboard and touch controls with visible focus; number keys pick dialogue choices',
  'reduced motion: a finished still frame, manual navigation, no shake/flash/particles',
  'status changes announced politely, never every frame',
];

const ACCESSIBILITY_AR = [
  'الهدف والتحكم ونص القصة في DOM؛ اللوحة زخرفة أو role=img مع وصف',
  'تحكم بلوحة المفاتيح واللمس مع تركيز ظاهر؛ أزرار الأرقام تختار خيارات الحوار',
  'تقليل الحركة: إطار ثابت مكتمل وتنقل يدوي بلا اهتزاز أو وميض أو جسيمات',
  'إعلان التغيرات بهدوء وليس في كل إطار',
];

/** Plan a creative piece from the brief (and the story bible, when the project has one). */
export function planCreativeBrief(
  request: string,
  options: CreativePlannerOptions = {},
): CreativeBriefV1 {
  const source = typeof request === 'string' ? request.slice(0, 4000) : '';
  const words = readRequestWords(source);
  const arabic =
    options.lang !== undefined ? options.lang.toLowerCase().startsWith('ar') : ARABIC.test(source);
  const rule = GENRES.find((candidate) => matches(words, candidate.keywords)) ?? FALLBACK_GENRE;
  const settings = SETTINGS.filter((setting) => matches(words, setting.keywords));
  const memoryCast = options.memory?.characters ?? [];
  const requested = castFromRequest(source).filter(
    (character) =>
      !memoryCast.some((known) => known.id === character.id || known.name === character.name),
  );
  const libs = unique<CreativeLib>([
    ...rule.libs,
    ...(matches(words, ['ink', 'inkle', 'لغة ink']) ? (['ink', 'dialogue'] as const) : []),
    ...(matches(words, ['zoom', 'pan', 'big map', 'خريطة كبيرة', 'تكبير'])
      ? (['viewport'] as const)
      : []),
    ...(matches(words, ['glow', 'neon', 'retro', 'crt', 'توهج', 'نيون'])
      ? (['filters'] as const)
      : []),
  ]);
  const weather = unique(settings.flatMap((setting) => setting.weather)).slice(0, 2);
  const effects = unique([
    ...rule.effects,
    ...settings.flatMap((setting) => setting.effects),
  ]).slice(0, 6);
  return {
    schemaVersion: 1,
    kind: rule.kind,
    genre: rule.genre,
    language: arabic ? 'ar' : 'en',
    libs,
    mechanics: rule.mechanics,
    beats: beatsFor(rule.kind, rule.genre, arabic),
    effects,
    weather,
    animation: rule.animation,
    settings: settings.map((setting) => setting.id),
    cast: [...memoryCast, ...requested].slice(0, 8),
    accessibility: arabic ? ACCESSIBILITY_AR : ACCESSIBILITY_EN,
    checks: [
      'libs named literally in ck.scene({ libs: [...] }) and only these',
      'every tick, listener, tween, effect, dialogue view and world released through s.dispose',
      'editor (s.editor) draws a still frame and its buttons do nothing',
      'Arabic text stays whole (DOM or unsplit Text); RTL flips horizontal flow with s.dir',
      'no invented image URLs: approved assets or drawn shapes only',
    ],
  };
}

/** The brief as compact prompt text, ready for a `data` context fragment. */
export function renderCreativeBrief(brief: CreativeBriefV1): string {
  const lines = [
    `KIND: ${brief.kind} · GENRE: ${brief.genre} · LANGUAGE: ${brief.language}`,
    `LIBS: ck.scene({ libs: [${brief.libs.map((lib) => `'${lib}'`).join(', ')}] })`,
    `MECHANICS: ${brief.mechanics.join('; ')}`,
    `BEATS: ${brief.beats.map((beat) => `${beat.id} — ${beat.purpose}`).join(' → ')}`,
  ];
  if (brief.settings.length > 0) lines.push(`SETTING: ${brief.settings.join(', ')}`);
  if (brief.effects.length > 0 || brief.weather.length > 0) {
    lines.push(
      `EFFECTS: ${[...brief.effects.map((name) => `fx.emit('${name}')`), ...brief.weather.map((name) => `fx.weather('${name}')`)].join(', ')}`,
    );
  }
  if (brief.animation.length > 0) lines.push(`ANIMATE: rig states ${brief.animation.join(', ')}`);
  if (brief.cast.length > 0) {
    lines.push(
      `CAST: ${brief.cast
        .map((character) =>
          [`${character.id}=${character.name}`, character.role, character.color]
            .filter(Boolean)
            .join(' '),
        )
        .join('; ')}`,
    );
  }
  lines.push(`ACCESSIBILITY: ${brief.accessibility.join('; ')}`);
  lines.push(`CHECK: ${brief.checks.join('; ')}`);
  return lines.join('\n');
}
