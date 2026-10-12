import type Anthropic from '@anthropic-ai/sdk';

import { AI_PLAN_WIRE_VERSION } from '@craftkit/builder/wire';

import { salvageJson } from './json-salvage';
import { pagePlanShapeCheck, repairPagePlanAnswer } from './plan-shape';
import { usageOf, type UsageReport } from './plan-params';

/*
  What an answer IS, and what the wire says about it (2026-10-12: moved out of claude.ts and
  handler.ts so a live plan and a background batch item are read by the same code).

  The wire has exactly three answers — a plan, a refusal, or a versioned invalid-output
  report — so every way a model can answer has to become one of them. A streamed answer
  (claude.ts) and a batch item's message (batch-routes.ts) both arrive as one
  `Anthropic.Message`; from there on they are the same answer.
*/

export type ClaudeOutcome =
  | { readonly kind: 'plan'; readonly plan: unknown; readonly usage: UsageReport }
  | { readonly kind: 'refusal'; readonly message: string }
  | { readonly kind: 'invalid-output'; readonly message: string };

export type PagePlanOutcome =
  | {
      readonly kind: 'page-plan';
      /** Untrusted and unvalidated: the client's `validatePagePlan` is the only judge. */
      readonly pagePlan: Readonly<Record<string, unknown>>;
      readonly rationale?: string;
      readonly usage: UsageReport;
    }
  | { readonly kind: 'refusal'; readonly message: string }
  | { readonly kind: 'invalid-output'; readonly message: string };

/** What reading an answer may tell the owner's log. */
export interface AnswerHooks {
  /** Receives the raw answer text before it is parsed — what the model actually said. */
  readonly onAnswer?: ((text: string) => void) | undefined;
  /** One line per thing this server did to an answer, for the owner's terminal. */
  readonly onLog?: ((line: string) => void) | undefined;
}

/** The text of an answer, with thinking and every other block left out. */
function answerText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

/** The rationale of an `impossible` plan, or undefined when the plan is a real one. */
function impossibleRationale(plan: unknown): string | undefined {
  if (typeof plan !== 'object' || plan === null || Array.isArray(plan)) return undefined;
  const record = plan as Record<string, unknown>;
  const commands = record['commands'];
  if (!Array.isArray(commands) || commands.length !== 1) return undefined;
  const only: unknown = commands[0];
  if (typeof only !== 'object' || only === null) return undefined;
  if ((only as Record<string, unknown>)['command'] !== 'impossible') return undefined;
  const rationale = record['rationale'];
  return typeof rationale === 'string' && rationale.trim() !== ''
    ? rationale.trim()
    : 'The assistant could not express this request as a change to the page.';
}

/**
 * A plan answer, read: refusal, cut-off, empty, unparseable, `impossible`, or the plan.
 * `judge` is the request's shape check (`planShapeCheck`), which picks between the
 * candidates a salvage of a broken answer produces.
 */
