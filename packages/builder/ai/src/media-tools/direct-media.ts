import type { BuilderKernel } from '@craftkit/builder-core';

import { normalizeIntentText } from '../intent/normalize-arabic';
import { liveToolContext } from '../style-tools/run-direct';
import { isElement, readTree, rootChildren, treeNodes, type TreeElementNode, type TreeRoot } from '../tools/agent/shared';
import { repeatedItemsPath } from './motion-add';
import { heroOf } from './placement';
// gsap-pixi additions (2026-10-08): registered sections (the playground's hero, features, pricing …)
import {
  alreadyAnimated,
  registeredSections,
  sectionMotionCall,
  type MotionCall,
  type RegisteredSection,
} from './registered-sections';
// end gsap-pixi additions
import { VIDEO_ADDRESS } from './resolve-video';

/**
 * Zero-token media readings (media-motion DESIGN §F.3): a request that says
 * EXACTLY one of these becomes its `media.add` call with no model —
 *
 *   «ضيف معرض صور (للمطعم)»            → gallery (catalog topic, else the page's)
 *   «… معرض صور شبكي/متداخل/سلايدر»     → that layout
 *   «حط فيديو <url>»                     → video (no address → the model asks)
 *   «فيديو خلفية للهيرو <url>»           → background video behind the hero
 *   «خلفية متحركة (بالجزيئات/تدرج)»      → particles / mesh-gradient behind the hero
 *   «جدارية (متحركة)»                    → a mural section after the hero
 *   «قبل وبعد»                           → before/after compare from the catalog
 *   «خريطة <address>»                    → map facade
 *   «ضيف انميشن للأقسام» / "animate all sections" → motion.add on every content section
 *                                          (gsap-pixi, 2026-10-08: customCode regions AND
 *                                          registered blocks, all in ONE plan = one Undo)
 *
 * — and the English of each. The text arrives folded by `normalizeIntentText`
 * (direct-tool.ts `folded`), so every rule is written once; addresses and
 * URLs are taken from the ORIGINAL request (folding lowercases a YouTube id
 * and rewrites Arabic letters in an address). Anything not read in full
 * returns undefined and the model path runs.
 */

/** The `Reading` shape of direct-tool.ts (structurally identical; that file imports this one). */
export interface MediaReading {
  readonly calls: readonly { readonly name: string; readonly input: Record<string, unknown> }[];
  readonly label: { readonly ar: string; readonly en: string };
}

const VERB_AR =
  '(?:ضيف|ضيفي|ضيفلي|اضف|اضيف|اضافه|حط|حطي|حطلي|زيد|ركب|اعمل|اعملي|سوي|سويلي|ابغي|ابي|بدي|اريد|ابغى)(?:\\s+لي)?';
// No "make" and no "the": «make the gallery masonry» edits the gallery the page has; these readings only ADD.
const VERB_EN = '(?:add|insert|put|create|include|give\\s+me)(?:\\s+(?:a|an|some))?';

const LAYOUT_WORDS: readonly (readonly [RegExp, string])[] = [
  [/^(?:شبكي|شبكيه|شبكه|grid)$/u, 'grid'],
  [/^(?:متداخل|متداخله|ماسونري|masonry)$/u, 'masonry'],
  [/^(?:سلايدر|كاروسيل|منزلق|متحرك|carousel|slider|sliding)$/u, 'carousel'],
  [/^(?:بنتو|bento)$/u, 'bento'],
  [/^(?:شريط|filmstrip|strip|marquee)$/u, 'filmstrip'],
];

/** Leading words a topic carries that are not the topic: «عن», «لل»… */
const TOPIC_LEAD = /^(?:(?:عن|من|فيه|فيها|يعرض|تعرض|of|for|with|showing|about|the)\s+)+/u;

const GALLERY_AR = new RegExp(
  `^${VERB_AR}\\s+(?:(?:ال)?(?:معرض|البوم|ألبوم)\\s+(?:ال)?صور|(?:ال)?(?:جاليري|غاليري|جالري))(?:\\s+(.+))?$`,
  'u',
);
const GALLERY_EN = new RegExp(
  `^${VERB_EN}\\s+(?:(?!(?:photo|image|picture)\\s)(\\w+)\\s+)?(?:photo\\s+|image\\s+|picture\\s+)?(?:gallery|galary|gallary|galery)(?:\\s+(.+))?$`,
  'u',
);

