import { useSyncExternalStore } from 'react';

import {
  GROUPED_DISPATCH_LABEL_MAX_LENGTH,
  type BuilderSiteKernel,
  type SiteGroupStep,
} from '@craftkit/builder-core';
import type { Author, BuilderSite } from '@craftkit/builder-schema';

/*
  ── The narrow door the design-system surfaces write through ───────────────
  (style-manager DESIGN.md §0.1, §G)

  Every panel in this family — the design-system editor, the class manager,
  symbols, the asset manager and the design-library transfer — writes the
  same way: a list of site and page steps sent as ONE `dispatchGroup` with a
  readable label, so one person-visible action is one transaction and one
  Undo. A refusal comes back as a sentence the panel shows, and the document
  is untouched (the site dispatcher runs the whole group in one production).

  `SiteDoor` is the slice of the site kernel those panels need. The real
  `BuilderSiteKernel` satisfies it as is; tests hand a real kernel too.
*/

export type SiteDoor = Pick<
  BuilderSiteKernel,
  'getSite' | 'subscribe' | 'dispatchGroup' | 'page' | 'currentPage'
>;

export type SiteCommitResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

/** One labelled commit: `steps` go through the door as one transaction. */
export type SiteCommit = (steps: readonly SiteGroupStep[], label: string) => SiteCommitResult;

/** Collapse whitespace and clip to the kernel's grouped-label ceiling. */
export function siteCommitLabel(label: string): string {
  const trimmed = label.replace(/\s+/gu, ' ').trim();
  if (trimmed.length <= GROUPED_DISPATCH_LABEL_MAX_LENGTH) return trimmed;
  return `${trimmed.slice(0, GROUPED_DISPATCH_LABEL_MAX_LENGTH - 1).trimEnd()}…`;
}

/**
 * Send `steps` as ONE labelled transaction. Never throws: the door's refusal
 * comes back as `{ ok: false, message }` in the door's own words.
 */
export function commitSiteSteps(
  door: Pick<SiteDoor, 'dispatchGroup'>,
  steps: readonly SiteGroupStep[],
  label: string,
  author: Author = 'user',
): SiteCommitResult {
  if (steps.length === 0) return { ok: true };
  const clipped = siteCommitLabel(label);
  try {
    door.dispatchGroup(steps, clipped === '' ? { author } : { author, label: clipped });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/** A `SiteCommit` bound to one door (what a host hands a props-driven panel). */
export function siteCommitFor(door: Pick<SiteDoor, 'dispatchGroup'>, author: Author = 'user'): SiteCommit {
  return (steps, label) => commitSiteSteps(door, steps, label, author);
}

/** The site as it stands, re-rendering on every committed change (undo included). */
export function useSiteSnapshot(door: Pick<SiteDoor, 'getSite' | 'subscribe'>): Readonly<BuilderSite> {
  return useSyncExternalStore(door.subscribe, door.getSite, door.getSite);
}
