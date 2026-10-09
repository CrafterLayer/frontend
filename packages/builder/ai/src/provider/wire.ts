// The HTTP contract between this package and a plan-proposing server. A server
// implements exactly this shape; everything else — registry lookup, args
// schemas, the scratch-kernel dry run — stays on this side of the wire, so a
// wrong server can only ever produce a rejected proposal, never a document.
import type {
  AiChatTurn,
  AiPlan,
  AiPlanValidationIssue,
  AiPromptEnhanceInput,
  AiPromptEnhanceQuestion,
  AiPromptEnhancement,
  AiPromptLocale,
  AssembledAiContext,
  PagePlanCandidate,
  PagePlanIssue,
} from '../types';
import { estimateCanonicalJsonTokens } from '../internal/canonical-json';
import { detectPromptLanguage } from '../prompt-enhance/language';

export const AI_PLAN_WIRE_VERSION = 1;
/** Maximum number of Unicode code points exposed from an invalid-output server message. */
export const AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH = 512;

/** Normalize and cap untrusted invalid-output prose before it crosses a host boundary. */
export function boundAiPlanWireInvalidOutputMessage(message: string): string {
  const normalized = message.replace(/\s+/gu, ' ').trim();
  if (normalized === '') {
    return 'The assistant server reported invalid output.';
  }
  const characters: string[] = [];
  for (const character of normalized) {
    if (characters.length === AI_PLAN_WIRE_MAX_INVALID_OUTPUT_MESSAGE_LENGTH) break;
    characters.push(character);
  }
  return characters.join('');
}

/** A prior proposal that failed validation, echoed back so the server can repair it. */
export interface AiPlanWireAttempt {
  plan: AiPlan;
  issues: readonly AiPlanValidationIssue[];
}

/** POST body sent to the plan endpoint. */
export interface AiPlanWireRequest {
  version: typeof AI_PLAN_WIRE_VERSION;
  request: string;
  context: AssembledAiContext;
  /** The conversation so far, oldest first, so follow-up requests resolve. */
  history?: readonly AiChatTurn[];
  attempt?: AiPlanWireAttempt;
  /**
   * What the POST asks for. Absent (every request before 2026-09-28) or
   * `'plan'`: an `AiPlan`, exactly as always. `'page-plan'`: a page plan —
   * see `AiPagePlanWireResponse` below for the answer a server must give.
   */
  task?: AiPlanWireTask;
  /** Only with `task: 'page-plan'`: the refused candidate and why, for the one repair round. */
  pagePlanAttempt?: AiPagePlanWireAttempt;
  /**
   * One call's model choice (`AiRunModelChoice`): the edit model a run asks
   * for. The ai-server reads it under its allowlist and it wins over the
   * `x-craftkit-ai-model` header (handler.ts `resolveModel`).
   */
  model?: string;
  /** One call's reasoning budget, beside `model` (handler.ts `callEffort`). */
  effort?: 'low' | 'medium';
  /**
   * The composer's «وضع الكود الحر» switch (2026-10-09, additive to wire v1):
   * present and `true` ONLY when the person turned free code mode on, so the
   * agent may write page JavaScript (a customCode block's `js` prop) and
   * custom PixiJS scenes. Absent = off; a server reads it strictly
   * (`=== true`) and then adds its free-code card to the per-request part of
   * its prompt. Never part of the token estimate below: it is a mode, not
   * content, and the card it buys is the server's cost.
   */
  freeCode?: boolean;
}

/** The kinds of answer the plan endpoint gives. Absent on the wire = `'plan'`. */
export type AiPlanWireTask = 'plan' | 'page-plan';

/** A page plan the client refused, echoed back so the server can repair it. */
export interface AiPagePlanWireAttempt {
  pagePlan: PagePlanCandidate;
  issues: readonly PagePlanIssue[];
}

/**
 * Deterministic estimate for the exact request envelope a remote provider
 * serializes. Only wire-contract fields participate, in canonical order, so
 * request text, history, and a rejected repair attempt cannot bypass the same
 * hard budget that protects the assembled context.
 */
