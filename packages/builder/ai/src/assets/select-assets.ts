import type {
  AssetEntry,
  AssetLibraryPort,
  DesignSystem,
  ImageProp,
} from '@craftkit/builder-schema';

/**
 * Which picture goes where — chosen from a library, never invented (FR-046).
 *
 * ## The one rule everything else follows from
 *
 * An image position holds a REAL library asset or a LABELLED ABSENCE. There is
 * no third state. A generated `src` — a plausible-looking URL a model wrote —
 * is the failure this module exists to make impossible: it renders as a broken
 * image on someone's site, it cannot be validated, and it is indistinguishable
 * from a real one until it is in front of a visitor.
 *
 * So the return type is `ImageProp`, which is `AssetRef | { absent, reason }`,
 * and there is no path through this file that produces a string.
 *
 * ## Why an empty library is a normal outcome and not an error
 *
 * A site with no pictures is a site. A run that failed because the library was
 * empty would be refusing to build a perfectly good text site — and a run that
 * invented pictures to avoid failing would be doing the one thing that is
 * actually forbidden. Every degradation here produces an absence a person can
 * read: what was wanted, and why there is nothing there.
 */

export interface SelectAssetsRequest {
  /** What the site is for, in the person's own words. Drives the match. */
  readonly brief: string;
  /** One entry per image position that needs filling. */
  readonly positions: readonly AssetPosition[];
  readonly library?: AssetLibraryPort | undefined;
  /** The palette the site was generated with; a picture should not fight it. */
  readonly designSystem?: DesignSystem | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface AssetPosition {
  /** Where this image goes, for the caller to match the answer back. */
  readonly id: string;
  /** What the picture is FOR, from the section's own intent. */
  readonly intent: string;
}

export interface AssetChoice<E extends AssetCandidate = AssetEntry> {
  readonly id: string;
  readonly image: ImageProp;
  /** The entry chosen, when one was. Absent for a labelled absence. */
  readonly entry?: E | undefined;
}

/**
 * What choosing actually needs: the metadata, never the address.
 *
 * Narrower than `AssetEntry` so the same scoring serves a caller holding a full
 * library entry AND one holding only the catalogue a stage was sent — which has
 * `url` withheld on purpose. One implementation, so the two cannot disagree
 * about which picture answers a brief.
 */
export type AssetCandidate = Pick<AssetEntry, 'id' | 'description' | 'alt' | 'mood' | 'palette'>;

export interface SelectAssetsResult<E extends AssetCandidate = AssetEntry> {
  readonly choices: readonly AssetChoice<E>[];
  /** Every asset actually used, for the site's own asset table. */
  readonly used: readonly E[];
}

export interface SelectFromOptions<E extends AssetCandidate> {
  readonly brief: string;
  readonly positions: readonly AssetPosition[];
  readonly entries: readonly E[];
  readonly designSystem?: DesignSystem | undefined;
  /** Said instead of "the library is empty" when the library could not be read. */
  readonly unavailable?: string | undefined;
}

const STOP = new Set([
  'a',
  'an',
  'and',
  'for',
  'in',
  'of',
  'on',
  'the',
  'to',
  'with',
  'من',
  'في',
  'على',
  'مع',
  'عن',
  'إلى',
]);

const words = (text: string): readonly string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3 && !STOP.has(word));

/**
 * How well one asset answers one position.
 *
 * Deliberately transparent arithmetic rather than a similarity model: a person
 * looking at a picture they did not expect should be able to find out why it
 * was chosen, and "its description shares two words with your brief and its
 * palette matches your accent" is an answer. A score nobody can read is a
 * choice nobody can argue with.
 */
export function scoreAsset(
  entry: AssetCandidate,
  brief: readonly string[],
  intent: readonly string[],
  palette: readonly string[],
): number {
  const haystack = new Set([
    ...words(entry.description),
    ...words(entry.alt),
    ...entry.mood.map((mood) => mood.toLowerCase()),
  ]);

  /* The INTENT weighs more than the brief: the brief describes the whole site,
     the intent describes this one position. */
  const intentHits = intent.filter((word) => haystack.has(word)).length * 3;
  const briefHits = brief.filter((word) => haystack.has(word)).length;
  const paletteHits = entry.palette.filter((colour) =>
    palette.includes(colour.toLowerCase()),
  ).length;

  return intentHits + briefHits + paletteHits;
}

const absent = (reason: string): ImageProp => ({ absent: true, reason });

/**
 * The choosing itself, pure and synchronous.
 *
 * Split out so a caller that already HOLDS the pictures — a stage answering
 * from the catalogue it was sent, which has `url` withheld — uses the same
 * scoring as one that has to go and list a library. Two implementations of
 * "which picture answers this brief" would be two answers that drift.
 */
export function selectFrom<E extends AssetCandidate>(
  options: SelectFromOptions<E>,
): SelectAssetsResult<E> {
  const { brief, positions, entries, designSystem, unavailable } = options;

  const briefWords = words(brief);
  const palette = (designSystem?.pairings ?? []).flatMap((pairing) => [
    designSystem?.tokens[pairing.text]?.toLowerCase() ?? '',
    designSystem?.tokens[pairing.background]?.toLowerCase() ?? '',
  ]);

  const taken = new Set<string>();
  const used: E[] = [];
  const choices: AssetChoice<E>[] = [];

  for (const position of positions) {
    const intentWords = words(position.intent);
    const ranked = entries
      .filter((entry) => !taken.has(entry.id))
      .map((entry) => ({ entry, score: scoreAsset(entry, briefWords, intentWords, palette) }))
      .sort(
        (left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id),
      );

    const best = ranked[0];
    if (best === undefined) {
      /*
        Ran out. Not an error and not a repeat: showing the same photograph
        three times reads as a mistake, and a labelled absence reads as a
        decision — which is what it is.
      */
      choices.push({
        id: position.id,
        image: absent(
          unavailable !== undefined
            ? `The asset library was unavailable (${unavailable}), so this image is empty.`
            : entries.length === 0
              ? 'The asset library is empty, so this image was left deliberately empty.'
              : 'The library ran out of distinct images before this position.',
        ),
      });
      continue;
    }
    if (best.score === 0) {
      choices.push({
        id: position.id,
        image: absent(
          `Nothing in the library matches "${position.intent}", so this image is empty rather than wrong.`,
        ),
      });
      continue;
    }

    taken.add(best.entry.id);
    used.push(best.entry);
    choices.push({ id: position.id, image: { assetId: best.entry.id }, entry: best.entry });
  }

  return { choices, used };
}

export async function selectAssets(request: SelectAssetsRequest): Promise<SelectAssetsResult> {
  const { brief, positions, library, designSystem, signal } = request;

  if (library === undefined) {
    return {
      choices: positions.map((position) => ({
        id: position.id,
        image: absent('No asset library is wired, so this image was left deliberately empty.'),
      })),
      used: [],
    };
  }

  let entries: readonly AssetEntry[];
  try {
    entries = await library.list(signal === undefined ? {} : { signal });
  } catch (error: unknown) {
    /*
      An unavailable library degrades; it does not fail the run. The reason
      carries the library's own words, because "the library did not answer" and
      "the library said no" send a person to different places.
    */
    const said = error instanceof Error ? error.message : 'it did not answer';
    return selectFrom({ brief, positions, entries: [], designSystem, unavailable: said });
  }

  return selectFrom({ brief, positions, entries, designSystem });
}
