import {
  GROUPED_DISPATCH_LABEL_MAX_LENGTH,
  type BuilderKernel,
  type GroupStep,
} from '@craftkit/builder-core';
import { BuilderError, type ContentDirection, type Transaction } from '@craftkit/builder-schema';

import type { AiPlan, AiValidationPorts } from '../types';
import type { AiEffectiveCommandPolicy } from '../skills';
import {
  assertAuthenticatedAiValidatedProposal,
  resolveAiProposalAuthority,
  type AiValidatedProposal,
} from './validated-proposal';
import { assertValidAiPlan, AUTHORED_PLAN_DOOR } from './validate-plan';
// script-wiring additions
import type { SiteGroupStep } from '@craftkit/builder-core';
import type { AiPlanSite, ScriptCrossPage } from '../script/cross-page';
// end script-wiring additions

export interface AppliedAiPlan {
  /**
   * 'group': the whole plan went through the kernel's grouped door as ONE
   * transaction — one history entry, one undo, atomic. This is what makes the
   * panel's "one entry in history, one undo" promise literally true for
   * multi-command plans.
   */
  mode: 'group';
  transactions: readonly Transaction[];
  /** Present when the authenticated proposal path owned this application. */
  proposal?: AiValidatedProposal;
}

interface ApplyAiPlanOptionsBase {
  kernel: BuilderKernel;
  validationPorts: AiValidationPorts;
  /** Human history label. The core door validates explicitly supplied values. */
  label?: string;
  // script-wiring additions
  /**
   * agent-script (DESIGN §A.9): the site `kernel` is a page lens of. Needed
   * only with `crossPage`; the plan then lands in ONE `site.dispatchGroup`.
   */
  site?: AiPlanSite;
  /**
   * agent-script: a script's writes to other pages (`scriptCrossPage(plan)`).
   * Every page's steps are re-validated on that page's lens with the plan's
   * policy, then applied with the open page's steps as one transaction whose
   * Undo reverts every page. Requires `site`.
   */
  crossPage?: ScriptCrossPage;
  // end script-wiring additions
}

export interface ApplyAiValidatedProposalOptions extends ApplyAiPlanOptionsBase {
  proposal: AiValidatedProposal;
  plan?: never;
  policy?: never;
}

export interface ApplyAiPlanCompatibilityOptions extends ApplyAiPlanOptionsBase {
  proposal?: never;
  plan: AiPlan;
  /** Required at type and runtime; compatibility never infers generation authority. */
  policy: AiEffectiveCommandPolicy;
}

export type ApplyAiPlanOptions = ApplyAiValidatedProposalOptions | ApplyAiPlanCompatibilityOptions;

function defaultLabel(plan: AiPlan): string {
  const detail = plan.rationale.replace(/\s+/g, ' ').trim();
  return `AI: ${detail}`.slice(0, GROUPED_DISPATCH_LABEL_MAX_LENGTH);
}

/**
 * The site door's refusal of a page turning on its own — the one refusal this
 * door answers on the plan's behalf rather than surfacing.
 *
 * A plan says `setDocMeta {dir}` because the craft manual tells the model to,
 * and the rehearsal accepts it because the rehearsal is a document kernel. The
 * kernel the PRODUCT applies through is a page lens over a site, and a site
 * keeps one direction: the lens refuses the page-scoped turn and names
 * `setSiteDirection`, a command the model has no way to say. Seen live on
 * 2026-09-05 as "site/structural-violation" on Apply.
 */
function refusesAPageTurningAlone(error: unknown): boolean {
  return (
    error instanceof BuilderError &&
    error.code === 'site/structural-violation' &&
    error.message.includes('setSiteDirection')
  );
}

/**
 * The same plan, said the site's way: every `setDocMeta` that carries a
 * direction becomes `setSiteDirection` (the rest of that step stays a page
 * write), and a direction the site already has is dropped, because the site
 * command refuses a no-op where the page command did not.
 */
function turningTheWholeSite(steps: readonly GroupStep[], current: ContentDirection): GroupStep[] {
  const said: GroupStep[] = [];
  for (const step of steps) {
    const args = step.args;
    if (
      step.command !== 'setDocMeta' ||
      typeof args !== 'object' ||
      args === null ||
      !('dir' in args)
    ) {
      said.push(step);
      continue;
    }
    const { dir, ...rest } = args as { dir?: unknown } & Record<string, unknown>;
    if (Object.keys(rest).length > 0) said.push({ command: 'setDocMeta', args: rest });
    if ((dir === 'ltr' || dir === 'rtl') && dir !== current) {
      said.push({ command: 'setSiteDirection', args: { dir } });
    }
  }
  return said;
}

