import type { BlockSchema, NodeId } from '@craftkit/builder';

import { formatList, STARTER_KEYS, t } from '../copy';

import type { Locale, SuggestionSource, SuggestionView } from './view-types';

/**
 * What the panel offers a person to say next (SPEC §4.16 SuggestionList).
 *
 * Every row FILLS the composer and never sends, so each text is written as the person's
 * own request, already in their language. Five sources, in `panelSuggestions`' priority:
 * salvage, the model's follow-ups, the selection, the catalog; and, on an empty page, the
 * authored starters instead.
 *
 * Copied from v1 `AssistantPanel.suggestions.ts` and changed per SPEC §7.4:
 * - `starterSuggestions(locale)` is new: an empty page gets strong, specific starters.
 * - `selectionSuggestions` names the block through a resolver. v1 put `schema.type` in
 *   the sentence and shipped «أعد صياغة نص hero ليكون أوضح».
 * - `salvageSuggestions` names SECTIONS. v1 named commands ("retry only what did not
 *   apply: insertNode"): words from the engine, not from the page.
 * - The Arabic is masdar, not the imperative, as SPEC §4.0 sets for everything the
 *   instrument writes; titles are quoted «like this», English ones “like this”.
 * - Every sentence is catalog copy (`starter.*`, `suggest.*`): this module decides which
 *   rows to offer and fills them, and writes no word of its own. The starters used to be
 *   authored twice, here and in the catalog, and nothing read the catalog's copy.
 */

/**
 * A block's human name. Called with the node id for the selected block, so an instance
 * label ("Our services") wins over its type, and without one for a type a slot accepts.
 * The panel passes the builder's display name; this module never falls back to a type.
 */
export type BlockNameResolver = (block: {
  readonly type: string;
  readonly nodeId?: NodeId | undefined;
}) => string;

/** The block selected on the canvas, as `selectionSuggestions` reads it. */
export interface SelectedBlock {
  readonly nodeId: NodeId;
  readonly schema: BlockSchema;
}

/** At most 4 rows in the empty state, 3 after a run (SPEC §4.16). */
export const SUGGESTION_LIMITS = { empty: 4, afterRun: 3 } as const;

/**
 * Arabic SCRIPT anywhere, not the Arabic language, and deliberately so. Persian and Urdu
 * readers get `ar`: an Arabic sentence is closer to right for them than an English one,
 * and its direction is certainly right. Hebrew is RTL in another script and answers
 * `en`, the honest limit of a two-locale panel. Script beats a language list because a
 * list is never finished, and its answer for an unlisted language is silently wrong.
 */
const ARABIC_SCRIPT = /[\u0600-\u06FF\u0750-\u077F]/u;

export function localeOf(text: string): Locale {
  return ARABIC_SCRIPT.test(text) ? 'ar' : 'en';
}

function suggestion(source: SuggestionSource, text: string): SuggestionView {
  return { key: `${source}:${text}`, text, source };
}

/**
 * A title as the locale quotes it (SPEC §4.0): «» in Arabic, “” in English. Punctuation,
 * not words: the catalog quotes a `{title}` itself, and this quotes each title of a list.
 */
function quoted(title: string, locale: Locale): string {
  return locale === 'ar' ? `«${title}»` : `“${title}”`;
}

/**
 * What counts as the same suggestion twice: "Add a hero" and "add  a hero" are one row to
 * a person. NFC folds the equivalent spellings Arabic arrives in from different keyboards.
 */
function dedupeKey(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
}

