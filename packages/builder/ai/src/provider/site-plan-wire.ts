// ── the site-plan task (T230, 2026-10-12) ───────────────────────────────────
/*
  `task: 'site-plan'` on the plan endpoint: the pages a multi-page request asks for, each
  with its own build brief. Kept out of wire.ts, which is at its size limit; the request
  is an ordinary `AiPlanWireRequest` (wire.ts `AiPlanWireTask` names the task).
*/
import type { AiChatTurn, AiSitePlanProposal, AssembledAiContext } from '../types';
import {
  AI_PLAN_WIRE_VERSION,
  boundAiPlanWireInvalidOutputMessage,
  type AiPlanWireInvalidOutputResponse,
  type AiPlanWireRequest,
} from './wire';

/** The most pages a server may answer with; the client keeps the first eight. */
export const AI_SITE_PLAN_WIRE_MAX_PAGES = 8;

/**
 * A server's site plan. THE SERVER'S OUTPUT CONTRACT:
 *
 *   {"version":1,"rationale":"<one sentence, the requester's language>",
 *    "pages":[{"title":"Home","request":"<that page's own build brief>"}, …2–8]}
 *
 * The first page is the home page. Each `request` is a brief a page build can run on
 * alone: in the requester's language, naming the site's subject, brand and style, so
 * every page reads as one site. The client validates (`validateSitePlan`): titles of
 * 1–60 characters, briefs of 1–2,000, no repeated title, at most eight pages.
 */
export interface AiSitePlanWireResult {
  version: typeof AI_PLAN_WIRE_VERSION;
  pages: readonly { readonly title: string; readonly request: string }[];
  rationale?: string;
}

/** The answer to a `task: 'site-plan'` request: a site plan, a refusal, or invalid output. */
export type AiSitePlanWireResponse =
  | AiSitePlanWireResult
  | { refusal: string; version?: typeof AI_PLAN_WIRE_VERSION }
  | AiPlanWireInvalidOutputResponse;

/** What a site-plan answer turned out to be, before validation. */
export type AiSitePlanWireReading =
  | { readonly kind: 'site-plan'; readonly proposal: AiSitePlanProposal }
  | { readonly kind: 'refusal'; readonly message: string }
  | { readonly kind: 'invalid-output'; readonly message: string }
  /** An ordinary plan, or a page plan: the server predates the site-plan task. */
  | { readonly kind: 'unsupported'; readonly message: string };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pageOf(value: unknown): { title: string; request: string } | [] {
  if (!isRecord(value)) return [];
  const { title, request } = value;
  return typeof title === 'string' && typeof request === 'string' ? { title, request } : [];
}

/**
 * Classify a site-plan answer (a JSON body, or an SSE `result` frame's data). Shallow,
 * like the page-plan reader: whether the plan is any good is `validateSitePlan`'s call.
 * Never throws.
 */
export function readAiSitePlanWireResponse(payload: unknown): AiSitePlanWireReading {
  if (!isRecord(payload)) {
    return {
      kind: 'invalid-output',
      message: 'The assistant server did not answer with a JSON object.',
    };
  }
  if (Object.hasOwn(payload, 'version') && payload['version'] !== AI_PLAN_WIRE_VERSION) {
    return {
      kind: 'invalid-output',
      message: `The assistant server answered with unsupported wire version ${String(payload['version'])}.`,
    };
  }
  const invalid = payload['invalidOutput'];
  if (isRecord(invalid) && typeof invalid['message'] === 'string') {
    return {
      kind: 'invalid-output',
      message: boundAiPlanWireInvalidOutputMessage(invalid['message']),
    };
  }
  if (typeof payload['refusal'] === 'string')
    return { kind: 'refusal', message: payload['refusal'] };
  const pages = payload['pages'];
  if (Array.isArray(pages)) {
    const rationale = payload['rationale'];
    return {
      kind: 'site-plan',
      proposal: {
        pages: pages.slice(0, AI_SITE_PLAN_WIRE_MAX_PAGES * 2).flatMap(pageOf),
        ...(typeof rationale === 'string' && rationale.trim() !== ''
          ? { rationale: rationale.trim() }
          : {}),
      },
    };
  }
  if (Array.isArray(payload['commands']) || isRecord(payload['pagePlan'])) {
    return {
      kind: 'unsupported',
      message:
        'The assistant server answered with another kind of plan: it does not plan sites yet.',
    };
  }
  return {
    kind: 'invalid-output',
    message: 'The assistant server answered with something that is not a site plan or a refusal.',
  };
}

/**
 * The context a site-plan request carries. The endpoint requires one on every request;
 * a site is planned from the words and the conversation alone, so it is empty: no page,
 * no catalog, no output contract.
 */
function emptyContext(): AssembledAiContext {
  return {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [] },
  };
}

/** The POST body of a site plan: the words, the conversation, `task: 'site-plan'`. */
export function aiSitePlanWireRequest(
  request: string,
  history?: readonly AiChatTurn[],
): AiPlanWireRequest {
  return {
    version: AI_PLAN_WIRE_VERSION,
    request,
    context: emptyContext(),
    ...(history === undefined ? {} : { history }),
    task: 'site-plan',
  };
}
