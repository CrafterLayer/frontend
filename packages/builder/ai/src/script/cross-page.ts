/**
 * Cross-page script writes, carried beside a plan (agent-script DESIGN §A.9, script-wiring).
 *
 * A script may write to pages other than the open one when the host passes a
 * site (`ck.find({page:'*'})`, `ck.tool(name, input, {page})`). Those writes
 * are expanded, coalesced and door-validated against each page's lens by
 * `expandScriptSteps`, and land with the current page's steps in ONE
 * `site.dispatchGroup`: one transaction, one Undo across every page.
 *
 * They ride on the validated `AiPlan` through a module-level WeakMap rather
 * than a plan field: wire v1 is unchanged, a provider can never forge them,
 * and the sidecar dies with the plan object it was attached to.
 */
import type { BuilderKernel, GroupedDispatchOptions, SiteGroupStep } from '@craftkit/builder-core';
import type { Transaction } from '@craftkit/builder-schema';

import type { AiPlan } from '../types';
import { SCRIPT_TOOL_NAME } from './types';

/** One step a script wrote for another page, already expanded and coalesced. */
export interface ScriptCrossPageStep {
  readonly command: string;
  readonly args: unknown;
  readonly title?: string;
}

/** Every write a script made to ONE other page. */
export interface ScriptCrossPageWrite {
  readonly pageId: string;
  readonly commands: readonly ScriptCrossPageStep[];
}

/** A script's writes to other pages, in the order the pages were first written. */
export type ScriptCrossPage = readonly ScriptCrossPageWrite[];

/**
 * The site door `applyAiPlan` needs to land a plan across pages: the open
 * page's id, a lens per page (each page's steps are re-validated on its own
 * lens) and the site's grouped door, which takes a `pageId` per step.
 * A `BuilderSiteKernel` satisfies it as is.
 */
export interface AiPlanSite {
  currentPage(): string;
  page(pageId: string): BuilderKernel;
  dispatchGroup(
    steps: readonly SiteGroupStep[],
    options?: GroupedDispatchOptions,
  ): Transaction;
}

const EMPTY: ScriptCrossPage = Object.freeze([]);

const sidecar = new WeakMap<object, ScriptCrossPage>();

/**
 * Attach a script's other-page writes to the validated plan they belong to.
 * An empty list attaches nothing. Returns the same plan object.
 */
export function attachScriptCrossPage<T extends AiPlan>(plan: T, crossPage: ScriptCrossPage): T {
  const writes = crossPage.filter(({ commands }) => commands.length > 0);
  if (writes.length === 0) return plan;
  sidecar.set(
    plan,
    Object.freeze(
      writes.map(({ pageId, commands }) =>
        Object.freeze({ pageId, commands: Object.freeze([...commands]) }),
      ),
    ),
  );
  return plan;
}

/** The other-page writes attached to this exact plan object; empty when none. */
export function scriptCrossPage(plan: AiPlan | undefined): ScriptCrossPage {
  if (plan === undefined) return EMPTY;
  return sidecar.get(plan) ?? EMPTY;
}

/** How many pages a plan with these other-page writes changes, the open page included when it has steps. */
export function scriptPagesTouched(plan: AiPlan, crossPage: ScriptCrossPage): number {
  return crossPage.length + (plan.commands.length > 0 ? 1 : 0);
}

/**
 * Whether a provider's raw answer names `script.run` anywhere — the cheap
 * check that keeps every other plan off the script path (0 bytes loaded).
 */
export function planHasScriptStep(candidate: unknown): boolean {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const commands = (candidate as { commands?: unknown }).commands;
  if (!Array.isArray(commands)) return false;
  return commands.some((step: unknown) => {
    if (typeof step !== 'object' || step === null) return false;
    const { command, args } = step as { command?: unknown; args?: unknown };
    if (command !== 'tool' || typeof args !== 'object' || args === null) return false;
    return (args as { name?: unknown }).name === SCRIPT_TOOL_NAME;
  });
}

function arabicPages(count: number): string {
  if (count === 1) return 'صفحة واحدة';
  if (count === 2) return 'صفحتين';
  if (count >= 3 && count <= 10) return `${String(count)} صفحات`;
  return `${String(count)} صفحة`;
}

/**
 * The sentence a proposal (Ask mode) gets instead of a cross-page change it
 * cannot rehearse (DESIGN §A.9, follow-up F3): nothing is proposed, and the
 * person is told to send it again in Auto, where it lands as one Undo.
 */
export function scriptCrossPageFollowUp(pages: number, language: 'ar' | 'en'): string {
  return language === 'ar'
    ? `هذا التعديل يشمل ${arabicPages(pages)} من الموقع، والمعاينة تعرض صفحة واحدة فقط، لذلك لم يُقترح شيء. بدّل إلى الوضع التلقائي وأعد الطلب ليُطبَّق على كل الصفحات دفعة واحدة، وتراجع واحد يلغيه.`
    : `This change spans ${String(pages)} pages of the site, and a proposal can only rehearse one page, so nothing was proposed. Switch to Auto and send it again to apply it to every page at once; one Undo reverts it.`;
}

/**
 * A script whose every write lands on OTHER pages leaves the open page with no
 * command, which the door refuses as an empty plan. Its words still stand:
 * the other pages' steps were door-validated on their own lenses during
 * expansion, and `applyAiPlan` re-validates them before the one site write.
 */
export function crossPageOnlyPlan(expanded: unknown): AiPlan | undefined {
  if (typeof expanded !== 'object' || expanded === null) return undefined;
  const { rationale, commands, followUp } = expanded as {
    rationale?: unknown;
    commands?: unknown;
    followUp?: unknown;
  };
  if (!Array.isArray(commands) || commands.length > 0) return undefined;
  const reason = typeof rationale === 'string' && rationale.trim() !== '' ? rationale : 'Script';
  return Object.freeze({
    rationale: reason,
    commands: Object.freeze([]),
    ...(typeof followUp === 'string' && followUp.trim() !== '' ? { followUp } : {}),
  });
}
