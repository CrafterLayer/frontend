import {
  AI_PLAN_WIRE_VERSION,
  isSceneInitializationRequest,
  type AiPlanWireRequest,
} from '@craftkit/builder/wire';

import type { FreeModelCatalog } from './free-models';
import { SITE_PLAN_MAX_TOKENS } from './site-plan';

/*
  How a POST asks for a plan, read the one way (2026-10-12: moved out of handler.ts, so
  `/plan` and every item of `POST /batch` are held to the same checks in the same order —
  the bearer, the body's size and JSON, the wire version, the task, free code, the model
  allowlist, the budget — and get the same model, budget and thinking for the same body).
*/

/** What the checks below read from the handler's options. `HandlerOptions` is one. */
export interface PlanRequestPolicy {
  /** The default model, and the one a request may always name. */
  readonly model?: string;
  /** The OTHER models a request may name through `x-craftkit-ai-model`. */
  readonly models?: readonly string[];
  /** The free OpenRouter models listed right now; a request may name any of them. */
  readonly freeModels?: FreeModelCatalog;
  /** The reasoning budget for a build's SECTION writers (handler.ts says why). */
  readonly sectionEffort?: string;
  /** Whether the PAGE PLAN call thinks (handler.ts says why). */
  readonly planThinking?: boolean;
  /** Output budget for a SCENE writer (default `SCENE_MAX_TOKENS`); see `callEffort`. */
  readonly sceneMaxTokens?: number;
  /** The deployment's own output budget, when it set one; a scene writer never gets less. */
  readonly maxTokens?: number;
}

export const DEFAULT_MAX_REQUEST_BYTES = 4 * 1024 * 1024;

function isWireRequest(value: unknown): value is AiPlanWireRequest {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record['version'] === AI_PLAN_WIRE_VERSION &&
    typeof record['request'] === 'string' &&
    typeof record['context'] === 'object' &&
    record['context'] !== null
  );
}

/** Constant-time-ish comparison, so a wrong token leaks no length information. */
function tokenMatches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let difference = 0;
  for (let at = 0; at < provided.length; at += 1) {
    difference |= provided.charCodeAt(at) ^ expected.charCodeAt(at);
  }
  return difference === 0;
}

export function authorized(request: Request, expected: string | undefined): boolean {
  if (expected === undefined || expected === '') return true;
  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  return tokenMatches(provided, expected);
}

/** The body of a POST as JSON, under the same size rule everywhere; or the status refusing it. */
export async function readJsonBody(
  request: Request,
  maxRequestBytes: number,
): Promise<{ readonly body: unknown } | { readonly status: 400 | 413; readonly error: string }> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxRequestBytes) {
    return { status: 413, error: 'Request too large.' };
  }
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxRequestBytes) {
      return { status: 413, error: 'Request too large.' };
    }
    return { body: JSON.parse(text) as unknown };
  } catch {
    return { status: 400, error: 'Body is not JSON.' };
  }
}

/**
 * The tasks the plan endpoint answers (`AiPlanWireRequest.task`): absent or
 * `'plan'` is an `AiPlan`, exactly as before 2026-09-28; `'page-plan'` is a
 * page plan (`AiPagePlanWireResponse` in builder-ai's provider/wire.ts); `'site-plan'`
 * (T230) is a site's pages (`AiSitePlanWireResponse`, site-plan-wire.ts).
 */
const KNOWN_TASKS: ReadonlySet<unknown> = new Set(['plan', 'page-plan', 'site-plan']);

/** The header a request names its model in. Also granted by `cors.ts` for preflights. */
export const MODEL_HEADER = 'x-craftkit-ai-model';

