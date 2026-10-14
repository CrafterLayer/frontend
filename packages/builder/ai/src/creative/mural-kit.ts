import { libraryEntry } from '@craftkit/builder-schema';

import { compileKeyword, readRequestWords, requestHasKeyword } from '../skills/keyword-match';

import { SCENE_PRESETS, type ScenePreset } from '../scene-presets/catalog';

/*
  The mural kit in a brief (2026-10-14). The owner wants the agent to paint ANY mural a person
  imagines, not only the ready presets, and a bespoke mural written as raw geometry was slow and
  uneven. So an illustrated mural is now briefed as a short s.lib.mural composition: 'mural' joins
  the libs, and when no ready preset closely matches the subject the brief carries the kit's
  mechanics and its whole vocabulary (from the schema's library reference, the one source).

  "Closely" is deliberately strict: a ready preset is offered only when the brief shares at least
  two subject words with it (its id, its English or Arabic name, its subject tags), or names it.
  One shared word ("coral" in differential-growth-coral, "aurora", "city") is not a match: that
  is how a coral-reef request ended up as an abstract growth pattern. Abstract and generative
  murals (flow fields, mosaics, type) keep their preset-first brief: the kit draws pictures.
*/

/** Words that make a mural abstract or typographic rather than an illustrated picture. */
export const ABSTRACT_MURAL_WORDS: readonly string[] = [
  'abstract',
  'generative',
  'pattern',
  'patterns',
  'geometric',
  'particles',
  'flow field',
  'fractal',
  'voronoi',
  'mosaic',
  'contour',
  'contours',
  'topographic',
  'marbling',
  'ebru',
  'kinetic',
  'typography',
  'calligraphy',
  'lettering',
  'girih',
  'zellige',
  'mashrabiya',
  'arabesque',
  'stained glass',
  'تجريدي',
  'تجريدية',
  'توليدي',
  'زخرفة',
  'زخارف',
  'هندسية',
  'جسيمات',
  'فسيفساء',
  'خط عربي',
  'رخامي',
];

/** Presets that are pictures (the kit's peers); abstract presets never "match" a picture brief. */
const PICTURE_TAGS = new Set(['illustrated', 'illustration']);
/** Tags that say nothing about the subject. */
const PLAIN_TAGS = new Set([
  ...PICTURE_TAGS,
  'story',
  'hero',
  'background',
  'calm',
  'arabic',
  'playful',
  'generative',
]);
const PLAIN_WORDS = new Set([
  'the',
  'and',
  'with',
  'for',
  'from',
  'into',
  'mural',
  'story',
  'جدارية',
  'قصة',
]);

function wordsOf(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((word) => (/^ال[ء-ي]{3,}$/u.test(word) ? word.slice(2) : word))
      .filter((word) => word.length >= 3 && !PLAIN_WORDS.has(word)),
  );
}

function subjectWords(preset: ScenePreset): Set<string> {
  return wordsOf(
    [
      preset.id.replaceAll('-', ' '),
      preset.title.en,
      preset.title.ar,
      ...preset.tags.filter((tag) => !PLAIN_TAGS.has(tag)),
    ].join(' '),
  );
}

/**
 * The ready picture preset that closely matches a brief: named by id, or sharing at least two
 * subject words with it (English or Arabic). Undefined when none does — the brief is composed
 * with the kit. Deterministic: ties keep catalogue order.
 */
export function closeMuralPreset(brief: string): ScenePreset | undefined {
  const text = brief.toLowerCase();
  const named = SCENE_PRESETS.find(
    ({ id, tags }) => tags.some((tag) => PICTURE_TAGS.has(tag)) && text.includes(id),
  );
  if (named !== undefined) return named;
  const asked = wordsOf(brief);
  // A ready backdrop named by its own lead word and nothing else to draw ("a calm aurora mural")
  // is the one asked for (2026-10-14); "an aurora over a snowy village" is a picture for the kit,
  // and a later word never counts (a coral reef is not differential-growth-coral).
  const lead = SCENE_PRESETS.find(({ id }) => {
    const word = id.split('-')[0] ?? '';
    return word.length >= 5 && asked.has(word);
  });
  const leadWord = lead?.id.split('-')[0] ?? '';
  if (lead !== undefined && !namesPicture(brief.replace(new RegExp(leadWord, 'giu'), ' ')))
    return lead;
  let best: ScenePreset | undefined;
  let score = 1;
  for (const preset of SCENE_PRESETS) {
    if (!preset.tags.some((tag) => PICTURE_TAGS.has(tag))) continue;
    let shared = 0;
    for (const word of subjectWords(preset)) if (asked.has(word)) shared += 1;
    if (shared > score) [best, score] = [preset, shared];
  }
  return best;
}

/** What a brief composed with the kit carries: the call, the spec shape, the whole vocabulary. */
export function muralKitMechanics(): readonly string[] {
  const api = libraryEntry('mural')?.api ?? [];
  const vocabulary = api.filter((line) => /^(?:sky|plants|creatures|beat):/u.test(line));
  return [
    "compose with s.lib.mural, the default for any illustrated mural no ready preset matches: ck.scene({libs:['mural','anim'],seed,design:{width:1280,height:720,fit:'cover'}}) then const m=s.lib.mural.compose(s,spec) — a 1-3k-character spec (width, mood, time arc, layers sky/far/mid/near/front of items, a cast with ids, 3-5 beats, mode 'loop' or 'scrub'), never thousands of characters of hand-written geometry; read m.warnings; extra Graphics go in m.layer('near')",
    `mural kit vocabulary — ${vocabulary.join(' · ')}`,
  ];
}