/** Split a gallery tail into its layout word and its topic words. */
function galleryTail(tail: string | undefined, leading?: string): { layout?: string; topic?: string } | undefined {
  const words = [...(leading === undefined ? [] : [leading]), ...(tail ?? '').split(' ').filter((word) => word !== '')];
  let layout: string | undefined;
  const rest: string[] = [];
  for (const word of words) {
    const hit = LAYOUT_WORDS.find(([pattern]) => pattern.test(word))?.[1];
    if (hit !== undefined && layout === undefined) layout = hit;
    else rest.push(word);
  }
  // fix pass (2026-10-06): «للأطباق مع عرض كبير عند الضغط» is the topic «أطباق»; the «مع …» clause asks for the lightbox every gallery has.
  const clause = rest.findIndex((word, at) => at > 0 && (word === 'مع' || word === 'with'));
  const kept = clause < 0 ? rest : rest.slice(0, clause);
  const topic = kept
    .join(' ')
    .replace(TOPIC_LEAD, '')
    .trim()
    .replace(/^(?:لل|ل(?=ال)|ب(?=ال))(?=\S{2,})/u, '')
    .replace(/^ال(?=\S{2,})/u, '');
  if (leading !== undefined && layout === undefined) return undefined; // "add a nice gallery": not ours
  return { ...(layout === undefined ? {} : { layout }), ...(topic === '' ? {} : { topic }) };
}

function readGallery(text: string): MediaReading | undefined {
  const ar = GALLERY_AR.exec(text);
  const en = ar === null ? GALLERY_EN.exec(text) : null;
  if (ar === null && en === null) return undefined;
  const parts = ar !== null ? galleryTail(ar[1]) : galleryTail(en?.[2], en?.[1]);
  if (parts === undefined) return undefined;
  return {
    calls: [
      {
        name: 'media.add',
        input: {
          kind: 'gallery',
          ...(parts.layout === undefined ? {} : { layout: parts.layout }),
          ...(parts.topic === undefined ? {} : { images: `catalog:${parts.topic}` }),
        },
      },
    ],
    label: { ar: 'أُضيف معرض صور', en: 'Gallery added' },
  };
}

// ── Video ─────────────────────────────────────────────────────────────────────

const HERO_AR = '(?:\\s+(?:لل|ل|في|ب)?\\s*(?:ال)?(?:هيرو|رئيسيه|واجهه|بانر|بنر|قسم الاول|القسم الاول))?';
const HERO_EN = '(?:\\s+(?:to|for|in|behind|on)\\s+(?:the\\s+)?(?:hero|banner|top|header)(?:\\s+section)?)?';

const VIDEO_AR = new RegExp(
  `^${VERB_AR}\\s+(?:ال)?(?:فيديو|فديو|مقطع|مقطع فيديو)(?:\\s+(?:يوتيوب|فيميو|youtube|vimeo))?(?:\\s+(?:هذا|هاد|هذا الرابط|الرابط|من))?\\s+(\\S+)$`,
  'u',
);
const VIDEO_EN = new RegExp(
  `^${VERB_EN}\\s+(?:youtube\\s+|vimeo\\s+)?video(?:\\s+(?:from|at|of))?\\s+(\\S+)$`,
  'u',
);
const BG_VIDEO_AR = new RegExp(
  `^(?:${VERB_AR}\\s+)?(?:ال)?(?:فيديو|فديو)\\s+(?:(?:ك|ل|في|ب)?\\s*(?:ال)?خلفيه)${HERO_AR}\\s+(\\S+)$`,
  'u',
);
const BG_VIDEO_EN = new RegExp(`^(?:${VERB_EN}\\s+)?(?:background|bg|hero background)\\s+video${HERO_EN}\\s+(\\S+)$`, 'u');

/**
 * The words of the ORIGINAL request that fold to `wanted`: the person's own
 * spelling of an address or a URL (case, hamza and taa marbuta intact).
 */
function originalWords(original: string, wanted: string): string | undefined {
  const words = original.normalize('NFKC').trim().split(/\s+/u);
  const count = wanted.split(' ').length;
  const fold = (value: string) => normalizeIntentText(value).replace(/[.!?,;:،؛؟]+$/u, '');
  for (let at = words.length - count; at >= 0; at -= 1) {
    const slice = words.slice(at, at + count).join(' ');
    if (fold(slice) === wanted) return slice.replace(/[.!?,;:،؛؟]+$/u, '');
  }
  return undefined;
}

function urlOf(folded: string | undefined, original: string): string | undefined {
  if (folded === undefined || !VIDEO_ADDRESS.test(folded)) return undefined;
  return originalWords(original, folded);
}

