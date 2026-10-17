import Anthropic from '@anthropic-ai/sdk';

import {
  AI_PLAN_WIRE_VERSION,
  AI_SCENE_REVIEW_MAX_FINDINGS,
  AI_SCENE_REVIEW_PATH,
  readAiSceneReviewFindings,
  readAiSceneReviewWireRequest,
  type AiSceneReviewFinding,
  type AiSceneReviewWireRequest,
} from '@craftkit/builder/wire';

import { enhancerModelFor, routeOf } from './enhance-route';
import { salvageJson } from './json-salvage';
import { CRAFTKIT_REASONING_EFFORT_HEADER } from './openrouter-client';
import { answerText, reportUsage, type UsageSink } from './plan-answer';
import { errorResponse } from './plan-errors';
import { DEFAULT_MODEL, usageOf, type UsageReport } from './plan-params';
import { sharedPrefixBlocks } from './prompt-cache';
import { CALL_EFFORT_LEVELS, EFFORT_HEADER, pickedModel } from './plan-request';
import { withModelThinking } from './thinking-config';

/*
  The scene review (visual self-review, 2026-10-13): `POST /v1/scene/review` shows the model a
  picture of ONE rendered scene section — the desktop pass at 640×360 and, when sent, the 390 px
  phone pass — beside the section's contract and the creative brief, and asks what VISIBLY fails.
  The answer is a verdict and at most five findings, each with one instruction for the section's
  writer; builder-ai's scene-review.ts turns them into `scene-visual` findings for the section's
  one repair round.

  A small call: a short prompt, the pictures, a JSON answer schema, `SCENE_REVIEW_MAX_TOKENS`
  of output, thinking off unless the person asked for depth (`high`, `xhigh`, `max`), on the
  fastest model of the route the person picked (the enhancer's choice, enhance-route.ts). Only
  the Messages API can be shown a picture — the CLI and OpenRouter shims flatten a message to
  its text — so on any other route the answer is `unsupported` and the build reviews nothing,
  at no cost. A background build's reviews may go through `/batch` instead, at half price
  (`reviewBatchItem`, batch-items.ts), and come back as the same body.

  The prompt's order (2026-10-13): what every review of one build shares comes first — the
  rules, then THE PAGE (its language and palette) — and only then the section's own contract,
  cast, setting and pictures. By the server's estimate (chars/4) the rules are 328 tokens and a
  six-colour page 32 (English) to 51 (Arabic): 360-379 shared, and at most 490 for the longest
  language and the ten 48-character colours the wire admits — under the smallest prefix any
  model caches (512 tokens on the newest; 4096 on Haiku 4.5), and only padding would reach it.
  The rules used to carry a breakpoint that therefore never wrote or read anything (no cost, no
  saving); `sharedPrefixBlocks` now marks the page block only when the shared part clears the
  model's minimum, so a breakpoint here is a real one or none. The page block holds only the page's
  language tag and palette, values its page plan already held to a tag and colours; the cast and
  setting are worded from the person's request and stay in the user turn, with the section.
*/

export const SCENE_REVIEW_PATH = AI_SCENE_REVIEW_PATH;
/** A verdict and five short findings fit in a few hundred tokens. */
export const SCENE_REVIEW_MAX_TOKENS = 700;
/** With thinking on (a deep effort), room for it before the answer. */
export const SCENE_REVIEW_DEEP_MAX_TOKENS = 6_000;
/** The whole call's cap, inside the 45 s the builder client waits. */
export const SCENE_REVIEW_TIMEOUT_MS = 40_000;

const DEEP_EFFORTS: ReadonlySet<string> = new Set(['high', 'xhigh', 'max']);