/**
 * The model this request runs on. The panel may name one; the SERVER decides
 * whether it is allowed, because a public endpoint must not let a browser
 * pick the most expensive model on someone else's key. The configured default
 * is always allowed by name; anything else has to be in `models`.
 *
 * Two places may name it (2026-09-28). The header is the PERSON's choice in
 * the picker; the body's `model` is the fast model a host names for a small
 * edit (the fast-edits contract: `RunAiAgentOptions.editModel`). The person's
 * choice wins (2026-10-08): the owner picked Opus and the log showed every edit
 * running on `haiku, effort low`, because the body used to win. The host's fast
 * model now applies only when the person picked nothing. Same allowlist either way.
 */
export async function resolveModel(
  headers: Headers,
  wire: AiPlanWireRequest,
  options: PlanRequestPolicy,
): Promise<{ readonly model: string | undefined } | { readonly refused: string }> {
  const perCall: unknown = (wire as { model?: unknown }).model;
  if (perCall !== undefined && typeof perCall !== 'string') {
    return { refused: 'The request\'s "model" must be a model name.' };
  }
  const called = (perCall ?? '').trim();
  const picked = pickedModel(headers);
  const named = picked !== '' ? picked : called;
  if (named === '') return { model: options.model };
  /*
    Match by the model's name WITHOUT its `cli:` prefix, and answer with the
    server's own spelling. 2026-09-30: the playground lists `cli:haiku` while
    this server's .env allows `haiku`; the panel started sending its edit model
    on every call, and every request came back 400 — the owner saw «حدث خطأ غير
    متوقع» on everything. Both spellings name the same CLI model.
  */
  const bare = (name: string): string => name.replace(/^cli:/u, '');
  const allowed = [
    ...(options.model === undefined ? [] : [options.model]),
    ...(options.models ?? []),
  ];
  const match =
    allowed.find((entry) => entry === named) ??
    allowed.find((entry) => bare(entry) === bare(named));
  if (match !== undefined) return { model: match };
  // A free model OpenRouter lists right now costs nothing, so it needs no place in the owner's list.
  if (named.endsWith(':free') && (await options.freeModels?.has(named)) === true) {
    return { model: named };
  }
  return { refused: `Model "${named}" is not one this server allows.` };
}

/**
 * The reasoning budgets a call may ask for, in the order the picker lists them.
 * Born as a small edit's `low | medium` (2026-09-28, the fast-edits contract's
 * `editEffort`); 2026-10-06 the picker's standing choice joined it, so a person
 * can spend `high`, `xhigh` or `max` on a page build. The model allowlist is
 * still what keeps a browser from picking a bill; the budget only decides how
 * long an allowed model thinks. `medium` is the default everywhere.
 */
export const CALL_EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type CallEffort = (typeof CALL_EFFORT_LEVELS)[number];
export const DEFAULT_CALL_EFFORT: CallEffort = 'medium';
const CALL_EFFORTS: ReadonlySet<unknown> = new Set(CALL_EFFORT_LEVELS);
/** The budgets that are asking for depth: thinking stays ON for every call at these. */
const DEEP_EFFORTS: ReadonlySet<unknown> = new Set(['high', 'xhigh', 'max']);

/**
 * The header a call may name its budget in instead (2026-09-28). The
 * fast-edits contract says a provider names the edit model "the way the model
 * picker does" — `MODEL_HEADER` — and a provider that sets headers per call
 * sets the budget beside it. The body's `effort` wins; both are held to
 * `CALL_EFFORTS`. `cors.ts` echoes the preflight's requested headers, so a
 * browser may send it with no CORS change.
 */
export const EFFORT_HEADER = 'x-craftkit-ai-effort';

/** The model the person picked in the panel's picker (the header), or ''. */
export function pickedModel(headers: Headers): string {
  return (headers.get(MODEL_HEADER) ?? '').trim();
}

/**
 * The budget one call asked for, or undefined. When the person picked a model,
 * the whole call is theirs: their header budget (or the default), never the
 * host's small-edit `effort` in the body, which belongs to the host's fast
 * model (2026-10-08, the owner's Opus edits ran at `effort low`). With no pick,
 * the body's budget, else the header's.
 */
