import { directionSetTool } from '../tools/agent/builtin/direction-set';
import { fail, inputRecord, isRecord, okParse, setProp, unknownKeys } from '../tools/agent/shared';
import {
  defineAgentTool,
  type AgentToolContext,
  type AgentToolRun,
  type AgentToolStep,
} from '../tools/agent/types';
import { isLanguageTag, languageDirection, siteLanguage } from './languages';
import { createTranslation, textKey, translatePage } from './page-texts';

/**
 * page.translate (2026-10-12) — put a page in another language in one step. The model writes
 * only the words: `{"lang":"fr","texts":{"Book a table":"Réserver une table", …}}`, one entry
 * per text the page shows (a name that stays the same maps to itself). The tool finds every
 * place a text sits (region trees, block parts, the page title and description), replaces it
 * without touching markup, sets the page's `lang`, and runs direction.set over the translated
 * page, so the direction flips, physical classes turn logical and an Arabic page gets Arabic
 * faces in the same Undo.
 *
 * A translation must be whole: when texts of more than one word are left in the old language,
 * the tool refuses and lists them, so the one repair round adds exactly those. Single words
 * left over (brand and product names) are allowed and named in the note.
 */

export interface PageTranslateInput {
  readonly lang: string;
  readonly texts: Readonly<Record<string, string>>;
}

const MAX_TEXTS = 400;
const MAX_TEXT = 4_000;
const MAX_LISTED = 12;
const RTL_SCRIPT = /[֐-ࣿיִ-﷿ﹰ-﻿]/u;

function parse(input: unknown) {
  const record = inputRecord(input);
  if (record === undefined)
    return fail<PageTranslateInput>(
      'input must be an object like {"lang":"fr","texts":{"Page text":"Translation"}}.',
    );
  const extra = unknownKeys(record, ['lang', 'texts']);
  if (extra.length > 0)
    return fail<PageTranslateInput>(`unknown keys ${extra.join(', ')}; use lang and texts.`);
  const lang = record['lang'];
  if (typeof lang !== 'string' || !isLanguageTag(lang.toLowerCase()) || lang.length > 12)
    return fail<PageTranslateInput>('"lang" must be a language tag such as fr, ar or pt-br.');
  const texts = record['texts'];
  if (!isRecord(texts))
    return fail<PageTranslateInput>(
      '"texts" must map each page text to its translation: {"Old":"New"}.',
    );
  const entries = Object.entries(texts);
  if (entries.length === 0 || entries.length > MAX_TEXTS)
    return fail<PageTranslateInput>(`"texts" must hold 1-${String(MAX_TEXTS)} entries.`);
  const out: Record<string, string> = {};
  for (const [from, to] of entries) {
    if (typeof to !== 'string' || to.trim() === '')
      return fail<PageTranslateInput>(
        `"texts"["${from.slice(0, 40)}"] must be a non-empty string.`,
      );
    if (to.length > MAX_TEXT)
      return fail<PageTranslateInput>(
        `"texts"["${from.slice(0, 40)}"] is over ${String(MAX_TEXT)} characters.`,
      );
    out[from] = to;
  }
  return okParse<PageTranslateInput>({ lang: lang.toLowerCase(), texts: out });
}

/**
 * Whether a text left without a translation is still in the old language. Only scripts can
 * tell: right-to-left words on a left-to-right page always are; on a right-to-left page they
 * may already be translated. Words in another script are a name when single, copy when several.
 */
function untranslated(text: string, lang: string): boolean {
  const rtlText = RTL_SCRIPT.test(text);
  if (languageDirection(lang) === 'rtl') return !rtlText && text.includes(' ');
  return rtlText || text.includes(' ');
}

function quoted(texts: readonly string[]): string {
  const shown = texts.slice(0, MAX_LISTED).map((text) => JSON.stringify(text.slice(0, 80)));
  return `${shown.join(', ')}${texts.length > MAX_LISTED ? `, and ${String(texts.length - MAX_LISTED)} more` : ''}`;
}

function run(input: PageTranslateInput, context: AgentToolContext): AgentToolRun {
  const translation = createTranslation(input.texts);
  const page = translatePage(context, translation);
  if (translation.used().size === 0)
    return {
      ok: false,
      error:
        'no key of "texts" is a text on this page; quote each text exactly as the page shows it.',
    };
  const missed = translation.missed();
  const leftOver = missed.filter((text) => untranslated(text, input.lang));
  if (leftOver.length > 0)
    return {
      ok: false,
      error: `${String(leftOver.length)} texts are still untranslated: ${quoted(leftOver)}. Send one page.translate with every text of the page in "texts" (a name that stays the same maps to itself).`,
    };

  // direction.set over the translated page: its tree steps carry the translations too.
  const translated: AgentToolContext = {
    ...context,
    readProp: (id, key) =>
      key === 'tree' && page.trees.has(id) ? page.trees.get(id) : context.readProp(id, key),
  };
  const direction = directionSetTool.run({ lang: input.lang }, translated);
  const directionSteps = direction.ok ? direction.steps : [];
  const flipped = new Set(
    directionSteps.flatMap((step) =>
      step.command === 'setProp' &&
      step.args['key'] === 'tree' &&
      typeof step.args['id'] === 'string'
        ? [step.args['id']]
        : [],
    ),
  );
  const steps: AgentToolStep[] = [
    ...[...page.trees]
      .filter(([id]) => !flipped.has(id))
      .map(([id, tree]) => setProp(id, 'tree', tree)),
    ...page.steps,
    ...directionSteps,
  ];
  const unused = Object.keys(input.texts).filter((from) => !translation.used().has(textKey(from)));
  const notes = [
    `${String(translation.used().size)} texts in ${siteLanguage(input.lang)?.english ?? input.lang}`,
    ...(missed.length > 0 ? [`kept as written: ${quoted(missed)}`] : []),
    ...(unused.length > 0 ? [`not on the page: ${quoted(unused)}`] : []),
  ];
  return { ok: true, steps, note: notes.join('; ') };
}

export const pageTranslateTool = defineAgentTool<PageTranslateInput>({
  name: 'page.translate',
  lanes: ['edit'],
  summary: 'Translate every page text, set language',
  signature: '{lang,texts:{"<page text>":"<translation>"}}',
  parse,
  run,
});