export function estimateAiPlanWireRequestTokens(request: AiPlanWireRequest): number {
  const canonical: AiPlanWireRequest = {
    version: request.version,
    request: request.request,
    context: request.context,
    ...(request.history === undefined ? {} : { history: request.history }),
    ...(request.attempt === undefined ? {} : { attempt: request.attempt }),
    ...(request.task === undefined ? {} : { task: request.task }),
    ...(request.pagePlanAttempt === undefined ? {} : { pagePlanAttempt: request.pagePlanAttempt }),
  };
  return estimateCanonicalJsonTokens(canonical);
}

/** A server explicitly reports model output that could not be represented as a plan. */
export interface AiPlanWireInvalidOutputResponse {
  version: typeof AI_PLAN_WIRE_VERSION;
  invalidOutput: Readonly<{ message: string }>;
}

/**
 * A server answers with a plan, refusal, or versioned invalid-output outcome.
 * Direct unversioned plan/refusal shapes remain accepted for backwards compatibility.
 */
export type AiPlanWireResponse =
  | AiPlan
  | (AiPlan & { version: typeof AI_PLAN_WIRE_VERSION })
  | { refusal: string; version?: typeof AI_PLAN_WIRE_VERSION }
  | AiPlanWireInvalidOutputResponse;

/**
 * OPTIONAL streaming shape. The client advertises
 * `accept: text/event-stream, application/json`; a server that streams answers
 * the same POST as SSE instead of one JSON body:
 *
 *   event: status
 *   data: {"text": "Reading the catalog…"}     (any number of these)
 *
 *   event: draft                                (page plans only, optional)
 *   data: {"text": "{\"version\":1,\"rationale\":…"}  (any number of these)
 *
 *   event: result
 *   data: <AiPlanWireResponse>                  (exactly one, then the stream ends)
 *
 * `status` text feeds the UI's live narration; `result` is validated exactly
 * like the plain JSON body. `draft` frames (see `AiPlanWireDraft`) carry the
 * model's raw answer text while it is written. A server that ignores the accept header and
 * answers plain JSON remains fully conformant. Aborting the request is the
 * cancellation signal — a server should stop the underlying work when the
 * connection closes.
 */
export interface AiPlanWireStatus {
  text: string;
}

/**
 * The OPTIONAL `draft` SSE frame (2026-10-05, additive to wire v1): the raw
 * text of a `task: 'page-plan'` answer while the model writes it, so the client
 * can act on each finished part of the plan before the whole answer arrives.
 *
 * - `{ "text": "…" }`: the next slice of the answer, in order; the slices
 *   concatenate to the model's raw output (which may differ from the `result`
 *   after the server's salvage and repairs).
 * - `{ "reset": true }`: the answer starts over (e.g. the server fell back to
 *   another model mid-stream) — forget every earlier slice.
 *
 * Advisory only: the `result` frame is the authority. A client ignores any
 * other payload and any draft after the result (neither is a protocol error),
 * and a client written before drafts ignores the event entirely. A server may
 * send none (`CRAFTKIT_AI_PLAN_DRAFTS=off`, or a plain JSON answer). Only the
 * page-plan task carries drafts; the client ignores them on every other task.
 */
export interface AiPlanWireDraft {
  text?: string;
  reset?: true;
}

// ── the page-plan task (2026-09-28) ─────────────────────────────────────────

/**
 * A server's page plan. The server does NOT validate it — `validatePagePlan`
 * on this side does, and its issues come back as `pagePlanAttempt` — so a
 * wrong server can only ever cost a repair round, never a page.
 */
export interface AiPagePlanWireResult {
  version: typeof AI_PLAN_WIRE_VERSION;
  pagePlan: PagePlanCandidate;
  /** One or two sentences on the direction, in the requester's language. */
  rationale?: string;
}

