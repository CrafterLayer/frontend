import { isAiProviderError } from '../provider/errors';
import { isAiTaskUnsupportedError } from '../provider/remote-provider';
import { readAiPromptEnhanceWireResponse } from '../provider/wire';
import type {
  AiPlanProvider,
  AiPromptEnhanceInput,
  AiPromptEnhancement,
  AiPromptLocale,
} from '../types';
import { detectPromptLanguage } from './language';
import { tidyRequest, type TidyFix } from './tidy-request-text';

/** Who rewrote the draft: a model through `enhancePrompt`, or the deterministic tidy. */
export type EnhanceRequestSource = 'model' | 'tidy';

/** The rewrite, and who made it — a UI says "tidied" differently from "improved". */
export interface EnhancedRequest extends AiPromptEnhancement {
  readonly source: EnhanceRequestSource;
}

export interface EnhanceRequestOptions {
  /** The run's provider. Without `enhancePrompt` (or without a provider) the draft is tidied. */
  readonly provider?: AiPlanProvider | undefined;
  /** Cancels the rewrite for real; rejects with the platform AbortError. */
  readonly signal?: AbortSignal | undefined;
}

/**
 * Statuses that mean "this server has no enhance route": not found, method
 * not allowed (a server that answers only GET there), not implemented. Every
 * server before 2026-09-28 answers 404 — the ai-server's handler sends
 * "Endpoint not found." for any path but /plan, and the old dev bridge
 * (scripts/ai-plan-bridge.mjs) refuses every POST but /plan.
 */
const NO_ROUTE_STATUSES: ReadonlySet<number> = new Set([404, 405, 501]);

/** The notes a tidy leaves, in the UI's language: short, and only for what changed. */
const TIDY_NOTES: Readonly<Record<AiPromptLocale, Readonly<Record<TidyFix | 'answers', string>>>> = {
  ar: {
    spacing: 'ضبط المسافات',
    article: 'وصل «ال» بالكلمة التي بعدها',
    'word-ending': 'تصحيح نهايات الكلمات (ة بدل ه)',
    punctuation: 'حذف علامات الترقيم المكررة',
    answers: 'إضافة إجاباتك إلى الطلب',
  },
  en: {
    spacing: 'Fixed the spacing',
    article: 'Joined the Arabic article «ال» to its word',
    'word-ending': 'Fixed word endings (ة for ه)',
    punctuation: 'Removed repeated punctuation',
    answers: 'Added your answers to the request',
  },
};

/**
 * Whether the provider can REWRITE a draft with a model — the question the
 * panel asks before it offers the ✨ Improve action. False for a provider
 * without `enhancePrompt` (the offline local provider, a bare scripted one);
 * `enhanceRequest` still tidies for those, but a tidy is not an improvement
 * worth a button.
 */
export function canEnhance(provider: AiPlanProvider | undefined): boolean {
  return typeof provider?.enhancePrompt === 'function';
}

function abortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  if (reason instanceof Error && reason.name === 'AbortError') return reason;
  return new DOMException('The operation was aborted.', 'AbortError');
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw abortError(signal);
}

/** The server has no enhancer: no route there, or a server that predates it. */
function isNoEnhancer(cause: unknown): boolean {
  if (isAiTaskUnsupportedError(cause, 'prompt-enhance')) return true;
  return (
    isAiProviderError(cause) &&
    cause.code === 'http-status' &&
    cause.status !== undefined &&
    NO_ROUTE_STATUSES.has(cause.status)
  );
}

/**
 * The deterministic rewrite: the draft tidied (tidy-request-text.ts), and any
 * answers the person gave appended one per line, question then answer — a
 * tidy cannot fold an answer into a sentence, and it must not lose one.
 * `understood` is empty and nothing is asked: understanding is a model's job.
 */
function tidied(input: AiPromptEnhanceInput): EnhancedRequest {
  const { text, fixes } = tidyRequest(input.text);
  const answered = input.answers
    .map(({ question, answer }) => ({ question: question.trim(), answer: answer.trim() }))
    .filter(({ answer }) => answer !== '');
  const lines = [
    text,
    ...answered.map(({ question, answer }) => (question === '' ? answer : `${question} ${answer}`)),
  ].filter((line) => line !== '');
  const notes = TIDY_NOTES[input.locale];
  return Object.freeze({
    enhanced: lines.join('\n'),
    understood: '',
    changes: Object.freeze([
      ...fixes.map((fix) => notes[fix]),
      ...(answered.length === 0 ? [] : [notes.answers]),
    ]),
    questions: Object.freeze([]),
    language: detectPromptLanguage(input.text) ?? input.locale,
    source: 'tidy' as const,
  });
}

/**
 * Rewrite a person's draft before it runs (the ✨ Improve action).
 *
 * With a provider that has `enhancePrompt`, a model rewrites it — spelling
 * and spacing fixed in the draft's own language, an edit made explicit, a
 * build turned into a short brief — and may ask 0–3 questions; the answer is
 * held to the contract's limits (wire.ts). Everything else is the
 * deterministic tidy, marked `source: 'tidy'`: no provider, no
 * `enhancePrompt`, an empty draft (nothing is sent for nothing), a server
 * without the enhance route (404/405/501, or one that answers every POST
 * with a plan), or a model answer with no rewrite in it.
 *
 * Any other failure — a timeout, a network error, a 5xx after the provider's
 * own retries — rejects with the provider's error, so the panel can say the
 * rewrite failed and leave the draft as it is. The caller's abort rejects
 * with the platform AbortError, and an answer that arrives after it is
 * dropped.
 */
export async function enhanceRequest(
  input: AiPromptEnhanceInput,
  options: EnhanceRequestOptions = {},
): Promise<EnhancedRequest> {
  const { provider, signal } = options;
  throwIfAborted(signal);
  const enhance = provider?.enhancePrompt?.bind(provider);
  if (enhance === undefined || input.text.trim() === '') return tidied(input);

  let answer: AiPromptEnhancement;
  try {
    answer = await enhance(input, signal === undefined ? {} : { signal });
  } catch (cause) {
    throwIfAborted(signal);
    if (isNoEnhancer(cause)) return tidied(input);
    throw cause;
  }
  throwIfAborted(signal);

  // A provider's answer is held to the same limits as a server's (≤5 changes, ≤3 questions).
  const reading = readAiPromptEnhanceWireResponse(
    answer,
    detectPromptLanguage(input.text) ?? input.locale,
  );
  if (reading.kind !== 'enhancement') return tidied(input);
  return Object.freeze({ ...reading.enhancement, source: 'model' as const });
}
