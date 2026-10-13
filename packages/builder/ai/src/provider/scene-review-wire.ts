// ── the scene review (visual self-review, 2026-10-13) ───────────────────────
/*
  A build that RAN a scene section (the scene probe) may also SHOW it to the model: a small
  picture of the rendered section (desktop, and the 390 px phone pass when there is one) beside
  the section's contract and the creative brief, asking — briefly — whether what a visitor sees
  matches, and what visibly fails. The answer is a verdict and at most five findings, each with
  one instruction for the writer; the build turns them into `scene-visual` findings for the
  section's ONE repair round.

  Its own endpoint, `POST <origin>/v1/scene/review`, like the prompt enhancer: the request is no
  plan request (it carries pictures, not a page's context), a server predating it answers 404,
  and no batch ever carries it. Both sides read the request and the answer here.
*/
import type { AiProposeOptions } from '../types';
import { AI_PLAN_WIRE_VERSION, boundAiPlanWireInvalidOutputMessage } from './wire';

/** The endpoint, on the plan endpoint's origin. */
export const AI_SCENE_REVIEW_PATH = '/v1/scene/review';
/** The most base64 characters a review's pictures carry together (≈ 150 KB of JPEG). */
export const AI_SCENE_REVIEW_MAX_IMAGE_CHARS = 200_000;
/** The most findings an answer is read with; the rest are dropped. */
export const AI_SCENE_REVIEW_MAX_FINDINGS = 5;
/** The picture formats a review accepts (the Messages API's, less GIF). */
export const AI_SCENE_REVIEW_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AiSceneReviewMediaType = (typeof AI_SCENE_REVIEW_MEDIA_TYPES)[number];

/** One picture of the rendered section: base64, without the `data:` prefix. */
export interface AiSceneReviewImage {
  readonly mediaType: AiSceneReviewMediaType;
  readonly base64: string;
  readonly width: number;
  readonly height: number;
}

/** What the section was asked to be (its `SectionContract`, in brief). */
export interface AiSceneReviewContract {
  readonly title: string;
  readonly purpose: string;
  readonly mustSay: readonly string[];
}

/** What the creative brief and the page's tokens say the picture should hold. */
export interface AiSceneReviewBrief {
  /** The page's colours: `bg #101820`, `accent emerald-700`… */
  readonly palette?: readonly string[];
  /** Characters and objects the brief names: `Layla (hero, teal)`. */
  readonly cast?: readonly string[];
  /** The kind of piece and its setting: `platformer · forest, night`. */
  readonly setting?: string;
}

/** `AiPlanProvider.reviewScene`'s question: the pictures, the contract, the brief, the language. */
export interface AiSceneReviewRequest {
  /** The desktop pass (1280×720, drawn at 640×360). */
  readonly image: AiSceneReviewImage;
  /** The phone pass (390×700), when it has a picture. */
  readonly phone?: AiSceneReviewImage;
  readonly contract: AiSceneReviewContract;
  readonly brief?: AiSceneReviewBrief;
  /** The page's language (`ar` reads right-to-left). */
  readonly lang: string;
}

/** One thing the picture visibly gets wrong, and the instruction that fixes it. */
export interface AiSceneReviewFinding {
  readonly problem: string;
  readonly fix: string;
  /** Which picture shows it; absent when both do or the model did not say. */
  readonly where?: 'desktop' | 'phone';
}

/** The verdict: `ok` only when nothing visibly fails. */
export interface AiSceneReview {
  readonly ok: boolean;
  readonly findings: readonly AiSceneReviewFinding[];
}

/** Live options for `reviewScene`: cancellation and the call's measured usage. */
export type AiReviewSceneOptions = Pick<AiProposeOptions, 'signal' | 'onUsage'>;

/** The capability, as `AiPlanProvider` declares it (types.ts extends this). */
export interface AiSceneReviewCapability {
  /**
   * Optional (visual self-review, 2026-10-13): LOOK at a rendered scene section — its picture,
   * its contract, the creative brief — and say what visibly fails. A provider that cannot carry
   * a picture leaves it out, and a build then reviews nothing. On the remote wire this is
   * `POST <origin>/v1/scene/review` (scene-review-wire.ts); the answer is UNTRUSTED and only
   * ever becomes repair instructions.
   */
  reviewScene?(
    request: AiSceneReviewRequest,
    options?: AiReviewSceneOptions,
  ): Promise<AiSceneReview>;
}

// ── the wire ────────────────────────────────────────────────────────────────

