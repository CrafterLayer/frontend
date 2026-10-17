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
import { readsAs, type IntentToken } from './intent-tokens';

const MURAL = new Set(['mural', 'murals', 'جداريه']);
const SCENE = new Set(['scene', 'story', 'game', 'مشهد', 'قصه', 'لعبه']);
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

/** A scene to create as the first effective verb's object, not a scene merely mentioned later. */
export function creativeCreationObject(
  tokens: readonly IntentToken[],
  verb: { readonly index: number; readonly width: number; readonly kind: VerbKind },
): string | undefined {
  if (!['create', 'want', 'make', 'add'].includes(verb.kind)) return undefined;
  if (tokens.slice(0, verb.index).some((token) => readsAs(token, NEGATIONS))) return undefined;
  let index = verb.index + verb.width;
  let qualified = false;
  let fillerPrefix = true;
  // Only the immediate object phrase may name the creation; later narrative verbs cannot.
  while (index < tokens.length && index <= verb.index + verb.width + 5) {
    const token = tokens[index];
    if (token === undefined || token.breakBefore) return undefined;
    if (readsAs(token, NEGATIONS)) return undefined;
    if (verb.kind === 'make' || verb.kind === 'want') {
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
    if (readsAs(token, MURAL)) return token.raw;
    if (readsAs(token, SCENE) && (qualified || readsAs(tokens[index + 1], QUALIFIERS)))
      return token.raw;
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
