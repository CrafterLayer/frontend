import type { BuilderKernel } from '@craftkit/builder-core';

import { normalizeIntentText } from '../intent/normalize-arabic';
import { heroOf } from './placement';
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
  const topic = rest.join(' ').replace(TOPIC_LEAD, '').trim();
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
    const hero = heroOf(kernel);
    if (url === undefined || hero === undefined) return undefined;
    return {
      calls: [{ name: 'media.add', input: { kind: 'video', url, mode: 'background', behind: hero } }],
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
  const hero = heroOf(kernel);
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
  const hero = heroOf(kernel);
  return {
    calls: [
      {
        name: 'media.add',
        input: {
          kind: 'scene',
          scene: 'mural',
          ...(topic === undefined || topic === '' ? {} : { images: `catalog:${topic}` }),
          ...(hero === undefined ? {} : { after: hero }),
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

/**
 * The request as one `media.add` call, or undefined. `text` is the folded
 * request; `original` the request as typed (for URLs and addresses).
 */
export function readMedia(text: string, kernel: BuilderKernel, original: string = text): MediaReading | undefined {
  return (
    readVideo(text, kernel, original) ??
    readGallery(text) ??
    readScene(text, kernel) ??
    readMural(text, kernel) ??
    readCompare(text) ??
    readMap(text, original)
  );
}
