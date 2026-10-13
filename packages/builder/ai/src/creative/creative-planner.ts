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

import { GAME_LIB_CUES } from '../skills/creative/game-cues';
import { compileKeyword, readRequestWords, requestHasKeyword } from '../skills/keyword-match';
import type { CreativeCharacterV1 } from './creative-memory';
import { creativeSlug } from './creative-memory';
import type {
  CreativeBeat,
  CreativeBriefV1,
  CreativeGenre,
  CreativeKind,
  CreativeLib,
  CreativePlannerOptions,
} from './creative-brief-types';
import { PHYSICS_CUE_WORDS, SCROLL_CUE_WORDS } from './creative-activation';
import { FALLBACK_GENRE, GENRES, SETTINGS, type GenreRule } from './creative-genres';

export type {
  CreativeBeat,
  CreativeBriefV1,
  CreativeGenre,
  CreativeKind,
  CreativeLib,
  CreativePlannerOptions,
} from './creative-brief-types';

const ARABIC = /[؀-ۿ]/u;

/* What each game library adds to the mechanics (its playbook carries the API). */
const GAME_LIB_MECHANICS: Partial<Record<CreativeLib, readonly string[]>> = {
  gameai: [
    'enemies as s.lib.gameai agents: patrol, then chase around walls (ai.grid(world) + agent.chase), caught/escaped states',
  ],
  hud: ['canvas HUD (s.lib.hud): health/xp bars and score, mirrored in the DOM status'],
  audio: [
    'sound effects for actions (s.lib.audio sfx presets), optional music from an approved URL',
  ],
  physics: ['Matter bodies stepped in s.fixedTick with Engine.update(engine, dt * 1000)'],
  peeps: [
    'people as s.lib.peeps characters: cast by name (the same name keeps its look), a mood per line or page; animals and creatures stay drawn',
  ],
  // procedural maps and animated GIFs (2026-10-13).
  procgen: [
    'the level from s.lib.procgen.maze|dungeon|cave(s,{width,height}) — always connected, start and exit reachable: map.rows() into s.lib.tilemap.world (p start, e exit) or map.draw(s,{tile}), map.scatter(n,{spacing}) for pickups and enemies, map.fov(x,y,r) for a lit radius; the scene seed fixes the layout',
  ],
  gif: [
    "the person's GIF on the canvas: await s.lib.gif.load(s,url) with their own URL only (never invent one), a Sprite that holds its first frame under reduced motion",
  ],
  // mural libraries and hex art (2026-10-13).
  noise: [
    'seeded fields from s.lib.noise.create(s,{type,fractal,scale,warp}): n.loop(x,y,phase) loops without a jump, n.grid({width,height,cell}) feeds s.lib.geom',
  ],
  geom: [
    'mural geometry from s.lib.geom: bands(grid,n) terraces, mosaic(s,{cells,gap,clip:arch(x,y,w,h)}), difference(a,b) cut-outs, ribbon(points,width) — or a ready preset (terraced-topography, ebru-marbling, mosaic-arch-window, paper-cut-landscape, ribbon-flow)',
  ],
  hex: [
    'a hex board from (await s.lib.hex.load(s)).board({cols,rows,terrain}): Kenney CC0 tiles, mirrored in RTL; board.pick(x,y) for taps, board.neighbours(q,r) for moves',
  ],
};

/* Scroll-driven pieces (creative power, 2026-10-12): the kit's s.scroll, no library. */
const SCROLL_MECHANICS = [
  's.scroll.progress moves parallax layers (far slow, near fast); the page keeps its own scroll',
];

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

