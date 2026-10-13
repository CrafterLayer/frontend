import type { Bilingual } from './types';

/**
 * The scene API as data (pixi-studio DESIGN.md §B.2, binding).
 *
 * It feeds the Studio's completions and hover docs, and the runtime tests in
 * the renderer and the kit assert that the real `ck` and scene objects carry
 * every `name` listed here — so this list cannot promise a member the runtime
 * does not have. Only top-level members are listed; nested ones (`s.palette.mix`,
 * `ck.sound.play`) are spelled out in their parent's signature and detail.
 */
export interface CkApiMember {
  /** `ck.<member>` or `s.<member>`. */
  name: string;
  signature: string;
  detail: Bilingual;
  /** The date the member shipped. */
  since: string;
  kind: 'property' | 'method';
}

const FREE_CODE = '2026-10-09';
const STUDIO = '2026-10-10';
const RESPONSIVE = '2026-10-13';

function member(
  name: string,
  kind: CkApiMember['kind'],
  signature: string,
  en: string,
  ar: string,
  since = STUDIO,
): CkApiMember {
  return { name, kind, signature, detail: { en, ar }, since };
}

export const CK_API_REFERENCE: readonly CkApiMember[] = [
  // ── ck: the region's handle ────────────────────────────────────────────────
  member(
    'ck.root',
    'property',
    'ck.root: HTMLElement',
    'The region element to draw inside.',
    'عنصر المنطقة الذي ترسم داخله.',
    FREE_CODE,
  ),
  member(
    'ck.editor',
    'property',
    'ck.editor: boolean',
    'True on the editor canvas: no pointer capture, no sound.',
    'صحيح داخل لوحة المحرر: لا التقاط للمؤشر ولا صوت.',
    FREE_CODE,
  ),
  member(
    'ck.reducedMotion',
    'property',
    'ck.reducedMotion: boolean',
    'The visitor asked for reduced motion: draw one finished still frame.',
    'طلب الزائر تقليل الحركة: ارسم إطاراً ثابتاً مكتملاً.',
    FREE_CODE,
  ),
  member(
    'ck.onDispose',
    'method',
    'ck.onDispose(fn: () => void): void',
    'Cleanup when the region re-runs or leaves the page.',
    'تنظيف عند إعادة تشغيل المنطقة أو إزالتها.',
    FREE_CODE,
  ),
  member(
    'ck.pixi',
    'method',
    'ck.pixi(): Promise<PIXI>',
    'The full pixi.js v8 namespace, loaded lazily.',
    'مكتبة pixi.js v8 كاملة، تُحمّل عند الطلب.',
    FREE_CODE,
  ),
  member(
    'ck.stage',
    'method',
    'ck.stage(options?): Promise<{ PIXI, app, canvas }>',
    'A ready PIXI.Application filling ck.root (low level; prefer ck.scene).',
    'تطبيق PIXI جاهز يملأ ck.root (مستوى منخفض؛ فضّل ck.scene).',
    FREE_CODE,
  ),
  member(
    'ck.params',
    'method',
    'ck.params<T>(defaults: T): T',
    'Defaults merged with the values set in the Inspector or Studio (data-ck-params); a change re-runs the region.',
    'القيم الافتراضية مدموجة مع ما ضُبط في المحرر أو الاستوديو؛ أي تغيير يعيد تشغيل المنطقة.',
  ),
  member(
    'ck.use',
    'method',
    "ck.use(...keys: ('kit'|'filters'|'emitter'|'physics'|'brush'|'rough'|'viewport'|'anim'|'fx'|'dialogue'|'ink'|'tilemap'|'audio'|'gameai'|'hud'|'peeps'|'procgen'|'gif'|'noise'|'geom'|'hex'|'color'|'lsys')[]): Promise<Record<string, unknown>>",
    'Loads add-on libraries once per page. Write the keys literally.',
    'يحمّل المكتبات الإضافية مرة واحدة للصفحة. اكتب الأسماء حرفياً.',
  ),
  member(
    'ck.scene',
    'method',
    "ck.scene({ libs?, background?, pointer?, blend?, audio?, quality?, seed?, maxFps?, design?: { width, height, fit?: 'contain'|'cover'|'width'|'height', align?: 'center'|'top'|'bottom', zoom?, maxZoom? } }): Promise<Scene>",
    'The scene API: a stage plus kit helpers and the listed libraries. Start every visual script here. design: draw in s.world at that size (stories and games: 1280×720, or 720×1280 portrait-first) and the kit scales it to every screen.',
    'واجهة المشهد: مسرح مع أدوات kit والمكتبات المذكورة. ابدأ كل سكربت مرئي من هنا. design: ارسم في s.world بهذا المقاس (القصص والألعاب: ‎1280×720‎ أو ‎720×1280‎ للطولي) وتكيّفه الأداة مع كل شاشة.',
  ),
  member(
    'ck.sound',
    'property',
    'ck.sound: { play(ref, { volume, pan, rate, bus }?): boolean; ambient(ref, { fadeMs }?): () => void; analyser(); muted; unlocked; setMuted(b); onChange(fn) }',
    'Sound, muted until the visitor turns it on. play() only on user events; never autoplay.',
    'الصوت، مكتوم حتى يشغّله الزائر. play()‎ عند أفعال المستخدم فقط؛ بلا تشغيل تلقائي.',
  ),
  member(
    'ck.lang',
    'property',
    'ck.lang: string',
    'The page language (from <html lang>).',
    'لغة الصفحة (من ‎<html lang>‎).',
  ),
  member(
    'ck.rtl',
    'property',
    'ck.rtl: boolean',
    'True when the page reads right to left.',
    'صحيح عندما تُقرأ الصفحة من اليمين لليسار.',
  ),

  // ── s: the scene ──────────────────────────────────────────────────────────
  member(
    's.PIXI',
    'property',
    's.PIXI',
    'The pixi.js namespace (Graphics, Sprite, Container, Text, Filter…).',
    'مكتبة pixi.js (Graphics وSprite وContainer وText وFilter…).',
  ),
  member(
    's.app',
    'property',
    's.app: PIXI.Application',
    'The running application.',
    'التطبيق العامل.',
  ),
  member(
    's.stage',
    'property',
    's.stage: PIXI.Container',
    'The root container (app.stage).',
    'الحاوية الجذرية (app.stage).',
  ),
  member(
    's.canvas',
    'property',
    's.canvas: HTMLCanvasElement',
    'The canvas inside the region.',
    'لوحة الرسم داخل المنطقة.',
  ),
  member(
    's.lib',
    'property',
    's.lib: { filters?, emitter?, physics?, brush?, rough?, viewport?, anim?, fx?, dialogue?, ink?, tilemap?, audio?, gameai?, hud?, peeps?, procgen?, gif?, noise?, geom?, hex?, color?, lsys? }',
    'The libraries listed in libs, by key (CK_LIBRARY_REFERENCE describes each).',
    'المكتبات المذكورة في libs، باسمها (CK_LIBRARY_REFERENCE يصف كل واحدة).',
  ),
  member(
    's.width',
    'property',
    's.width: number',
    'Live width in CSS pixels.',
    'العرض الحالي بوحدات CSS.',
  ),
  member(
    's.height',
    'property',
    's.height: number',
    'Live height in CSS pixels.',
    'الارتفاع الحالي بوحدات CSS.',
  ),
  member(
    's.dpr',
    'property',
    's.dpr: number',
    'Device pixel ratio, capped at 2.',
    'كثافة البكسل للجهاز، بحد أقصى 2.',
  ),
  member(
    's.world',
    'property',
    's.world: PIXI.Container',
    "Design mode: the container in design units, scaled and centred to fit the region on every resize (contain letterboxes with the background or theme surface; background: null keeps it clear). With design.zoom and libs: ['viewport'] it is a pixi-viewport Viewport: drag, two-finger pinch, ctrl/⌘ + wheel, clamped to the design. Without design it is s.stage.",
    "وضع التصميم: حاوية بوحدات التصميم تُكبّر وتُوسّط لتلائم المنطقة عند كل تغيير حجم (contain يملأ الهوامش بلون الخلفية أو سطح القالب؛ background: null يتركها شفافة). مع design.zoom وlibs: ['viewport'] تصبح Viewport من pixi-viewport: سحب وقرص بإصبعين وعجلة مع ctrl/⌘، محصورة في التصميم. دون design هي s.stage.",
    RESPONSIVE,
  ),
  member(
    's.design',
    'property',
    's.design: { width, height, zoom, scale, view: { x, y, width, height } } | null',
    'Design mode: the design size, CSS px per design unit (zoom included) and view, the part of design space the region shows — paint backdrops over view so the letterbox matches. null without design.',
    'وضع التصميم: مقاس التصميم، وبكسلات CSS لكل وحدة تصميم (مع التكبير)، وview الجزء الظاهر من مساحة التصميم — ارسم الخلفيات عليه لتطابق الهوامش. null دون design.',
    RESPONSIVE,
  ),
  member(
    's.compact',
    'property',
    's.compact: boolean',
    'The region is under 600 CSS px wide (a phone): stack the HUD, enlarge targets. Live on resize.',
    'المنطقة أضيق من 600 بكسل CSS (هاتف): رتّب العناصر عمودياً وكبّر الأهداف. تتحدث عند تغيير الحجم.',
    RESPONSIVE,
  ),
  member(
    's.portrait',
    'property',
    's.portrait: boolean',
    'The region is taller than wide. Live on resize.',
    'المنطقة أطول من عرضها. تتحدث عند تغيير الحجم.',
    RESPONSIVE,
  ),
  member(
    's.ui',
    'method',
    's.ui(px: number): number',
    'Design units that show as px CSS px right now: Math.max(28, s.ui(16)) keeps canvas text and hit radii readable on a phone. px itself without design.',
    'وحدات تصميم تظهر الآن بمقدار px بكسل CSS: ‏Math.max(28, s.ui(16))‏ يبقي نص اللوحة وأنصاف أقطار اللمس مقروءة على الهاتف. px نفسها دون design.',
    RESPONSIVE,
  ),
  member(
    's.params',
    'property',
    's.params: Record<string, number|string|boolean|string[]>',
    'The values ck.params merged.',
    'القيم التي دمجها ck.params.',
  ),
  member(
    's.palette',
    'property',
    's.palette: { colors: number[5]; accent; text; muted; surface; dark; hex(i); mix(a, b, t); ramp(n) }',
    'Theme colours from the site tokens; mix() blends in OKLab. params.palette overrides.',
    'ألوان القالب من رموز الموقع؛ mix()‎ تمزج في OKLab. يتجاوزها params.palette.',
  ),
  member(
    's.pointer',
    'property',
    's.pointer: { x, y, nx, ny, vx, vy, down, inside, active, onDown(fn), onUp(fn), onMove(fn) }',
    'The pointer, region-relative and passive (works with pointer:false; touch included). Design mode: x, y, vx, vy in design units; nx, ny stay 0..1 of the region.',
    'المؤشر بالنسبة للمنطقة، دون التقاط (يعمل مع pointer:false ويشمل اللمس). وضع التصميم: x وy وvx وvy بوحدات التصميم؛ nx وny تبقى 0..1 من المنطقة.',
  ),
  member(
    's.scroll',
    'property',
    's.scroll: { progress, velocity, visible }',
    'Scroll progress 0..1 through the viewport.',
    'تقدم التمرير من 0 إلى 1 عبر الشاشة.',
  ),
  member(
    's.input',
    'property',
    's.input: { down(code): boolean; axis(negativeCodes, positiveCodes): -1|0|1; set(code, held): void; clear(): void }',
    'Keyboard input only on a focused canvas; virtual keys for native touch controls. Disabled in editor, cleared when hidden.',
    'تحكّم بلوحة المفاتيح داخل اللوحة المركّز عليها فقط؛ مفاتيح افتراضية لأزرار اللمس. معطّل في المحرر ويُصفّر عند الإخفاء.',
    '2026-10-11',
  ),
  member(
    's.time',
    'property',
    's.time: { t, dt, frame }',
    'Seconds since start; dt clamped to 0.1.',
    'الثواني منذ البدء؛ dt بحد أقصى 0.1.',
  ),
  member(
    's.audio',
    'property',
    's.audio: { level, bass, mid, treble, beat, active }',
    'Audio bands, zero until the visitor unmutes (needs audio:true). Not s.lib.audio, the scene music/effects library.',
    'نطاقات الصوت، صفر حتى يلغي الزائر الكتم (يتطلب audio:true). ليست s.lib.audio مكتبة موسيقى المشهد ومؤثراته.',
  ),
  member(
    's.random',
    'method',
    's.random(): number',
    'Seeded random 0..1 (deterministic from the seed).',
    'رقم عشوائي ببذرة من 0 إلى 1 (ثابت حسب البذرة).',
  ),
  member(
    's.rand',
    'method',
    's.rand(a: number, b: number): number',
    'Seeded random between a and b.',
    'رقم عشوائي ببذرة بين a وb.',
  ),
  member(
    's.int',
    'method',
    's.int(a: number, b: number): number',
    'Seeded whole number between a and b.',
    'عدد صحيح عشوائي ببذرة بين a وb.',
  ),
  member(
    's.pick',
    'method',
    's.pick<T>(list: T[]): T',
    'A seeded pick from a list.',
    'اختيار عشوائي ببذرة من قائمة.',
  ),
  member(
    's.shuffle',
    'method',
    's.shuffle<T>(list: T[]): T[]',
    'A seeded shuffled copy.',
    'نسخة مخلوطة ببذرة.',
  ),
  member(
    's.noise2',
    'method',
    's.noise2(x: number, y: number): number',
    'Seeded 2D simplex noise, -1..1.',
    'ضجيج simplex ثنائي الأبعاد ببذرة، من ‎-1 إلى 1.',
  ),
  member(
    's.noise3',
    'method',
    's.noise3(x: number, y: number, z: number): number',
    'Seeded 3D simplex noise (use time as z).',
    'ضجيج simplex ثلاثي الأبعاد ببذرة (استخدم الزمن كبعد z).',
  ),
  member(
    's.fbm',
    'method',
    's.fbm(x: number, y: number, octaves?: number): number',
    'Fractal noise: layered simplex.',
    'ضجيج كسوري: طبقات من simplex.',
  ),
  member(
    's.poisson',
    'method',
    's.poisson(w: number, h: number, r: number, max?: number): [number, number][]',
    'Evenly spread points at least r apart.',
    'نقاط موزعة بانتظام بمسافة لا تقل عن r.',
  ),
  member(
    's.delaunay',
    'method',
    's.delaunay(points): { triangles: Uint32Array; voronoi(bounds?): number[][]; find(x, y): number }',
    'Triangulation and Voronoi cells of a point set.',
    'تثليث وخلايا فورونوي لمجموعة نقاط.',
  ),
  member(
    's.count',
    'method',
    's.count(n: number): number',
    'n scaled by the density param and the quality governor (≥ 1).',
    'العدد n مضروباً بالكثافة والجودة (لا يقل عن 1).',
  ),
  member(
    's.quality',
    'property',
    's.quality: number',
    '1, 0.75 or 0.5: steps down when the frame rate stays low.',
    '1 أو 0.75 أو 0.5: تنخفض عندما يبقى معدل الإطارات منخفضاً.',
  ),
  member(
    's.onQuality',
    'method',
    's.onQuality(fn: (q: number) => void): void',
    'Called when the quality level changes.',
    'يُستدعى عند تغيّر مستوى الجودة.',
  ),
  member(
    's.tick',
    'method',
    's.tick(fn: (time: { t, dt, frame }) => void): void',
    'Per frame, paused offscreen; under reduced motion runs ONCE, so the first frame must look finished.',
    'كل إطار، ويتوقف خارج الشاشة؛ مع تقليل الحركة يعمل مرة واحدة فقط.',
  ),
  member(
    's.still',
    'method',
    's.still(fn: () => void): void',
    'Reduced motion only: runs after the single tick.',
    'مع تقليل الحركة فقط: يعمل بعد الإطار الوحيد.',
  ),
  member(
    's.fixedTick',
    'method',
    's.fixedTick(fn: (dtSeconds: number) => void, { step?, maxSteps? }?): () => void',
    'Bounded fixed-step simulation (default 1/60 seconds, max 5 steps/frame). Off in editor/reduced motion; returns unsubscribe.',
    'محاكاة بخطوة ثابتة محدودة (افتراضياً 1/60 ثانية، 5 خطوات/إطار). تتوقف في المحرر وعند تقليل الحركة؛ تعيد دالة إلغاء.',
    '2026-10-11',
  ),
  member(
    's.story',
    'method',
    's.story(chapters: { id, enter?, leave? }[], initial?): { current; go(id); next(); back(); reset(); dispose() }',
    'Manual navigation of 1..32 unique chapters. Enters once, no autoplay or wrapping; cleaned up with the scene.',
    'تنقّل يدوي بين 1 إلى 32 فصلاً بأسماء فريدة. يبدأ مرة واحدة، بلا تشغيل تلقائي أو دوران؛ يُنظّف مع المشهد.',
    '2026-10-11',
  ),
  member(
    's.onResize',
    'method',
    's.onResize(fn: (w: number, h: number) => void): void',
    'Called when the region changes size.',
    'يُستدعى عند تغيّر حجم المنطقة.',
  ),
  member(
    's.text',
    'method',
    's.text(str: string, style?): PIXI.Text | PIXI.HTMLText',
    'Arabic-safe text: HTMLText when the string is Arabic or the page is RTL.',
    'نص آمن للعربية: HTMLText عندما يكون النص عربياً أو الصفحة من اليمين لليسار.',
  ),
  member(
    's.words',
    'method',
    's.words(str: string): string[]',
    'A safe split into words (never into letters).',
    'تقسيم آمن إلى كلمات (لا إلى حروف أبداً).',
  ),
  member(
    's.texture',
    'method',
    's.texture(url: string): Promise<PIXI.Texture>',
    'Loads an image (https, data or blob URL).',
    'يحمّل صورة (رابط https أو data أو blob).',
  ),
  member(
    's.svg',
    'method',
    's.svg(markup: string): PIXI.Graphics',
    'Graphics from SVG markup.',
    'رسومات من كود SVG.',
  ),
  member(
    's.shader',
    'method',
    's.shader(fragment: string, uniforms?): PIXI.Filter',
    "A fragment-shader filter; '#include noise' adds simplex noise; uTime, uResolution and uPointer are fed every tick.",
    "مرشح مظلل؛ '#include noise' يضيف ضجيج simplex؛ وتُحدّث uTime وuResolution وuPointer كل إطار.",
  ),
  member(
    's.rt',
    'method',
    's.rt(w?: number, h?: number): PIXI.RenderTexture',
    'A render texture for trails and feedback, destroyed on dispose.',
    'نسيج عرض للآثار والتغذية الراجعة، يُحذف عند التنظيف.',
  ),
  member(
    's.sound',
    'property',
    's.sound: CkSound',
    'The same object as ck.sound.',
    'نفس كائن ck.sound.',
  ),
  member(
    's.editor',
    'property',
    's.editor: boolean',
    'True on the editor canvas.',
    'صحيح داخل لوحة المحرر.',
  ),
  member(
    's.reducedMotion',
    'property',
    's.reducedMotion: boolean',
    'The visitor asked for reduced motion.',
    'طلب الزائر تقليل الحركة.',
  ),
  member(
    's.rtl',
    'property',
    's.rtl: boolean',
    'True when the page reads right to left.',
    'صحيح عندما تُقرأ الصفحة من اليمين لليسار.',
  ),
  member('s.lang', 'property', 's.lang: string', 'The page language.', 'لغة الصفحة.'),
  member(
    's.dir',
    'property',
    's.dir: 1 | -1',
    '1 for left-to-right, -1 for right-to-left: multiply horizontal flow by it.',
    '1 لليسار إلى اليمين و‎-1 لليمين إلى اليسار: اضرب به اتجاه الحركة الأفقية.',
  ),
  member(
    's.dispose',
    'method',
    's.dispose(fn: () => void): void',
    'Cleanup for what you created outside the scene (= ck.onDispose).',
    'تنظيف ما أنشأته خارج المشهد (مثل ck.onDispose).',
  ),
];

/** The members under one prefix: `apiMembersOf('ck')`, `apiMembersOf('s')`. */
export function apiMembersOf(prefix: 'ck' | 's'): readonly CkApiMember[] {
  return CK_API_REFERENCE.filter((entry) => entry.name.startsWith(`${prefix}.`));
}