/** One picture on the wire, named by the pass it shows. */
export interface AiSceneReviewWireImage extends AiSceneReviewImage {
  readonly view: 'desktop' | 'phone';
}

/** The POST body. */
export interface AiSceneReviewWireRequest {
  readonly version: typeof AI_PLAN_WIRE_VERSION;
  readonly lang: string;
  readonly contract: AiSceneReviewContract;
  readonly brief?: AiSceneReviewBrief;
  /** The desktop picture first, then the phone's: one or two. */
  readonly images: readonly AiSceneReviewWireImage[];
}

/**
 * The server's answer. THE SERVER'S OUTPUT CONTRACT:
 *
 *   {"version":1,"ok":false,"findings":[{"where":"desktop","problem":"…","fix":"…"}, …≤5]}
 *
 * or `{"version":1,"refusal":"…"}`, `{"version":1,"invalidOutput":{"message":"…"}}`, or —
 * when the model this server would ask cannot see pictures — `{"version":1,"unsupported":"…"}`.
 */
export type AiSceneReviewWireResponse =
  | {
      readonly version: typeof AI_PLAN_WIRE_VERSION;
      readonly ok: boolean;
      readonly findings: readonly AiSceneReviewFinding[];
    }
  | { readonly version: typeof AI_PLAN_WIRE_VERSION; readonly refusal: string }
  | { readonly version: typeof AI_PLAN_WIRE_VERSION; readonly unsupported: string }
  | {
      readonly version: typeof AI_PLAN_WIRE_VERSION;
      readonly invalidOutput: { readonly message: string };
    };

/** What a review answer turned out to be. */
export type AiSceneReviewWireReading =
  | { readonly kind: 'review'; readonly review: AiSceneReview }
  | { readonly kind: 'refusal'; readonly message: string }
  | { readonly kind: 'invalid-output'; readonly message: string }
  /** The server cannot show this model a picture: nothing to review with, nothing to retry. */
  | { readonly kind: 'unsupported'; readonly message: string };

const LIMITS = {
  lang: 35,
  title: 200,
  purpose: 600,
  claim: 200,
  claims: 6,
  palette: 10,
  colour: 48,
  cast: 8,
  character: 80,
  setting: 160,
  problem: 200,
  fix: 240,
  side: 4_096,
} as const;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/u;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whitespace folded and trimmed, cut at `limit` with an ellipsis. */
function clip(text: string, limit: number): string {
  const clean = text.replace(/\s+/gu, ' ').trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

function strings(value: unknown, count: number, limit: number): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    .slice(0, count)
    .map((entry) => clip(entry, limit));
}

function briefOf(value: unknown): AiSceneReviewBrief | undefined {
  if (!isRecord(value)) return undefined;
  const palette = strings(value['palette'], LIMITS.palette, LIMITS.colour);
  const cast = strings(value['cast'], LIMITS.cast, LIMITS.character);
  const setting =
    typeof value['setting'] === 'string' ? clip(value['setting'], LIMITS.setting) : '';
  const brief = {
    ...(palette.length === 0 ? {} : { palette }),
    ...(cast.length === 0 ? {} : { cast }),
    ...(setting === '' ? {} : { setting }),
  };
  return Object.keys(brief).length === 0 ? undefined : brief;
}

/** The POST body for a review: the desktop picture, the phone's when it fits the size cap. */
export function aiSceneReviewWireRequest(request: AiSceneReviewRequest): AiSceneReviewWireRequest {
  const phone =
    request.phone !== undefined &&
    request.image.base64.length + request.phone.base64.length <= AI_SCENE_REVIEW_MAX_IMAGE_CHARS
      ? [{ view: 'phone' as const, ...request.phone }]
      : [];
  const brief = briefOf(request.brief);
  return {
    version: AI_PLAN_WIRE_VERSION,
    lang: clip(request.lang, LIMITS.lang),
    contract: {
      title: clip(request.contract.title, LIMITS.title),
      purpose: clip(request.contract.purpose, LIMITS.purpose),
      mustSay: strings(request.contract.mustSay, LIMITS.claims, LIMITS.claim),
    },
    ...(brief === undefined ? {} : { brief }),
    images: [{ view: 'desktop', ...request.image }, ...phone],
  };
}

