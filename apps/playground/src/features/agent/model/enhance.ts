import {
  AI_PROMPT_ENHANCE_MAX_SECTIONS,
  type AiPromptEnhanceInput,
  type IntentDocumentSummary,
  type IntentKind,
  type IntentRoute,
} from '@craftkit/builder';

import type { ClarifyQuestionView, ErrorClass, FailureClass, Locale } from './view-types';

/**
 * "Read my request and fix it" (owner request, 2026-09-28; view-types `EnhancementView`,
 * `ClarifyView`): the port the controller talks to, and the pure rules around it.
 *
 * The engine's `enhanceRequest()` / `canEnhance()` (`packages/builder/ai/src/prompt-enhance`,
 * `POST /v1/prompt/enhance`) are the real implementation. This module declares only the
 * shape the panel needs, so the controller codes against a narrow interface and a test or
 * a story passes a scripted one; `hooks/use-prompt-enhancer.ts` adapts the engine's
 * functions to it (`engineEnhanceInput` below is the request it sends).
 *
 * What comes back is model output, so it is read defensively (`readEnhanceResult`): a
 * missing field is empty, a question without choices is dropped, and nothing is trusted
 * to be short.
 */

/** Below this router confidence a request is too unclear to act on (`IntentRoute`, "Below ~0.6, confirm"). */
export const CLARIFY_BELOW_CONFIDENCE = 0.6;

/** At most this many questions are docked at once; each offers at most this many chips. */
export const MAX_CLARIFY_QUESTIONS = 3;
export const MAX_CLARIFY_CHOICES = 4;

