/**
 * Which curated font pairs FontPairMenu may offer: only faces the engine has verified
 * (SPEC §4.11 "curated Arabic-capable pairs"; the engine's `VERIFIED_FONT_FAMILIES`, each
 * fetched from both font hosts with its Arabic ranges and rendered in Chromium).
 *
 * The curated list is the model's `FONT_PAIRS`, and `page-plan-draft.test.ts` runs every
 * pair through the engine's own `validatePagePlan` on an Arabic page and an English one.
 * This is the runtime half of that promise: when the engine's public API exports its
 * verified families (`VERIFIED_FONT_FAMILIES`), or the direction deck whose every face was
 * fetched with its weights (`DIRECTION_DECK_ROWS`), a pair naming any other face is left
 * out, so a menu can never offer a face the build would refuse. Until it does (both are
 * internal to `@craftkit/builder-ai` on 2026-09-28), the validator-checked list stands.
 */
import * as builder from '@craftkit/builder';

import { FONT_PAIRS } from '../../model/page-plan-draft';
import type { FontPairOption } from '../../model/view-types';

/**
 * The engine exports this reads, as a narrow shape, so a facade without the list still
 * types. `validatePagePlan` is the judge the curated list is tested against today; it is
 * named here too, which also keeps the shape from being one no facade could match.
 */
interface DeckFaceShape {
  readonly family: string;
}

/** One direction-deck row, as far as its faces: an Arabic pair and a Latin pair. */
interface DeckRowShape {
  readonly arabic?: readonly DeckFaceShape[] | undefined;
  readonly latin?: readonly DeckFaceShape[] | undefined;
}

interface VerifiedFacesSurface {
  readonly VERIFIED_FONT_FAMILIES?: Readonly<Record<string, unknown>> | undefined;
  readonly DIRECTION_DECK_ROWS?: readonly DeckRowShape[] | undefined;
  readonly validatePagePlan?: unknown;
}

const ENGINE: VerifiedFacesSurface = builder;

/**
 * The engine's verified family names: the keys of `VERIFIED_FONT_FAMILIES` and every face
 * a direction-deck row names. `null` while its public API exports neither.
 */
export function engineVerifiedFamilies(
  engine: VerifiedFacesSurface = ENGINE,
): ReadonlySet<string> | null {
  const families = engine.VERIFIED_FONT_FAMILIES;
  const rows = engine.DIRECTION_DECK_ROWS;
  if (families === undefined && rows === undefined) return null;
  const verified = new Set(families === undefined ? [] : Object.keys(families));
  for (const row of rows ?? []) {
    for (const face of [...(row.arabic ?? []), ...(row.latin ?? [])]) verified.add(face.family);
  }
  return verified;
}

/** `options` (the curated pairs by default) with any pair naming an unverified face removed. */
export function verifiedPairs(
  options: readonly FontPairOption[] = FONT_PAIRS,
  verified: ReadonlySet<string> | null = engineVerifiedFamilies(),
): readonly FontPairOption[] {
  if (verified === null) return options;
  return options.filter((pair) => verified.has(pair.heading) && verified.has(pair.body));
}
