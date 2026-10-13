import type { Bilingual, StudioLibKey } from './types';

/**
 * The add-on libraries as data (creative engines, 2026-10-12).
 *
 * One entry per `STUDIO_LIB_KEYS` key except `kit` (the scene itself, described member by member
 * in `CK_API_REFERENCE`). It feeds Studio completions/hover docs and the Agent's teaching, and a
 * test holds its keys equal to the allowlist, so it cannot describe a library the runtime does
 * not load. `api` lists the entry points a script calls, spelled as written in code.
 */
export interface CkLibraryEntry {
  key: Exclude<StudioLibKey, 'kit'>;
  /** Binds to the page's one Pixi namespace (its asset loads after pixi.js). */
  pixiBound: boolean;
  /** What the library is for. */
  purpose: Bilingual;
  /** The calls a script makes, e.g. `s.lib.anim.create({ reducedMotion })`. */
  api: readonly string[];
  /** The bundled third-party package, or 'first-party'. */
  source: string;
  since: string;
}

const STUDIO = '2026-10-10';
const CREATIVE = '2026-10-12';
const GAMES = '2026-10-12';
const CHARACTERS = '2026-10-13';

export const CK_LIBRARY_REFERENCE: readonly CkLibraryEntry[] = [
  {
    key: 'filters',
    pixiBound: true,
    purpose: {
      en: 'Reviewed GPU filters: bloom, glow, CRT, glitch, god rays, shockwave, tilt-shift…',
      ar: 'مرشحات GPU مراجعة: توهج وCRT وتشويش وأشعة وموجة صدمية وغيرها.',
    },
    api: ['new s.lib.filters.GlowFilter({ … })', 'sprite.filters = [filter]'],
    source: 'pixi-filters',
    since: STUDIO,
  },
  {
    key: 'emitter',
    pixiBound: true,
    purpose: {
      en: 'Config-driven particle emitter (Pixi v8 port, eval-free paths).',
      ar: 'باعث جسيمات يعمل بالإعدادات (نسخة Pixi v8 بلا eval).',
    },
    api: ['new s.lib.emitter.Emitter(container, config)', 'emitter.update(dt)'],
    source: '@spd789562/particle-emitter (vendored)',
    since: STUDIO,
  },
  {
    key: 'physics',
    pixiBound: false,
    purpose: { en: 'Matter.js rigid-body physics.', ar: 'فيزياء الأجسام الصلبة Matter.js.' },
    api: ['s.lib.physics.Engine.create()', 'Engine.update(engine, dt * 1000)'],
    source: 'matter-js',
    since: STUDIO,
  },
  {
    key: 'brush',
    pixiBound: false,
    purpose: { en: 'Pressure-like freehand strokes.', ar: 'خطوط يدوية بضغط متغير.' },
    api: ['s.lib.brush.getStroke(points, options)'],
    source: 'perfect-freehand',
    since: STUDIO,
  },
  {
    key: 'rough',
    pixiBound: false,
    purpose: {
      en: 'Hand-drawn sketchy shapes into Graphics.',
      ar: 'أشكال مرسومة باليد داخل Graphics.',
    },
    api: ['s.lib.rough.generator()', 's.lib.rough.drawRough(graphics, drawable)'],
    source: 'roughjs',
    since: STUDIO,
  },
  {
    key: 'viewport',
    pixiBound: true,
    purpose: {
      en: 'Pan/zoom camera viewport. With ck.scene design.zoom, s.world itself is one, fitted to the design (drag, two-finger pinch, ctrl/⌘ + wheel; the page still scrolls).',
      ar: 'كاميرا تحريك وتكبير. مع design.zoom في ck.scene تصبح s.world نفسها كاميرا ملائمة للتصميم (سحب وقرص بإصبعين وعجلة مع ctrl/⌘؛ وتبقى الصفحة قابلة للتمرير).',
    },
    api: [
      "ck.scene({ libs: ['viewport'], design: { width: 2560, height: 1440, zoom: true } }) → s.world",
      'new s.lib.viewport.Viewport({ … })',
    ],
    source: 'pixi-viewport',
    since: STUDIO,
  },
  {
    key: 'anim',
    pixiBound: false,
    purpose: {
      en: 'Tweens, timelines, springs, shake, sprite-sheet states and procedural character rigs (idle, walk, run, jump, wave, talk, celebrate, hurt, think).',
      ar: 'تحريك وتسلسلات زمنية ونوابض واهتزاز وحالات صور متتابعة وهياكل شخصيات إجرائية (وقوف، مشي، ركض، قفز، تلويح، كلام، احتفال، ألم، تفكير).',
    },
    api: [
      'const anim = s.lib.anim.create({ reducedMotion: s.reducedMotion })',
      's.tick((t) => anim.update(t.dt))',
      "anim.to(target, { x: 100, 'scale.x': 1.2 }, { duration: 0.6, ease: 'outBack' })",
      'anim.timeline().to(…).call(fn).to(…, {}, "+=0.2")',
      "anim.rig({ root, body, head, armL, armR, legL, legR }, { state: 'idle', size })",
      'anim.sprite(sprite, { states: { idle: { frames, fps } } })',
      'anim.spring(target, "x").to(value)',
      'anim.shake(container, { intensity })',
    ],
    source: 'first-party',
    since: CREATIVE,
  },
  {
    key: 'fx',
    pixiBound: true,
    purpose: {
      en: 'Game-feel and atmosphere: named bursts, weather, trails, shockwave rings, flash, shake, floating text and glow pulses.',
      ar: 'إحساس اللعب والأجواء: انفجارات جاهزة وطقس ومسارات وموجات وومضات واهتزاز ونصوص طافية ونبض توهج.',
    },
    api: [
      'const fx = s.lib.fx.create(s.app, { reducedMotion: s.reducedMotion, rng: s.random })',
      's.tick((t) => fx.update(t.dt))',
      "fx.emit('coin' | 'hit' | 'magic' | 'heal' | 'smoke' | 'dust' | 'explosion' | 'confetti' | 'sparkle' | 'fire' | 'splash' | 'levelup', x, y)",
      "fx.weather('rain' | 'snow' | 'embers' | 'leaves' | 'stars' | 'fireflies' | 'bubbles', { density, wind })",
      "fx.floatText(x, y, '+10')",
      'fx.shake(container) / fx.flash() / fx.ring(x, y) / fx.trail(target) / fx.pulse(target)',
    ],
    source: 'first-party',
    since: CREATIVE,
  },
  {
    key: 'dialogue',
    pixiBound: false,
    purpose: {
      en: 'Branching dialogue with a cast, variables, eval-free conditions, endings and versioned saves, plus an accessible DOM dialogue box. Lines can live in the section tree (fromDom), where translation and editing reach them.',
      ar: 'حوار متفرّع مع طاقم شخصيات ومتغيرات وشروط آمنة ونهايات وحفظ بإصدار، مع صندوق حوار DOM سهل الوصول. يمكن أن تبقى السطور في شجرة القسم (fromDom) حيث تصلها الترجمة والتحرير.',
    },
    api: [
      'const cast = s.lib.dialogue.cast([{ id, name, color, portrait? }])',
      // creative engines (2026-10-12): words in the tree, only logic in code — <ol data-ck-dialogue
      // hidden><li data-ck-speaker data-ck-node data-ck-next data-ck-ending>…<button data-ck-next>…
      'const talk = s.lib.dialogue.create(s.lib.dialogue.fromDom(ck.root, { vars, nodes: { id: { if, set, cue, choices: [{ set }] } } }), { cast, rng: s.random })',
      'const talk = s.lib.dialogue.create({ start, vars, nodes }, { cast, rng: s.random })',
      'const box = s.lib.dialogue.view(talk, { root: ck.root, reducedMotion: s.reducedMotion, interactive: !s.editor })',
      "talk.on('line' | 'cue' | 'end' | 'change', fn)",
      'talk.save() / talk.load(save) / talk.restart()',
    ],
    source: 'first-party',
    since: CREATIVE,
  },
  {
    key: 'ink',
    pixiBound: false,
    purpose: {
      en: "inkle's Ink narrative language (compiler + runtime): write the story as Ink text and play it through the dialogue box.",
      ar: 'لغة Ink السردية (مترجم ومشغّل): اكتب القصة نصاً بلغة Ink وشغّلها في صندوق الحوار.',
    },
    api: [
      'const talk = s.lib.ink.dialogue(inkSource, { cast })',
      's.lib.dialogue.view(talk, { root: ck.root })',
      's.lib.ink.check(inkSource) → errors[]',
    ],
    source: 'inkjs',
    since: CREATIVE,
  },
  {
    key: 'tilemap',
    pixiBound: true,
    purpose: {
      en: 'Tile levels from ASCII rows and a legend: batched rendering, procedural tile styles, platformer collision, pickups and a follow camera.',
      ar: 'مستويات بلاطات من أسطر نصية ودليل رموز: رسم مجمّع وأنماط بلاط إجرائية وتصادم منصات والتقاطات وكاميرا متابعة.',
    },
    api: [
      "const world = s.lib.tilemap.world(s.app, { tileSize, rows: ['#..#'], legend: { '#': { style: 'stone', solid: true } } })",
      'world.move({ x, y, w, h }, dx, dy) → { x, y, onGround, hitX, hitY }',
      "world.find('coin') / world.overlaps(box) / world.set(col, row, '.')",
      'const cam = s.lib.tilemap.camera(layer, { world, screen: () => ({ width: s.width, height: s.height }) })',
    ],
    source: '@pixi/tilemap',
    since: CREATIVE,
  },
  {
    key: 'audio',
    pixiBound: true,
    purpose: {
      en: 'Music and sound effects owned by the scene: @pixi/sound for admitted music URLs, ZzFX presets (jump, coin, hit, explode, powerup, click, laser, blip, step, win, lose) with no files; starts on the first gesture, renders an accessible mute toggle, pauses when hidden.',
      ar: 'موسيقى ومؤثرات صوتية يملكها المشهد: @pixi/sound لروابط الموسيقى المسموحة، ومؤثرات ZzFX جاهزة (قفز، عملة، ضربة، انفجار، قوة، نقرة، ليزر، تنبيه، خطوة، فوز، خسارة) بلا ملفات؛ يبدأ مع أول تفاعل ويعرض زر كتم سهل الوصول ويتوقف عند إخفاء الصفحة.',
    },
    api: [
      'const audio = s.lib.audio.create(s)',
      "audio.sfx('coin' | 'jump' | 'hit' | … | [zzfxParams], { volume })",
      'audio.music.play(url, { loop: true, volume: 0.5, fadeMs: 800 }) / audio.music.stop({ fadeMs })',
      'audio.volume = 0.6 / audio.mute() / audio.unmute() / audio.muted',
    ],
    source: '@pixi/sound + zzfx',
    since: GAMES,
  },
  {
    key: 'gameai',
    pixiBound: false,
    purpose: {
      en: 'Enemy and NPC behaviour: yuka steering (seek, flee, arrive, pursue, evade, wander, patrol, obstacle avoidance, separation) on agents that move display objects, A* chases around tilemap walls and small state machines; seeded and bounded.',
      ar: 'سلوك الأعداء والشخصيات: توجيه yuka (ملاحقة وهروب ووصول ومطاردة وتفادٍ وتجوال ودورية وتجنّب العوائق وتباعد) لعملاء يحرّكون عناصر العرض، ومطاردة A* حول جدران الخريطة، وآلات حالة صغيرة؛ ببذرة وحدود.',
    },
    api: [
      'const ai = s.lib.gameai.create(s)',
      'const grid = ai.grid(world)',
      'const enemy = ai.agent(sprite, { x, y, speed: 110, solid: true }).chase(hero)',
      'enemy.seek(p) / flee(p) / arrive(p) / pursue(a) / evade(a) / wander() / patrol(points) / avoid() / separate() / stop()',
      "const brain = ai.fsm({ patrol: { enter, update }, chase: { … } }, 'patrol')",
      's.fixedTick((dt) => ai.update(dt))',
    ],
    source: 'yuka',
    since: GAMES,
  },
  {
    key: 'hud',
    pixiBound: true,
    purpose: {
      en: 'In-canvas game HUD from @pixi/ui: health/xp bars, sliders, buttons, check boxes, scrolling lists and score text in direction-aware corners, themed from the site tokens; every control has a keyboard/screen-reader DOM twin. Menus and forms stay DOM.',
      ar: 'واجهة لعبة داخل اللوحة من @pixi/ui: أشرطة صحة وخبرة ومنزلقات وأزرار وخانات اختيار وقوائم منزلقة ونص النقاط في زوايا تتبع اتجاه الصفحة، بألوان رموز الموقع؛ لكل عنصر نظير DOM للوحة المفاتيح وقارئ الشاشة. القوائم والنماذج تبقى DOM.',
    },
    api: [
      'const hud = s.lib.hud.create(s)',
      "const hp = hud.bar({ label: 'Health', value: 100, max: 100 }); hp.value -= 10",
      "const score = hud.text('Score 0', { corner: 'topEnd' }); score.text = 'Score 10'",
      "hud.button({ label, corner: 'bottomEnd', onPress }) / hud.slider({ label, min, max, value, onChange }) / hud.checkbox({ label, checked, onChange }) / hud.list({ label, items })",
    ],
    source: '@pixi/ui',
    since: GAMES,
  },
  {
    key: 'peeps',
    pixiBound: false,
    purpose: {
      en: 'People for stories and games: Open Peeps, hand-drawn characters by Pablo Stanley (CC0), bundled with no network. A name fixes the look (the same name always looks the same), a mood picks the face (calm, happy, surprised, sad, angry, thinking, laughing, scared, worried, tired, serious, love), and hair, skin, outfit and accessories can be art-directed. SVG, data: URLs for DOM portraits, or Pixi textures.',
      ar: 'أشخاص للقصص والألعاب: شخصيات Open Peeps المرسومة باليد لبابلو ستانلي (CC0)، مضمّنة بلا شبكة. الاسم يحدد الشكل (الاسم نفسه يبدو دائماً كما هو)، والمزاج يختار الوجه (هادئ، سعيد، مندهش، حزين، غاضب، يفكر، يضحك، خائف، قلق، متعب، جاد، محب)، ويمكن توجيه الشعر ولون البشرة والملابس والإكسسوارات. صيغة SVG أو روابط data: لصور DOM أو خامات Pixi.',
    },
    api: [
      "const people = s.lib.peeps.cast([{ id: 'layla', name: 'Layla', color: '#f59e0b', hair: 'long' }, 'Omar'])",
      "await s.lib.peeps.texture(s, { ...people.get('layla'), mood: 'happy', size: 220 }) → PIXI.Texture",
      "const faces = await s.lib.peeps.textures(s, people.get('omar')) → { calm, happy, surprised, sad, angry, thinking }",
      's.lib.dialogue.cast(people.members()) → dialogue portraits per mood (line emotion)',
      "s.lib.peeps.svg({ seed: 'Noor', mood: 'surprised', skin: 'medium', flip: true }) / s.lib.peeps.dataUrl(options)",
    ],
    source: '@dicebear/core + @dicebear/open-peeps',
    since: CHARACTERS,
  },
];

/** One library's entry, or undefined for `kit` and unknown keys. */
export function libraryEntry(key: string): CkLibraryEntry | undefined {
  return CK_LIBRARY_REFERENCE.find((entry) => entry.key === key);
}
