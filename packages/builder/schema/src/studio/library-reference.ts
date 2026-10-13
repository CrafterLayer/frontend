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
const MEDIA = '2026-10-13';

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
    // particles and physics (2026-10-13): thirteen tuned presets and one-line helpers on top of
    // the unchanged upstream emitter.
    purpose: {
      en: 'Config-driven particle emitter (Pixi v8 port, eval-free paths) with 13 tuned, theme-aware presets on procedural textures: fire, smoke, sparkles, snow, rain, confetti, magic, bubbles, leaves, petals, fireworks, dust, embers. Pre-warmed, frozen under reduced motion, mirrored in RTL, halved in the editor, disposed with the scene.',
      ar: 'باعث جسيمات يعمل بالإعدادات (نسخة Pixi v8 بلا eval) مع 13 إعدادًا جاهزًا متناسقًا مع ألوان السمة بأنسجة مرسومة برمجيًا: نار ودخان وبريق وثلج ومطر وقصاصات احتفال وغبار سحري وفقاعات وأوراق شجر وبتلات وألعاب نارية وغبار وجمر. يبدأ ممتلئًا، ويتجمد مع تقليل الحركة، وينعكس في RTL، ويقل في المحرر، ويُحرَّر مع المشهد.',
    },
    api: [
      "const snow = s.lib.emitter.spawn(s, 'snow' | 'rain' | 'fire' | 'embers' | …, { x, y, width, height, colors, intensity, wind, parent })",
      "s.lib.emitter.burst(s, 'confetti' | 'fireworks' | 'sparkles' | …, { x, y, count })",
      'handle.move(x, y) / handle.burst(n) / handle.stop() / handle.start() / handle.destroy()',
      's.lib.emitter.presets.fire(s, options) → config',
      'new s.lib.emitter.Emitter(new PIXI.ParticleContainer(…), config)',
      'emitter.update(dt)',
    ],
    source: '@spd789562/particle-emitter (vendored)',
    since: STUDIO,
  },
  {
    key: 'physics',
    pixiBound: false,
    purpose: {
      en: 'Matter.js rigid-body physics, plus world(s): an engine with walls fitted to the design or region, fixed-step stepping, body-to-display links, pointer drag and a settled still frame in the editor and under reduced motion.',
      ar: 'فيزياء الأجسام الصلبة Matter.js، مع world(s): محرك بجدران على قدّ التصميم أو المنطقة، وخطوات زمنية ثابتة، وربط الأجسام برسومها، وسحب بالمؤشر، وإطار ثابت مستقر في المحرر ومع تقليل الحركة.',
    },
    api: [
      "const w = s.lib.physics.world(s, { gravity, walls: true | 'box' | false, bounds, drag })",
      'w.add(Bodies.circle(x, y, r), graphics) / w.remove(body) / w.settle()',
      's.lib.physics.Engine.create()',
      'Engine.update(engine, dt * 1000)',
    ],
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
  {
    key: 'procgen',
    pixiBound: false,
    purpose: {
      en: 'Procedural levels from rot.js: dungeons of rooms and corridors, cellular caves and perfect mazes, seeded by the scene (the same seed draws the same map) and always connected, with a reachable start and exit, shortest paths, field of view and spaced scattering for pickups; rows for s.lib.tilemap.world or one Graphics in the site colours.',
      ar: 'مستويات مولّدة من rot.js: زنزانات من غرف وممرات، وكهوف خلوية، ومتاهات كاملة، ببذرة المشهد (البذرة نفسها ترسم الخريطة نفسها) ومتصلة دائماً، مع بداية ومخرج يمكن بلوغهما، وأقصر المسارات، ومجال الرؤية، وتوزيع متباعد للعناصر؛ صفوف لـ s.lib.tilemap.world أو رسم Graphics واحد بألوان الموقع.',
    },
    api: [
      "const map = s.lib.procgen.dungeon(s, { width: 48, height: 30, style: 'digger' | 'rooms' }) / .cave(s, { fill: 0.46 }) / .maze(s, { style: 'divided' | 'icey' | 'eller' })",
      "s.lib.tilemap.world(s.app, { tileSize: 24, rows: map.rows(), legend: { '#': { style: 'stone', solid: true }, p: { kind: 'player' }, e: { kind: 'exit' } } })",
      'map.draw(s, { tile: 16 }) → PIXI.Graphics on s.world in s.palette colours',
      'map.start / map.exit / map.rooms / map.path(a, b) / map.distance(a, b) / map.fov(x, y, 8).has(x, y) / map.scatter(6, { spacing: 4 }) / map.centre(cell, tile)',
    ],
    source: 'rot-js',
    since: MEDIA,
  },
  {
    key: 'gif',
    pixiBound: false,
    purpose: {
      en: 'Animated GIFs on the canvas from a URL the person supplied or approved (https:, data:image/gif, blob: — never an invented one): a PIXI.Sprite with AnimatedSprite controls, stepped by the scene’s ticker, held on its first frame under reduced motion and destroyed with the scene; long GIFs are thinned to a memory budget.',
      ar: 'صور GIF متحركة على اللوحة من رابط قدّمه الشخص أو اعتمده (https: أو data:image/gif أو blob: — لا رابط مخترع أبداً): PIXI.Sprite بأدوات تحكم AnimatedSprite، يتقدم مع مؤقت المشهد، ويثبت على إطاره الأول عند تقليل الحركة، ويُزال مع المشهد؛ وتُخفَّف إطارات الصور الطويلة لتناسب حد الذاكرة.',
    },
    api: [
      'const gif = await s.lib.gif.load(s, url, { loop: true, animationSpeed: 1, pixelated: false })',
      's.world.addChild(gif); gif.anchor.set(0.5)',
      'gif.play() / gif.stop() / gif.gotoAndStop(0) / gif.currentFrame / gif.totalFrames / gif.onLoop = fn',
      's.lib.gif.from(s, arrayBuffer) → the same from a file the person picked',
    ],
    source: 'gifuct-js',
    since: MEDIA,
  },
  {
    key: 'noise',
    pixiBound: false,
    purpose: {
      en: 'Seeded noise fields for murals in design units, beyond the kit’s s.noise2/s.fbm: simplex, Perlin, value, value-cubic and OpenSimplex2 / 2S (FastNoiseLite, vendored), Worley cells (stone, scales, cracked glaze), ridged and billowed fractals, domain warp (marbling, liquid), a seamless loop and sampled grids for s.lib.geom contours; the same seed draws the same field.',
      ar: 'حقول ضوضاء ببذرة المشهد للجداريات بوحدات التصميم، أبعد مما يعطيه s.noise2 وs.fbm: simplex وPerlin وvalue وvalue-cubic وOpenSimplex2 (من FastNoiseLite المضمّنة)، وخلايا ورلي (حجر، حراشف، تشقق الطلاء)، وكسوريات حادة ومنتفخة، وتشويه المجال (رخامي، سائل)، وحلقة بلا انقطاع، وشبكات عيّنات لخطوط s.lib.geom؛ البذرة نفسها ترسم الحقل نفسه.',
    },
    api: [
      "const n = s.lib.noise.create(s, { type: 'simplex' | 'cellular' | 'perlin' | 'value' | 'value-cubic' | 'opensimplex2' | 'opensimplex2s', fractal: 'fbm' | 'ridged' | 'billow' | 'none', scale: 240, warp: 60, cell: 'edge' | 'f1' | 'f2' | 'id' })",
      'n.at(x, y, t) / n.loop(x, y, phase) → [-1, 1]; phase 0 and 1 are the same frame',
      'const grid = n.grid({ width: 1280, height: 720, cell: 16, t }) → s.lib.geom.bands(grid, 8)',
    ],
    source: 'simplex-noise + FastNoiseLite',
    since: MEDIA,
  },
  {
    key: 'geom',
    pixiBound: false,
    purpose: {
      en: 'Mural geometry as flat polygons for Graphics.poly: terraced contour bands and isolines of any grid (d3-contour), cut, joined and clipped shapes (polybooljs), relaxed Voronoi mosaics with grout trimmed to an arch, ribbons, insets, smoothing, round, pointed or horseshoe arches, Bézier curves with offsets and tapered outlines (Bezier.js, vendored) for brush strokes and rivers, splines through or near points, rounded ring sectors laid out as pie spans (d3-shape) and stroke simplification (simplify-js).',
      ar: 'هندسة الجداريات كمضلعات مسطحة لـ Graphics.poly: أشرطة كنتور متدرجة وخطوط تساوٍ لأي شبكة (d3-contour)، وأشكال تُقص وتُدمج وتُقتطع (polybooljs)، وفسيفساء فورونوي مُرخاة بفواصل ومقصوصة على قوس، وأشرطة، وإزاحة للداخل، وتنعيم، وأقواس دائرية أو مدببة أو حدوة فرس، ومنحنيات بيزيه بخطوط موازية وحدود تضيق وتتسع (Bezier.js المضمّنة) لضربات الفرشاة والأنهار، ومنحنيات ناعمة تمر بالنقاط أو بقربها، وقطاعات حلقات مستديرة الحواف موزّعة كقطاعات دائرة (d3-shape)، وتبسيط الخطوط (simplify-js).',
    },
    api: [
      'const bands = s.lib.geom.bands(grid, 8); bands.forEach((b, i) => s.lib.geom.draw(g, b.shapes, colours[i]))',
      's.lib.geom.lines(grid, 12) → [{ value, lines: [flat polyline…] }] (no runs along the border)',
      "s.lib.geom.mosaic(s, { width: 1280, height: 720, cells: s.count(160), relax: 2, gap: 3, clip: s.lib.geom.arch(340, 60, 600, 640, 'pointed') }) → [{ tile, cell, cx, cy, tone }]",
      's.lib.geom.difference(a, b) / union / intersect / xor → rings; s.lib.geom.draw(g, rings, fill, stroke?) cuts the holes',
      's.lib.geom.ribbon(points, (t) => 30 * Math.sin(Math.PI * t)) / smooth(points, { closed, iterations }) / inset(poly, d)',
      'const c = s.lib.geom.curve([x0, y0, cx, cy, (cx2, cy2,) x1, y1]); g.poly(c.outline([4, 40]), true).fill(ink); c.points(64) / at(t) / normal(t) / project(x, y) / offset(d) / split(t)',
      "s.lib.geom.spline(points, { curve: 'catmull' | 'basis' | 'natural' | 'monotone' | 'step', closed, steps: 8 }) → a flat polyline (a ring when closed)",
      's.lib.geom.pie([3, 1, 2], { pad: 0.03, dir: s.dir }).forEach((span) => g.poly(s.lib.geom.arc({ cx: 640, cy: 360, inner: 120, outer: 220, corner: 6, ...span })).fill(colour))',
      's.lib.geom.simplify(strokePoints, 2, highQuality?) → fewer points along the same line',
    ],
    source: 'd3-contour + polybooljs + Bezier.js + d3-shape + simplify-js',
    since: MEDIA,
  },
  {
    key: 'hex',
    pixiBound: false,
    purpose: {
      en: 'Kenney’s Hexagon Pack (CC0): 28 hand-drawn hex tiles — grass, dirt, sand, mars and stone with trees, rocks, cacti and crystals, and eight buildings — bundled (nothing fetched), on a seeded pointy-top board in design units that mirrors in RTL, with palette-painted water, picking and neighbours, for map murals and hex-board games.',
      ar: 'حزمة سداسيات Kenney (CC0): ‏28 بلاطة سداسية مرسومة — عشب وتراب ورمل وأرض حمراء وحجر مع أشجار وصخور وصبار وبلورات، وثمانية مبانٍ — مضمّنة (لا تحميل من الشبكة)، على رقعة ببذرة المشهد بوحدات التصميم تنعكس في RTL، مع ماء بألوان الموقع وتحديد الخلية وجيرانها، لجداريات الخرائط وألعاب الرقع السداسية.',
    },
    api: [
      'const hex = await s.lib.hex.load(s); const board = hex.board({ cols: 9, rows: 6 }) → a seeded island on s.world',
      "hex.board({ cols, rows, size, terrain: (cell) => cell.height < -0.1 ? 'water' : 'grass' })",
      "board.at(q, r) / board.pick(x, y) / board.neighbours(q, r) / board.set(q, r, 'castle')",
      "hex.tile('windmill', 96) → PIXI.Sprite; s.lib.hex.names / terrains / buildings / credit",
    ],
    source: 'kenney-hexagon-pack (art, CC0 1.0)',
    since: MEDIA,
  },
  {
    key: 'color',
    pixiBound: false,
    purpose: {
      en: 'Perceptual colour that keeps a mural in the page palette: even OKLab / OKLCH ramps between s.palette colours, lighter-to-darker shades that keep the hue, analogous / complementary / triadic / split / tetradic harmonies, OKLab mixes, WCAG contrast and a readable pick — colours in as s.palette numbers or CSS strings, out as 0xRRGGBB for Pixi (culori).',
      ar: 'ألوان إدراكية تُبقي الجدارية ضمن ألوان الصفحة: تدرجات OKLab / OKLCH متساوية الخطوات بين ألوان s.palette، ودرجات من الفاتح إلى الداكن تحفظ الصبغة، وتناسقات متجاورة ومتكاملة وثلاثية ومنقسمة ورباعية، ومزج OKLab، وتباين WCAG واختيار لون مقروء — تدخل الألوان أرقامًا من s.palette أو نصوص CSS وتخرج 0xRRGGBB لـ Pixi (culori).',
    },
    api: [
      "const Co = s.lib.color; Co.ramp(C.surface, C.accent, 7, { space: 'oklch' }) → 7 × 0xRRGGBB; Co.ramp([c0, c1, c2], n)",
      "Co.shades(C.accent, 5) / Co.harmony(C.accent, 'analogous' | 'complementary' | 'triadic' | 'split' | 'tetradic')",
      'Co.mix(a, b, t) / Co.adjust(c, { l: 0.1, c: -0.02, h: 30 }) / Co.oklch(c) → { l, c, h }',
      'Co.contrast(a, b) → 1..21; Co.readable(C.surface, [C.text, C.accent]) → the first ≥ 4.5:1, else the best',
      "Co.toHex(c) → '#rrggbb'; Co.toNumber('oklch(0.7 0.1 200)') → 0xRRGGBB",
    ],
    source: 'culori',
    since: MEDIA,
  },
  {
    key: 'lsys',
    pixiBound: false,
    purpose: {
      en: 'L-system growth for plants, vines, ferns, arabesque scrolls and fractal patterns: seeded rewriting (lindenmayer) with weighted and context-sensitive rules, a turtle in design units that mirrors with s.dir, ready rule sets, a fit into a box, a growth animation that grows every branch at once and a stroke per branch depth; hard limits stop runaway strings.',
      ar: 'نمو أنظمة ليندنماير للنباتات والكروم والسرخس وزخارف الأرابيسك والأنماط الكسورية: إعادة كتابة ببذرة المشهد (lindenmayer) بقواعد موزونة وحساسة للسياق، وسلحفاة رسم بوحدات التصميم تنعكس مع s.dir، وقواعد جاهزة، وملاءمة داخل إطار، وتحريك نمو تنمو فيه الأغصان كلها معًا، وخط لكل عمق غصن؛ وحدود صارمة تمنع انفلات النصوص.',
    },
    api: [
      "const L = s.lib.lsys; const r = L.fit(L.grow(s, { preset: 'fern' | 'tree' | 'bush' | 'vine' | 'arabesque' | 'koch' | 'dragon' | 'hilbert', dir: s.dir }), { x, y, width, height }, { align: 'bottom' })",
      "L.grow(s, { axiom: 'X', rules: { X: [{ to: 'F[+X]FX', p: 0.6 }, 'F[-X]FX'], F: 'FF' }, iterations: 5, angle: 25, seed })",
      'L.draw(g.clear(), L.upTo(r, t), { color: [trunk, twig], width: 4, taper: 0.7 }) — t from 0 to 1 grows it',
      'r.segments [x0, y0, x1, y1, …] / r.depths / r.tips (branch ends for buds) / r.bounds / L.presets / L.limits',
    ],
    source: 'lindenmayer',
    since: MEDIA,
  },
];

/** One library's entry, or undefined for `kit` and unknown keys. */
export function libraryEntry(key: string): CkLibraryEntry | undefined {
  return CK_LIBRARY_REFERENCE.find((entry) => entry.key === key);
}
