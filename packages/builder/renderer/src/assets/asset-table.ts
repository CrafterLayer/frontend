import { createContext, useContext } from 'react';

import type { AssetEntry, AssetId, ImageProp } from '@craftkit/builder-schema';

/**
 * The site's asset table, made reachable from inside a block (FR-045).
 *
 * ## Why a context and not a prop
 *
 * Because a block is rendered by a recursion — `NodeView` inside `NodeView`
 * inside a slot — and an image can appear at any depth, inside any block, in a
 * prop the registry named. Threading a table through every level would put the
 * word "assets" in the signature of every renderer that has no images in it,
 * and would still miss the next block that nests one somewhere new.
 *
 * ## Why the default is empty rather than undefined
 *
 * So that a block rendered with no provider at all — in a story, in a test, in
 * a static export — degrades to a LABELLED ABSENCE instead of throwing. A
 * picture that cannot be resolved is a hole with an explanation in it; it is
 * never an error that takes the page down with it.
 */

export type AssetTable = Readonly<Record<AssetId, AssetEntry>>;

export const AssetTableContext = createContext<AssetTable>({});

export function useAssetTable(): AssetTable {
  return useContext(AssetTableContext);
}

/**
 * What a block should draw for one image position.
 *
 * There are exactly three answers and the third is the interesting one: a
 * reference the table cannot resolve. That is not corruption and not a reason
 * to fail the page — an asset can be deleted while a site that references it is
 * still open — so it degrades to an absence carrying its own sentence.
 */
export type ResolvedImage =
  | { readonly kind: 'asset'; readonly entry: AssetEntry }
  | { readonly kind: 'absent'; readonly reason: string };

export function resolveImage(
  image: ImageProp | undefined,
  table: AssetTable,
): ResolvedImage | undefined {
  if (image === undefined) return undefined;
  if ('absent' in image) return { kind: 'absent', reason: image.reason };

  const entry = table[image.assetId];
  if (entry === undefined) {
    /*
      Defensive, and it should never fire on a stored site: `validateSite`
      refuses a site whose reference does not resolve in its OWN asset table,
      and the table holds COPIES — so a picture vanishing from the library
      cannot cause this. What can is a document rendered outside its site: a
      page in isolation, a static export assembled without the table.

      Named, not numbered, because the answer is either "pass the table" or
      "choose another picture" and both need to know which one.
    */
    return {
      kind: 'absent',
      reason: `The picture "${image.assetId}" is not in the asset table this page was rendered with.`,
    };
  }
  return { kind: 'asset', entry };
}