function readVideo(text: string, kernel: BuilderKernel, original: string): MediaReading | undefined {
  const background = BG_VIDEO_AR.exec(text) ?? BG_VIDEO_EN.exec(text);
  if (background !== null) {
    const url = urlOf(background[1], original);
    // gsap-pixi additions (2026-10-08): a background video needs a composed hero's layer, never a registered block.
    const hero = heroTarget(kernel);
    if (url === undefined || hero?.region !== true) return undefined;
    // end gsap-pixi additions
    return {
      calls: [{ name: 'media.add', input: { kind: 'video', url, mode: 'background', behind: hero.id } }],
      label: { ar: 'أُضيف فيديو خلفية', en: 'Background video added' },
    };
  }
  const plain = VIDEO_AR.exec(text) ?? VIDEO_EN.exec(text);
  if (plain === null) return undefined;
  const url = urlOf(plain[1], original);
  if (url === undefined) return undefined;
  return {
    calls: [{ name: 'media.add', input: { kind: 'video', url } }],
    label: { ar: 'أُضيف فيديو', en: 'Video added' },
  };
}

// gsap-pixi additions (2026-10-08)
/** The hero as the readings use it: its id, whether it is a composed region, and the root child holding it. */
interface HeroTarget {
  readonly id: string;
  readonly region: boolean;
  readonly rootChild: string;
}

function heroTarget(kernel: BuilderKernel): HeroTarget | undefined {
  const id = heroOf(kernel);
  if (id === undefined) return undefined;
  if (readTree(liveToolContext(kernel), id) !== undefined) return { id, region: true, rootChild: id };
  const section = registeredSections(kernel).find((entry) => entry.id === id);
  return { id, region: false, rootChild: section?.rootChild ?? id };
}
// end gsap-pixi additions

// ── Scenes ────────────────────────────────────────────────────────────────────

const SCENE_AR = new RegExp(
  `^(?:${VERB_AR}\\s+)?(?:ال)?خلفيه\\s+(?:ال)?(?:متحركه|متحرك|انيميشن|حيه)(?:\\s+(?:ب|من)?\\s*(?:ال)?(جزيئات|نقاط|تدرج|تدرجات|متدرجه|الوان متدرجه))?${HERO_AR}$`,
  'u',
);
const SCENE_EN = new RegExp(
  `^(?:${VERB_EN}\\s+)?(?:animated|moving|live)\\s+(?:(particles?|gradient|mesh(?:\\s+gradient)?)\\s+)?background(?:\\s+(?:with|of)\\s+(particles|a\\s+gradient|gradient|mesh))?${HERO_EN}$`,
  'u',
);
const PARTICLES_EN = new RegExp(`^(?:${VERB_EN}\\s+)?particles?(?:\\s+background)?${HERO_EN}$`, 'u');

function sceneOf(word: string | undefined): 'particles' | 'mesh-gradient' {
  return word !== undefined && /تدرج|متدرج|gradient|mesh/u.test(word) ? 'mesh-gradient' : 'particles';
}

function readScene(text: string, kernel: BuilderKernel): MediaReading | undefined {
  const ar = SCENE_AR.exec(text);
  const en = ar === null ? SCENE_EN.exec(text) : null;
  const particles = ar === null && en === null ? PARTICLES_EN.test(text) : false;
  if (ar === null && en === null && !particles) return undefined;
  // gsap-pixi additions (2026-10-08): a composed hero takes a layer, a registered hero its motion.scene (media.add decides).
  const hero = heroOf(kernel);
  // end gsap-pixi additions
  if (hero === undefined) return undefined;
  const scene = particles ? 'particles' : sceneOf(ar?.[1] ?? en?.[1] ?? en?.[2]);
  return {
    calls: [{ name: 'media.add', input: { kind: 'scene', scene, behind: hero } }],
    label: { ar: 'أُضيفت خلفية متحركة', en: 'Animated background added' },
  };
}

const MURAL_AR = new RegExp(
  `^(?:${VERB_AR}\\s+)?(?:ال)?جداريه(?:\\s+(?:ال)?(?:متحركه|صور|فنيه|حيه))?(?:\\s+(?:عن|من|لل|ل|ب)\\s*(.+))?$`,
  'u',
);
const MURAL_EN = new RegExp(`^(?:${VERB_EN}\\s+)?(?:(?:animated|moving|photo)\\s+)?(?:mural|photo\\s+wall)(?:\\s+(?:of|for|with)\\s+(.+))?$`, 'u');

function readMural(text: string, kernel: BuilderKernel): MediaReading | undefined {
  const match = MURAL_AR.exec(text) ?? MURAL_EN.exec(text);
  if (match === null) return undefined;
  const topic = match[1]?.trim();
  // gsap-pixi additions (2026-10-08): after the ROOT section holding the hero (a registered hero may sit in a surface).
  const hero = heroTarget(kernel);
  // end gsap-pixi additions
  return {
    calls: [
      {
        name: 'media.add',
        input: {
          kind: 'scene',
          scene: 'mural',
          ...(topic === undefined || topic === '' ? {} : { images: `catalog:${topic}` }),
          ...(hero === undefined ? {} : { after: hero.rootChild }),
        },
      },
    ],
    label: { ar: 'أُضيفت جدارية متحركة', en: 'Mural added' },
  };
}