function imageOf(value: unknown): AiSceneReviewWireImage | string {
  if (!isRecord(value)) return 'Each image must be an object.';
  const { view, mediaType, base64, width, height } = value;
  if (view !== 'desktop' && view !== 'phone') return 'An image\'s "view" must be desktop or phone.';
  if (!AI_SCENE_REVIEW_MEDIA_TYPES.some((type) => type === mediaType)) {
    return `An image's "mediaType" must be one of ${AI_SCENE_REVIEW_MEDIA_TYPES.join(', ')}.`;
  }
  if (typeof base64 !== 'string' || !BASE64.test(base64)) {
    return 'An image\'s "base64" must be base64 data without a data: prefix.';
  }
  const side = (size: unknown): size is number =>
    typeof size === 'number' && Number.isInteger(size) && size > 0 && size <= LIMITS.side;
  if (!side(width) || !side(height)) return "An image's width and height must be whole pixels.";
  return { view, mediaType: mediaType as AiSceneReviewMediaType, base64, width, height };
}

/**
 * A review request as a server reads it: the request with every text held to its limit, or
 * why it is refused (a 400). The pictures are checked, never decoded.
 */
export function readAiSceneReviewWireRequest(
  body: unknown,
): { readonly request: AiSceneReviewWireRequest } | { readonly error: string } {
  if (!isRecord(body) || body['version'] !== AI_PLAN_WIRE_VERSION) {
    return { error: `Expected a scene review request of version ${String(AI_PLAN_WIRE_VERSION)}.` };
  }
  const contract = body['contract'];
  if (
    !isRecord(contract) ||
    typeof contract['title'] !== 'string' ||
    typeof contract['purpose'] !== 'string'
  ) {
    return { error: 'A scene review needs the section\'s "contract": its title and purpose.' };
  }
  const listed: unknown = body['images'];
  if (!Array.isArray(listed) || listed.length < 1 || listed.length > 2) {
    return { error: 'A scene review carries one or two images.' };
  }
  const images: AiSceneReviewWireImage[] = [];
  for (const entry of listed) {
    const image = imageOf(entry);
    if (typeof image === 'string') return { error: image };
    images.push(image);
  }
  if (
    images.reduce((sum, { base64 }) => sum + base64.length, 0) > AI_SCENE_REVIEW_MAX_IMAGE_CHARS
  ) {
    return {
      error: `A scene review's images may carry ${String(AI_SCENE_REVIEW_MAX_IMAGE_CHARS)} base64 characters together.`,
    };
  }
  const lang = typeof body['lang'] === 'string' ? clip(body['lang'], LIMITS.lang) : '';
  const brief = briefOf(body['brief']);
  return {
    request: {
      version: AI_PLAN_WIRE_VERSION,
      lang: lang === '' ? 'en' : lang,
      contract: {
        title: clip(contract['title'], LIMITS.title),
        purpose: clip(contract['purpose'], LIMITS.purpose),
        mustSay: strings(contract['mustSay'], LIMITS.claims, LIMITS.claim),
      },
      ...(brief === undefined ? {} : { brief }),
      images,
    },
  };
}

/** One finding as the reader keeps it: both texts present, clipped; `where` only when named. */
function findingOf(value: unknown): AiSceneReviewFinding | [] {
  if (!isRecord(value)) return [];
  const { problem, fix, where } = value;
  if (typeof problem !== 'string' || typeof fix !== 'string') return [];
  if (problem.trim() === '' || fix.trim() === '') return [];
  return {
    problem: clip(problem, LIMITS.problem),
    fix: clip(fix, LIMITS.fix),
    ...(where === 'desktop' || where === 'phone' ? { where } : {}),
  };
}

/**
 * A review's findings as both sides keep them: well-formed ones only, at most five. Exported
 * for the server, which reads the model's JSON with it.
 */
export function readAiSceneReviewFindings(value: unknown): readonly AiSceneReviewFinding[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, AI_SCENE_REVIEW_MAX_FINDINGS * 2)
    .flatMap(findingOf)
    .slice(0, AI_SCENE_REVIEW_MAX_FINDINGS);
}

/** Classify a review answer (a JSON body). Never throws. */
export function readAiSceneReviewWireResponse(payload: unknown): AiSceneReviewWireReading {
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
  if (typeof payload['unsupported'] === 'string') {
    return { kind: 'unsupported', message: clip(payload['unsupported'], 300) };
  }
  if (typeof payload['ok'] === 'boolean' && Array.isArray(payload['findings'])) {
    return {
      kind: 'review',
      review: { ok: payload['ok'], findings: readAiSceneReviewFindings(payload['findings']) },
    };
  }
  return {
    kind: 'invalid-output',
    message: 'The assistant server answered with something that is not a scene review.',
  };
}
