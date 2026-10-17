import type { DeckFace } from '../../../skills/direction-deck';
import { VERIFIED_FONT_FAMILIES } from '../../../skills/verified-fonts';
import { readPageKit, writePageKit } from '../page-kit';
import { fail, inputRecord, isArabicLocale, okParse, rootIdOf, setProp, unknownKeys } from '../shared';
import { defineAgentTool, type AgentToolContext, type AgentToolRun } from '../types';

/**
 * fonts.set — change the page's display and/or body face.
 *
 * Verified families only (`VERIFIED_FONT_FAMILIES`): one wrong weight in a
 * css2 request drops every face in it, so the import is rebuilt by
 * `directionDeckImportUrl` from the weights each family ships. An Arabic page
 * takes Arabic-capable faces only.
 */

export interface FontsSetInput {
  readonly display?: string;
  readonly body?: string;
}

/** The verified family a name means, matched without regard to case or extra spaces. */
export function verifiedFamily(name: string): string | undefined {
  const wanted = name.trim().replace(/\s+/gu, ' ').toLowerCase();
  return Object.keys(VERIFIED_FONT_FAMILIES).find((family) => family.toLowerCase() === wanted);
}

const PREFERRED: Readonly<Record<'display' | 'body', readonly number[]>> = {
  display: [600, 700],
  body: [400, 700],
};

/** The face with the weights a role uses, of those the family ships; bare for a one-weight face. */
export function faceFor(family: string, role: 'display' | 'body'): DeckFace {
  const shipped = VERIFIED_FONT_FAMILIES[family]?.weights ?? [];
  if (shipped.length <= 1) return { family, weights: [] };
  const wanted = PREFERRED[role].filter((weight) => shipped.includes(weight));
  const weights = wanted.length > 0 ? wanted : [shipped.includes(400) ? 400 : (shipped[0] ?? 400)];
  return { family, weights };
}

function parse(input: unknown) {
  const record = inputRecord(input);
  if (record === undefined) return fail<FontsSetInput>('input must be an object like {"display":"Lalezar","body":"Almarai"}.');
  const extra = unknownKeys(record, ['display', 'body']);
  if (extra.length > 0) return fail<FontsSetInput>(`unknown keys ${extra.join(', ')}; use display and/or body.`);
  const out: { display?: string; body?: string } = {};
  for (const key of ['display', 'body'] as const) {
    const value = record[key];
    if (value === undefined) continue;
    const family = typeof value === 'string' ? verifiedFamily(value) : undefined;
    if (family === undefined) {
      return fail<FontsSetInput>(
        `"${key}" must be a verified family: ${Object.keys(VERIFIED_FONT_FAMILIES).join(', ')}.`,
      );
    }
    out[key] = family;
  }
  if (out.display === undefined && out.body === undefined) return fail<FontsSetInput>('name display and/or body.');
  return okParse<FontsSetInput>(out);
}

function arabicFaces(): string {
  return Object.entries(VERIFIED_FONT_FAMILIES)
    .filter(([, family]) => family.arabic)
    .map(([name]) => name)
    .join(', ');
}

export function runFontsSet(input: FontsSetInput, context: AgentToolContext): AgentToolRun {
  const arabic = isArabicLocale(context) || context.locale.dir === 'rtl';
  for (const family of [input.display, input.body]) {
    if (family !== undefined && arabic && VERIFIED_FONT_FAMILIES[family]?.arabic !== true) {
      return { ok: false, error: `${family} has no Arabic glyphs and this page is Arabic; use one of ${arabicFaces()}.` };
    }
  }
  const rootId = rootIdOf(context.kernel);
  const current = context.readProp(rootId, 'pageCss');
  const pageCss = typeof current === 'string' ? current : '';
  const { state } = readPageKit(pageCss, arabic);
  const next = {
    ...state,
    ...(input.display === undefined ? {} : { display: faceFor(input.display, 'display') }),
    ...(input.body === undefined ? {} : { body: faceFor(input.body, 'body') }),
  };
  const css = writePageKit(pageCss, next, context.locale);
  if (css === pageCss) return { ok: true, steps: [], note: 'the page already uses these faces' };
  return { ok: true, steps: [setProp(rootId, 'pageCss', css)] };
}

export const fontsSetTool = defineAgentTool<FontsSetInput>({
  name: 'fonts.set',
  lanes: ['edit'],
  summary: 'Set display and body faces',
  signature: '{display?,body?:verified family}',
  parse,
  run: runFontsSet,
});
