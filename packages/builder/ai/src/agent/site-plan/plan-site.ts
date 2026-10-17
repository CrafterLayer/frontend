/*
  Planning a site (T230, 2026-10-12): the model's plan when the provider can make one and
  it passes `validateSitePlan`, else the plan read from the words. Nothing is written here;
  the host builds each page with `runAiBuild`, its pages sharing one writers' pool.
*/
import { detectPromptLanguage } from '../../prompt-enhance/language';
import type { AiChatTurn, AiPlanProvider, AiProviderUsage } from '../../types';

import { sitePlanFromRequest } from './site-from-words';
import {
  AI_SITE_MAX_PAGES,
  AI_SITE_MAX_REQUEST_LENGTH,
  AI_SITE_MAX_TITLE_LENGTH,
  AI_SITE_MIN_PAGES,
  type AiSitePage,
  type AiSitePlan,
} from './types';

export type ValidateSitePlanResult =
  | { readonly ok: true; readonly pages: readonly AiSitePage[] }
  | { readonly ok: false; readonly issues: readonly string[] };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** One line, spaces folded: a title or a brief as a page build can use it. */
function flat(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
}

/**
 * A site plan from untrusted output (a provider's `proposeSitePlan` answer): `{ pages:
 * [{ title, request }] }`. Each page needs a title (at most 60 characters) and a brief
 * (at most 2,000); a page that lacks either, or repeats a title already planned, is
 * dropped with an issue. Pages past `AI_SITE_MAX_PAGES` are dropped too: a site is
 * planned as its first eight. Fewer than two pages left is no site, and not ok.
 */
export function validateSitePlan(candidate: unknown): ValidateSitePlanResult {
  if (!isRecord(candidate) || !Array.isArray(candidate['pages'])) {
    return { ok: false, issues: ['A site plan is an object with a "pages" list.'] };
  }
  const issues: string[] = [];
  const pages: AiSitePage[] = [];
  const titles = new Set<string>();
  for (const [index, entry] of (candidate['pages'] as readonly unknown[]).entries()) {
    const at = `Page ${String(index + 1)}`;
    const title = isRecord(entry) ? flat(entry['title']) : '';
    const request = isRecord(entry) ? flat(entry['request']) : '';
    if (title === '' || title.length > AI_SITE_MAX_TITLE_LENGTH) {
      issues.push(`${at} needs a title of 1 to ${String(AI_SITE_MAX_TITLE_LENGTH)} characters.`);
    } else if (request === '' || request.length > AI_SITE_MAX_REQUEST_LENGTH) {
      issues.push(
        `${at} needs a request of 1 to ${String(AI_SITE_MAX_REQUEST_LENGTH)} characters.`,
      );
    } else if (titles.has(title.toLowerCase())) {
      issues.push(`${at} repeats the page "${title}".`);
    } else if (pages.length >= AI_SITE_MAX_PAGES) {
      issues.push(`${at} is past the ${String(AI_SITE_MAX_PAGES)} pages a site may plan.`);
    } else {
      titles.add(title.toLowerCase());
      pages.push({ title, request });
    }
  }
  if (pages.length < AI_SITE_MIN_PAGES) {
    return { ok: false, issues: [...issues, 'A site plan needs at least two pages.'] };
  }
  return { ok: true, pages };
}

export interface PlanAiSiteOptions {
  /** The person's request, as they wrote it. */
  readonly request: string;
  /** Asked first when it can plan a site (`proposeSitePlan`); else the words decide. */
  readonly provider?: AiPlanProvider | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly history?: readonly AiChatTurn[] | undefined;
  readonly onUsage?: ((usage: AiProviderUsage) => void) | undefined;
  /** The router already read a site: the words plan one even when they count no pages. */
  readonly assumeSite?: boolean | undefined;
}

function aborted(signal: AbortSignal | undefined): Error | undefined {
  if (signal?.aborted !== true) return undefined;
  const error = new Error('The site plan was stopped.');
  error.name = 'AbortError';
  return error;
}

/**
 * The site a request asks for: the provider's plan when it has `proposeSitePlan` and its
 * answer passes `validateSitePlan`, else the plan read from the words
 * (`sitePlanFromRequest`), else `null` (one page, not a site). A provider that fails or
 * answers badly costs the model plan, never the site. A stopped `signal` rejects with an
 * `AbortError`: a Stop is never read as "plan it from the words instead".
 */
export async function planAiSite(options: PlanAiSiteOptions): Promise<AiSitePlan | null> {
  const { request, provider, signal } = options;
  const stopped = aborted(signal);
  if (stopped !== undefined) throw stopped;
  const fromWords = sitePlanFromRequest(request, { assumeSite: options.assumeSite });
  const propose = provider?.proposeSitePlan?.bind(provider);
  if (propose !== undefined) {
    try {
      const proposal = await propose(request, {
        ...(signal === undefined ? {} : { signal }),
        ...(options.history === undefined ? {} : { history: options.history }),
        ...(options.onUsage === undefined ? {} : { onUsage: options.onUsage }),
      });
      const checked = validateSitePlan(proposal);
      if (checked.ok) {
        const locale = fromWords?.locale ?? detectPromptLanguage(request) ?? 'en';
        return { pages: checked.pages, source: 'model', locale };
      }
    } catch (cause) {
      const stop = aborted(signal);
      if (stop !== undefined) throw cause instanceof Error ? cause : stop;
      // Any other failure: the words still plan the site.
    }
  }
  const late = aborted(signal);
  if (late !== undefined) throw late;
  return fromWords;
}
