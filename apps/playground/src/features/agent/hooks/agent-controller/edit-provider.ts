/**
 * The provider an edit runs on: the block catalog in front of it, and a note of its
 * last words-only answer, so an edit can tell an answer from a refusal.
 */
import {
  type AiPlanProvider,
  type BuilderKernel,
  classifyAiRunFailure,
  createDirectPlanProvider,
  isAiNeedsInputError,
} from '@craftkit/builder';

/**
 * The provider with the block catalog in front of it (v1's `catalogFirstProvider`): a
 * catalog suggestion carries a block's own example prompt, and the catalog already holds
 * the node that prompt produces, so asking a model would spend a round trip to be told a
 * value the page already has. Only a suggestion the person PICKED reaches this; typed
 * words that happen to read the same are the person's own request (`Outgoing.catalog`).
 * An example that no longer matches falls through to the provider, unchanged.
 */
export function catalogFirst(kernel: BuilderKernel, fallback: AiPlanProvider): AiPlanProvider {
  return createDirectPlanProvider({
    catalog: () =>
      kernel.context.registry.blocks(kernel.context.surface).map(({ schema }) => ({
        type: schema.type,
        examples: schema.examples,
      })),
    fallback,
  });
}

/** What a provider said when it answered in words alone: no command at all. */
export interface WordsOnly {
  readonly rationale: string;
  readonly commands: readonly unknown[];
  readonly followUp?: string | undefined;
}

function wordsOnly(answer: unknown): WordsOnly | null {
  if (typeof answer !== 'object' || answer === null) return null;
  const record = answer as Record<string, unknown>;
  const { rationale, commands, followUp } = record;
  if (typeof rationale !== 'string' || !Array.isArray(commands) || commands.length > 0) return null;
  return {
    rationale,
    commands: [],
    ...(typeof followUp === 'string' ? { followUp } : {}),
  };
}

/**
 * The provider with a note of its last words-only answer. The engine's door refuses a plan
 * with no command ("An AI plan needs at least one command"), and it refuses it before any
 * event carries the plan, so a model asking back ("Which page should the link open?") would
 * read as a failure. The note lets the edit tell the two apart: words and no command are an
 * answer; a refusal of real commands stays a failure. Every other member passes through.
 */
export function recordingWords(provider: AiPlanProvider): {
  readonly provider: AiPlanProvider;
  readonly words: () => WordsOnly | null;
} {
  let last: WordsOnly | null = null;
  const note = (answer: unknown): unknown => {
    last = wordsOnly(answer);
    return answer;
  };
  const wrapped = new Proxy(provider, {
    get(target, property, receiver) {
      const value: unknown = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      if (property === 'propose' || property === 'repair') {
        return async (...args: unknown[]) =>
          note(await (value as (...rest: unknown[]) => Promise<unknown>).apply(target, args));
      }
      return (value as (...rest: unknown[]) => unknown).bind(target);
    },
  });
  return { provider: wrapped, words: () => last };
}

/**
 * A run the door refused only because the model answered in words: the refusal is
 * `plan-rejected`, the last answer had no command and something to say, and nothing landed.
 */
export function spokeInWords(
  cause: unknown,
  heard: (() => WordsOnly | null) | undefined,
  kernel: BuilderKernel,
  logBefore: number,
): boolean {
  if (heard === undefined || kernel.transactions().length !== logBefore) return false;
  if (classifyAiRunFailure(cause).code !== 'plan-rejected') return false;
  const said = wordsSaid(cause, heard);
  if (said === null) return false;
  return said.rationale.trim() !== '' || (said.followUp?.trim() ?? '') !== '';
}

/**
 * The words a refused run said: the engine's own question (media-motion fix pass,
 * 2026-10-06: a video with no link is asked for with no model), else the model's.
 */
export function wordsSaid(
  cause: unknown,
  heard: (() => WordsOnly | null) | undefined,
): WordsOnly | null {
  if (isAiNeedsInputError(cause)) return { rationale: cause.words.rationale, commands: [] };
  return heard?.() ?? null;
}
