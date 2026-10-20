import {
  DEFINITE_AR,
  DEFINITE_EN,
  INDEFINITE_EN,
  NEGATIONS,
  NOUNS,
  OBJECT_FILLERS,
  PHRASE_STOPS,
  type VerbKind,
} from './intent-lexicon';
import { readsAs, tokenize, type IntentToken } from './intent-tokens';

const MURAL = new Set(['mural', 'murals', 'جداريه', 'جداريات']);
const GAME = new Set(['game', 'games', 'لعبه', 'العاب']);
const STORY = new Set(['story', 'stories', 'tale', 'tales', 'قصه', 'قصص', 'حكايه', 'حكايات']);
const SCENE = new Set(['scene', 'مشهد', ...GAME, ...STORY]);
export type CreativeCreationKind = 'game' | 'story' | 'scene';

/** The recognized object, with the same clitic readings the router used. */
export function creativeObjectKind(object: string | undefined): CreativeCreationKind | undefined {
  const token = object === undefined ? undefined : tokenize(object)[0];
  if (readsAs(token, GAME)) return 'game';
  if (readsAs(token, STORY)) return 'story';
  return readsAs(token, MURAL) || readsAs(token, SCENE) ? 'scene' : undefined;
}
const OTHER_OBJECTS = new Set([
  'message',
  'copy',
  'text',
  'caption',
  'label',
  'رساله',
  'نص',
  'عنوان',
  'شرح',
]);
const QUALIFIERS = new Set([
  'interactive',
  'playable',
  'illustrated',
  'animated',
  'scrolling',
  'horizontal',
  'تفاعلي',
  'تفاعليه',
  'متحرك',
  'متحركه',
  'افقي',
  'افقيه',
]);
const FILLERS = new Set([...OBJECT_FILLERS, ...INDEFINITE_EN, 'الي', 'new', 'جديد', 'جديده']);
const MODIFIERS = new Set([
  'custom',
  'bespoke',
  'narrative',
  'layered',
  'professional',
  '2d',
  '3d',
  'مخصص',
  'مخصصه',
  'قصصي',
  'قصصيه',
  'احترافي',
  'احترافيه',
]);

const BUSINESS_COPY = new Set([
  'our',
  'their',
  'brand',
  'company',
  'business',
  'customer',
  'client',
  'success',
  'studio',
  'store',
  'shop',
  'article',
  'review',
  'tutorial',
  'شركه',
  'شركتنا',
  'عميل',
  'عملاء',
  'نجاح',
  'متجر',
  'استوديو',
  'مقال',
  'مقاله',
  'مراجعه',
]);
const CLAUSE_JOINS = new Set(['and', 'then', 'but', 'ثم', 'بس', 'لكن']);
const INTO = new Set(['to', 'into', 'inside', 'within', 'in', 'داخل', 'في', 'على', 'الي']);
const BACK = new Set(['it', 'عليها', 'عليه', 'فيها', 'فيه', 'لها', 'له', 'اليها', 'اليه']);
const DETAILS = new Set(['with', 'مع']);
const SUBJECT = new Set([
  'about',
  'of',
  'featuring',
  'beside',
  'below',
  'above',
  'next',
  'عن',
  'بجانب',
  'تحت',
  'فوق',
]);

/** Adding a beat INSIDE existing art edits that art; subjects and adjacent placement do not. */
function hasCreativeDestination(
  tokens: readonly IntentToken[],
  verb: { readonly index: number; readonly width: number; readonly kind: VerbKind },
): boolean {
  if (!['create', 'add', 'make', 'want'].includes(verb.kind)) return false;
  let object = false;
  let into = false;
  let definite = false;
  for (const token of tokens.slice(verb.index + verb.width, verb.index + verb.width + 18)) {
    if (token.breakBefore || CLAUSE_JOINS.has(token.raw) || readsAs(token, SUBJECT)) return false;
    const creative = readsAs(token, MURAL) || readsAs(token, SCENE);
    if (!object) {
      if (readsAs(token, PHRASE_STOPS)) return false;
      object = creative;
      continue;
    }
    if (readsAs(token, DETAILS)) continue;
    if (INTO.has(token.raw)) {
      into = true;
      continue;
    }
    if ((into || token.arabic) && BACK.has(token.raw)) return true;
    if (into && (readsAs(token, DEFINITE_EN) || readsAs(token, DEFINITE_AR))) {
      definite = true;
      continue;
    }
    if (creative && token.arabic && /^(?:[وف])?(?:لل|بال)/u.test(token.raw)) return true;
    if (creative && into) {
      return definite || token.readings.some((reading) => reading.definite);
    }
    if (readsAs(token, PHRASE_STOPS)) return false;
  }
  return false;
}