// ── Widgets ───────────────────────────────────────────────────────────────────

const COMPARE_AR = new RegExp(
  `^(?:${VERB_AR}\\s+)?(?:(?:ال)?مقارنه\\s+)?(?:صور\\s+)?(?:ال)?قبل\\s+و\\s*(?:ال)?بعد(?:\\s+(?:لل|ل|عن|من)\\s*(.+))?$`,
  'u',
);
const COMPARE_EN = new RegExp(
  `^(?:${VERB_EN}\\s+)?before\\s*(?:and|&|/|-)\\s*after(?:\\s+(?:slider|comparison|compare|photos|images))?(?:\\s+(?:of|for)\\s+(.+))?$`,
  'u',
);

function readCompare(text: string): MediaReading | undefined {
  const match = COMPARE_AR.exec(text) ?? COMPARE_EN.exec(text);
  if (match === null) return undefined;
  const topic = match[1]?.trim();
  return {
    calls: [
      {
        name: 'media.add',
        input: { kind: 'compare', ...(topic === undefined || topic === '' ? {} : { images: `catalog:${topic}` }) },
      },
    ],
    label: { ar: 'أُضيفت مقارنة قبل وبعد', en: 'Before/after added' },
  };
}

const MAP_AR = new RegExp(`^(?:${VERB_AR}\\s+)?(?:ال)?خريطه(?:\\s+(?:لل|ل|عن|الى|الي|في|ب|موقعنا في|موقع))?\\s+(.+)$`, 'u');
const MAP_EN = new RegExp(`^${VERB_EN}\\s+(?:google\\s+)?map(?:\\s+(?:of|for|to|at|showing))?\\s+(.+)$`, 'u');
/** Without a verb, English needs the preposition: "map out a plan" is not a place. */
const MAP_EN_BARE = /^(?:a\s+|the\s+)?(?:google\s+)?map\s+(?:of|for|to|at|showing)\s+(.+)$/u;
/** «خريطة الموقع» is a sitemap and «خريطة ذهنية» a mind map, not places. */
const NOT_A_PLACE =
  /^(?:(?:ال)?(?:موقع|صفحه|صفحات|ذهنيه|مفاهيم|مفاهيميه|تدفق|رحله)|(?:the\s+)?(?:site|website|page|pages|sitemap|mind|concept|journey|flow|out))(?:\s|$)/u;

function readMap(text: string, original: string): MediaReading | undefined {
  const match = MAP_AR.exec(text) ?? MAP_EN.exec(text) ?? MAP_EN_BARE.exec(text);
  const folded = match?.[1]?.trim();
  if (folded === undefined || folded === '' || NOT_A_PLACE.test(folded) || folded.length > 300) return undefined;
  const address = originalWords(original, folded) ?? folded;
  return {
    calls: [{ name: 'media.add', input: { kind: 'map', address } }],
    label: { ar: 'أُضيفت خريطة', en: 'Map added' },
  };
}

// ── Motion (fix pass, 2026-10-06) ─────────────────────────────────────────────

/*
  «ضيف حركة GSAP عند التمرير لقسم المميزات» and "add a GSAP scroll reveal to
  the features" reached the model, which ignored motion.add and wrote
  `.ck-feature-item{opacity:0}` with nothing to reveal it: the section shipped
  blank. A scroll animation that names its section is ONE motion.add call:
  `stagger-in` on the section's repeated items (else its outer element),
  `split-reveal` on its heading when the request names the heading.
*/

const MOTION_AR = new RegExp(
  `^(?:${VERB_AR}\\s+)?(?:ال)?(?:حركه|حركات|انيميشن|انميشن|تحريك)(?:\\s+(?:ال)?(?:gsap|جي ساب|جيساب))?(?:\\s+(?:عند|مع|اثناء|وقت|ب)\\s*(?:ال)?(?:تمرير|سكرول|scroll|نزول))?(?:\\s+(?:gsap|جي ساب|جيساب))?(?:\\s+(?:تدريجي|تدريجيه|ظهور|دخول))?\\s+(?:(?:لل|ل|على|علي|في|ب)\\s*)?(?:(?:ال)?(?:قسم|سكشن|جزء)\\s+)?(.+)$`,
  'u',
);
const MOTION_EN = new RegExp(
  `^(?:${VERB_EN}\\s+)?(?:(?:gsap|scroll|scroll-triggered|on-scroll|entrance|fade|reveal)\\s+)*(?:reveal|reveals|animation|animations|motion|entrance|effect)(?:\\s+on\\s+scroll)?\\s+(?:to|on|for|in)\\s+(?:the\\s+)?(.+?)$`,
  'u',
);
const ANIMATE_EN = /^animate\s+(?:the\s+)?(.+?)\s+(?:on|with|while)\s+(?:scroll|scrolling)(?:\s+with\s+gsap)?$/u;

