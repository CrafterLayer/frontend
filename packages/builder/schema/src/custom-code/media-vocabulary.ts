/**
 * The media and motion vocabulary (media-motion DESIGN §C.2, §D.2, §E — 2026-10-06).
 *
 * Closed lists only. A tree names a curated behaviour (`data-ck-behavior`), or
 * an ENGINE MARKER the renderer resolves to a lazily loaded engine asset:
 *
 *   data-ck-timeline="<recipe>"  → the timeline engine (GSAP 3.15 today)
 *   data-ck-scene="<scene>"      → the scene engine (PixiJS 8.22 today)
 *   data-ck-lottie               → the Lottie engine (lottie-web light 5.13)
 *
 * The markers never name a vendor, so swapping an engine is replacing one asset
 * that implements the same names. Nothing here is a timing literal, a colour or
 * an address the door could not bound; every value is a name from a list below
 * (or, for `data-ck-src` and `data-ck-email`, a bounded pattern in the door).
 *
 * This module imports nothing: the tree door (`custom-code-tree.ts`) reads it,
 * and so do the media recipes, the agent tools and the shell pickers.
 */

/**
 * The media behaviours, appended to `CUSTOM_CODE_BEHAVIORS`. `lightbox` and
 * `carousel` stay in the original enum (the gallery pack runs `lightbox` as a
 * gallery of one; the carousel gains indicators and autoplay).
 */
export const CUSTOM_CODE_MEDIA_BEHAVIORS = [
  'gallery',
  'video-player',
  'bg-video',
  'embed-facade',
  'compare',
  'toggle-group',
  'mailto-form',
] as const;

export type CustomCodeMediaBehavior = (typeof CUSTOM_CODE_MEDIA_BEHAVIORS)[number];

/** Named scroll timelines (`data-ck-timeline`): the agent picks a name, a fixed runner plays it. */
export const CUSTOM_CODE_TIMELINE_RECIPES = [
  'split-reveal',
  'stagger-in',
  'pin-sequence',
  'horizontal-scroll',
  'parallax-depth',
  'scrub-scale',
  'velocity-marquee',
  // gsap-pixi additions (2026-10-08): the two plain entrances the owner asked for.
  'fade-in',
  'slide-in',
] as const;

export type CustomCodeTimelineRecipe = (typeof CUSTOM_CODE_TIMELINE_RECIPES)[number];

/** Decorative canvas scenes (`data-ck-scene`), drawn behind real HTML content. */
export const CUSTOM_CODE_SCENES = [
  'particles',
  'mesh-gradient',
  'parallax-layers',
  'mural',
  'ripple',
] as const;

export type CustomCodeScene = (typeof CUSTOM_CODE_SCENES)[number];

/** How busy a scene is (`data-ck-density`); the engine caps and halves it on weak devices. */
export const SCENE_DENSITIES = ['low', 'medium', 'high'] as const;

export type SceneDensity = (typeof SCENE_DENSITIES)[number];

/** Where a scene takes its colours (`data-ck-palette`): read from the theme tokens at mount. */
export const SCENE_PALETTES = ['theme', 'accent', 'mono'] as const;

export type ScenePalette = (typeof SCENE_PALETTES)[number];

/** The carousel's position indicator (`data-ck-indicator`). */
export const CAROUSEL_INDICATORS = ['dots', 'counter', 'none'] as const;

export type CarouselIndicator = (typeof CAROUSEL_INDICATORS)[number];

/** The two-valued switches: `data-ck-autoplay`, `data-ck-scrub`. */
export const MEDIA_SWITCH_VALUES = ['true', 'false'] as const;

/** Parallax layers (`data-ck-depth`): 1 is nearest (fastest), 3 is farthest. */
export const TIMELINE_DEPTHS = ['1', '2', '3'] as const;

export type TimelineDepth = (typeof TIMELINE_DEPTHS)[number];

/** The two sides of a toggle group (`data-ck-option`): `a` shows first (monthly), `b` second (yearly). */
export const TOGGLE_OPTIONS = ['a', 'b'] as const;