/**
 * The answer to a `task: 'page-plan'` request: a page plan, a refusal, or the
 * versioned invalid-output report — as JSON, or as the SSE `result` frame with
 * the same `status` frames as a plan (see `AiPlanWireStatus`).
 *
 * THE SERVER'S OUTPUT CONTRACT — copy this block. Answer with exactly one JSON
 * object and nothing around it. This is the COMPACT form (2026-10-05, fast
 * page build); the server's `PAGE_PLAN_EXAMPLE` (apps/ai-server plan-shape.ts)
 * is this exact JSON, and tests compare the two:
 *
 *   BEGIN PAGE PLAN WIRE EXAMPLE
 *   {
 *     "version": 1,
 *     "rationale": "A warm, type-led roastery page: burnt orange on pale lime, Fraunces headings.",
 *     "pagePlan": {
 *       "intent": "new-page",
 *       "locale": { "lang": "en", "dir": "ltr" },
 *       "title": "Cardamom Roasters — specialty coffee in Amman",
 *       "description": "Small-batch coffee roasted every morning in Amman, delivered fresh.",
 *       "tokens": { "deckRowId": "cafe", "signature": "The brand name at text-8xl, faint behind the menu." },
 *       "primaryCta": { "label": "Order beans", "href": "#order" },
 *       "sections": [
 *         { "key": "header", "role": "header", "title": "Header" },
 *         { "key": "hero", "role": "hero", "title": "Roasted this morning", "variant": "split" },
 *         { "key": "menu", "role": "band", "title": "Menu", "variant": "menu", "nav": "Menu" },
 *         { "key": "order", "role": "cta", "title": "Order", "variant": "cta-split", "nav": "Order" },
 *         { "key": "footer", "role": "footer", "title": "Footer", "variant": "footer" }
 *       ],
 *       "briefs": [
 *         { "key": "hero", "purpose": "Say what the roastery is and invite the first order.",
 *           "mustSay": ["Roasted daily in Amman"],
 *           "images": [{ "subject": "cafe", "aspect": "landscape", "alt": "Freshly roasted coffee beans" }] },
 *         { "key": "menu", "purpose": "The drinks and beans, with prices.",
 *           "mustNotRepeat": ["Roasted daily in Amman"],
 *           "facts": [{ "key": "price-espresso", "sample": "JOD 1.50" }] },
 *         { "key": "order", "purpose": "One clear way to order.",
 *           "slots": { "title": "Fresh beans, delivered in Amman",
 *             "cta": { "label": "Order beans", "href": "#order" } } },
 *         { "key": "footer", "purpose": "Address, hours and contact.",
 *           "facts": [{ "key": "phone", "sample": "+962 6 461 2750" }] }
 *       ],
 *       "seo": { "keyword": "specialty coffee Amman", "pageKind": "home",
 *         "businessType": "CafeOrCoffeeShop", "slug": "specialty-coffee-amman" }
 *     }
 *   }
 *   END PAGE PLAN WIRE EXAMPLE
 *
 * KEY ORDER is part of the contract — it is what lets the client act on the
 * answer while it streams (the `draft` frames, `AiPlanWireDraft`): the
 * skeleton lands when `sections` closes, and each section's writer starts when
 * its brief closes. `rationale`, then inside `pagePlan`: intent, locale,
 * title, description, tokens, primaryCta, [nav], sections, briefs, [facts],
 * seo.
 *
 * `validatePagePlan` accepts three shapes and normalises all of them to one
 * `PagePlan`: the classic plan (every field written out on each section, full
 * tokens, top-level nav and facts — still valid, unchanged), the compact plan
 * above, and any mix. The compact form expands first (`expandCompactPagePlan`:
 * total, pure, idempotent, never throws, leaves a classic plan untouched):
 *
 * 1. tokens: when `tokens.deckRowId` names a DIRECTION_DECK_ROWS row, every
 *    token NOT written is filled from it — bg = ground, surface = card, ink,
 *    muted, accent, onAccent, accentInk (shade names, resolved to hex);
 *    border = mix(bg, muted, 0.2) as "#rrggbb"; fontDisplay / fontBody = the
 *    row's arabic pair when locale.lang starts with "ar", else its latin pair;
 *    radius = "xl"; signature = the row's. A token the model DID write wins
 *    (contrast is still checked). No deckRowId → tokens in full, as before.
 * 2. sections (the outline): anchorId defaults to key; mustSay / mustNotRepeat
 *    default to []; kit defaults from variant; a `nav` string on a section is
 *    its nav label.
 * 3. briefs: each brief merges into the section with the same key (purpose,
 *    mustSay, mustNotRepeat, images, slots, and variant / kit when given — the
 *    brief's value wins). brief.facts ([{ key, sample }]) are appended to the
 *    top-level facts with section = the brief's key. A brief whose key names
 *    no section is dropped with a warning. `briefs` is removed after merging.
 * 4. purpose: a header or footer without a brief gets purpose = title. Any
 *    other section still without one gets purpose = title with a WARNING
 *    (never an issue — a thin contract beats a repair round).
 * 5. nav: when the top-level `nav` is absent, it is built from the outline
 *    sections carrying `nav`, in page order ([] without a header). A
 *    top-level `nav` wins and section labels are ignored.
 * 6. facts absent → [].
 *
 * Code repairs (client, after expansion; each is a warning, never an issue,
 * so no model repair round is spent on what code can fix):
 * - an unknown variant is dropped;
 * - a kit on the header or footer, or one that does not fit, is dropped;
 * - Tailwind shade names in tokens become hex;
 * - a fact sample holding a placeholder run ("XXXX") is filled, exactly as the
 *   server's fillPlaceholderSample does;
 * - a masked digit run (a digit repeated 6+ times, 1234567, 7654321) in a fact
 *   sample, the primaryCta href or a slot string is refilled in place from
 *   "4612750389" (separators kept), the same way everywhere, so equal masks
 *   stay equal.
 *
 * Field rules (the client refuses anything else, with a repair instruction):
 * - intent: "new-page" | "replace" | "append" (the host may override it).
 * - locale.lang: BCP 47 ("ar", "en"); dir follows the language.
 * - tokens: { deckRowId, signature }, plus a colour or font key ONLY when the
 *   person named one; with no fitting deck row, the full set. Colours:
 *   "#rrggbb" or a Tailwind shade from the direction deck ("orange-700"). ink
 *   and muted must read ≥ 4.5:1 on bg AND surface, onAccent on accent,
 *   accentInk on bg AND surface (omit accentInk to let the client use the
 *   accent when it reads, else the ink).
 * - fonts: a VERIFIED_FONT_FAMILIES family, weights it ships; Arabic-capable
 *   faces only on an Arabic page. "url" may be omitted — the client builds it.
 * - radius: "none" | "md" | "xl" | "full".
 * - sections: 2..12, in page order, each { key, role, title, [variant],
 *   [nav] } (classic fields such as anchorId, purpose and kit are still
 *   accepted here). key (and anchorId): unique slugs ([a-z][a-z0-9-]*, Latin
 *   even on an Arabic page). role: "header" (first, at most one) | "hero"
 *   (exactly one, first or right after the header) | "band" | "cta" |
 *   "footer" (last, at most one); an "append" plan uses band and cta only.
 *   variant: a SECTION_VARIANTS id, or omit.
 * - briefs: one per section in page order, except the header (the footer's is
 *   optional and carries contact facts): { key, purpose, [mustSay],
 *   [mustNotRepeat], [images], [slots], [facts] }. mustSay / mustNotRepeat:
 *   ≤ 6 short strings each. images: ≤ 4, subject a photo catalog topic,
 *   aspect "landscape" | "portrait" | "square".
 * - kit (2026-09-30): a section-kit id whose role fits the section (a hero
 *   kit for the hero, a closing kit for a cta; none on the header or
 *   footer). Omitted with a known variant → that variant's default kit; one
 *   that does not fit is dropped, never refused. slots: the kit's slots, only
 *   for a short section (stats, logos, a cta, a faq of ≤ 6) — the skeleton
 *   then writes it whole and no writer runs; slots that do not fill the kit
 *   are dropped and a writer fills the section.
 * - seo (optional): { keyword (≤ 80, page language), pageKind ("home" |
 *   "menu" | "product" | "service" | "about" | "contact" | "article" |
 *   "landing"), businessType (a schema.org type, optional), slug (optional;
 *   normalised by seoSlug, Arabic kept) }.
 * - nav anchors and a "#…" primaryCta.href name a section's anchorId (its key
 *   by default); an external href is https:, mailto: or tel:.
 * - facts: every invented, owner-replaceable value (phone, price, address,
 *   hours), inside the brief of the section that shows it, complete and
 *   realistic — never a mask.
 * - All prose (titles, purpose, labels, alt, samples) in the page language.
 */