// script-wiring additions
/** `turningTheWholeSite`, keeping each page step's `pageId` (a site command ignores it). */
function turningTheWholeSiteAcrossPages(
  steps: readonly SiteGroupStep[],
  current: ContentDirection,
): SiteGroupStep[] {
  return steps.flatMap((step) =>
    turningTheWholeSite([step], current).map((said) =>
      step.pageId === undefined ? said : { ...said, pageId: step.pageId },
    ),
  );
}

/**
 * A plan whose script also wrote other pages (DESIGN §A.9): the open page's
 * steps and every other page's, each re-validated on its own page lens under
 * the plan's policy, land in ONE grouped site write — one history entry, one
 * Undo that reverts every page.
 */
function applyAcrossPages(
  options: ApplyAiPlanOptions,
  authority: ReturnType<typeof resolveAiProposalAuthority>,
  crossPage: ScriptCrossPage,
): AppliedAiPlan {
  const site = options.site;
  if (site === undefined) {
    throw new Error(
      'applyAiPlan: this plan writes other pages of the site (a script); pass `site` so they land in one transaction.',
    );
  }
  const currentPage = site.currentPage();
  if (site.page(currentPage) !== options.kernel) {
    throw new Error(
      `applyAiPlan: the site's current page "${currentPage}" is not the page this plan was made for.`,
    );
  }
  // A script that wrote only other pages leaves the open page nothing to judge.
  const plan =
    authority.plan.commands.length === 0
      ? authority.plan
      : assertValidAiPlan(
          authority.plan,
          options.kernel,
          options.validationPorts,
          authority.policy,
          AUTHORED_PLAN_DOOR,
        );
  const elsewhere = crossPage.map(({ pageId, commands }) => {
    if (pageId === currentPage) {
      throw new Error(`applyAiPlan: cross-page writes name the open page "${pageId}".`);
    }
    const checked = assertValidAiPlan(
      { rationale: plan.rationale, commands },
      site.page(pageId),
      options.validationPorts,
      authority.policy,
      AUTHORED_PLAN_DOOR,
    );
    return { pageId, commands: checked.commands };
  });
  // Keep the authentication check adjacent to the only live mutation door.
  if (authority.proposal !== undefined) {
    assertAuthenticatedAiValidatedProposal(authority.proposal);
  }
  const steps: SiteGroupStep[] = [
    ...plan.commands.map((step) => ({ command: step.command, args: step.args, pageId: currentPage })),
    ...elsewhere.flatMap(({ pageId, commands }) =>
      commands.map((step) => ({ command: step.command, args: step.args, pageId })),
    ),
  ];
  const group = { author: 'ai' as const, label: options.label ?? defaultLabel(plan) };
  let tx: Transaction;
  try {
    tx = site.dispatchGroup(steps, group);
  } catch (cause) {
    if (!refusesAPageTurningAlone(cause)) throw cause;
    tx = site.dispatchGroup(
      turningTheWholeSiteAcrossPages(steps, options.kernel.getDocument().dir),
      group,
    );
  }
  return {
    mode: 'group',
    transactions: [tx],
    ...(authority.proposal === undefined ? {} : { proposal: authority.proposal }),
  };
}
// end script-wiring additions

export function applyAiPlan(options: ApplyAiPlanOptions): AppliedAiPlan {
  const authority = resolveAiProposalAuthority(options);
  // script-wiring additions
  if (options.crossPage !== undefined && options.crossPage.length > 0) {
    return applyAcrossPages(options, authority, options.crossPage);
  }
  // end script-wiring additions
  const plan = assertValidAiPlan(
    authority.plan,
    options.kernel,
    options.validationPorts,
    authority.policy,
    AUTHORED_PLAN_DOOR,
  );
  // Keep the authentication check adjacent to the only live mutation door.
  if (authority.proposal !== undefined) {
    assertAuthenticatedAiValidatedProposal(authority.proposal);
  }
  const steps: GroupStep[] = plan.commands.map((step) => ({
    command: step.command,
    args: step.args,
  }));
  const group = { author: 'ai' as const, label: options.label ?? defaultLabel(plan) };
  let tx: Transaction;
  try {
    tx = options.kernel.dispatchGroup(steps, group);
  } catch (cause) {
    /*
      Nothing was written: the site door refuses BEFORE it commits, and a
      document kernel never raises this code at all. Re-said as one group, so
      the promise underneath — one entry in history, one undo — still holds.
    */
    if (!refusesAPageTurningAlone(cause)) throw cause;
    tx = options.kernel.dispatchGroup(
      turningTheWholeSite(steps, options.kernel.getDocument().dir),
      group,
    );
  }
  return {
    mode: 'group',
    transactions: [tx],
    ...(authority.proposal === undefined ? {} : { proposal: authority.proposal }),
  };
}
