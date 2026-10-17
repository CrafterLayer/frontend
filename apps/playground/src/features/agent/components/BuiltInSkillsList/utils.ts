import type { BuiltInSkillToggleView } from '../../model/builtin-skills';

/** Case, Arabic diacritics and spacing do not decide a match. */
function folded(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ًͯ-ٰٟ]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase();
}

/** Whether a built-in's name, description or id holds the filter's words. */
export function matchesFilter(skill: BuiltInSkillToggleView, query: string): boolean {
  const words = folded(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const text = folded(`${skill.name} ${skill.description} ${skill.id}`);
  return words.every((word) => text.includes(word));
}