export type ToggleOption = (typeof TOGGLE_OPTIONS)[number];

/** The engine markers, each naming one lazily loaded engine. */
export const CUSTOM_CODE_ENGINE_MARKERS = ['data-ck-timeline', 'data-ck-scene', 'data-ck-lottie'] as const;

export type CustomCodeEngineMarker = (typeof CUSTOM_CODE_ENGINE_MARKERS)[number];

/** The engine kinds, in the order of their markers (the `window.ckEngines` keys, DESIGN §2.3). */
export const CUSTOM_CODE_ENGINE_KINDS = ['timeline', 'scene', 'lottie'] as const;

export type CustomCodeEngineKind = (typeof CUSTOM_CODE_ENGINE_KINDS)[number];

/** Which engine each marker loads. */
export const CUSTOM_CODE_ENGINE_OF_MARKER: Readonly<Record<CustomCodeEngineMarker, CustomCodeEngineKind>> =
  {
    'data-ck-timeline': 'timeline',
    'data-ck-scene': 'scene',
    'data-ck-lottie': 'lottie',
  };

/**
 * Params that tune a BEHAVIOUR on the same element — appended to
 * `CUSTOM_CODE_BEHAVIOR_PARAMS`, so the door refuses each one alone.
 */
export const CUSTOM_CODE_MEDIA_BEHAVIOR_PARAMS = [
  'data-ck-indicator',
  'data-ck-autoplay',
  'data-ck-email',
] as const;

/** The behaviours each media behaviour param tunes (anything else is a door problem). */
export const CUSTOM_CODE_MEDIA_BEHAVIOR_PARAM_OWNERS: Readonly<
  Record<(typeof CUSTOM_CODE_MEDIA_BEHAVIOR_PARAMS)[number], readonly string[]>
> = {
  'data-ck-indicator': ['carousel'],
  'data-ck-autoplay': ['carousel'],
  'data-ck-email': ['mailto-form'],
};

/** Params that tune an ENGINE MARKER on the same element. */
export const CUSTOM_CODE_ENGINE_PARAMS = [
  'data-ck-scrub',
  'data-ck-density',
  'data-ck-palette',
  'data-ck-src',
] as const;

export type CustomCodeEngineParam = (typeof CUSTOM_CODE_ENGINE_PARAMS)[number];

/** The marker each engine param needs beside it. */
export const CUSTOM_CODE_ENGINE_PARAM_OWNERS: Readonly<
  Record<CustomCodeEngineParam, CustomCodeEngineMarker>
> = {
  'data-ck-scrub': 'data-ck-timeline',
  'data-ck-density': 'data-ck-scene',
  'data-ck-palette': 'data-ck-scene',
  'data-ck-src': 'data-ck-lottie',
};

/**
 * Part markers: they sit on DESCENDANTS of the element that carries the
 * behaviour or recipe (`data-ck-option` inside a `toggle-group`, `data-ck-depth`
 * inside a `parallax-depth` timeline). The door admits them on any html element;
 * the runtime ignores them elsewhere.
 */
export const CUSTOM_CODE_MEDIA_PART_ATTRIBUTES = ['data-ck-option', 'data-ck-depth'] as const;

/** Every new param name (DESIGN §C.2, §D.2, §E), in one list. */
export const CUSTOM_CODE_MEDIA_PARAMS = [
  'data-ck-indicator',
  'data-ck-autoplay',
  'data-ck-option',
  'data-ck-email',
  'data-ck-scrub',
  'data-ck-depth',
  'data-ck-density',
  'data-ck-palette',
  'data-ck-src',
] as const;

export type CustomCodeMediaParam = (typeof CUSTOM_CODE_MEDIA_PARAMS)[number];

/** Every attribute this vocabulary adds to `CUSTOM_CODE_ATTRIBUTES`: the markers and the params. */
export const CUSTOM_CODE_MEDIA_ATTRIBUTES = [
  ...CUSTOM_CODE_ENGINE_MARKERS,
  ...CUSTOM_CODE_MEDIA_PARAMS,
] as const;

