import { readRequestWords } from './keyword-match';
import type { AiSkillRegistry } from './types';

/** Concrete skill names, not a broad match on "pro", "max", "UI" or a phone model. */
const PRO_MAX_NAMES = [
  ['ui', 'ux', 'pro', 'max'],
  ['ux', 'ui', 'pro', 'max'],
  ['uiux', 'pro', 'max'],
  ['pro', 'max', 'design'],
  ['يو', 'اي', 'يو', 'اكس', 'برو', 'ماكس'],
  ['يو', 'اكس', 'يو', 'اي', 'برو', 'ماكس'],
] as const;

const PRO_MAX_IDS = ['craftkit.pro-max-design', 'craftkit.pro-max-ux'] as const;
const NEGATED_NAME =
  /(?:^| )(?:do not|don't|never|without|avoid|exclude|skip)(?: (?:use|using|apply|enable|activate|the|skill)){0,3}$|(?:^| )(?:لا|بدون|دون|تجنب)(?: (?:تستخدم|تستعمل|تفعل|استخدام|مهاره|المهاره)){0,3}$/u;

/**
 * Explicit natural-language skill names. This channel is separate from automatic additions:
 * callers preserve these like a slash selection, subject to the normal hard skill budget.
 * A disabled default absent from the registry remains unavailable. CV nouns never count as
 * explicit selections. Punctuation and case do not alter a concrete Pro Max name.
 */
export function explicitRequestSkillIdsFor(
  registry: AiSkillRegistry | undefined,
  request: string,
): readonly string[] {
  if (registry === undefined) return [];
  const words = readRequestWords(request);
  const named = words.some((_, index) => {
    if (
      !PRO_MAX_NAMES.some((name) =>
        name.every((word, offset) => words[index + offset]?.raw === word),
      )
    )
      return false;
    const before = words
      .slice(Math.max(0, index - 6), index)
      .map(({ raw }) => raw)
      .join(' ');
    return !NEGATED_NAME.test(before);
  });
  return Object.freeze(named ? PRO_MAX_IDS.filter((id) => registry.get(id) !== undefined) : []);
}