/** Concepts a section noun names, and the anchors / words a region of that kind carries. */
const SECTION_CONCEPTS: readonly { readonly words: readonly string[]; readonly anchors: readonly string[] }[] = [
  {
    words: ['مميزات', 'ميزات', 'مزايا', 'لماذا نختارنا', 'لماذا نحن', 'ليش نحن', 'ليش تختارنا', 'features', 'feature', 'why us', 'why choose us', 'benefits', 'advantages'],
    anchors: ['features', 'feature', 'why', 'why-us', 'benefits', 'advantages'],
  },
  { words: ['منيو', 'قائمه طعام', 'قائمه', 'اطباق', 'اكلات', 'مشروبات', 'menu', 'dishes'], anchors: ['menu', 'dishes'] },
  { words: ['خدمات', 'خدماتنا', 'services', 'service'], anchors: ['services', 'service'] },
  {
    words: ['اراء', 'اراء عملاء', 'تقييمات', 'شهادات', 'reviews', 'testimonials'],
    anchors: ['reviews', 'testimonials', 'testimonial'],
  },
  { words: ['من نحن', 'قصتنا', 'قصه', 'عنا', 'about', 'about us', 'story', 'our story'], anchors: ['about', 'story'] },
  { words: ['اسعار', 'باقات', 'pricing', 'prices', 'plans'], anchors: ['pricing', 'prices', 'plans'] },
  { words: ['فريق', 'فريقنا', 'team', 'our team'], anchors: ['team'] },
  { words: ['اسئله', 'اسئله شائعه', 'faq', 'faqs', 'questions'], anchors: ['faq', 'questions'] },
  { words: ['معرض', 'معرض صور', 'صور', 'gallery', 'photos'], anchors: ['gallery', 'photos'] },
  { words: ['تواصل', 'اتصل بنا', 'contact', 'contact us'], anchors: ['contact'] },
  { words: ['احصائيات', 'ارقام', 'stats', 'numbers'], anchors: ['stats', 'numbers'] },
];
const HERO_WORDS = new Set(['هيرو', 'رئيسيه', 'واجهه', 'بانر', 'بنر', 'hero', 'banner']);
const HEADING_WORD = /^(?:(?:ال)?(?:عنوان|عناوين)|(?:the\s+)?(?:heading|headline|title))(?:\s+(?:ال)?(?:رئيسي|كبير))?(?:\s+|$)/u;
const HEADING_TAIL = /\s+(?:heading|headline|title)$/u;

/** Folded, article and "section" dropped: «قسم المميزات», "the features section" and «المميزات» are one key. */
function sectionKey(text: string): string {
  return normalizeIntentText(text)
    .replace(/^(?:the\s+)/u, '')
    .replace(/\s+section$/u, '')
    .replace(/^(?:(?:ال)?(?:قسم|سكشن)\s+)/u, '')
    .split(' ')
    .map((word) => word.replace(/^(?:لل|ال)(?=\S{2,})/u, ''))
    .join(' ')
    .trim();
}

const FOLDED_CONCEPTS = SECTION_CONCEPTS.map(({ words, anchors }) => ({ words: words.map(sectionKey), anchors }));

interface Region {
  readonly id: string;
  readonly tree: TreeRoot;
  readonly keys: readonly string[];
  readonly anchor: string;
  readonly classes: string;
}

function regionsOf(kernel: BuilderKernel): readonly Region[] {
  const context = liveToolContext(kernel);
  return rootChildren(kernel).flatMap((id) => {
    const tree = readTree(context, id);
    if (tree === undefined) return [];
    const label = context.readProp(id, 'label');
    const outer = tree.children.find(isElement);
    const heading = treeNodes(tree).find((node): node is TreeElementNode => isElement(node) && /^h[1-3]$/u.test(node.tag));
    const keys = [label, heading?.text].flatMap((value) => (typeof value === 'string' && value.trim() !== '' ? [sectionKey(value)] : []));
    const anchor = typeof outer?.attributes?.['id'] === 'string' ? outer.attributes['id'].toLowerCase() : '';
    const classes = treeNodes(tree)
      .flatMap((node) => (isElement(node) && typeof node.className === 'string' ? [node.className] : []))
      .join(' ');
    return [{ id, tree, keys, anchor, classes }];
  });
}