const BRUSH_WORDS = ['brush', 'brushstroke', 'painted', 'watercolor', 'فرشاة', 'ألوان مائية'];
/* character art (2026-10-13): human characters bring s.lib.peeps (Open Peeps); animals do not. */
const PEOPLE_WORDS = [
  'people',
  'person',
  'boy',
  'girl',
  'man',
  'woman',
  'friends',
  'family',
  'grandma',
  'grandpa',
  'teacher',
  'avatar',
  'avatars',
  'ناس',
  'أشخاص',
  'ولد',
  'بنت',
  'رجل',
  'امرأة',
  'أصدقاء',
  'عائلة',
  'جدتي',
  'معلم',
  'معلمة',
];
const ROUGH_WORDS = ['hand drawn', 'sketchy', 'doodle', 'crayon', 'مرسوم باليد', 'رسم يدوي'];
/*
  procedural maps (2026-10-13): a generated level whenever the brief asks for one by name; a maze,
  dungeon or cave only in a game (a story set "in a cave" needs no map).
*/
const PROCGEN_WORDS = [
  'roguelike',
  'rogue like',
  'procedural',
  'procedurally',
  'dungeon crawler',
  'random level',
  'random map',
  'random maze',
  'random dungeon',
  'generated level',
  'new level every time',
  'متاهة عشوائية',
  'خريطة عشوائية',
  'مستويات عشوائية',
  'زنزانات عشوائية',
  'مولدة عشوائيا',
];
const LEVEL_WORDS = [
  'maze',
  'labyrinth',
  'dungeon',
  'cave',
  'متاهة',
  'متاهات',
  'زنزانة',
  'زنزانات',
  'كهف',
  'كهوف',
  'سرداب',
];
/* animated GIFs (2026-10-13): only when the person brings one. */
const GIF_WORDS = ['gif', 'gifs', 'giphy', 'animated gif'];
/* mural libraries (2026-10-13): contour, marbling, mosaic and cut-paper pictures; hex maps. */
const MURAL_GEOMETRY_WORDS = [
  'topographic',
  'contour',
  'contours',
  'terraced',
  'marbling',
  'marbled',
  'ebru',
  'paper cut',
  'papercut',
  'cut paper',
  'mosaic',
  'stained glass',
  'voronoi',
  'تضاريس',
  'كنتور',
  'رخامي',
  'إبرو',
  'ورق مقصوص',
  'فسيفساء',
  'زجاج معشق',
];
const HEX_WORDS = [
  'hex map',
  'hex board',
  'hex tiles',
  'hex grid',
  'hexagon map',
  'hexagon board',
  'hexagonal map',
  'خريطة سداسية',
  'رقعة سداسية',
  'بلاطات سداسية',
];

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

/** The genre rule a text names, most specific first (GENRES order); undefined when none. */
function genreOf(words: ReturnType<typeof readRequestWords>): GenreRule | undefined {
  return GENRES.find((candidate) => matches(words, candidate.keywords));
}

/*
  A section of a creative page (brief propagation, 2026-10-12): its own genre when it names one
  of another kind than the page's (a game band on a story page); the more specific of the two
  when both are the same kind (a bedtime page's "interactive story chapter scene" stays a picture
  book); the page's when it names none.
*/
function sectionRule(own: GenreRule | undefined, page: GenreRule | undefined): GenreRule {
  if (own === undefined) return page ?? FALLBACK_GENRE;
  if (own.kind !== page?.kind) return own;
  return GENRES.indexOf(own) <= GENRES.indexOf(page) ? own : page;
}

/** Plan a creative piece from the brief (and the story bible, when the project has one). */
export function planCreativeBrief(
  request: string,
  options: CreativePlannerOptions = {},
): CreativeBriefV1 {
  return briefFrom(request, undefined, options);
}

/**
 * The brief ONE section of a creative page writes from (brief propagation, 2026-10-12). A
 * section writer sees its own title and purpose, not the request, so a chapter band planned from
 * its words alone lost the cast, the setting and the genre. Here the section's words still
 * decide what it is (see `sectionRule`), and the page's request supplies the rest: its cast
 * (hero first), settings and weather, the libraries and cues it asked for. Pure; `pageRequest`
 * is the person's request for the whole page.
 */
export function creativeBriefFor(
  section: string,
  pageRequest: string,
  options: CreativePlannerOptions = {},
): CreativeBriefV1 {
  return briefFrom(section, pageRequest, options);
}