export type AiPagePlanWireResponse =
  | AiPagePlanWireResult
  | { refusal: string; version?: typeof AI_PLAN_WIRE_VERSION }
  | AiPlanWireInvalidOutputResponse;

/** What a page-plan answer turned out to be, before validation. */
export type AiPagePlanWireReading =
  | {
      readonly kind: 'page-plan';
      readonly pagePlan: PagePlanCandidate;
      readonly rationale?: string;
    }
  | { readonly kind: 'refusal'; readonly message: string }
  | { readonly kind: 'invalid-output'; readonly message: string }
  /** The server answered an ordinary plan: it predates the page-plan task. */
  | { readonly kind: 'unsupported'; readonly message: string };

function isWireRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Classify a page-plan answer (a JSON body, or an SSE `result` frame's data).
 * Shallow by design, like the plan reader: telling "a page plan" from "not
 * one" is this function's job; whether the plan is any GOOD is
 * `validatePagePlan`'s. Never throws.
 */
export function readAiPagePlanWireResponse(payload: unknown): AiPagePlanWireReading {
  if (!isWireRecord(payload)) {
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
  if (isWireRecord(invalid) && typeof invalid['message'] === 'string') {
    return {
      kind: 'invalid-output',
      message: boundAiPlanWireInvalidOutputMessage(invalid['message']),
    };
  }
  if (typeof payload['refusal'] === 'string') {
    return { kind: 'refusal', message: payload['refusal'] };
  }
  const pagePlan = payload['pagePlan'];
  if (isWireRecord(pagePlan)) {
    const rationale = payload['rationale'];
    return {
      kind: 'page-plan',
      pagePlan,
      ...(typeof rationale === 'string' && rationale.trim() !== ''
        ? { rationale: rationale.trim() }
        : {}),
    };
  }
  if (typeof payload['rationale'] === 'string' && Array.isArray(payload['commands'])) {
    return {
      kind: 'unsupported',
      message:
        'The assistant server answered with an ordinary plan: it does not support page plans yet.',
    };
  }
  return {
    kind: 'invalid-output',
    message: 'The assistant server answered with something that is not a page plan or a refusal.',
  };
}

// ── the prompt enhancer (2026-09-28) ─────────────────────────────────────────

/**
 * Where the enhancer answers: this path on the plan server's ORIGIN (the plan
 * endpoint's own path is dropped), with the same bearer and CORS as `/plan`.
 * Its own route rather than a third `task` on /plan because the answer shares
 * nothing with a plan — no context, no catalog, no SSE narration — and an
 * older server must answer 404 (the client's cue to fall back to its tidy)
 * instead of spending a whole plan generation on a request it misreads.
 */
export const AI_PROMPT_ENHANCE_PATH = '/v1/prompt/enhance';
/** Section labels sent with the draft; a longer page is summarised by its first 20. */
export const AI_PROMPT_ENHANCE_MAX_SECTIONS = 20;
/** The contract's limits on an answer, enforced by the reader so a UI never sees more. */
export const AI_PROMPT_ENHANCE_MAX_CHANGES = 5;
export const AI_PROMPT_ENHANCE_MAX_QUESTIONS = 3;
export const AI_PROMPT_ENHANCE_MAX_CHOICES = 4;

/**
 * POST body of the enhancer:
 *
 *   {"version":1,"text":"<the person's draft>","locale":"ar"|"en",
 *    "intent":{"kind":"build-page"|"build-site"|"add-section"|"edit"|"question",
 *              "confidence":0.0-1.0}|null,
 *    "page":{"empty":boolean,"sections":["<section label>", …≤20]},
 *    "selection":"<selected block label>"|null,
 *    "answers":[{"question":"…","answer":"…"}]}
 */
export interface AiPromptEnhanceWireRequest extends AiPromptEnhanceInput {
  readonly version: typeof AI_PLAN_WIRE_VERSION;
}

/**
 * The 200 answer:
 *
 *   {"version":1,"enhanced":"<rewritten request>","understood":"<one sentence, UI locale>",
 *    "changes":["<≤5 short items, UI locale>"],
 *    "questions":[{"id":"q1","text":"…","choices":["…","…"]}],"language":"ar"|"en"}
 *
 * Failures use /plan's envelope and statuses (`{"error": "…"}` with 4xx/5xx,
 * or the versioned `invalidOutput` report), so the remote provider's error
 * taxonomy reads both routes the same way.
 */
export interface AiPromptEnhanceWireResponse extends AiPromptEnhancement {
  readonly version: typeof AI_PLAN_WIRE_VERSION;
}

/** The exact body the remote provider POSTs for `input`: the contract's fields, nothing else. */
export function aiPromptEnhanceWireRequest(
  input: AiPromptEnhanceInput,
): AiPromptEnhanceWireRequest {
  return {
    version: AI_PLAN_WIRE_VERSION,
    text: input.text,
    locale: input.locale,
    intent:
      input.intent === null
        ? null
        : { kind: input.intent.kind, confidence: input.intent.confidence },
    page: {
      empty: input.page.empty,
      sections: input.page.sections.slice(0, AI_PROMPT_ENHANCE_MAX_SECTIONS),
    },
    selection: input.selection,
    answers: input.answers.map(({ question, answer }) => ({ question, answer })),
  };
}

/** What an enhance answer turned out to be. Never a throw: the caller decides what a miss costs. */
export type AiPromptEnhanceWireReading =
  | { readonly kind: 'enhancement'; readonly enhancement: AiPromptEnhancement }
  | { readonly kind: 'invalid-output'; readonly message: string }
  /** The server answered an ordinary plan: it answers every POST as /plan and predates the route. */
  | { readonly kind: 'unsupported'; readonly message: string };

/** One line of UI text: whitespace folded, ends trimmed. */
function oneLine(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
}

/** Distinct non-empty lines, in order, at most `limit`. */
function distinctLines(value: unknown, limit: number): readonly string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    const line = oneLine(item);
    if (line !== '') seen.add(line);
    if (seen.size === limit) break;
  }
  return [...seen];
}

