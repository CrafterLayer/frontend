import type Anthropic from '@anthropic-ai/sdk';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { buildPrompt } from './prompt';

/**
 * The Claude call, and the translation of its failures into the wire contract.
 *
 * The wire has exactly three answers — a plan, a refusal, or a versioned
 * invalid-output report — so every way this can fail has to become one of them
 * or an HTTP status. Collapsing them into "500" would be easier and would cost
 * the client its entire error taxonomy: `remote-provider` distinguishes
 * retryable from terminal, and a UI shows a refusal differently from an outage.
 */

/**
 * `claude-opus-5` by default, and the default is not a placeholder.
 *
 * A plan is a schema-constrained edit to someone's live page, judged by a
 * validator that rejects near-misses outright — so a cheaper model that is
 * right 85% of the time costs more in rejected round trips than it saves per
 * token. Override deliberately, per deployment, with a measurement in hand.
 */
const DEFAULT_MODEL = 'claude-opus-5';

/**
 * Generous, because a plan is not a chat reply: it composes a whole page as a
 * JSON tree — a landing page of six regions with scoped CSS runs to 15–25k
 * output tokens, and a cut-off plan is not a smaller plan, it is no plan (the
 * JSON does not close). 16k was the first value and it truncated exactly that
 * request. Streaming is what makes a ceiling this size safe: a non-streaming
 * request of this length risks an HTTP timeout.
 */
const DEFAULT_MAX_TOKENS = 32_000;

export interface ClaudeOptions {
  readonly client: Anthropic;
  readonly model?: string;
  readonly maxTokens?: number;
  /** Forwarded to the SDK so a client disconnect actually stops the work. */
  readonly signal?: AbortSignal;
  /** Receives Claude's own narration; becomes SSE `status` frames. */
  readonly onProgress?: (text: string) => void;
}

export type ClaudeOutcome =
  | { readonly kind: 'plan'; readonly plan: unknown; readonly usage: UsageReport }
  | { readonly kind: 'refusal'; readonly message: string }
  | { readonly kind: 'invalid-output'; readonly message: string };

export interface UsageReport {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWriteTokens: number;
}

function usageOf(message: Anthropic.Message): UsageReport {
  return {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

/**
 * Ask Claude for a plan.
 *
 * The output schema is NOT written here. It travels on the wire as
 * `context.outputContract.schema`, authored by the same package that validates
 * the answer — so the shape the model is constrained to and the shape the door
 * accepts cannot drift apart. A schema restated in this file would be a second
 * source of truth about the plan format, and the first divergence would look
 * like a model failure.
 */
export async function proposePlan(
  request: AiPlanWireRequest,
  options: ClaudeOptions,
): Promise<ClaudeOutcome> {
  const contract = request.context.outputContract;
  /*
    `JsonValue` admits `null` and primitives, so the presence of the field is
    not proof of a schema. Checked rather than asserted: an unusable contract
    forwarded to the API returns a 400 whose message blames the request, and
    the deployment mistake would be read as a model failure.
  */
  const schema = contract?.schema;
  if (schema === undefined || typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    return {
      kind: 'invalid-output',
      message: 'The request carried no usable output contract, so no plan shape could be enforced.',
    };
  }

  const { system, messages } = buildPrompt(request);

  const stream = options.client.messages.stream(
    {
      model: options.model ?? DEFAULT_MODEL,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      // Thinking earns its cost here: choosing a parent and slot that the
      // schema actually permits is the difference between a plan and a retry.
      thinking: { type: 'adaptive', display: 'summarized' },
      system: system as Anthropic.TextBlockParam[],
      messages: messages as Anthropic.MessageParam[],
      output_config: { format: { type: 'json_schema', schema } },
    },
    { ...(options.signal === undefined ? {} : { signal: options.signal }) },
  );

  /*
    Narration comes from the thinking summary rather than invented server-side.
    A status line that says "Working…" tells the user nothing they cannot see;
    one that says what the model is actually considering is the only kind worth
    streaming.
  */
  if (options.onProgress !== undefined) {
    const report = options.onProgress;
    let carried = '';
    stream.on('thinking', (delta: string) => {
      carried += delta;
      const boundary = carried.lastIndexOf('\n');
      if (boundary === -1) return;
      for (const line of carried.slice(0, boundary).split('\n')) {
        const text = line.trim();
        if (text !== '') report(text);
      }
      carried = carried.slice(boundary + 1);
    });
  }

  const message = await stream.finalMessage();

  /*
    A safety decline is a REFUSAL, not an error: the wire has a shape for it,
    the UI shows it as a sentence rather than an outage, and the client marks
    it terminal so nothing retries a decision that will not change.
  */
  if (message.stop_reason === 'refusal') {
    return {
      kind: 'refusal',
      message:
        message.stop_details?.explanation ??
        'The assistant declined this request.',
    };
  }

  if (message.stop_reason === 'max_tokens') {
    return {
      kind: 'invalid-output',
      message:
        'The plan was cut off before it finished. Ask for a smaller change, or split the request in two.',
    };
  }

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (text.trim() === '') {
    return { kind: 'invalid-output', message: 'The assistant returned no plan.' };
  }

  /*
    Structured outputs constrain generation, but this server does not get to
    ASSUME they held: the answer crosses a network into a validator, and a
    parse failure here is a clearer report than a schema violation there.
  */
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'invalid-output', message: 'The assistant answer was not valid JSON.' };
  }

  return { kind: 'plan', plan: parsed, usage: usageOf(message) };
}
