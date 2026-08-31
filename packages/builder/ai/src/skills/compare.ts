/** Locale-independent UTF-16 ordering for byte-stable skill resolution. */
export function compareSkillText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
