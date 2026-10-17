import type Anthropic from '@anthropic-ai/sdk';

import { AI_SITE_PLAN_WIRE_MAX_PAGES, type AiPlanWireRequest } from '@craftkit/builder/wire';

import { salvageJson } from './json-salvage';
import { answerText, type AnswerHooks } from './plan-answer';
import {
  DEFAULT_MODEL,
  usageOf,
  type PlanCallSettings,
  type PlanParams,
  type UsageReport,
} from './plan-params';
import { withModelThinking } from './thinking-config';

/*
  The site-plan task (T230, 2026-10-12): `task: 'site-plan'` on /plan answers which pages a
  multi-page request asks for, each with the brief its own page build runs on. A short call:
  no catalog, no page, no skills, thinking off unless the person asked for depth
  (`callEffort`), a small output budget. The client validates what comes back
  (`validateSitePlan`) and falls back to the pages it reads from the words, so a wrong
  answer here can only cost the model's plan, never the site.
*/

/** The rules of a site-plan call. */
export const SITE_PLAN_RULES = `You plan a multi-page WEBSITE: which pages it has, and the brief each page is built from. Another writer builds each page on its own from your brief alone, so every brief must carry the whole site: its business or subject, its name, its audience, and the tone and visual style the person asked for.

Answer with exactly ONE JSON object, minified on one line, nothing before or after it: {"rationale":"<one sentence on the site, in the requester's language>","pages":[{"title":"<page name>","request":"<that page's brief>"}]}. When the request cannot be a website at all, answer {"rationale":"…","refusal":"<one sentence, in the requester's language>"} instead.

Rules:
- 2 to ${String(AI_SITE_PLAN_WIRE_MAX_PAGES)} pages. Keep every page the person named, in their order and in their words. A number of pages they gave is the number you plan (at most ${String(AI_SITE_PLAN_WIRE_MAX_PAGES)}); pages they did not name are the ones such a site needs.
- The first page is the home page.
- title: the page's short name as the site's menu shows it, 1 to 3 words, in the requester's language.
- request: 2 to 4 sentences in the requester's language: what this page is for, the sections it holds, then the site's subject, name and style restated so this page matches the others. Never a question.
- Write no markup, no CSS and no code.`;

/** A site plan is a few hundred words; this is room for eight briefs in Arabic. */
export const SITE_PLAN_MAX_TOKENS = 6_000;

const text = { type: 'string' } as const;

/** The answer's shape, as the Messages API decodes it. */
export const SITE_PLAN_ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['rationale'],
  properties: {
    rationale: text,
    refusal: text,
    pages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'request'],
        properties: { title: text, request: text },
      },
    },
  },
} as const;

const API_EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

/** The conversation so far, then the request: one user turn, so roles never need to alternate. */
function turnText(wire: AiPlanWireRequest): string {
  const said = (wire.history ?? []).map(({ role, text: words }) => `${role}: ${words}`);
  return said.length === 0
    ? wire.request
    : `The conversation so far:\n${said.join('\n')}\n\nThe request to plan:\n${wire.request}`;
}

/** The Messages API request for one site plan (`ask` in claude.ts sends it). */
export function sitePlanParams(
  wire: AiPlanWireRequest,
  settings: PlanCallSettings,
  schema: Readonly<Record<string, unknown>>,
): PlanParams {
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: SITE_PLAN_RULES }];
  const effort = API_EFFORT_LEVELS.find((level) => level === settings.effort);
  const thinking: Anthropic.ThinkingConfigParam = settings.thinkingOff
    ? { type: 'disabled' }
    : { type: 'adaptive', display: 'summarized' };
  const params = withModelThinking({
    model: settings.model ?? DEFAULT_MODEL,
    max_tokens: settings.maxTokens ?? SITE_PLAN_MAX_TOKENS,
    thinking,
    system,
    messages: [{ role: 'user' as const, content: turnText(wire) }],
    output_config: {
      format: { type: 'json_schema' as const, schema },
      ...(effort === undefined ? {} : { effort }),
    },
  });
  return { params, system };
}

export type SitePlanOutcome =
  | {
      readonly kind: 'site-plan';
      /** Untrusted: the client's `validateSitePlan` is the judge. */
      readonly pages: readonly { readonly title: string; readonly request: string }[];
      readonly rationale?: string;
      readonly usage: UsageReport;
    }
  | { readonly kind: 'refusal'; readonly message: string }
  | { readonly kind: 'invalid-output'; readonly message: string };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasPages(value: unknown): boolean {
  return isRecord(value) && (Array.isArray(value['pages']) || typeof value['refusal'] === 'string');
}

/** A site-plan answer, read: refusal, cut-off, empty, unparseable, or its pages (at most eight). */
export function readSitePlanMessage(
  message: Anthropic.Message,
  hooks: AnswerHooks = {},
): SitePlanOutcome {
  if (message.stop_reason === 'refusal') {
    return {
      kind: 'refusal',
      message: message.stop_details?.explanation ?? 'The assistant declined this request.',
    };
  }
  if (message.stop_reason === 'max_tokens') {
    return { kind: 'invalid-output', message: 'The site plan was cut off before it finished.' };
  }
  const raw = answerText(message);
  hooks.onAnswer?.(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(salvageJson(raw, hasPages));
  } catch {
    return { kind: 'invalid-output', message: 'The assistant answer was not a JSON site plan.' };
  }
  if (!isRecord(parsed)) {
    return { kind: 'invalid-output', message: 'The assistant answer was not a JSON site plan.' };
  }
  const rationale = typeof parsed['rationale'] === 'string' ? parsed['rationale'].trim() : '';
  if (typeof parsed['refusal'] === 'string' && parsed['refusal'].trim() !== '') {
    return { kind: 'refusal', message: parsed['refusal'].trim() };
  }
  const pages = (Array.isArray(parsed['pages']) ? (parsed['pages'] as unknown[]) : [])
    .flatMap((page) =>
      isRecord(page) && typeof page['title'] === 'string' && typeof page['request'] === 'string'
        ? [{ title: page['title'], request: page['request'] }]
        : [],
    )
    .slice(0, AI_SITE_PLAN_WIRE_MAX_PAGES);
  if (pages.length < 2) {
    return { kind: 'invalid-output', message: 'The assistant planned fewer than two pages.' };
  }
  return {
    kind: 'site-plan',
    pages,
    ...(rationale === '' ? {} : { rationale }),
    usage: usageOf(message),
  };
}