/** The rules of a review. */
export const SCENE_REVIEW_RULES = `You look at a screenshot of ONE section of a web page as a visitor sees it — on a desktop screen, and sometimes also on a 390 px phone — and say, briefly, whether it matches what the section was asked to be and what VISIBLY fails.

Report only problems a visitor would notice in the picture:
- a blank or near-blank area where the scene or its content should be;
- text that cannot be read: too small, too little contrast, or over busy art with no backdrop;
- something cut off at an edge, or elements overlapping each other;
- colours far from the page's palette;
- a character or object the brief names that is missing;
- a layout that breaks on the phone (cramped, overflowing, unreadable).
Do not judge the copywriting, the code, taste, or anything you cannot see. Photos and web fonts are not loaded in these pictures: an empty image frame or a plain typeface is not a problem.

Answer with exactly ONE JSON object, nothing before or after it: {"ok":true|false,"findings":[{"where":"desktop"|"phone","problem":"<what is visibly wrong, one short sentence>","fix":"<one instruction for the section's writer: what to change in its markup, css or scene code>"}]}. At most ${String(AI_SCENE_REVIEW_MAX_FINDINGS)} findings, the most important first; "ok" is true only when there are none. Write the findings in English, whatever the page's language.`;

const text = { type: 'string' } as const;

/** The answer's shape, as the Messages API decodes it. */
export const SCENE_REVIEW_ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'findings'],
  properties: {
    ok: { type: 'boolean' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['problem', 'fix'],
        properties: {
          where: { type: 'string', enum: ['desktop', 'phone'] },
          problem: text,
          fix: text,
        },
      },
    },
  },
} as const;

const RTL = /^(?:ar|fa|he|ur|ps|ckb|yi|dv)(?:-|$)/iu;

/** The page every section of a build is on: its language and palette, the same in each review. */
export function sceneReviewPageText(
  request: Pick<AiSceneReviewWireRequest, 'brief' | 'lang'>,
): string {
  const { brief, lang } = request;
  return [
    'THE PAGE',
    `Page language: ${lang}${RTL.test(lang) ? ' (right-to-left: its text reads right to left, and Arabic letters stay joined)' : ''}`,
    ...(brief?.palette === undefined ? [] : [`Palette: ${brief.palette.join(', ')}`]),
  ].join('\n');
}

/** The section and what its picture should hold, as the review reads them before the pictures. */
export function sceneReviewContractText(request: AiSceneReviewWireRequest): string {
  const { contract, brief } = request;
  const lines = [
    'THE SECTION',
    `Title: ${contract.title}`,
    `Purpose: ${contract.purpose}`,
    ...(contract.mustSay.length === 0
      ? []
      : [`Must say: ${contract.mustSay.map((claim) => `"${claim}"`).join('; ')}`]),
    ...(brief?.cast === undefined
      ? []
      : [`Cast the picture should show: ${brief.cast.join('; ')}`]),
    ...(brief?.setting === undefined ? [] : [`Kind and setting: ${brief.setting}`]),
  ];
  return lines.join('\n');
}

/** The Messages API request for one review. */
export function sceneReviewParams(
  request: AiSceneReviewWireRequest,
  settings: { readonly model: string; readonly effort?: string | undefined },
) {
  const deep = settings.effort !== undefined && DEEP_EFFORTS.has(settings.effort);
  const content: Anthropic.ContentBlockParam[] = [
    { type: 'text', text: sceneReviewContractText(request) },
    ...request.images.flatMap((image): Anthropic.ContentBlockParam[] => [
      {
        type: 'text',
        text:
          image.view === 'desktop'
            ? `Desktop, a 1280×720 screen (picture ${String(image.width)}×${String(image.height)}):`
            : `Phone, 390 px wide (picture ${String(image.width)}×${String(image.height)}):`,
      },
      {
        type: 'image',
        source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
      },
    ]),
    { type: 'text', text: 'Does the rendered section match it? Answer with the JSON object.' },
  ];
  return withModelThinking({
    model: settings.model,
    max_tokens: deep ? SCENE_REVIEW_DEEP_MAX_TOKENS : SCENE_REVIEW_MAX_TOKENS,
    thinking: deep ? ({ type: 'adaptive' } as const) : ({ type: 'disabled' } as const),
    // The rules, then the page: a breakpoint only where it can cache (see the note above).
    system: sharedPrefixBlocks([SCENE_REVIEW_RULES, sceneReviewPageText(request)], settings.model),
    messages: [{ role: 'user' as const, content }],
    output_config: {
      format: { type: 'json_schema' as const, schema: SCENE_REVIEW_ANSWER_SCHEMA },
      ...(deep ? { effort: settings.effort as 'high' | 'xhigh' | 'max' } : {}),
    },
  });
}

