import type { BlockSchema } from '@craftkit/builder';

import type { AgentLocale } from '../AgentFace';

/**
 * What the panel offers a person to say next.
 *
 * Four kinds, and every one of them is DERIVED. The panel used to show four
 * hardcoded English sentences that appeared only before the first message and
 * never came back — so a person who wrote one thing and then paused was left
 * with an empty box and a blinking cursor, in a product that is bilingual.
 */
export type SuggestionKind =
  /** From the catalog's own example prompts: things this build can actually make. */
  | 'example'
  /** From the SELECTED block's schema: what can be done to the thing in hand. */
  | 'selection'
  /** From the model's own `followUp` on the last answer. */
  | 'followUp';

export interface Suggestion {
  /** Stable across renders for the same text, so React keys do not churn. */
  readonly id: string;
  readonly kind: SuggestionKind;
  /** Sent verbatim when chosen — already in the person's language. */
  readonly text: string;
}

/**
 * Arabic SCRIPT anywhere — not the Arabic language, and the difference is
 * deliberate.
 *
 * The panel speaks two locales, `ar` and `en`, and what it uses them for is
 * which sentence to show and which way it reads. Persian and Urdu are written
 * in this script, so they answer `ar` here: for a reader of either, an Arabic
 * suggestion is closer to right than an English one, and the direction is
 * certainly right. Hebrew is RTL but a different script and answers `en`, which
 * is the honest limit of a two-locale panel rather than a bug to hide — the day
 * a third locale exists, this returns it instead of guessing.
 *
 * Script beats a language list because a list is never finished, and the answer
 * it gives for an unlisted language is silently wrong.
 */
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿ]/u;

export function localeOf(text: string): AgentLocale {
  return ARABIC_SCRIPT.test(text) ? 'ar' : 'en';
}

function suggestion(kind: SuggestionKind, text: string): Suggestion {
  return { id: `${kind}:${text}`, kind, text };
}

/**
 * What counts as the same suggestion twice.
 *
 * Normalised, not compared raw: two chips reading "Add a hero" and "add  a
 * hero" are one suggestion to a person, and showing both wastes a slot on a
 * rail that only has four. NFC folds the Unicode-equivalent spellings Arabic
 * text arrives in from different keyboards.
 */
function dedupeKey(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
}

/** Deduplicate by text, preserving order and the original spelling, and take `limit`. */
function take(suggestions: readonly Suggestion[], limit: number): readonly Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const candidate of suggestions) {
    const key = dedupeKey(candidate.text);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
    if (out.length === limit) break;
  }
  return out;
}

export interface CatalogSuggestionOptions {
  readonly locale: AgentLocale;
  readonly limit?: number;
  /**
   * Rotates which of the matching examples are shown, deterministically.
   *
   * Not randomness: the same offset always yields the same list, so a story and
   * a test can pin one and a person who reopens the panel does not get a
   * different four every time for no reason.
   */
  readonly offset?: number;
}

/**
 * Starters taken from the catalog's OWN few-shot prompts.
 *
 * `BlockSchema.examples[].prompt` is already a sentence a person would say —
 * that is what an example is — and the marketing catalog carries both Arabic
 * and English ones. Deriving from them means a new block arrives with its
 * suggestions already written, in both languages, by whoever knew the block.
 * The alternative was a second list of sentences maintained by hand, which
 * goes stale the first time a block is added and is wrong in one language
 * from the start.
 */
export function catalogSuggestions(
  blocks: readonly { schema: BlockSchema }[],
  options: CatalogSuggestionOptions,
): readonly Suggestion[] {
  const limit = options.limit ?? 4;
  if (limit <= 0) return [];

  /*
    Sorted by block type so the order is a property of the catalog, not of
    registration order — two kernels with the same blocks offer the same
    starters whatever sequence their extensions loaded in.
  */
  const prompts = [...blocks]
    /*
      A total order, including the equal case. Returning 1 for equality breaks
      comparator symmetry, and the answer then depends on the engine's sort and
      on registration order — the exact thing sorting here was meant to remove.
    */
    .sort((left, right) => left.schema.type.localeCompare(right.schema.type))
    .flatMap(({ schema }) => schema.examples.map((example) => example.prompt.trim()))
    .filter((prompt) => prompt.length > 0);

  const inLocale = prompts.filter((prompt) => localeOf(prompt) === options.locale);
  /*
    FALL BACK to the other language rather than showing nothing.

    A catalog that carries only English examples — a host's own blocks, the test
    vocabulary, an extension written by one person — would otherwise leave an
    Arabic panel with an empty strip, which is the exact failure this module
    exists to end. The reader of this panel is bilingual by construction, and an
    English example they can adapt beats a blinking cursor. The preferred
    language still wins whenever it has anything at all.
  */
  const matching = inLocale.length > 0 ? inLocale : prompts;
  if (matching.length === 0) return [];

  const start = ((options.offset ?? 0) % matching.length + matching.length) % matching.length;
  const rotated = [...matching.slice(start), ...matching.slice(0, start)];
  return take(
    rotated.map((prompt) => suggestion('example', prompt)),
    limit,
  );
}