// gsap-pixi additions (2026-10-08): a section noun names a composed region OR a registered block.
/** What a motion reading animates: a composed region, or a registered section block. */
type MotionTarget =
  | { readonly kind: 'region'; readonly region: Region }
  | { readonly kind: 'block'; readonly section: RegisteredSection };

/** The registered block types a section concept means (keyed by the concept's first anchor). */
const CONCEPT_BLOCK_TYPES: Readonly<Record<string, readonly string[]>> = {
  features: ['features'],
  reviews: ['testimonials'],
  about: ['content-section'],
  pricing: ['pricing', 'comparisonTable'],
  team: ['team'],
  faq: ['faq'],
  gallery: ['gallery', 'portfolioGrid'],
  contact: ['contact', 'formSection'],
  stats: ['stats'],
};

/** A registered section's own words: its heading and label props, folded like a section noun. */
function blockKeys(section: RegisteredSection): readonly string[] {
  return ['label', 'heading', 'headline', 'title'].flatMap((key) => {
    const value = section.props[key];
    return typeof value === 'string' && value.trim() !== '' ? [sectionKey(value)] : [];
  });
}

/** The hero as a motion target (a composed hero region, or the registered hero block). */
function heroMotionTarget(kernel: BuilderKernel): MotionTarget | undefined {
  const hero = heroOf(kernel);
  if (hero === undefined) return undefined;
  const region = regionsOf(kernel).find(({ id }) => id === hero);
  if (region !== undefined) return { kind: 'region', region };
  const section = registeredSections(kernel).find(({ id }) => id === hero);
  return section === undefined ? undefined : { kind: 'block', section };
}

/** The ONE region or registered block a section noun names (label, heading, anchor, kind or block type), or undefined. */
function targetNamed(kernel: BuilderKernel, noun: string): MotionTarget | undefined {
  const key = sectionKey(noun);
  if (key === '') return undefined;
  if (HERO_WORDS.has(key)) return heroMotionTarget(kernel);
  const regions = regionsOf(kernel);
  const blocks = registeredSections(kernel).map((section) => ({ section, keys: blockKeys(section) }));
  const asRegion = (region: Region): MotionTarget => ({ kind: 'region', region });
  const asBlock = ({ section }: { readonly section: RegisteredSection }): MotionTarget => ({ kind: 'block', section });
  const exact = [
    ...regions.filter(({ keys }) => keys.includes(key)).map(asRegion),
    ...blocks.filter(({ keys }) => keys.includes(key)).map(asBlock),
  ];
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;
  const concept = FOLDED_CONCEPTS.find(({ words }) => words.includes(key));
  if (concept === undefined) return undefined;
  const ownWords = (keys: readonly string[]) =>
    keys.some((own) => concept.words.some((word) => own === word || own.split(' ').includes(word)));
  const types = CONCEPT_BLOCK_TYPES[concept.anchors[0] ?? ''] ?? [];
  const hits = [
    ...regions
      .filter(
        ({ keys, anchor, classes }) =>
          concept.anchors.some((name) => anchor === name || anchor.startsWith(`${name}-`) || new RegExp(`(?:^|\\s)ck-${name}(?:[\\s-]|$)`, 'u').test(classes)) ||
          ownWords(keys),
      )
      .map(asRegion),
    ...blocks.filter(({ section, keys }) => types.includes(section.type) || ownWords(keys)).map(asBlock),
  ];
  return hits.length === 1 ? hits[0] : undefined;
}
// end gsap-pixi additions

/** Child indices from the tree root to `target`, or undefined. */
function pathTo(tree: TreeRoot, target: unknown): readonly number[] | undefined {
  const walk = (nodes: readonly unknown[], prefix: readonly number[]): readonly number[] | undefined => {
    for (const [index, node] of nodes.entries()) {
      const path = [...prefix, index];
      if (node === target) return path;
      if (isElement(node)) {
        const inner = walk(node.children ?? [], path);
        if (inner !== undefined) return inner;
      }
    }
    return undefined;
  };
  return walk(tree.children, []);
}

// gsap-pixi additions (2026-10-08) ────────────────────────────────────────────
/*
  «ضيف انميشن GSAP للأقسام», «حركة للأقسام», "animate all sections" and "add a
  scroll reveal to the sections" named no section, so they reached the model.
  They mean every CONTENT section: the hero's heading word by word, a list
  section's cards one by one, any other section fading in — chrome (header,
  navigation, footer, announcement bar) left still, a section already moved
  by an engine or a scroll effect left as it is. Every call is in ONE reading,
  so the plan is one transaction and one Undo.
*/
const ANIMATE_ALL_EN =
  /^animate\s+(?:(?:all\s+(?:of\s+)?(?:the\s+)?|the\s+)?sections|(?:every|each)\s+section|(?:the\s+)?(?:whole\s+|entire\s+)?(?:page|site))(?:\s+(?:on|with|while)\s+(?:scroll|scrolling))?(?:\s+with\s+gsap)?$/u;