function enhanceQuestions(value: unknown): readonly AiPromptEnhanceQuestion[] {
  if (!Array.isArray(value)) return [];
  const questions: AiPromptEnhanceQuestion[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!isWireRecord(item)) continue;
    const text = oneLine(item['text']);
    if (text === '') continue;
    const named = oneLine(item['id']);
    // An id the UI keys answers by: the model's own when usable, else its position.
    const id = named !== '' && !ids.has(named) ? named : `q${String(questions.length + 1)}`;
    ids.add(id);
    questions.push({
      id,
      text,
      choices: distinctLines(item['choices'], AI_PROMPT_ENHANCE_MAX_CHOICES),
    });
    if (questions.length === AI_PROMPT_ENHANCE_MAX_QUESTIONS) break;
  }
  return questions;
}

/**
 * Read an enhance answer (a JSON body, or a provider's own result) into the
 * contract's shape, holding it to the contract's limits: at most 5 changes,
 * 3 questions and 4 choices each, blank entries dropped. `enhanced` keeps its
 * line breaks — a brief may be several lines — and is the one field that
 * must be there: an answer without a rewrite is not an answer.
 *
 * `fallbackLanguage` names the draft's language when the answer names none
 * the panel speaks; the rewrite's own script decides first.
 */
export function readAiPromptEnhanceWireResponse(
  payload: unknown,
  fallbackLanguage: AiPromptLocale = 'en',
): AiPromptEnhanceWireReading {
  if (!isWireRecord(payload)) {
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
  if (isWireRecord(invalid) && typeof invalid['message'] === 'string') {
    return {
      kind: 'invalid-output',
      message: boundAiPlanWireInvalidOutputMessage(invalid['message']),
    };
  }
  if (typeof payload['rationale'] === 'string' && Array.isArray(payload['commands'])) {
    return {
      kind: 'unsupported',
      message:
        'The assistant server answered with an ordinary plan: it does not rewrite requests yet.',
    };
  }
  const enhanced = typeof payload['enhanced'] === 'string' ? payload['enhanced'].trim() : '';
  if (enhanced === '') {
    return {
      kind: 'invalid-output',
      message: 'The assistant server answered without a rewritten request.',
    };
  }
  const named = payload['language'];
  const language: AiPromptLocale =
    named === 'ar' || named === 'en' ? named : (detectPromptLanguage(enhanced) ?? fallbackLanguage);
  return {
    kind: 'enhancement',
    enhancement: {
      enhanced,
      understood: oneLine(payload['understood']),
      changes: distinctLines(payload['changes'], AI_PROMPT_ENHANCE_MAX_CHANGES),
      questions: enhanceQuestions(payload['questions']),
      language,
    },
  };
}