/**
 * What can be done to the block in hand, read from its own schema.
 *
 * The panel knows the selected block's type; its schema knows which property is
 * edited in place, which slots it accepts, and which props it declares. Those
 * are the three things a person actually asks for next, and all three are in
 * the schema — so this needs no model, no server, and no second list.
 */
export function selectionSuggestions(
  schema: BlockSchema | undefined,
  locale: AgentLocale,
  limit = 3,
): readonly Suggestion[] {
  if (schema === undefined || limit <= 0) return [];
  const label = schema.type;
  const out: Suggestion[] = [];

  if (schema.inlineEditable !== undefined) {
    out.push(
      suggestion(
        'selection',
        locale === 'ar'
          ? `أعد صياغة نص ${label} ليكون أوضح`
          : `rewrite the ${label} text to be clearer`,
      ),
    );
  }

  const slots = Object.keys(schema.slots ?? {});
  const firstSlot = slots[0];
  if (firstSlot !== undefined) {
    const allow = schema.slots?.[firstSlot]?.allow ?? [];
    const child = allow[0];
    if (child !== undefined) {
      out.push(
        suggestion(
          'selection',
          locale === 'ar' ? `أضف ${child} داخل ${label}` : `add a ${child} inside the ${label}`,
        ),
      );
    }
  }

  /*
    An example the block author wrote for THIS type, in this language, is a
    better third suggestion than anything phrased here: it describes a shape the
    block is known to produce well.
  */
  const example = schema.examples.find(
    (candidate) => candidate.prompt.trim().length > 0 && localeOf(candidate.prompt) === locale,
  );
  if (example !== undefined) {
    out.push(
      suggestion(
        'selection',
        locale === 'ar'
          ? `اجعل ${label} مثل: ${example.prompt.trim()}`
          : `make the ${label} like: ${example.prompt.trim()}`,
      ),
    );
  }

  return take(out, limit);
}

/**
 * The model's own follow-ups, when it gave any.
 *
 * Kept separate from the two above because it is the only kind that needs a
 * provider to have answered — the panel must still have something to offer when
 * there is no server, which is why the other two exist.
 */
export function followUpSuggestions(
  followUp: readonly string[] | string | undefined,
  limit = 3,
): readonly Suggestion[] {
  if (followUp === undefined || limit <= 0) return [];
  const entries = (typeof followUp === 'string' ? [followUp] : followUp)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return take(
    entries.map((entry) => suggestion('followUp', entry)),
    limit,
  );
}

export interface PanelSuggestionInput {
  readonly blocks: readonly { schema: BlockSchema }[];
  readonly selected: BlockSchema | undefined;
  readonly followUp: readonly string[] | string | undefined;
  readonly locale: AgentLocale;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * What the panel shows, in the order it shows it.
 *
 * The model's follow-ups come first when it gave any — they are about the
 * conversation that is actually happening. Then the selection, because a person
 * with something selected is usually asking about it. The catalog fills what is
 * left, so the strip is never empty: that is the whole point, and it is why the
 * first two are allowed to be empty and the last one is not.
 */
export function panelSuggestions(input: PanelSuggestionInput): readonly Suggestion[] {
  const limit = input.limit ?? 4;
  const ordered = [
    ...followUpSuggestions(input.followUp, limit),
    ...selectionSuggestions(input.selected, input.locale, limit),
    ...catalogSuggestions(input.blocks, {
      locale: input.locale,
      limit,
      ...(input.offset === undefined ? {} : { offset: input.offset }),
    }),
  ];
  return take(ordered, limit);
}
