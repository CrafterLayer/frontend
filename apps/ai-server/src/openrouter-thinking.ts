import { isSceneInitializationRequest } from '@craftkit/builder/wire';

import { turnText } from './prompt-cache';
import { withModelThinking, type ThinkingParams } from './thinking-config';

interface InitThinkingParams {
  readonly thinking?: { readonly type?: string };
  readonly messages?: readonly { readonly role: string; readonly content: unknown }[];
}

/** Known Claude lines that support disabling; future/unknown model lines need provider facts. */
const DISABLE_SUPPORTED_CLAUDE =
  /^claude-(?:3-[57]-|(?:haiku|sonnet|opus)-4(?:$|[.-])|opus-5(?:$|-(?!5))|haiku-5-5(?:$|-))/u;

/**
 * Only the mandatory local-initialization lane translates thinking off. General calls retain
 * their existing effort mapping. OpenRouter documents `reasoning.enabled: false`; a model's
 * `reasoning.mandatory` and the existing Claude compatibility policy decide whether it is safe.
 * https://openrouter.ai/docs/guides/best-practices/reasoning-tokens
 */
export function openRouterThinking(
  params: InitThinkingParams,
  model: string,
  effort: string | undefined,
  reasoningMandatory: boolean | undefined,
): { readonly effort?: string; readonly enabled?: false } | undefined {
  const last = params.messages?.at(-1);
  const initializes =
    params.thinking?.type === 'disabled' &&
    effort === 'low' &&
    last?.role === 'user' &&
    isSceneInitializationRequest(turnText(last.content));
  if (!initializes) return effort === undefined ? undefined : { effort };
  const claude = model.startsWith('anthropic/') ? model.slice('anthropic/'.length) : undefined;
  if (claude !== undefined) {
    const compatible = withModelThinking<ThinkingParams>({
      model: claude,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
    });
    if (compatible.thinking?.type !== 'disabled') return { effort: 'low' };
  }
  if (reasoningMandatory === true) return { effort: 'low' };
  if (
    reasoningMandatory === false ||
    (claude !== undefined && DISABLE_SUPPORTED_CLAUDE.test(claude))
  ) {
    return { enabled: false };
  }
  return { effort: 'low' };
}
