import type { InsertionAnchor, SourceHandle } from '@craftkit/builder-schema';

export interface ResolvedInsertionOwner {
  readonly owner: string | SourceHandle;
  readonly children: readonly string[];
}

export interface InsertionAnchorResolver {
  currentRevision(pageId: string): string | undefined;
  resolveOwner(
    pageId: string,
    owner: string | SourceHandle,
    slot: string,
  ): readonly ResolvedInsertionOwner[];
}

export type InsertionAnchorFailureReason =
  | 'revision-unavailable'
  | 'missing-owner'
  | 'ambiguous-owner'
  | 'missing-neighbor'
  | 'neighbors-diverged'
  | 'occupied-empty-anchor'
  | 'invalid-position';

export type InsertionAnchorResult =
  | { readonly ok: true; readonly anchor: InsertionAnchor; readonly index: number }
  | { readonly ok: false; readonly reason: InsertionAnchorFailureReason };

function atBoundary(
  children: readonly string[],
  index: number,
): Pick<InsertionAnchor, 'beforeId' | 'afterId'> {
  const beforeId = children[index - 1];
  const afterId = children[index];
  return {
    ...(beforeId === undefined ? {} : { beforeId }),
    ...(afterId === undefined ? {} : { afterId }),
  };
}

/** Capture the owner and adjacent identities at the visible insertion boundary. */
export function createInsertionAnchor(options: {
  readonly pageId: string;
  readonly owner: string | SourceHandle;
  readonly slot: string;
  readonly mode: InsertionAnchor['mode'];
  readonly children: readonly string[];
  readonly index: number;
  readonly revision: string;
}): InsertionAnchorResult {
  if (
    !Number.isInteger(options.index) ||
    options.index < 0 ||
    options.index > options.children.length
  ) {
    return { ok: false, reason: 'invalid-position' };
  }
  const neighbors = atBoundary(options.children, options.index);
  if (
    options.mode !== 'inside' &&
    neighbors.beforeId === undefined &&
    neighbors.afterId === undefined
  ) {
    return { ok: false, reason: 'missing-neighbor' };
  }
  return {
    ok: true,
    index: options.index,
    anchor: {
      pageId: options.pageId,
      owner: typeof options.owner === 'string' ? options.owner : { ...options.owner },
      slot: options.slot,
      mode: options.mode,
      ...neighbors,
      revision: options.revision,
    },
  };
}

/**
 * Re-resolve by owner and neighbor identity. A changed index is safe; a lost or separated
 * neighbor is a conflict. No branch appends to an arbitrary parent as a fallback.
 */
export function revalidateInsertionAnchor(
  anchor: InsertionAnchor,
  resolver: InsertionAnchorResolver,
): InsertionAnchorResult {
  const revision = resolver.currentRevision(anchor.pageId);
  if (revision === undefined) return { ok: false, reason: 'revision-unavailable' };
  const owners = resolver.resolveOwner(anchor.pageId, anchor.owner, anchor.slot);
  if (owners.length === 0) return { ok: false, reason: 'missing-owner' };
  if (owners.length > 1) return { ok: false, reason: 'ambiguous-owner' };
  const resolved = owners[0];
  if (resolved === undefined) return { ok: false, reason: 'missing-owner' };

  const beforeIndex =
    anchor.beforeId === undefined ? undefined : resolved.children.indexOf(anchor.beforeId);
  const afterIndex =
    anchor.afterId === undefined ? undefined : resolved.children.indexOf(anchor.afterId);
  if (beforeIndex === -1 || afterIndex === -1) return { ok: false, reason: 'missing-neighbor' };

  let index: number;
  if (beforeIndex !== undefined && afterIndex !== undefined) {
    if (afterIndex !== beforeIndex + 1) return { ok: false, reason: 'neighbors-diverged' };
    index = afterIndex;
  } else if (beforeIndex !== undefined) {
    index = beforeIndex + 1;
  } else if (afterIndex !== undefined) {
    index = afterIndex;
  } else {
    if (resolved.children.length > 0) return { ok: false, reason: 'occupied-empty-anchor' };
    index = 0;
  }

  return {
    ok: true,
    index,
    anchor: {
      ...anchor,
      owner: typeof resolved.owner === 'string' ? resolved.owner : { ...resolved.owner },
      revision,
    },
  };
}
