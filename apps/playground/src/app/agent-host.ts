/**
 * What the app hands the agent panel, read from the environment and the site kernel.
 *
 * Kept out of `App.tsx` so every rule here is a table in a test: which panel mounts, the
 * fast model and effort an edit runs on, and how a "new page" request opens its page.
 */
import type { BuilderKernel, BuilderSiteKernel } from '@craftkit/builder';

import type { EditEffort, Locale } from '../features/agent';
// script-wiring additions
import { rememberAgentSite } from '../features/agent/model/script-site';
// end script-wiring additions

type Env = Readonly<Record<string, unknown>>;

function envString(env: Env, key: string): string {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Which agent panel mounts: the v2 panel (`features/agent/`) unless
 * `VITE_AGENT_PANEL=v1` asks for the old AssistantPanel, the rollback kept for one
 * release (SPEC §8 WP-20, FR-053). Any other value, or none, is v2.
 */
export function agentPanelFromEnv(env: Env): 'v1' | 'v2' {
  return envString(env, 'VITE_AGENT_PANEL').toLowerCase() === 'v1' ? 'v1' : 'v2';
}

/**
 * The panel's language when the build pins one (`VITE_AGENT_LOCALE=en|ar`): the live
 * screenshots' English and Arabic halves. Unset (2026-10-12), the panel speaks the
 * editor's language, so one choice in Settings turns the whole editor, panel included.
 */
export function agentLocaleFromEnv(env: Env): Locale | undefined {
  const value = envString(env, 'VITE_AGENT_LOCALE').toLowerCase();
  return value === 'en' || value === 'ar' ? value : undefined;
}

/*
  The server's own speed ranking (apps/ai-server/src/model-policy.ts `fastestModel`),
  restated here because an app never imports the server. Nothing reports a model's speed
  ahead of a call, so the name decides, in three tiers: the small tiers every vendor names
  alike; the middle tiers; everything else. A ':free' slug ranks after every other entry of
  its tier (its time is its queue's), and a tier word counts only as a whole word of the
  slug ("gemini" is not "mini", "minimax" is not "mini"). Ties keep the order given.
*/
const SPEED_TIERS: readonly RegExp[] = [
  /(?<![a-z])(?:haiku|flash|lite|mini|nano|small|luna|instant|turbo)(?![a-z])/iu,
  /(?<![a-z])(?:sonnet|terra|medium)(?![a-z])/iu,
];

function speedRank(model: string): number {
  const tier = SPEED_TIERS.findIndex((pattern) => pattern.test(model));
  const named = tier === -1 ? SPEED_TIERS.length : tier;
  return named * 2 + (model.endsWith(':free') ? 1 : 0);
}

/** The fastest of `models` by the server's ranking; `undefined` when none is given. */
export function fastestModel(models: readonly string[]): string | undefined {
  let best: string | undefined;
  for (const candidate of models) {
    const model = candidate.trim();
    if (model === '') continue;
    if (best === undefined || speedRank(model) < speedRank(best)) best = model;
  }
  return best;
}

/**
 * The model a page build runs on, and the one the composer's picker shows: the person's
 * remembered pick while the server still offers it, else the fastest offered model — the
 * owner ranks speed first, so the first name in `VITE_AI_PLAN_MODELS` does not decide.
 * With nothing offered, `undefined`: no model is named and the server's default answers.
 */
export function planModelChoice(
  stored: string | null | undefined,
  offered: readonly string[],
): string | undefined {
  if (stored !== null && stored !== undefined && offered.includes(stored)) return stored;
  return fastestModel(offered);
}

/**
 * The model an edit or a new section runs on (`RunAiAgentOptions.editModel`): the
 * owner's `VITE_AI_EDIT_MODEL` when set, else the fastest of the models the server was
 * told to allow (`VITE_AI_PLAN_MODELS`, which must match its `CRAFTKIT_AI_MODELS`).
 * With neither, `undefined`: the server answers with its own default. A page build keeps
 * the model the person picked.
 */
export function editModelFromEnv(env: Env, offered: readonly string[]): string | undefined {
  const chosen = envString(env, 'VITE_AI_EDIT_MODEL');
  return chosen === '' ? fastestModel(offered) : chosen;
}

/**
 * The reasoning effort that goes with the edit model (`VITE_AI_EDIT_EFFORT`): `low` or
 * `medium`, `low` by default. The owner ranks speed first (2026-09-05), and an edit is one
 * section read against an outline, not a page to plan.
 */
export function editEffortFromEnv(env: Env): EditEffort {
  return envString(env, 'VITE_AI_EDIT_EFFORT').toLowerCase() === 'medium' ? 'medium' : 'low';
}

/** `/page-N`, the first N past the site's page count that no page holds yet. */
export function nextPageAddress(addresses: readonly string[]): string {
  let index = addresses.length + 1;
  while (addresses.includes(`/page-${String(index)}`)) index += 1;
  return `/page-${String(index)}`;
}

/**
 * The panel's `addPage`: a "new page" request opens a page on the site, titled from the
 * request, makes it the current page and hands the build its lens. The same two steps
 * Pages → Add page takes (`page-workspace.tsx`), through the site kernel's door, authored
 * `ai` so the change strip says who opened it. A refused command rejects, and the panel
 * then builds below the current page and says so. A site build (T230) opens its further
 * pages with `{ current: false }`, so the page the person watches (the home page) stays
 * current while the others are written beside it.
 */
export function pageOpener(
  siteKernel: BuilderSiteKernel,
): (
  title: string,
  open?: { readonly current?: boolean },
) => Promise<{ readonly kernel: BuilderKernel }> {
  // script-wiring additions
  /*
    The panel's site hand-off for code mode (agent-script DESIGN §A.9): the opener is the
    one thing the app builds from its site kernel for the panel, so the site is remembered
    here, and an edit run finds it again by its page lens (`agentScriptSiteFor`) — a script
    may then write every page in one transaction, one Undo.
  */
  rememberAgentSite(siteKernel);
  // end script-wiring additions
  return (title, open = {}) => {
    try {
      const pages = siteKernel.getSite().pages;
      const before = new Set(pages.map((page) => page.id));
      const address = nextPageAddress(pages.map((page) => page.address));
      siteKernel.dispatch('addPage', { address, title }, 'ai');
      const created = siteKernel.getSite().pages.find((page) => !before.has(page.id));
      if (created === undefined) return Promise.reject(new Error('The new page did not appear.'));
      if (open.current !== false) siteKernel.setCurrentPage(created.id);
      return Promise.resolve({ kernel: siteKernel.page(created.id) });
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  };
}