const ALL_SECTIONS_NOUN = new RegExp(
  [
    '^(?:(?:كل|جميع)\\s+)?(?:ال)?(?:اقسام|سكاشن|سكشنات)(?:\\s+(?:ال)?(?:صفحه|موقع))?(?:\\s+(?:كلها|جميعها|كلهم))?$',
    '^(?:(?:كل|جميع)\\s+)?(?:ال)?(?:صفحه|موقع)(?:\\s+(?:كلها|كله|كامله|كامل|بالكامل))?$',
    '^(?:all\\s+(?:of\\s+)?(?:the\\s+)?)?sections(?:\\s+(?:on|of|in)\\s+(?:the\\s+|this\\s+)?(?:page|site))?$',
    '^(?:every|each)\\s+section(?:\\s+(?:on|of|in)\\s+(?:the\\s+|this\\s+)?(?:page|site))?$',
    '^(?:whole\\s+|entire\\s+)?(?:page|site)$',
  ].join('|'),
  'u',
);
const CHROME_TAGS: ReadonlySet<string> = new Set(['header', 'nav', 'footer']);
const CHROME_WORD = /^(?:ck-)?(?:nav|navbar|navigation|header|site-header|footer|site-footer|announcement(?:-bar)?|top-?bar)$/u;

function isHeadingNode(node: unknown): node is TreeElementNode {
  return isElement(node) && /^h[1-3]$/u.test(node.tag);
}

/** Whether a marquee drives the outer element or any container down to `path` (its items never stagger). */
function marqueeAlong(outer: TreeElementNode, path: readonly number[]): boolean {
  let node: unknown = outer;
  for (const index of [-1, ...path]) {
    if (index >= 0) node = isElement(node) ? node.children?.[index] : undefined;
    if (!isElement(node)) return false;
    if (node.attributes?.['data-ck-behavior'] === 'marquee') return true;
  }
  return false;
}

/** The motion.add call that animates one composed region, or undefined (chrome, already moving). */
function regionMotionCall(region: Region, hero: boolean): MotionCall | undefined {
  const outer = region.tree.children.find(isElement);
  if (outer === undefined) return undefined;
  const outerAt = region.tree.children.indexOf(outer);
  if (CHROME_TAGS.has(outer.tag)) return undefined;
  if ([...(outer.className ?? '').split(/\s+/u), region.anchor].some((word) => CHROME_WORD.test(word))) return undefined;
  if (treeNodes(region.tree).some((node) => isElement(node) && node.attributes?.['data-ck-timeline'] !== undefined)) {
    return undefined;
  }
  if (hero) {
    const nodes = treeNodes(region.tree);
    const title = nodes.find((node): node is TreeElementNode => isElement(node) && node.tag === 'h1') ?? nodes.find(isHeadingNode);
    const path = title === undefined ? undefined : pathTo(region.tree, title);
    if (path !== undefined) return { name: 'motion.add', input: { id: region.id, path, recipe: 'split-reveal' } };
  }
  const items = repeatedItemsPath(outer as unknown as Parameters<typeof repeatedItemsPath>[0]);
  if (items !== undefined && !marqueeAlong(outer, items)) {
    return { name: 'motion.add', input: { id: region.id, path: [outerAt, ...items], recipe: 'stagger-in' } };
  }
  return { name: 'motion.add', input: { id: region.id, path: [outerAt], recipe: 'fade-in' } };
}

/** Every content section of the page, composed or registered, animated in ONE reading. */
function readAllSections(kernel: BuilderKernel): MediaReading | undefined {
  const hero = heroOf(kernel);
  const regions = new Map(regionsOf(kernel).map((region) => [region.id, region]));
  const blocks = registeredSections(kernel);
  const calls: MotionCall[] = [];
  for (const id of rootChildren(kernel)) {
    const region = regions.get(id);
    if (region !== undefined) {
      const call = regionMotionCall(region, region.id === hero);
      if (call !== undefined) calls.push(call);
      continue;
    }
    for (const section of blocks) {
      if (section.rootChild !== id || alreadyAnimated(section)) continue;
      const call = sectionMotionCall(section, section.id === hero ? 'hero' : 'section');
      if (call !== undefined) calls.push(call);
    }
  }
  if (calls.length === 0) return undefined;
  return { calls, label: { ar: 'أُضيفت حركة للأقسام', en: 'Scroll animation added to the sections' } };
}
// end gsap-pixi additions