/**
 * Motion params a timeline recipe reuses (DESIGN §C.2): beside `data-ck-timeline`
 * they need no `data-ck-motion`. `data-ck-speed` is reused too (judged with the
 * behaviours). Trigger, once, distance and target stay CSS-preset only.
 */
export const TIMELINE_REUSED_MOTION_PARAMS = ['data-ck-ease', 'data-ck-delay', 'data-ck-stagger'] as const;

/** The tags each media behaviour may sit on (the door names the fix otherwise). */
export const CUSTOM_CODE_MEDIA_BEHAVIOR_TAGS: Readonly<
  Partial<Record<CustomCodeMediaBehavior, readonly string[]>>
> = {
  'video-player': ['figure', 'div'],
  'bg-video': ['section', 'header', 'div', 'figure'],
  'embed-facade': ['a'],
  'mailto-form': ['form'],
};

/** A name in two languages. */
export interface MediaBilingual {
  readonly ar: string;
  readonly en: string;
}

/** What a named entry is called and what it does, for pickers and the agent's catalogue. */
export interface MediaVocabularyInfo {
  readonly label: MediaBilingual;
  readonly description: MediaBilingual;
}

/** Labels and one-line descriptions for the timeline recipes (the flag-gated picker reads them). */
export const CUSTOM_CODE_TIMELINE_RECIPE_INFO: Readonly<
  Record<CustomCodeTimelineRecipe, MediaVocabularyInfo>
> = {
  'split-reveal': {
    label: { ar: 'كشف الكلمات', en: 'Split reveal' },
    description: {
      ar: 'تظهر الكلمات واحدة تلو الأخرى عند الوصول إليها',
      en: 'Words rise and fade in as they enter',
    },
  },
  'stagger-in': {
    label: { ar: 'دخول متتابع', en: 'Stagger in' },
    description: {
      ar: 'تدخل العناصر الأبناء بالتتابع أثناء التمرير',
      en: 'Direct children enter in sequence on scroll',
    },
  },
  'pin-sequence': {
    label: { ar: 'تثبيت ومراحل', en: 'Pinned steps' },
    description: {
      ar: 'يُثبَّت القسم وتظهر عناصره خطوة بخطوة مع التمرير',
      en: 'The section pins and plays its children as steps while scrolling',
    },
  },
  'horizontal-scroll': {
    label: { ar: 'تمرير أفقي', en: 'Horizontal scroll' },
    description: {
      ar: 'يُثبَّت القسم ويتحرك شريطه أفقيًا مع التمرير',
      en: 'The section pins and its track moves sideways',
    },
  },
  'parallax-depth': {
    label: { ar: 'عمق متوازٍ', en: 'Parallax depth' },
    description: {
      ar: 'تتحرك الطبقات بسرعات مختلفة حسب عمقها',
      en: 'Layers marked with a depth move at different speeds',
    },
  },
  'scrub-scale': {
    label: { ar: 'تكبير مع التمرير', en: 'Scrub scale' },
    description: {
      ar: 'تكبر الصورة أو الفيديو كلما اقترب من منتصف الشاشة',
      en: 'A media element grows as it scrolls into the centre',
    },
  },
  'velocity-marquee': {
    label: { ar: 'شريط بسرعة التمرير', en: 'Velocity marquee' },
    description: {
      ar: 'يتسارع الشريط المتحرك ويميل مع سرعة التمرير',
      en: 'The marquee speeds up and skews with scroll velocity',
    },
  },
  // gsap-pixi additions (2026-10-08)
  'fade-in': {
    label: { ar: 'ظهور تدريجي', en: 'Fade in' },
    description: {
      ar: 'يظهر العنصر بنعومة ويرتفع قليلًا عند الوصول إليه',
      en: 'The element fades in and rises slightly as it enters',
    },
  },
  'slide-in': {
    label: { ar: 'انزلاق من الجانب', en: 'Slide in' },
    description: {
      ar: 'ينزلق العنصر من جهة بداية السطر عند الوصول إليه (يعكس الاتجاه في العربية)',
      en: 'The element slides in from the start side as it enters (mirrored in RTL)',
    },
  },
};

