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
    api: ['s.lib.rough.draw(graphics, shape)'],
    source: 'roughjs',
    since: STUDIO,
  },
  {
    key: 'viewport',
    pixiBound: true,
    purpose: { en: 'Pan/zoom camera viewport.', ar: 'كاميرا تحريك وتكبير.' },
    api: ['new s.lib.viewport.Viewport({ … })'],
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
      en: 'Branching dialogue with a cast, variables, eval-free conditions, endings and versioned saves, plus an accessible DOM dialogue box.',
      ar: 'حوار متفرّع مع طاقم شخصيات ومتغيرات وشروط آمنة ونهايات وحفظ بإصدار، مع صندوق حوار DOM سهل الوصول.',
    },
    api: [
      'const cast = s.lib.dialogue.cast([{ id, name, color, portrait? }])',
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
];

/** One library's entry, or undefined for `kit` and unknown keys. */
export function libraryEntry(key: string): CkLibraryEntry | undefined {
  return CK_LIBRARY_REFERENCE.find((entry) => entry.key === key);
}