export function readPlanMessage(
  message: Anthropic.Message,
  judge: ((value: unknown) => boolean) | undefined,
  hooks: AnswerHooks = {},
): ClaudeOutcome {
  /*
    A safety decline is a REFUSAL, not an error: the wire has a shape for it,
    the UI shows it as a sentence rather than an outage, and the client marks
    it terminal so nothing retries a decision that will not change.
  */
  if (message.stop_reason === 'refusal') {
    return {
      kind: 'refusal',
      message: message.stop_details?.explanation ?? 'The assistant declined this request.',
    };
  }

  if (message.stop_reason === 'max_tokens') {
    return {
      kind: 'invalid-output',
      message:
        'The plan was cut off before it finished. Ask for a smaller change, or split the request in two.',
    };
  }

  const raw = answerText(message);
  /*
    Before parsing, so the host can show what came back even when the answer
    is refused two layers later: "names unknown command "e"" is all the panel
    can say, and a bad model and a bad prompt look the same without this.
  */
  hooks.onAnswer?.(raw);

  if (raw.trim() === '') {
    return { kind: 'invalid-output', message: 'The assistant returned no plan.' };
  }

  /*
    Structured outputs constrain generation, but this server does not get to
    ASSUME they held: the answer crosses a network into a validator, and a
    parse failure here is a clearer report than a schema violation there.
    First the wrappers every backend sometimes adds — a fence, a sentence, a
    trailing comma — are undone; the plan's content is still judged as it is.
  */
  const text = salvageJson(raw, judge);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'invalid-output', message: 'The assistant answer was not valid JSON.' };
  }

  /*
    prompt.ts asks for "a plan whose single command is impossible" when a
    request cannot be expressed. No command by that name exists — the wire's
    refusal shape is what it means — so it is translated here, where the
    rationale becomes the sentence the panel shows instead of a validator's
    `names unknown command "impossible"`.
  */
  const declined = impossibleRationale(parsed);
  if (declined !== undefined) return { kind: 'refusal', message: declined };

  return { kind: 'plan', plan: parsed, usage: usageOf(message) };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A page plan written without its `{rationale, pagePlan}` wrapper: the plan's
 * own keys at the top. Taken as the plan rather than refused — a repair round
 * is a whole second model call, and the client validates the plan either way.
 */
function barePagePlan(value: Readonly<Record<string, unknown>>): boolean {
  return (
    !Object.hasOwn(value, 'commands') &&
    (isRecord(value['tokens']) || Array.isArray(value['sections']))
  );
}

/** What a parsed page-plan answer is: the plan, the model's refusal, or neither. */
function readPagePlanAnswer(parsed: unknown, usage: UsageReport): PagePlanOutcome {
  if (!isRecord(parsed)) {
    return {
      kind: 'invalid-output',
      message: 'The assistant answered with something that is not a page plan.',
    };
  }
  const refusal = parsed['refusal'];
  if (parsed['pagePlan'] === undefined && typeof refusal === 'string' && refusal.trim() !== '') {
    return { kind: 'refusal', message: refusal.trim() };
  }
  const rawRationale = parsed['rationale'];
  const rationale =
    typeof rawRationale === 'string' && rawRationale.trim() !== ''
      ? rawRationale.trim()
      : undefined;
  const wrapped = parsed['pagePlan'];
  let pagePlan: Readonly<Record<string, unknown>> | undefined;
  if (isRecord(wrapped)) {
    pagePlan = wrapped;
  } else if (wrapped === undefined && barePagePlan(parsed)) {
    // The bare plan's own rationale moves up to where the wire carries it.
    pagePlan = Object.fromEntries(Object.entries(parsed).filter(([key]) => key !== 'rationale'));
  }
  if (pagePlan === undefined) {
    return {
      kind: 'invalid-output',
      message:
        'The assistant answered without a page plan: it wrote no "pagePlan" object (an ordinary plan of commands is the answer to a different task).',
    };
  }
  return { kind: 'page-plan', pagePlan, ...(rationale === undefined ? {} : { rationale }), usage };
}

/** A page-plan answer, read: refusal, cut-off, empty, unparseable, or the plan after code repairs. */
export function readPagePlanMessage(
  message: Anthropic.Message,
  hooks: AnswerHooks = {},
): PagePlanOutcome {
  if (message.stop_reason === 'refusal') {
    return {
      kind: 'refusal',
      message: message.stop_details?.explanation ?? 'The assistant declined this request.',
    };
  }
  if (message.stop_reason === 'max_tokens') {
    return {
      kind: 'invalid-output',
      message:
        'The page plan was cut off before it finished. Ask again, or for a page with fewer sections.',
    };
  }

  const raw = answerText(message);
  hooks.onAnswer?.(raw);
  if (raw.trim() === '') {
    return { kind: 'invalid-output', message: 'The assistant returned no page plan.' };
  }

  /*
    The judge asks about each candidate AFTER the code repairs below, so a
    placeholder phone the next step fills never makes the right rebalance of
    a dropped closer lose to a wrong one that parses.
  */
  const text = salvageJson(raw, (candidate) =>
    pagePlanShapeCheck(repairPagePlanAnswer(candidate).value),
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      kind: 'invalid-output',
      message: 'The assistant answer was not valid JSON, so no page plan could be read from it.',
    };
  }
  /*
    What code can fix without a model round (plan-shape.ts): shade names to
    the hex they mean, placeholder samples filled in their own format. Each
    one was a refused plan and a ~60-120 s repair round when measured live on
    2026-09-28; here it costs nothing, and the log says what changed.
  */
  const repaired = repairPagePlanAnswer(parsed);
  if (repaired.repairs.length > 0) {
    hooks.onLog?.(`page plan repaired in code: ${repaired.repairs.join('; ')}`);
  }
  return readPagePlanAnswer(repaired.value, usageOf(message));
}