// gsap-pixi additions (2026-10-08)
/**
 * Scenes that draw from the palette alone, so they can sit behind ANY
 * section's existing content (a registered block's root, a customCode
 * `section`): the engine adds its own layer at runtime. The image scenes
 * (`parallax-layers`, `mural`, `ripple`) need a `div` layer with img children.
 */
export const HOSTED_SCENES = ['particles', 'mesh-gradient'] as const;

export type HostedScene = (typeof HOSTED_SCENES)[number];

export function isHostedScene(value: string): value is HostedScene {
  return (HOSTED_SCENES as readonly string[]).includes(value);
}

/** Sectioning tags a hosted scene may sit on in a customCode tree (besides the classic `div` layer). */
export const SCENE_HOST_TAGS = ['section', 'header', 'main', 'article', 'aside', 'footer'] as const;

/** Labels and one-line descriptions for the scenes. */
export const CUSTOM_CODE_SCENE_INFO: Readonly<Record<CustomCodeScene, MediaVocabularyInfo>> = {
  particles: {
    label: { ar: 'جزيئات', en: 'Particles' },
    description: {
      ar: 'نقاط متصلة تتحرك بألوان الموقع',
      en: 'A field of linked dots in the brand colours',
    },
  },
  'mesh-gradient': {
    label: { ar: 'تدرج متحرك', en: 'Mesh gradient' },
    description: {
      ar: 'تدرج لوني ناعم يتموج ببطء',
      en: 'A slowly moving gradient from the palette',
    },
  },
  'parallax-layers': {
    label: { ar: 'طبقات متوازية', en: 'Parallax layers' },
    description: {
      ar: 'الصور طبقات عمق تنساب مع المؤشر والتمرير',
      en: 'The images become depth layers that drift with pointer and scroll',
    },
  },
  mural: {
    label: { ar: 'جدارية', en: 'Mural' },
    description: {
      ar: 'جدار من الصور ينساب ببطء مع تموج خفيف',
      en: 'The images tile into a slowly panning wall with a soft ripple',
    },
  },
  ripple: {
    label: { ar: 'تموج', en: 'Ripple' },
    description: {
      ar: 'تموج على الصورة عند مرور المؤشر',
      en: 'A ripple across one image under the pointer',
    },
  },
};

const MEDIA_BEHAVIOR_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_MEDIA_BEHAVIORS);
const TIMELINE_RECIPE_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_TIMELINE_RECIPES);
const SCENE_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_SCENES);
const ENGINE_MARKER_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_ENGINE_MARKERS);

/** Whether a value names a media behaviour. */
export function isCustomCodeMediaBehavior(value: string): value is CustomCodeMediaBehavior {
  return MEDIA_BEHAVIOR_SET.has(value);
}

/** Whether a value names a timeline recipe. */
export function isCustomCodeTimelineRecipe(value: string): value is CustomCodeTimelineRecipe {
  return TIMELINE_RECIPE_SET.has(value);
}

/** Whether a value names a scene. */
export function isCustomCodeScene(value: string): value is CustomCodeScene {
  return SCENE_SET.has(value);
}

/** Whether an attribute name is an engine marker. */
export function isCustomCodeEngineMarker(name: string): name is CustomCodeEngineMarker {
  return ENGINE_MARKER_SET.has(name);
}

/** The engines an attribute record asks for (`{'data-ck-scene': 'mural'}` → `['scene']`). */
export function customCodeEnginesOf(
  attributes: Readonly<Record<string, string | undefined>> | undefined,
): readonly CustomCodeEngineKind[] {
  if (attributes === undefined) return [];
  return CUSTOM_CODE_ENGINE_MARKERS.filter(
    (marker) => typeof attributes[marker] === 'string',
  ).map((marker) => CUSTOM_CODE_ENGINE_OF_MARKER[marker]);
}
