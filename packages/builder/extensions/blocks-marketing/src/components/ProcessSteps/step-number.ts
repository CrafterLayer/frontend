/** Arabic-Indic and Eastern Arabic-Indic digits as ASCII (U+0660 and U+06F0 are both ≡ 0 mod 16). */
function latinDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/gu, (digit) =>
    String((digit.codePointAt(0) ?? 0) % 16),
  );
}

const NUMBER_ONLY =
  /^(?:step|stage|phase|الخطوة|خطوة|المرحلة|مرحلة)?\s*[#.:\-–—]?\s*0*(\d+)\s*[.:)]?$/iu;

/**
 * Whether a step's meta line only repeats its number ("01", "Step 1",
 * "الخطوة ١"). The badge already shows that number, so a meta that says it
 * again printed the step twice (the agency template's process cards, audit
 * 2026-10-08). A meta that says anything else — "Week 01", "Discover" — stays,
 * and so does every meta while the badge is switched off.
 */
export function metaRepeatsNumber(meta: unknown, stepNumber: number): boolean {
  if (typeof meta !== 'string') return false;
  const match = NUMBER_ONLY.exec(latinDigits(meta).trim());
  return match !== null && Number(match[1]) === stepNumber;
}