function readMotion(text: string, kernel: BuilderKernel): MediaReading | undefined {
  // gsap-pixi additions (2026-10-08): "animate all sections" names no one section
  if (ANIMATE_ALL_EN.test(text)) return readAllSections(kernel);
  // end gsap-pixi additions
  const noun = (MOTION_AR.exec(text) ?? MOTION_EN.exec(text) ?? ANIMATE_EN.exec(text))?.[1]?.trim();
  if (noun === undefined || noun === '' || noun.split(' ').length > 6) return undefined;
  // gsap-pixi additions (2026-10-08): «للأقسام», "to the sections", "to the page" → every content section
  if (ALL_SECTIONS_NOUN.test(noun)) return readAllSections(kernel);
  // end gsap-pixi additions
  const heading = HEADING_WORD.exec(noun) ?? HEADING_TAIL.exec(noun);
  const sectionNoun = heading === null ? noun : noun.replace(heading[0], ' ').trim();
  // gsap-pixi additions (2026-10-08): the noun may name a registered block (the playground's features, hero …)
  const target = sectionNoun === '' && heading !== null ? heroMotionTarget(kernel) : targetNamed(kernel, sectionNoun);
  if (target === undefined) return undefined;
  const label = { ar: 'أُضيفت حركة عند التمرير', en: 'Scroll animation added' };
  if (target.kind === 'block') {
    const call = sectionMotionCall(target.section, heading !== null ? 'heading' : 'section');
    return call === undefined ? undefined : { calls: [call], label };
  }
  const { region } = target;
  // end gsap-pixi additions
  if (heading !== null) {
    const title = treeNodes(region.tree).find((node): node is TreeElementNode => isElement(node) && /^h[1-3]$/u.test(node.tag));
    const path = title === undefined ? undefined : pathTo(region.tree, title);
    if (path === undefined) return undefined;
    return { calls: [{ name: 'motion.add', input: { id: region.id, path, recipe: 'split-reveal' } }], label };
  }
  const outer = region.tree.children.find(isElement);
  const outerAt = outer === undefined ? -1 : region.tree.children.indexOf(outer);
  if (outer === undefined || outerAt < 0) return undefined;
  const items = repeatedItemsPath(outer as unknown as Parameters<typeof repeatedItemsPath>[0]);
  return {
    calls: [{ name: 'motion.add', input: { id: region.id, path: [outerAt, ...(items ?? [])], recipe: 'stagger-in' } }],
    label,
  };
}

// ── Asking (fix pass, 2026-10-06) ─────────────────────────────────────────────

/*
  «حط فيديو تعريفي من يوتيوب» (no link) went to the model: 22,872 tokens, a
  made-up video id and a raw iframe. A video request with no address is
  answered with a question, for 0 tokens.
*/
const VIDEO_WORD = /(?:^|\s)(?:ال)?(?:فيديو|فديو|فيديوهات|مقطع|يوتيوب|فيميو|video|videos|youtube|vimeo|clip)(?:\s|$)/u;
const ADD_START = new RegExp(`^(?:${VERB_AR}|${VERB_EN})(?:\\s|$)`, 'u');
const HAS_ADDRESS = /https?:|www\.|youtu\.be|\.(?:mp4|webm|m3u8|mov)(?:\s|$)|[a-z0-9-]+\.(?:com|net|org|be|tv)\//u;
const MAX_QUESTION_WORDS = 10;

/** What to ask instead of guessing, in both languages. */
export interface MediaQuestion {
  readonly ar: string;
  readonly en: string;
}

/**
 * A media request that cannot run without something only the person has (a
 * video with no link), as the question to ask; undefined otherwise. `text`
 * is the folded request.
 */
export function askMedia(text: string): MediaQuestion | undefined {
  if (!ADD_START.test(text) || !VIDEO_WORD.test(text) || HAS_ADDRESS.test(text)) return undefined;
  if (text.split(' ').length > MAX_QUESTION_WORDS) return undefined;
  return {
    ar: 'أرسل رابط الفيديو (يوتيوب أو فيميو أو ملف ‎.mp4‎) وسأضيفه بمشغّل خفيف لا يحمّل شيئًا قبل الضغط. لا أضع فيديو من عندي.',
    en: "Send me the video link (YouTube, Vimeo or an .mp4 file) and I'll add it with a light player that loads nothing until it is pressed. I don't pick a video for you.",
  };
}

/**
 * The request as one `media.add` call, or undefined. `text` is the folded
 * request; `original` the request as typed (for URLs and addresses).
 */
export function readMedia(text: string, kernel: BuilderKernel, original: string = text): MediaReading | undefined {
  return (
    readMotion(text, kernel) ??
    readVideo(text, kernel, original) ??
    readGallery(text) ??
    readScene(text, kernel) ??
    readMural(text, kernel) ??
    readCompare(text) ??
    readMap(text, original)
  );
}
