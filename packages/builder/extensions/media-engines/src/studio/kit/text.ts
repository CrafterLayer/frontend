/*
  Arabic-safe text for the scene kit (pixi-studio §B.2: s.text / s.words).

  Arabic letters join and shape by context, so a string split per character renders as isolated
  letters, which is wrong. The kit never splits per letter:
  - s.words(str) splits on whitespace only (each word keeps its joined letters);
  - s.text(str, style) returns an HTMLText (the browser shapes and orders it) whenever the string
    holds right-to-left script or the page is RTL, and a plain Text otherwise.
*/

/** Arabic, Syriac, Thaana, NKo, Hebrew and the Arabic presentation forms. */
export const RTL_SCRIPT = /[֐-ࣿיִ-﷿ﹰ-﻿]/u;

export const ARABIC_SCRIPT = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/u;

export function hasRtlScript(text: string): boolean {
  return RTL_SCRIPT.test(text);
}

/** Split into words on whitespace; never per letter. Empty input gives []. */
export function words(text: string): string[] {
  return String(text ?? '')
    .split(/\s+/u)
    .filter((word) => word !== '');
}

export type TextStyleInput = Record<string, unknown>;

interface TextCtor {
  new (options: { text: string; style?: TextStyleInput }): unknown;
}

interface PixiTextNamespace {
  Text: TextCtor;
  HTMLText: TextCtor;
}

/**
 * Build the right text object. `fontFamily` defaults to the region's computed font, so a scene
 * matches the page's type.
 */
export function createSceneText(
  PIXI: unknown,
  text: string,
  style: TextStyleInput | undefined,
  context: { rtl: boolean; fontFamily?: string | undefined },
): unknown {
  const value = String(text ?? '');
  const namespace = PIXI as PixiTextNamespace;
  const merged: TextStyleInput = { ...(style ?? {}) };
  if (merged['fontFamily'] === undefined && context.fontFamily !== undefined && context.fontFamily !== '') {
    merged['fontFamily'] = context.fontFamily;
  }
  const rtlText = hasRtlScript(value);
  if (rtlText || context.rtl) {
    const given = merged['cssOverrides'];
    const overrides = Array.isArray(given) ? given.filter((item) => typeof item === 'string') : [];
    overrides.push(`direction: ${rtlText ? 'rtl' : 'ltr'}`, 'unicode-bidi: plaintext');
    merged['cssOverrides'] = overrides;
    return new namespace.HTMLText({ text: value, style: merged });
  }
  return new namespace.Text({ text: value, style: merged });
}