export type SceneReviewOutcome =
  | {
      readonly kind: 'review';
      readonly ok: boolean;
      readonly findings: readonly AiSceneReviewFinding[];
      readonly usage: UsageReport;
    }
  | { readonly kind: 'refusal'; readonly message: string; readonly usage: UsageReport }
  | { readonly kind: 'invalid-output'; readonly message: string; readonly usage: UsageReport };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVerdict(value: unknown): boolean {
  return isRecord(value) && typeof value['ok'] === 'boolean' && Array.isArray(value['findings']);
}

/** A review's answer, read: refusal, cut-off, unparseable, or the verdict (findings decide `ok`). */
export function readSceneReviewMessage(
  message: Anthropic.Message,
  onAnswer?: (text: string) => void,
): SceneReviewOutcome {
  const usage = usageOf(message);
  if (message.stop_reason === 'refusal') {
    return {
      kind: 'refusal',
      message: message.stop_details?.explanation ?? 'The assistant declined to review this scene.',
      usage,
    };
  }
  if (message.stop_reason === 'max_tokens') {
    return { kind: 'invalid-output', message: 'The scene review was cut off.', usage };
  }
  const raw = answerText(message);
  onAnswer?.(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(salvageJson(raw, isVerdict));
  } catch {
    return {
      kind: 'invalid-output',
      message: 'The assistant answer was not a JSON verdict.',
      usage,
    };
  }
  if (!isVerdict(parsed)) {
    return { kind: 'invalid-output', message: 'The assistant answer was not a verdict.', usage };
  }
  const findings = readAiSceneReviewFindings((parsed as { findings: unknown }).findings);
  // A verdict that lists what fails is not "ok", whatever its flag says; one that lists nothing is.
  return { kind: 'review', ok: findings.length === 0, findings, usage };
}

/** What a review answers on the wire — from the live endpoint or a batch item — as a v1 body. */
export function sceneReviewBody(outcome: SceneReviewOutcome): unknown {
  if (outcome.kind === 'review') {
    return { version: AI_PLAN_WIRE_VERSION, ok: outcome.ok, findings: outcome.findings };
  }
  return outcome.kind === 'refusal'
    ? { version: AI_PLAN_WIRE_VERSION, refusal: outcome.message }
    : { version: AI_PLAN_WIRE_VERSION, invalidOutput: { message: outcome.message } };
}

/** Whether `model` on `client` can be shown a picture: only the Messages API can. */
export function canSeePictures(client: Anthropic, model: string): boolean {
  const route = routeOf(model);
  if (route === 'api') return true;
  if (route === 'cli' || model.includes('/')) return false;
  return client instanceof Anthropic;
}

export interface SceneReviewOptions {
  readonly client: Anthropic;
  readonly model: string;
  readonly effort?: string | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly onAnswer?: ((text: string) => void) | undefined;
}

/** Ask for one review. Rejects only with the backend's own failure (or an abort). */
export async function reviewScene(
  request: AiSceneReviewWireRequest,
  options: SceneReviewOptions,
): Promise<SceneReviewOutcome> {
  const params = sceneReviewParams(request, { model: options.model, effort: options.effort });
  const deep = options.effort !== undefined && DEEP_EFFORTS.has(options.effort);
  const stream = options.client.messages.stream(params, {
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    // The CLI shim reads the budget here; the API ignores it.
    headers: { [CRAFTKIT_REASONING_EFFORT_HEADER]: deep ? (options.effort ?? 'high') : 'low' },
  });
  return readSceneReviewMessage(await stream.finalMessage(), options.onAnswer);
}