/** One answered question, as the rewrite call receives it. */
export interface EnhanceAnswer {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

/** What the enhancer is asked: the request, the page it is about, and any answers so far. */
export interface EnhanceInput {
  readonly text: string;
  readonly locale: Locale;
  readonly intent?: IntentKind | undefined;
  /** The router's 0–1 confidence in `intent` (sent with it; 1 when absent). */
  readonly confidence?: number | undefined;
  readonly page?: IntentDocumentSummary | undefined;
  /** The blocks the request points at, by human name. */
  readonly selection?: readonly string[] | undefined;
  readonly answers?: readonly EnhanceAnswer[] | undefined;
}

export interface EnhanceQuestion {
  readonly id: string;
  readonly text: string;
  readonly choices: readonly string[];
}

/**
 * The enhancer's answer: `enhanced` is the rewritten request in the request's own
 * language; `understood` restates it in one line; `changes` lists what was fixed;
 * `questions` is non-empty when the request is too unclear to rewrite without asking.
 */
export interface EnhanceResult {
  readonly enhanced: string;
  readonly understood: string;
  readonly changes: readonly string[];
  readonly questions: readonly EnhanceQuestion[];
  /**
   * Who rewrote it: a model (`model`), or the engine's deterministic tidy (`tidy`), which
   * is all a server without the enhance route can give. Absent: a port that does not say.
   */
  readonly source?: 'model' | 'tidy' | undefined;
}

/** The port: one call, cancellable. */
export interface PromptEnhancer {
  readonly enhance: (input: EnhanceInput, signal?: AbortSignal) => Promise<EnhanceResult>;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';

const texts = (value: unknown, limit: number): readonly string[] =>
  Array.isArray(value)
    ? [...new Set((value as readonly unknown[]).map(text).filter((line) => line !== ''))].slice(
        0,
        limit,
      )
    : [];

/**
 * An enhancer's answer, read defensively. Questions without text or without a single
 * choice are dropped (a question the person cannot answer by a chip, or answer at all, is
 * not asked); ids are made unique, so an answer always lands on one question.
 */
export function readEnhanceResult(raw: unknown): EnhanceResult {
  const record = isRecord(raw) ? raw : {};
  const seen = new Set<string>();
  const questions: EnhanceQuestion[] = [];
  const listed: unknown = record['questions'];
  for (const [index, item] of (Array.isArray(listed)
    ? (listed as readonly unknown[])
    : []
  ).entries()) {
    if (!isRecord(item)) continue;
    const question = text(item['text']);
    const choices = texts(item['choices'], MAX_CLARIFY_CHOICES);
    if (question === '' || choices.length === 0) continue;
    let id = text(item['id']);
    if (id === '' || seen.has(id)) id = `q${String(index + 1)}`;
    while (seen.has(id)) id = `${id}-${String(index + 1)}`;
    seen.add(id);
    questions.push({ id, text: question, choices });
    if (questions.length === MAX_CLARIFY_QUESTIONS) break;
  }
  const source = record['source'];
  return {
    enhanced: typeof record['enhanced'] === 'string' ? record['enhanced'].trim() : '',
    understood: text(record['understood']),
    changes: texts(record['changes'], 6),
    questions,
    ...(source === 'model' || source === 'tidy' ? { source } : {}),
  };
}

/** The list separator a joined selection is written with, in the UI's language. */
const LIST_SEPARATOR: Readonly<Record<Locale, string>> = { ar: '، ', en: ', ' };

/**
 * The panel's request as the engine's `enhanceRequest` takes it (`AiPromptEnhanceInput`,
 * the `POST /v1/prompt/enhance` body minus `version`): the route as `{ kind, confidence }`,
 * the page as "empty or not" plus its first 20 section names, the pointed blocks as one
 * label (joined in the UI's language), and the answers as question/answer pairs.
 * A request with no page summary is read as a page with content, the reading that never
 * turns an edit into a build (`routeIntent`'s own rule for an unknown page).
 */
export function engineEnhanceInput(input: EnhanceInput): AiPromptEnhanceInput {
  const confidence = input.confidence ?? 1;
  const selection = (input.selection ?? [])
    .map((label) => label.trim())
    .filter((label) => label !== '');
  const page = input.page;
  return {
    text: input.text,
    locale: input.locale,
    intent:
      input.intent === undefined
        ? null
        : {
            kind: input.intent,
            confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 1,
          },
    page:
      page === undefined
        ? { empty: false, sections: [] }
        : {
            empty: page.nodeCount === 0 || page.placeholderOnly,
            sections: page.sectionLabels
              .map((label) => label.trim())
              .filter((label) => label !== '')
              .slice(0, AI_PROMPT_ENHANCE_MAX_SECTIONS),
          },
    selection: selection.length === 0 ? null : selection.join(LIST_SEPARATOR[input.locale]),
    answers: (input.answers ?? []).map(({ question, answer }) => ({ question, answer })),
  };
}

/**
 * Whether a routed request is too unclear to act on, so the enhancer is asked first:
 * - the router's own confidence is below its confirm line (`IntentRoute`: "Below ~0.6,
 *   confirm before acting"), and it is not a clear question (a question is answered in
 *   words and writes nothing, so it is never worth a delay);
 * - or it would BUILD a whole page and the router is no surer than that line. A build is
 *   the costliest misreading there is (minutes, and a page of sections nobody asked for),
 *   and the owner's own example proves the line matters: «هل يمكنك تربط ال صفحه هاي داخل
 *   عليها» ("can you link this page inside it") routes to a new page at exactly 0.6.
 * An edit at 0.6 is the router's plain default for a short edit on a page with content,
 * so it runs as it is: asking about every such edit would cost a round trip each time.
 */
export function needsClarifying(route: Pick<IntentRoute, 'kind' | 'confidence'>): boolean {
  if (route.kind === 'question') return false;
  return route.confidence < CLARIFY_BELOW_CONFIDENCE || isUnsureBuild(route);
}

/**
 * A build (a page or a site) the router is no surer of than its confirm line. When the
 * clarify check for one FAILS (a timeout, the server down), it is never built as written:
 * the controller plans it instead, and the plan card waits for Build, so nothing is
 * written and no page is opened unasked. The owner's «هل يمكنك تربط ال صفحه هاي داخل
 * عليها» on a built page routes to a new page at 0.6; with the check timed out, running it
 * "as written" built a whole eight-section page for a linking request. Every other route
 * still runs as written when the check fails: an edit writes one reviewable change.
 */
export function isUnsureBuild(route: Pick<IntentRoute, 'kind' | 'confidence'>): boolean {
  const builds = route.kind === 'build-page' || route.kind === 'build-site';
  return builds && route.confidence <= CLARIFY_BELOW_CONFIDENCE;
}

/** The questions as the ClarifyView docks them, none answered yet. */
export function clarifyQuestionsOf(result: EnhanceResult): readonly ClarifyQuestionView[] {
  return result.questions.map((question) => ({
    id: question.id,
    text: question.text,
    choices: question.choices,
  }));
}

/** The answers of every answered question, in the order they were asked. */
export function answersOf(questions: readonly ClarifyQuestionView[]): readonly EnhanceAnswer[] {
  return questions.flatMap((question) =>
    question.answer === undefined || question.answer.trim() === ''
      ? []
      : [{ id: question.id, question: question.text, answer: question.answer.trim() }],
  );
}

/**
 * The request to run when the rewrite itself failed after every question was answered:
 * the person's own words, then their own answers, one per line. Their words and their
 * choices, never a sentence the panel wrote for them.
 */
export function requestWithAnswers(
  request: string,
  questions: readonly ClarifyQuestionView[],
): string {
  const answers = answersOf(questions).map((entry) => entry.answer);
  return [request.trim(), ...answers].join('\n');
}

/** An enhancer failure as the one-line note under the draft (`EnhancementView.failed`). */
export function enhanceFailureOf(errorClass: ErrorClass): FailureClass {
  switch (errorClass) {
    case 'unreachable':
    case 'offline':
      return 'unreachable';
    case 'timeout':
      return 'timeout';
    case 'busy':
      return 'busy';
    case 'declined':
      return 'declined';
    case 'invalid':
      return 'invalid';
    case 'tooLarge':
    case 'unknown':
    case 'sourceChanged':
      return 'unknown';
  }
}