/** Deduplicate by text, keeping order and the first spelling, and take `limit`. */
function take(suggestions: readonly SuggestionView[], limit: number): readonly SuggestionView[] {
  const seen = new Set<string>();
  const out: SuggestionView[] = [];
  for (const candidate of suggestions) {
    if (out.length >= limit) break;
    const key = dedupeKey(candidate.text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

/** The same rotation for every source: deterministic, so a story can pin one and a reopened panel does not reshuffle. */
function rotate<T>(items: readonly T[], offset: number): readonly T[] {
  if (items.length === 0) return items;
  const start = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

export interface StarterOptions {
  readonly limit?: number | undefined;
  /** Rotates through the authored pool; 0 shows the SPEC's four. */
  readonly offset?: number | undefined;
}

/**
 * What an empty page offers (SPEC §3.1, §4.16): the catalog's authored starters, in the
 * panel's locale. `offset` 0 shows the SPEC's four; a new conversation may step it to
 * rotate through the rest of the pool. Each names a trade AND what the page must do,
 * because that is what makes a first build good: a subject alone leaves the plan to guess.
 */
export function starterSuggestions(
  locale: Locale,
  options: StarterOptions = {},
): readonly SuggestionView[] {
  const limit = options.limit ?? SUGGESTION_LIMITS.empty;
  return take(
    rotate(STARTER_KEYS, options.offset ?? 0).map((key) => suggestion('starter', t(locale, key))),
    limit,
  );
}

export interface CatalogSuggestionOptions {
  readonly locale: Locale;
  readonly limit?: number | undefined;
  /** Rotates which matching examples show, deterministically. */
  readonly offset?: number | undefined;
}

/**
 * Starters taken from the catalog's OWN few-shot prompts. `BlockSchema.examples[].prompt`
 * is already a sentence a person would say, in both languages, written by whoever knew
 * the block; a second hand-kept list would go stale the first time a block is added.
 */
export function catalogSuggestions(
  blocks: readonly { readonly schema: BlockSchema }[],
  options: CatalogSuggestionOptions,
): readonly SuggestionView[] {
  const limit = options.limit ?? SUGGESTION_LIMITS.empty;
  if (limit <= 0) return [];
  /*
    Sorted by type with a total order, so what is offered is a property of the catalog,
    not of the order extensions happened to register in.
  */
  const prompts = [...blocks]
    .sort((left, right) => left.schema.type.localeCompare(right.schema.type))
    .flatMap(({ schema }) => schema.examples.map((example) => example.prompt.trim()))
    .filter((prompt) => prompt.length > 0);
  const inLocale = prompts.filter((prompt) => localeOf(prompt) === options.locale);
  /*
    Fall back to the other language rather than showing nothing: a host whose blocks carry
    only English examples must not leave an Arabic panel empty. The preferred language
    still wins whenever it has anything.
  */
  const matching = inLocale.length > 0 ? inLocale : prompts;
  return take(
    rotate(matching, options.offset ?? 0).map((prompt) => suggestion('catalog', prompt)),
    limit,
  );
}

/**
 * What can be done to the block in hand, read from its own schema and named through the
 * resolver.
 *
 * - An in-place prop → rewrite its text.
 * - A slot → add what it accepts.
 * - A block with neither is a free-form region: every AI-built section is one. Its
 *   content lives inside its own tree, so it gets the two section actions that always
 *   apply (tighten the words, try another layout) instead of the catalog's example for
 *   its type, which for `customCode` is a CV header and reads as nonsense on a clinic page.
 * - Otherwise, a catalog block is reworked after its own example in this locale.
 */
export function selectionSuggestions(
  selected: SelectedBlock | undefined,
  locale: Locale,
  nameOf: BlockNameResolver,
  limit: number = SUGGESTION_LIMITS.afterRun,
): readonly SuggestionView[] {
  if (selected === undefined || limit <= 0) return [];
  const { schema, nodeId } = selected;
  const title = nameOf({ type: schema.type, nodeId });
  const texts: string[] = [];

  if (schema.inlineEditable !== undefined) {
    texts.push(t(locale, 'suggest.rewrite', { title }));
  }

  const accepted = Object.values(schema.slots ?? {}).find((slot) => slot.allow.length > 0)
    ?.allow[0];
  if (accepted !== undefined) {
    texts.push(t(locale, 'suggest.addInside', { child: nameOf({ type: accepted }), title }));
  }

  const region =
    schema.inlineEditable === undefined && Object.keys(schema.slots ?? {}).length === 0;
  if (region) {
    texts.push(t(locale, 'suggest.tighten', { title }), t(locale, 'suggest.relayout', { title }));
  } else {
    const example = schema.examples.find(
      (candidate) => candidate.prompt.trim() !== '' && localeOf(candidate.prompt) === locale,
    );
    if (example !== undefined) {
      texts.push(t(locale, 'suggest.rework', { title, prompt: example.prompt.trim() }));
    }
  }

  return take(
    texts.map((text) => suggestion('selection', text)),
    limit,
  );
}

/**
 * The model's own follow-ups, when it gave any. The only source that needs a provider to
 * have answered; the others exist so the list still has something without a server.
 */
export function followUpSuggestions(
  followUp: readonly string[] | string | undefined,
  limit: number = SUGGESTION_LIMITS.afterRun,
): readonly SuggestionView[] {
  if (followUp === undefined || limit <= 0) return [];
  const entries = (typeof followUp === 'string' ? [followUp] : followUp)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return take(
    entries.map((entry) => suggestion('followUp', entry)),
    limit,
  );
}

/**
 * Finish what the newest answer's salvage left undone, named by SECTION (SPEC §4.16).
 *
 * The controller resolves the dropped steps (`runs.ts` `lastDropped`) to the sections they
 * targeted and passes the titles. Naming sections keeps the request smaller than the
 * original: it asks for the gap, not for what already applied to apply twice. It never
 * says "page", so the router cannot read it as a request to scaffold a second one. A
 * salvage no section can be named for offers nothing: a retry of "something" is not a
 * request a person can judge before filling it in.
 */
export function salvageSuggestions(
  sections: readonly string[] | undefined,
  locale: Locale,
  limit = 1,
): readonly SuggestionView[] {
  if (sections === undefined || limit <= 0) return [];
  const titles = [
    ...new Set(sections.map((title) => title.trim()).filter((title) => title !== '')),
  ];
  if (titles.length === 0) return [];
  const list = formatList(
    locale,
    titles.map((title) => quoted(title, locale)),
  );
  return [suggestion('salvage', t(locale, 'suggest.salvage', { titles: list }))];
}

export interface PanelSuggestionInput {
  readonly blocks: readonly { readonly schema: BlockSchema }[];
  readonly nameOf: BlockNameResolver;
  readonly selected?: SelectedBlock | undefined;
  readonly followUp: readonly string[] | string | undefined;
  /** Titles of the sections the newest answer's salvage left undone. */
  readonly salvaged?: readonly string[] | undefined;
  readonly locale: Locale;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

/**
 * What the list shows on a page with content, in the order it shows it (SPEC §4.16).
 *
 * Salvage first, above even the model's follow-up: a follow-up proposes the NEXT thing,
 * and a dropped change is part of the thing just asked for that never happened. Then the
 * follow-ups, which are about this conversation; then the selection, since a person with
 * something selected is usually asking about it; the catalog fills the rest, so the list
 * is never empty. An empty page uses `starterSuggestions` instead.
 */
export function panelSuggestions(input: PanelSuggestionInput): readonly SuggestionView[] {
  const limit = input.limit ?? SUGGESTION_LIMITS.empty;
  return take(
    [
      ...salvageSuggestions(input.salvaged, input.locale),
      ...followUpSuggestions(input.followUp, limit),
      ...selectionSuggestions(input.selected, input.locale, input.nameOf, limit),
      ...catalogSuggestions(input.blocks, { locale: input.locale, limit, offset: input.offset }),
    ],
    limit,
  );
}