/** What the endpoint reads from the handler's options (`HandlerOptions` is one). */
export interface SceneReviewHost extends UsageSink {
  readonly client: Anthropic;
  readonly model?: string | undefined;
  readonly models?: readonly string[] | undefined;
  readonly enhanceModel?: string | undefined;
  readonly onAnswer?: ((text: string) => void) | undefined;
  /** The whole call's cap; `SCENE_REVIEW_TIMEOUT_MS` by default. */
  readonly sceneReviewTimeoutMs?: number | undefined;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** A review body read at the endpoint's door, with the model and budget it runs under. */
export type SceneReviewCall =
  | {
      readonly request: AiSceneReviewWireRequest;
      readonly model: string;
      readonly effort: string | undefined;
    }
  | { readonly status: 400; readonly error: string };

/**
 * Every check the endpoint makes of a review body — the request, the budget header — and the
 * model it runs on: the fastest of the route the person picked. A batch item meets the same door.
 */
export function readSceneReviewCall(
  body: unknown,
  headers: Headers,
  options: Pick<SceneReviewHost, 'model' | 'models' | 'enhanceModel'>,
): SceneReviewCall {
  const read = readAiSceneReviewWireRequest(body);
  if ('error' in read) return { status: 400, error: read.error };
  const effort = (headers.get(EFFORT_HEADER) ?? '').trim();
  if (effort !== '' && !(CALL_EFFORT_LEVELS as readonly string[]).includes(effort)) {
    return { status: 400, error: `Effort "${effort.slice(0, 40)}" is not one a call may ask for.` };
  }
  const model = enhancerModelFor(options, pickedModel(headers)) ?? options.model ?? DEFAULT_MODEL;
  return { request: read.request, model, effort: effort === '' ? undefined : effort };
}

/**
 * `POST /v1/scene/review`, behind the same door as the plan (bearer and body size were checked
 * before routing): 400 a malformed request, a verdict, a refusal or invalid output as a v1 body,
 * `unsupported` when the picked route cannot see, 504 its own cap, and a backend's failure in
 * the plan endpoint's statuses.
 */
export async function sceneReviewResponse(
  body: unknown,
  options: SceneReviewHost,
  request: Request,
): Promise<Response> {
  const call = readSceneReviewCall(body, request.headers, options);
  if ('error' in call) return json({ error: call.error }, call.status);
  const { model, effort } = call;
  if (!canSeePictures(options.client, model)) {
    return json({
      version: AI_PLAN_WIRE_VERSION,
      unsupported: `This server cannot show "${model}" a picture: only the Messages API can see.`,
    });
  }
  const timeoutMs = options.sceneReviewTimeoutMs ?? SCENE_REVIEW_TIMEOUT_MS;
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const outcome = await reviewScene(call.request, {
      client: options.client,
      model,
      effort,
      signal: AbortSignal.any([request.signal, timeout]),
      onAnswer: options.onAnswer,
    });
    reportUsage(options, outcome.usage, 'scene-review');
    const response = json(sceneReviewBody(outcome));
    response.headers.set('x-craftkit-ai-usage', JSON.stringify(outcome.usage));
    response.headers.set('access-control-expose-headers', 'x-craftkit-ai-usage');
    return response;
  } catch (cause) {
    if (timeout.aborted && !request.signal.aborted) {
      return json(
        {
          error: `Looking at the scene took longer than ${String(Math.round(timeoutMs / 1000))} s, so it was stopped.`,
        },
        504,
      );
    }
    return errorResponse(cause);
  }
}
