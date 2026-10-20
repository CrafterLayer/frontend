import { compileKeyword, requestHasKeyword, type CompiledKeyword } from '../skills/keyword-match';
import { PHRASE_STOPS } from '../intent/intent-lexicon';
import { readsAs, type IntentToken } from '../intent/intent-tokens';
import { specificGenreKeywords, STORY_WORDS } from './creative-activation';
import type { CreativeKind } from './creative-brief-types';

export const MURAL_WORDS = ['mural', 'murals', 'generative art', 'جدارية', 'جداريات', 'فن توليدي'];

const PHRASES: readonly { kind: CreativeKind; words: readonly string[] }[] = [
  { kind: 'scene', words: MURAL_WORDS },
  {
    kind: 'game',
    // Subject cues such as dungeon, treasure and maze activate skills, but name no medium.
    words: [
      'game',
      'games',
      'لعبة',
      'ألعاب',
      'platformer',
      'rpg',
      'roguelike',
      'dungeon crawler',
      'physics toy',
      'physics sandbox',
      'physics playground',
      'endless runner',
      'side scroller',
      'jump and run',
    ],
  },
  { kind: 'story', words: [...STORY_WORDS, ...specificGenreKeywords('story')] },
];
const COMPILED = PHRASES.flatMap(({ kind, words }) =>
  words.map((word) => ({ kind, keyword: compileKeyword(word) })),
);
const MURALS = MURAL_WORDS.map(compileKeyword);

function startsWith(
  words: readonly IntentToken[],
  index: number,
  keyword: CompiledKeyword,
): boolean {
  return requestHasKeyword(words.slice(index, index + keyword.length), keyword);
}

/** A compound may carry a few modifiers: "a fairy-tale forest mural", never "a story of a mural". */
function isMuralCompound(words: readonly IntentToken[], start: number): boolean {
  for (let index = start; index < Math.min(words.length, start + 4); index += 1) {
    const token = words[index];
    if (token?.breakBefore === true || readsAs(token, PHRASE_STOPS)) return false;
    if (MURALS.some((keyword) => startsWith(words, index, keyword))) return true;
  }
  return false;
}

/**
 * The first named experience owns the brief; later subjects cannot change its medium.
 * "A story about a maze" stays a story, "a game with a mural" stays a game, and the
 * compound "story mural" / «قصة جدارية» is a mural. Genre specificity is decided separately.
 */
export function requestedCreativeKind(words: readonly IntentToken[]): CreativeKind | undefined {
  for (let index = 0; index < words.length; index += 1) {
    const phrase = COMPILED.find(({ keyword }) => startsWith(words, index, keyword));
    if (phrase === undefined) continue;
    if (phrase.kind === 'story' && isMuralCompound(words, index + phrase.keyword.length))
      return 'scene';
    return phrase.kind;
  }
  return undefined;
}
