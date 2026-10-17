/**
 * pixi-studio:runtime-wiring (2026-10-10): a customCode block's `jsParams` (DESIGN D8) as the
 * `data-ck-params` JSON the region carries beside `data-ck-js`, or undefined when there is
 * nothing to carry (absent, not a plain object, or empty). `ck.params(defaults)` reads it.
 */
export function customCodeParamsAttribute(jsParams: unknown): string | undefined {
  if (jsParams === null || typeof jsParams !== 'object' || Array.isArray(jsParams)) return undefined;
  if (Object.keys(jsParams).length === 0) return undefined;
  try {
    return JSON.stringify(jsParams);
  } catch {
    return undefined;
  }
}
