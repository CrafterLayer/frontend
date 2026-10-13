import { turnText } from './prompt-cache';

/*
  The prompt cache through OpenRouter (2026-10-13).

  Anthropic's models cache only where a request marks a breakpoint, on OpenRouter as on the
  Messages API. This shim forwarded the system breakpoints at OpenRouter's default five
  minutes and flattened every turn to a string, which dropped the conversation breakpoint.
  A page build writes for three to eight minutes, so its own entry was gone before the next
  request began, and a follow-up never read the conversation back: cache read 0.

  Now, for `anthropic/` slugs, each breakpoint keeps the lifetime the request gave it (an hour,
  prompt-cache.ts) and the turn that carries the conversation breakpoint travels as a text
  part that carries it too. Should OpenRouter refuse that form, the call is sent once more in
  the old one; when the old one is accepted, the shim keeps to it for the rest of the process.

  Every other vendor OpenRouter fronts caches by itself (OpenAI, DeepSeek, Grok, Gemini 2.5
  and later): a stable prefix is all it needs, and its reads come back as
  `prompt_tokens_details.cached_tokens`, which the shim already reports.
*/

/** The parts of a `messages.stream` request the chat messages are made from. */
export interface ChatParams {
  readonly system?: readonly { readonly text: string; readonly cache_control?: unknown }[];
  readonly messages?: readonly { readonly role: string; readonly content: unknown }[];
}

/** How the breakpoints travel: whether at all (`explicit`), and with lifetime and history. */
export interface CacheForm {
  readonly explicit: boolean;
  readonly extended: boolean;
}

/** Whether OpenRouter caches this slug only where a breakpoint says (Anthropic's models). */
export function explicitCacheFor(model: string): boolean {
  return model.startsWith('anthropic/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasTtl(cacheControl: unknown): boolean {
  return isRecord(cacheControl) && typeof cacheControl['ttl'] === 'string';
}

/** The breakpoint a turn's text parts carry, if one of them carries one. */
function turnBreakpoint(content: unknown): unknown {
  if (!Array.isArray(content)) return undefined;
  const marked = (content as unknown[]).find(
    (block) => isRecord(block) && block['cache_control'] !== undefined,
  );
  return isRecord(marked) ? marked['cache_control'] : undefined;
}

/** The breakpoint as OpenRouter is sent it: the request's own lifetime in the extended form. */
function breakpoint(source: unknown, extended: boolean): Record<string, unknown> {
  return extended && isRecord(source) && hasTtl(source)
    ? { type: 'ephemeral', ttl: source['ttl'] }
    : { type: 'ephemeral' };
}

/** Whether the extended form differs from the old one for this request (else no fallback). */
export function usesExtendedCache(params: ChatParams, model: string): boolean {
  if (!explicitCacheFor(model)) return false;
  return (
    (params.system ?? []).some((block) => hasTtl(block.cache_control)) ||
    (params.messages ?? []).some((turn) => turnBreakpoint(turn.content) !== undefined)
  );
}

/** The chat messages: the system blocks and their breakpoints, the `tail` after them, the turns. */
export function chatMessages(
  params: ChatParams,
  tail: string | undefined,
  form: CacheForm,
): unknown[] {
  const system = (params.system ?? []).map((block) => ({
    type: 'text',
    text: block.text,
    ...(block.cache_control === undefined || !form.explicit
      ? {}
      : { cache_control: breakpoint(block.cache_control, form.extended) }),
  }));
  if (tail !== undefined) system.push({ type: 'text', text: tail });
  const turns = (params.messages ?? []).map((turn) => {
    const role = turn.role === 'assistant' ? 'assistant' : 'user';
    const text = turnText(turn.content);
    const marked = form.explicit && form.extended ? turnBreakpoint(turn.content) : undefined;
    return marked === undefined
      ? { role, content: text }
      : { role, content: [{ type: 'text', text, cache_control: breakpoint(marked, true) }] };
  });
  return [...(system.length === 0 ? [] : [{ role: 'system', content: system }]), ...turns];
}

/** OpenRouter refusing a request outright (a 400 before any token), as the shim reports it. */
function refused(error: unknown): boolean {
  return isRecord(error) && error['httpStatus'] === 400;
}

/**
 * Sends in the extended form while OpenRouter accepts it. A refused call is sent once more in
 * the old form; only when that one is accepted is the extended form given up (`onRefused`), so
 * a request refused for another reason keeps it.
 */
export async function sendWithCacheFallback<T>(
  send: (extended: boolean) => Promise<T>,
  extended: boolean,
  onRefused: () => void,
): Promise<T> {
  if (!extended) return send(false);
  try {
    return await send(true);
  } catch (error) {
    if (!refused(error)) throw error;
    const answer = await send(false);
    onRefused();
    return answer;
  }
}
