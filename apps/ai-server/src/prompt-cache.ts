import type Anthropic from '@anthropic-ai/sdk';

import type { PromptParts } from './prompt';

/*
  Where a plan request's cache breakpoints sit, and how long they live (2026-10-12).

  The person measured a run that wrote 11,465 tokens to the cache and read 0. Three causes,
  fixed here and in cache-gate.ts:

  1. The 5-minute default lifetime. An entry's clock starts with the request that writes it,
     and a page build or a long edit writes 15-25k output tokens (three to eight minutes), so
     the entry was gone before the next request began; the person's next message usually
     comes minutes later still. These breakpoints live an hour (`ttl: '1h'`, as the authored
     run's already did): a write costs 2x instead of 1.25x, repaid by the second read.
  2. One breakpoint behind the rules, the catalog AND the active skills. Default skills wake
     on the words of each request, so two requests rarely carried the same set, and a
     different set missed the whole ~11k-token segment. The skills now sit behind their own
     breakpoint, so a new set re-writes only the skills.
  3. Parallel section writers all wrote the same prefix and read none (cache-gate.ts).

  The rules take a breakpoint of their own (the catalog changes with the selection; the rules
  never do), and the conversation so far takes the fourth, so a follow-up reads it back.
  `prompt.ts` still builds one stable segment (its digests are pinned); the split happens
  here, at the skills heading it writes. Joined again with a blank line, which is what the
  CLI shim does with system blocks, the text is byte-for-byte the same.
*/

/** Every breakpoint's entry lives an hour: see (1). Longer entries must precede shorter ones, so all match. */
export const PROMPT_CACHE: Anthropic.CacheControlEphemeral = { type: 'ephemeral', ttl: '1h' };

/** Where `prompt.ts` starts the active skills inside the stable segment. */
const SKILLS_HEADING = '\n\n# Active skills\n';

export interface CachedPrompt {
  readonly system: Anthropic.TextBlockParam[];
  readonly messages: Anthropic.MessageParam[];
}

/** The request parts with their breakpoints placed: catalog, skills, conversation so far. */
export function cachedPrompt(parts: PromptParts): CachedPrompt {
  const system = parts.system.flatMap((block): Anthropic.TextBlockParam[] => {
    if (block.cache_control === undefined) return [{ type: 'text', text: block.text }];
    const at = block.text.indexOf(SKILLS_HEADING);
    if (at <= 0) return [{ type: 'text', text: block.text, cache_control: PROMPT_CACHE }];
    return [
      { type: 'text', text: block.text.slice(0, at), cache_control: PROMPT_CACHE },
      { type: 'text', text: block.text.slice(at + 2), cache_control: PROMPT_CACHE },
    ];
  });
  // The rules too: the catalog changes with the selection, the rules never (four breakpoints at most).
  const cached = system.some((block) => block.cache_control !== undefined);
  const rules = system[0];
  if (cached && system.length > 1 && rules?.cache_control === undefined) {
    system[0] = { ...rules, cache_control: PROMPT_CACHE } as Anthropic.TextBlockParam;
  }
  // The last turn before the current one, when the system segment caches at all.
  const history = cached ? parts.messages.length - 2 : -1;
  const messages = parts.messages.map((turn, index): Anthropic.MessageParam =>
    index === history && turn.content.trim() !== ''
      ? {
          role: turn.role,
          content: [{ type: 'text', text: turn.content, cache_control: PROMPT_CACHE }],
        }
      : { role: turn.role, content: turn.content },
  );
  return { system, messages };
}

/** A turn's text, whether it arrives as a string or as text blocks (a cached history turn). */
export function turnText(content: unknown): string {
  if (typeof content === 'string') return content;
  const texts = Array.isArray(content)
    ? content.map((block: unknown) =>
        typeof block === 'object' && block !== null && 'text' in block ? block.text : undefined,
      )
    : [];
  return texts.length > 0 && texts.every((text) => typeof text === 'string')
    ? texts.join('\n\n')
    : JSON.stringify(content);
}