function askedEffort(headers: Headers, wire: AiPlanWireRequest): unknown {
  const inHeader = (headers.get(EFFORT_HEADER) ?? '').trim();
  if (pickedModel(headers) !== '') return inHeader === '' ? undefined : inHeader;
  const inBody: unknown = (wire as { effort?: unknown }).effort;
  if (inBody !== undefined) return inBody;
  return inHeader === '' ? undefined : inHeader;
}

/** A body that asks for a plan, with the options its call runs under; or why it is refused. */
export type PlanCall<O> =
  | { readonly wire: AiPlanWireRequest; readonly run: O }
  | { readonly status: 400; readonly error: string };

/**
 * Every check `/plan` makes of a body, in its order, and what passes them: the wire request
 * (its budget written in, wherever it was named) and the options with the chosen model.
 * `headers` carries the picker's choice (`x-craftkit-ai-model`, `x-craftkit-ai-effort`).
 */
export async function readPlanCall<O extends PlanRequestPolicy>(
  headers: Headers,
  body: unknown,
  options: O,
): Promise<PlanCall<O>> {
  if (!isWireRequest(body)) {
    return {
      status: 400,
      error: `Expected an AiPlanWireRequest of version ${String(AI_PLAN_WIRE_VERSION)}.`,
    };
  }

  /*
    An unknown task is refused, not answered as a plan: a newer client asking
    for something this server has never heard of would read a plan as
    garbage — or, worse, as the thing it asked for. 400 is terminal, so
    nothing retries it.
  */
  const task: unknown = body.task;
  if (task !== undefined && !KNOWN_TASKS.has(task)) {
    const named = typeof task === 'string' ? task.slice(0, 60) : JSON.stringify(task).slice(0, 60);
    return { status: 400, error: `Unknown task "${named}".` };
  }

  /*
    The composer's free-code switch (2026-10-09) is a mode, so it is a
    boolean or absent; like `task` and `effort`, anything else is refused. A
    client that sends "true" thinks it asked, and a prompt without the card
    would answer as if it had not. `buildPrompt` reads it with `=== true`
    and nothing more.
  */
  const freeCode: unknown = body.freeCode;
  if (freeCode !== undefined && typeof freeCode !== 'boolean') {
    return { status: 400, error: 'freeCode must be true or false when present.' };
  }

  const chosen = await resolveModel(headers, body, options);
  if ('refused' in chosen) return { status: 400, error: chosen.refused };
  const effort = askedEffort(headers, body);
  if (effort !== undefined && !CALL_EFFORTS.has(effort)) {
    return {
      status: 400,
      error:
        `Effort ${JSON.stringify(effort).slice(0, 40)} is not one a call may ask for ` +
        `(${CALL_EFFORT_LEVELS.join(', ')}).`,
    };
  }
  const run: O = { ...options, ...(chosen.model === undefined ? {} : { model: chosen.model }) };
  // One place `callEffort` reads the call's budget from, wherever it was named.
  const wire: AiPlanWireRequest =
    effort === undefined ? body : ({ ...body, effort } as AiPlanWireRequest);
  return { wire, run };
}

/** The skill a build pins on every section writer (run-build.ts). */
const SECTION_WRITER_SKILL = 'craftkit.build-fill';
/** The skill a build pins on its scaffold call — the fallback after a refused page plan (run-build.ts). */
const SCAFFOLD_SKILL = 'craftkit.build-scaffold';
/** The Pixi playbooks a build hands a section that writes scene code (pixi-selection.ts). */
const SCENE_SKILL_PREFIX = 'craftkit.pixi-';
/**
 * A scene writer's output budget (2026-10-12). A story, game or mural region is a whole
 * program — up to 32,000 characters of code plus its tree and css, and thinking on top —
 * so the plan call's 32k ceiling cut long scenes off mid-JSON, which is no answer at all.
 */
export const SCENE_MAX_TOKENS = 48_000;
/** A tested scene initializes locally; the model only chooses its id and writes section copy. */
export const SCENE_INITIALIZATION_MAX_TOKENS = 8_192;