/** An explicit new object, not a later request to make an existing scene feel new. */
export function namesNewCreativeObject(
  tokens: readonly IntentToken[],
  verb: { readonly index: number; readonly width: number },
): boolean {
  let fresh = false;
  const phrase = tokens.slice(verb.index + verb.width, verb.index + verb.width + 7);
  for (const [index, token] of phrase.entries()) {
    if (token.breakBefore || CLAUSE_JOINS.has(token.raw) || readsAs(token, SUBJECT)) return false;
    if (['new', 'جديد', 'جديده'].includes(token.raw)) fresh = true;
    if (readsAs(token, MURAL) || readsAs(token, SCENE))
      return fresh || ['new', 'جديد', 'جديده'].includes(phrase[index + 1]?.raw ?? '');
  }
  return false;
}

/** "Game website" and "company story" name business content, not a new playable piece. */
function describesOtherContent(
  tokens: readonly IntentToken[],
  from: number,
  object: number,
): boolean {
  for (let index = from; index <= object + 3 && index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined || token.breakBefore) break;
    if (
      index > object &&
      (readsAs(token, PHRASE_STOPS) ||
        CLAUSE_JOINS.has(token.raw) ||
        (token.arabic && token.raw.startsWith('و') && token.raw.length > 3))
    )
      break;
    if (readsAs(token, BUSINESS_COPY)) return true;
    if (index > object && token.readings.some((reading) => NOUNS.has(reading.stem))) return true;
  }
  return false;
}

/** A scene to create as the first effective verb's object, not a scene merely mentioned later. */
export function creativeCreationObject(
  tokens: readonly IntentToken[],
  verb: { readonly index: number; readonly width: number; readonly kind: VerbKind },
): string | undefined {
  const word = tokens[verb.index]?.raw ?? '';
  const writesStory = verb.kind === 'edit' && /^(?:write|اكتب(?:لي|لنا)?)$/u.test(word);
  if (!writesStory && !['create', 'want', 'make', 'add'].includes(verb.kind)) return undefined;
  if (hasCreativeDestination(tokens, verb)) return undefined;
  if (tokens.slice(0, verb.index).some((token) => readsAs(token, NEGATIONS))) return undefined;
  let index = verb.index + verb.width;
  let qualified = false;
  let fillerPrefix = true;
  // Only the immediate object phrase may name the creation; later narrative verbs cannot.
  while (index < tokens.length && index <= verb.index + verb.width + 5) {
    const token = tokens[index];
    if (token === undefined || token.breakBefore) return undefined;
    if (readsAs(token, NEGATIONS)) return undefined;
    if (writesStory || verb.kind === 'make' || verb.kind === 'want') {
      if (
        readsAs(token, DEFINITE_EN) ||
        readsAs(token, DEFINITE_AR) ||
        token.readings.some(
          (reading) => reading.definite && (MURAL.has(reading.stem) || SCENE.has(reading.stem)),
        )
      )
        return undefined;
    }
    if (fillerPrefix && readsAs(token, FILLERS)) {
      index += 1;
      continue;
    }
    fillerPrefix = false;
    if (readsAs(token, MODIFIERS)) {
      index += 1;
      continue;
    }
    if (readsAs(token, QUALIFIERS)) {
      qualified = true;
      index += 1;
      continue;
    }
    if (readsAs(token, MURAL) && !writesStory) return token.raw;
    if (readsAs(token, SCENE)) {
      if (writesStory && !readsAs(token, STORY)) return undefined;
      if (describesOtherContent(tokens, verb.index + verb.width, index)) return undefined;
      const explicitScene = qualified || readsAs(tokens[index + 1], QUALIFIERS);
      if (
        !explicitScene &&
        token.readings.some((reading) => reading.definite && STORY.has(reading.stem))
      )
        return undefined;
      if (readsAs(token, GAME) || readsAs(token, STORY) || explicitScene) return token.raw;
    }
    if (
      readsAs(token, SCENE) ||
      readsAs(token, OTHER_OBJECTS) ||
      readsAs(token, PHRASE_STOPS) ||
      token.readings.some((reading) => NOUNS.has(reading.stem))
    )
      return undefined;
    // Unknown modifiers are allowed only within this short immediate object phrase.
    index += 1;
  }
  return undefined;
}

/** A make/want aimed at a definite scene asks to change the scene that already exists. */
export function targetsExistingCreativeObject(
  tokens: readonly IntentToken[],
  verb: { readonly index: number; readonly width: number; readonly kind: VerbKind } | undefined,
): boolean {
  if (verb !== undefined && hasCreativeDestination(tokens, verb)) return true;
  if (verb === undefined || !['make', 'want'].includes(verb.kind)) return false;
  let definite = false;
  for (const token of tokens.slice(verb.index + verb.width, verb.index + verb.width + 5)) {
    if (token.breakBefore) return false;
    if (readsAs(token, DEFINITE_EN) || readsAs(token, DEFINITE_AR)) {
      definite = true;
      continue;
    }
    if (readsAs(token, MURAL) || readsAs(token, SCENE)) {
      return (
        definite ||
        token.readings.some(
          (reading) => reading.definite && (MURAL.has(reading.stem) || SCENE.has(reading.stem)),
        )
      );
    }
    if (readsAs(token, PHRASE_STOPS) || token.readings.some((reading) => NOUNS.has(reading.stem)))
      return false;
  }
  return false;
}
