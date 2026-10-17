import { commitGeneratedSite, parseSite, projectSite } from '@craftkit/builder';
import type { BuilderSite, BuilderSiteKernel } from '@craftkit/builder';

import { fingerprintSite } from './drafts';

/**
 * The one door a generated SITE lands through — `commitDraft`'s site mirror.
 *
 * ## Why the app supplies the codec and the engine does not
 *
 * `commitGeneratedSite` in `@craftkit/builder-ai` takes the diff and the
 * fingerprint as PORTS. That is not a convenience: `builder-ai` and
 * `builder-transforms` are both layer 2, so the engine may not reach the site
 * codec at all — and it should not want to. How a site is serialised is not the
 * agent's business. The app is where the two meet, which is exactly where
 * `commitDraft` already reaches the canonical-json projection for a page.
 *
 * ## The three promises, unchanged from the page version
 *
 * One transaction, so one undo takes the whole generation back. Attributed to
 * `ai` with a sentence a person can read in history. And refused with ZERO
 * writes when the site moved underneath a run that takes minutes.
 */

export type CommitSiteRefusal =
  /** The live site moved while the run was building. */
  | 'stale'
  /** The draft and the live site are the same; there is nothing to land. */
  | 'unchanged'
  /** The draft did not read back against the live site. */
  | 'invalid';

export type CommitSiteOutcome =
  | { readonly ok: true; readonly patches: number }
  | { readonly ok: false; readonly refusal: CommitSiteRefusal; readonly reason: string };

export interface CommitSiteOptions {
  /** The kernel that owns the real site. The only thing this writes to. */
  readonly live: BuilderSiteKernel;
  /** The site the run produced. Read only; never dispatched into. */
  readonly draft: BuilderSite;
  /** What the live site was when the draft was made. */
  readonly baseFingerprint: string;
  /** One sentence, shown in history. Written by the caller, who knows the run. */
  readonly label: string;
}

export function commitSite(options: CommitSiteOptions): CommitSiteOutcome {
  const { live, draft, baseFingerprint, label } = options;

  /*
    No staleness check here, and its absence is the considered answer.

    One was written — "check first, before the diff is computed, so a moved site
    is reported as stale rather than invalid" — and no mutation could tell it
    from its own absence. The reasoning behind it was simply wrong:
    `parseSite` composes its candidate from the DRAFT alone, so the live site
    moving cannot make the draft fail to read back. `commitGeneratedSite` checks
    the fingerprint before it writes anything, which is the only place the check
    has to be.
  */
  const registry = live.page(live.currentPage()).context.registry;
  const parsed = parseSite(projectSite(draft), live.getSite(), {
    blockExists: (type) => registry.block(type) !== undefined,
  });
  if (!parsed.ok) {
    return {
      ok: false,
      refusal: 'invalid',
      reason: parsed.errors[0]?.message ?? 'The result did not read back against this site.',
    };
  }

  const result = commitGeneratedSite({
    live,
    patches: parsed.patches,
    fingerprint: fingerprintSite,
    baseFingerprint,
    label,
  });
  return result.ok
    ? { ok: true, patches: parsed.patches.length }
    : { ok: false, refusal: result.refusal, reason: result.reason };
}