function briefFrom(
  request: string,
  pageRequest: string | undefined,
  options: CreativePlannerOptions,
): CreativeBriefV1 {
  const source = typeof request === 'string' ? request.slice(0, 4000) : '';
  const page = typeof pageRequest === 'string' ? pageRequest.slice(0, 4000) : '';
  const words = readRequestWords(source);
  const sets = page === '' ? [words] : [words, readRequestWords(page)];
  const asked = (keywords: readonly string[]): boolean =>
    sets.some((set) => matches(set, keywords));
  const arabic =
    options.lang !== undefined
      ? options.lang.toLowerCase().startsWith('ar')
      : ARABIC.test(source) || ARABIC.test(page);
  const rule =
    page === ''
      ? (genreOf(words) ?? FALLBACK_GENRE)
      : sectionRule(genreOf(words), genreOf(sets[1] ?? []));
  const settings = SETTINGS.filter((setting) => asked(setting.keywords));
  const memoryCast = options.memory?.characters ?? [];
  // The page's names first: its hero stays the hero of every chapter.
  const requested = castFromRequest(page === '' ? source : `${page}\n${source}`).filter(
    (character) =>
      !memoryCast.some((known) => known.id === character.id || known.name === character.name),
  );
  const libs = unique<CreativeLib>([
    ...rule.libs,
    ...(asked(['ink', 'inkle', 'لغة ink']) ? (['ink', 'dialogue'] as const) : []),
    ...(asked(['zoom', 'pan', 'big map', 'خريطة كبيرة', 'تكبير']) ? (['viewport'] as const) : []),
    ...(asked(['glow', 'neon', 'retro', 'crt', 'توهج', 'نيون']) ? (['filters'] as const) : []),
    // game libraries (2026-10-12): enemies, a HUD or sound only when the brief asks for them.
    ...GAME_LIB_CUES.filter((cue) => asked(cue.words)).map((cue) => cue.lib),
    // creative power (2026-10-12): bodies, brush strokes and sketchy shapes only when asked.
    ...(asked(PHYSICS_CUE_WORDS) ? (['physics'] as const) : []),
    ...(asked(BRUSH_WORDS) ? (['brush'] as const) : []),
    ...(asked(ROUGH_WORDS) ? (['rough'] as const) : []),
    ...(asked(PEOPLE_WORDS) ? (['peeps'] as const) : []),
    ...(asked(PROCGEN_WORDS) || (rule.kind === 'game' && asked(LEVEL_WORDS))
      ? (['procgen'] as const)
      : []),
    ...(asked(GIF_WORDS) ? (['gif'] as const) : []),
    ...(asked(MURAL_GEOMETRY_WORDS) ? (['noise', 'geom'] as const) : []),
    ...(asked(HEX_WORDS) ? (['hex'] as const) : []),
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
    mechanics: [
      ...rule.mechanics,
      ...libs.flatMap((lib) => (rule.libs.includes(lib) ? [] : (GAME_LIB_MECHANICS[lib] ?? []))),
      ...(asked(SCROLL_CUE_WORDS) ? SCROLL_MECHANICS : []),
    ],
    beats: beatsFor(rule.kind, rule.genre, arabic),
    effects,
    weather,
    animation: rule.animation,
    settings: settings.map((setting) => setting.id),
    cast: [...memoryCast, ...requested].slice(0, 8),
    accessibility: arabic ? ACCESSIBILITY_AR : ACCESSIBILITY_EN,
    checks: [
      ...(libs.includes('audio')
        ? [
            'sound starts on a gesture, music has the mute toggle s.lib.audio renders, no meaning by sound alone',
          ]
        : []),
      'libs named literally in ck.scene({ libs: [...] }) and only these',
      'every tick, listener, tween, effect, dialogue view and world released through s.dispose',
      'editor (s.editor) draws a still frame and its buttons do nothing',
      'Arabic text stays whole (DOM or unsplit Text); RTL flips horizontal flow with s.dir',
      'no invented image URLs: approved assets, s.lib.peeps people or drawn shapes only',
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
