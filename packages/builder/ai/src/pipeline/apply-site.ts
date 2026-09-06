import type { BuilderSiteKernel } from '@craftkit/builder-core';
import type { Author, BuilderSite, Patch, PageId, Transaction } from '@craftkit/builder-schema';

import type { AssemblyStep } from './wire';

/**
 * The other half of "the caller sends these through the same door".
 *
 * ## Why this file has to exist
 *
 * `generateSite` returns commands and touches nothing, which is what makes a
 * failure at stage four cost zero bytes of a person's site. But a producer with
 * no consumer is a claim nobody has checked: for as long as nothing applied
 * these commands, "they go through the same door a plan goes through" was a
 * sentence in a comment. The first test that actually tried it found the
 * assembly emitting `addPage` args the door refuses.
 *
 * ## The one problem it solves
 *
 * A page command cannot name the page it edits, because the page does not exist
 * when the batch is written — `addPage` mints its id from the kernel's own port
 * (Law D). So an assembly step names its SITEMAP page, and this applier watches
 * pages come into existence and keeps the map from one to the other.
 *
 * That is why the steps are applied ONE AT A TIME rather than as a group: a
 * group is produced in a single pass and cannot read back an id minted halfway
 * through it. The one-transaction, one-undo promise is not lost — it is moved
 * to where it belongs, the COMMIT, which puts a whole generation onto the live
 * site as a single `applySitePatches`.
 *
 * So: apply into a DRAFT kernel, whose history is nobody's, then commit once.
 */

export interface ApplySiteCommandsOptions {
  /** The kernel the commands are applied to. In production, a draft. */
  readonly kernel: BuilderSiteKernel;
  readonly commands: readonly AssemblyStep[];
  readonly author?: Author;
}

export interface AppliedSiteCommand {
  readonly step: AssemblyStep;
  /** The page it landed on, once resolved. */
  readonly pageId?: PageId;
}

export interface SiteCommandRefusal {
  readonly step: AssemblyStep;
  readonly index: number;
  readonly reason: string;
}

export type ApplySiteCommandsResult =
  | { readonly ok: true; readonly applied: readonly AppliedSiteCommand[] }
  | {
      readonly ok: false;
      readonly refusal: SiteCommandRefusal;
      /** What had already landed when the refusal came. */
      readonly applied: readonly AppliedSiteCommand[];
    };

/**
 * Apply an assembly batch, stopping at the first command the door refuses.
 *
 * STOPPING, not skipping. A site assembled from the commands that happened to
 * be acceptable is a site nobody designed: the sections that survived were
 * chosen by which ones passed, not by anyone's judgement, and a person shown it
 * has no way to know what is missing. The refusal names the command and its
 * position, and the caller — holding a draft — throws the draft away.
 */
export function applySiteCommands(options: ApplySiteCommandsOptions): ApplySiteCommandsResult {
  const { kernel, commands, author = 'ai' } = options;
  const minted = new Map<string, PageId>();
  const applied: AppliedSiteCommand[] = [];

  for (const [index, step] of commands.entries()) {
    const known = new Set(kernel.getSite().pages.map((page) => page.id));
    const pageId = step.page === undefined ? undefined : minted.get(step.page);

    if (step.page !== undefined && pageId === undefined && step.command !== 'addPage') {
      return {
        ok: false,
        applied,
        refusal: {
          step,
          index,
          reason: `Command ${String(index + 1)} ("${step.command}") edits the page "${step.page}", which nothing in this batch created.`,
        },
      };
    }

    try {
      kernel.dispatch(step.command, step.args, author, pageId);
    } catch (error: unknown) {
      return {
        ok: false,
        applied,
        refusal: {
          step,
          index,
          reason:
            error instanceof Error
              ? error.message
              : `Command ${String(index + 1)} ("${step.command}") was refused.`,
        },
      };
    }

    if (step.command === 'addPage' && step.page !== undefined) {
      /*
        Read back by difference rather than from the transaction's patches. The
        patch path for an insert is an INDEX (`pages/2`), and `addPage` accepts
        an index, so the page a batch just added is not reliably the last one —
        but it is reliably the one that was not there a moment ago.
      */
      const added = kernel.getSite().pages.find((page) => !known.has(page.id));
      if (added !== undefined) {
        minted.set(step.page, added.id);
        applied.push({ step, pageId: added.id });
        continue;
      }
    }

    applied.push(pageId === undefined ? { step } : { step, pageId });
  }

  return { ok: true, applied };
}

/* ── The commit ───────────────────────────────────────────────────────────── */

export interface CommitGeneratedSiteOptions {
  /** The kernel that owns the real site. The only thing this writes to. */
  readonly live: BuilderSiteKernel;
  /**
   * What changed, as the CALLER's codec computed it.
   *
   * A port, not a computation, and the layer law is only half the reason. The
   * other half is that this package must not know how a site is SERIALISED:
   * the codec has its own round-trip laws at a thousand cases each, and a
   * second differ living here would be a second answer to "what changed" with
   * none of them.
   */
  readonly patches: readonly Patch[];
  /** The site's identity function — the same one that produced `baseFingerprint`. */
  readonly fingerprint: (site: BuilderSite) => string;
  /** What the live site was when the draft was seeded. */
  readonly baseFingerprint: string;
  /** One sentence, shown in history. Written by the caller, who knows the run. */
  readonly label: string;
}

export type CommitGeneratedSiteResult =
  | { readonly ok: true; readonly transaction: Transaction }
  | { readonly ok: false; readonly refusal: 'stale' | 'unchanged'; readonly reason: string };

/**
 * A whole generation onto the live site, as ONE transaction (SC-011).
 *
 * ## Why a commit and not a group of the original commands
 *
 * Because the commands cannot be one group. A page command names a page that
 * `addPage` mints inside the batch, and a group is produced in a single pass
 * with no way to read an id back halfway through. So the batch is applied to a
 * draft — many transactions, in a history that is nobody's — and the RESULT is
 * committed here as a single `applySitePatches`. One entry in history, one
 * undo, exactly as `applyAiPlan` gives a page.
 *
 * The door still validates: `applySitePatches` runs `validateSite` over the
 * whole result before it commits, and refuses the batch entire if the site it
 * would produce is invalid.
 */
export function commitGeneratedSite(
  options: CommitGeneratedSiteOptions,
): CommitGeneratedSiteResult {
  const { live, patches, fingerprint, baseFingerprint, label } = options;

  /*
    Checked FIRST, before anything is computed. Not for speed — for the promise:
    "zero writes" is easy to state and easy to lose, and the way to keep it is
    to leave before there is anything to lose.
  */
  if (fingerprint(live.getSite()) !== baseFingerprint) {
    return {
      ok: false,
      refusal: 'stale',
      reason: 'The site changed while this was building, so nothing was applied.',
    };
  }
  if (patches.length === 0) {
    return {
      ok: false,
      refusal: 'unchanged',
      reason: 'The run produced nothing the site does not already have.',
    };
  }

  const transaction = live.dispatchGroup(
    [{ command: 'applySitePatches', args: { patches: [...patches] } }],
    { author: 'ai', label },
  );
  return { ok: true, transaction };
}