/**
 * A refusal is a 200, not a 4xx.
 *
 * It is an ANSWER — the model considered the request and declined — and the
 * wire has a shape for it that the client turns into a sentence in the chat.
 * Returning 4xx would make `remote-provider` report a transport failure and
 * lose the explanation the user needs.
 */
export function refusalBody(message: string): unknown {
  return { version: AI_PLAN_WIRE_VERSION, refusal: message };
}

export function invalidOutputBody(message: string): unknown {
  return { version: AI_PLAN_WIRE_VERSION, invalidOutput: { message } };
}

/** What one request answers on the wire, and what it cost when the model produced it. */
export interface Answered {
  readonly body: unknown;
  readonly usage?: UsageReport;
}

/**
 * The one answer every transport sends — JSON, the SSE `result` frame, a batch item: an
 * `AiPlan` (or a page plan for `task: 'page-plan'`), a refusal, or the versioned
 * invalid-output report — the shapes `remote-provider` reads, and nothing else. `measured`
 * is the call's usage when the outcome itself carries none (a refusal still cost tokens).
 */
export function answerBody(
  outcome: ClaudeOutcome | PagePlanOutcome,
  measured: UsageReport | undefined,
): Answered {
  const usage = measured === undefined ? {} : { usage: measured };
  if (outcome.kind === 'refusal') return { body: refusalBody(outcome.message), ...usage };
  if (outcome.kind === 'invalid-output')
    return { body: invalidOutputBody(outcome.message), ...usage };
  if (outcome.kind === 'plan') return { body: outcome.plan, usage: outcome.usage };
  return {
    body: {
      version: AI_PLAN_WIRE_VERSION,
      ...(outcome.rationale === undefined ? {} : { rationale: outcome.rationale }),
      pagePlan: outcome.pagePlan,
    },
    usage: outcome.usage,
  };
}

/** Which call a usage line belongs to: a plan, a page plan, or an enhancement. */
export type UsageTask = 'plan' | 'page-plan' | 'enhance';

/** Where a call's usage line goes: `HandlerOptions.onUsage`. */
export interface UsageSink {
  readonly onUsage?: (
    report: UsageReport & { readonly cachedShare: number | null; readonly task?: UsageTask },
  ) => void;
}

/** One usage line for the owner's log, with the cached share of the input it was billed for. */
export function reportUsage(options: UsageSink, usage: UsageReport, task: UsageTask): void {
  if (options.onUsage === undefined) return;
  const billedInput =
    usage.inputTokens === null || usage.cacheWriteTokens === null || usage.cacheReadTokens === null
      ? null
      : usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens;
  try {
    options.onUsage({
      ...usage,
      // The number worth watching: a cached share near zero means a silent invalidator got into the prefix and the catalog is being re-billed.
      cachedShare:
        billedInput === null || usage.cacheReadTokens === null
          ? null
          : billedInput === 0
            ? 0
            : usage.cacheReadTokens / billedInput,
      task,
    });
  } catch {
    /* Telemetry must not turn a valid answer into a failure. */
  }
}