/**
 * This call's own reasoning budget: the one its body asks for (low or
 * medium, a small edit's), else the section budget for a section writer,
 * else none. A page plan is a PLANNING call — the design every section writer
 * then builds from — so a body budget or a pinned writer skill never changes
 * it; it runs with thinking OFF unless the deployment sets `planThinking`. Measured live 2026-09-28 (cli:haiku at the
 * deployment's `medium`): 6,341–12,435 output tokens for a 2.0k–3.3k-character
 * plan, most of it thinking — so effort IS this call's speed lever, and
 * lowering it is a deliberate deployment choice, never a side effect of a pin.
 */
export function callEffort(
  wire: AiPlanWireRequest,
  options: PlanRequestPolicy,
): { effort?: string; thinkingOff?: true; maxTokens?: number } {
  // The call's own budget, already held to CALL_EFFORTS by the handler.
  const asked: unknown = (wire as { effort?: unknown }).effort;
  const deep = DEEP_EFFORTS.has(asked);
  /*
    The body's budget never reaches a page plan; its thinking is the deployment's choice
    (planThinking) — unless the person asked for depth (`high` and up): then the plan
    thinks, at the budget they named. Their picker is the only thing that sends those.
  */
  if (wire.task === 'page-plan') {
    if (deep) return { effort: asked as string };
    return options.planThinking === true ? {} : { thinkingOff: true };
  }
  // A site plan (T230) is a list of pages and briefs: no thinking, a small budget.
  if (wire.task === 'site-plan') {
    return deep
      ? { effort: asked as string }
      : { thinkingOff: true, maxTokens: SITE_PLAN_MAX_TOKENS };
  }
  const pins = wire.context.skills ?? [];
  const writesASection = pins.some((pin) => pin.id === SECTION_WRITER_SKILL);
  const scaffoldsABuild = pins.some((pin) => pin.id === SCAFFOLD_SKILL);
  /*
    Thinking off for a section writer (the skeleton already decided its
    design), for a build's scaffold call, and for any call that asked for
    `low`. Measured 2026-09-30 on cli:haiku with thinking on at effort low:
    8,001-20,747 output tokens for a 1.1k-2.7k-character section, 49 s-3 min
    each — over 85% of it thinking. The scaffold is the fallback after a
    refused page plan; with thinking on (2026-10-05) one took 3:28 and 22,035
    output tokens, so any T1 failure made the build slower than the old
    221 s baseline. It is a planning call like the page plan, which already
    runs with thinking off.
  */
  /*
    A SCENE writer is the exception (2026-10-12, the owner asked for stronger stories,
    murals and games): a section writer handed the Pixi playbooks with free code on writes
    a program, not markup — a lib to load, a lifecycle to dispose, a layout to keep in its
    region — and with thinking off that is where builds failed the scene checks. It keeps
    thinking, at medium or the section budget if higher, with a bigger output budget.
  */
  const writesAScene =
    writesASection &&
    wire.freeCode === true &&
    pins.some((pin) => pin.id.startsWith(SCENE_SKILL_PREFIX));
  if (writesAScene) {
    if (!deep && isSceneInitializationRequest(wire.request)) {
      return { effort: 'low', thinkingOff: true, maxTokens: SCENE_INITIALIZATION_MAX_TOKENS };
    }
    const budget = options.sectionEffort === undefined || options.sectionEffort === 'low';
    return {
      effort: deep ? (asked as string) : budget ? 'medium' : options.sectionEffort,
      maxTokens: Math.max(options.sceneMaxTokens ?? SCENE_MAX_TOKENS, options.maxTokens ?? 0),
    };
  }
  const thinkingOff = !deep && (writesASection || scaffoldsABuild || asked === 'low');
  const off = thinkingOff ? ({ thinkingOff: true } as const) : {};
  if (CALL_EFFORTS.has(asked)) return { effort: asked as string, ...off };
  if (options.sectionEffort === undefined || !writesASection) return off;
  return { effort: options.sectionEffort, ...off };
}