/** The line a brief carries when a ready preset closely matches its subject. */
export function closePresetMechanics(preset: ScenePreset): string {
  return `the ready preset ${preset.id} closely matches this subject: scene.preset ${preset.id} (or compose with s.lib.mural for a different picture)`;
}

/** Picture subjects beyond the item names: places, seasons, occasions, journeys (English, Arabic). */
const SUBJECT_WORDS: readonly string[] = [
  'reef',
  'ocean',
  'underwater',
  'space',
  'galaxy',
  'city',
  'town',
  'village',
  'souq',
  'market',
  'harbour',
  'harbor',
  'port',
  'farm',
  'garden',
  'park',
  'forest',
  'jungle',
  'mountain',
  'desert',
  'beach',
  'island',
  'winter',
  'summer',
  'spring',
  'autumn',
  'ramadan',
  'eid',
  'christmas',
  'skyline',
  'landscape',
  'countryside',
  'kingdom',
  'fairy tale',
  'fairy-tale',
  'journey',
  'voyage',
  'animals',
  'sunset',
  'sunrise',
  'night sky',
  'مدينة',
  'قرية',
  'سوق',
  'ميناء',
  'مزرعة',
  'حديقة',
  'غابة',
  'جبل',
  'جبال',
  'صحراء',
  'بحر',
  'شاطئ',
  'جزيرة',
  'شتاء',
  'صيف',
  'ربيع',
  'خريف',
  'رمضان',
  'عيد',
  'فضاء',
  'قمر',
  'نجوم',
  'رحلة',
  'مرجان',
  'حيوانات',
  'قلعة',
  'تنين',
  'فوانيس',
  'فانوس',
  'هلال',
  'ثلج',
  'غروب',
  'شروق',
  'سفينة',
  'قطار',
  'سيارة',
  'قافلة',
  'جمل',
  'خيل',
  'حصان',
  'طيور',
  'أسماك',
  'سمك',
  'نخيل',
];

let compiled: ReturnType<typeof compileKeyword>[] | undefined;

/** Every kit item, kind and subject word, compiled once for whole-word matching. */
function pictureKeywords(): ReturnType<typeof compileKeyword>[] {
  if (compiled !== undefined) return compiled;
  const api = libraryEntry('mural')?.api ?? [];
  const items = api
    .filter((line) => /^(?:sky|plants|creatures):/u.test(line))
    .flatMap((line) => line.split(/[^a-z]+/u))
    .filter((word) => word.length >= 3);
  compiled = [...new Set([...items, ...SUBJECT_WORDS])].map((word) => compileKeyword(word));
  return compiled;
}

/** The brief names a picture: a kit item (a tree, a camel, a castle…) or a place or occasion. */
export function namesPicture(brief: string): boolean {
  const words = readRequestWords(brief);
  return pictureKeywords().some((keyword) => requestHasKeyword(words, keyword));
}

/** Abstract, generative or typographic art: the presets and mural libraries, not the kit. */
export function isAbstractMural(brief: string): boolean {
  const words = readRequestWords(brief);
  return ABSTRACT_MURAL_WORDS.some((word) => requestHasKeyword(words, compileKeyword(word)));
}

/**
 * Whether a mural brief should be composed with s.lib.mural: it names a picture, it is not
 * abstract art, and no ready preset closely matches it. The planner and the writer's ready-scene
 * lines (agent/scene-ready.ts, owner diff) decide with this one function.
 */
export function composesWithKit(brief: string): boolean {
  return namesPicture(brief) && !isAbstractMural(brief) && closeMuralPreset(brief) === undefined;
}

/** What a scene writer is told instead of a list of unrelated ready scenes. */
export const MURAL_KIT_WRITER_LINE =
  "No ready scene closely matches this brief, so do not force one: compose it with s.lib.mural — ck.scene({libs:['mural','anim'],seed,design:{width:1280,height:720,fit:'cover'}}) then s.lib.mural.compose(s,spec), a 1-3k-character spec of layered items, a cast and 3-5 beats (the mural playbook's KIT line lists every item). It writes in seconds; keep the whole js under 3,000 characters.";

/** The same, for an edit's request (the edit lane places scenes with the scene.preset tool). */
export const MURAL_KIT_EDIT_LINE =
  "No ready scene closely matches this request: write the mural's js with s.lib.mural — ck.scene({libs:['mural','anim'],seed,design:{width:1280,height:720,fit:'cover'}}) then s.lib.mural.compose(s,spec), a 1-3k-character spec (the mural playbook's KIT line lists every item) — rather than placing an unrelated preset.";

/**
 * What a mural brief adds (the creative planner's one call): for a mural that names a picture and
 * is not abstract art, 'mural' and 'anim' in the libs, and either the kit's mechanics with its
 * vocabulary or the one ready preset that closely matches. Nothing for any other brief.
 */
export function muralKitBrief(
  mural: boolean,
  text: string,
): { libs: readonly ('mural' | 'anim')[]; mechanics: readonly string[] } {
  if (!mural || !namesPicture(text) || isAbstractMural(text)) return { libs: [], mechanics: [] };
  const ready = closeMuralPreset(text);
  return {
    libs: ['mural', 'anim'],
    mechanics: ready === undefined ? muralKitMechanics() : [closePresetMechanics(ready)],
  };
}
