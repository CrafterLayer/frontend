/*
  "Thinking off", in the form each model takes (2026-10-12).

  The server turns thinking off for calls whose design is already decided (a page plan unless
  the deployment asks, a section writer, a scaffold, any `low` call, the enhancer) by sending
  `thinking: {type: 'disabled'}`. Claude Opus 5.5 and Claude Sonnet 5.5 answer that with a 400
  at every effort, and Claude Opus 5 and Claude Haiku 5.5 take it only at effort `high` or
  below, so `api:claude-opus-5-5` and `api:claude-sonnet-5-5`, the models `.env.example`
  offers, failed every build and every «Improve». Per model:

  - Opus 5.5, Sonnet 5.5 and the Fable and Mythos lines: no `thinking` field (it runs
    adaptive) at effort `low`, the documented way to think least.
  - Opus 5 and Haiku 5.5: `disabled`, at effort `high` or below.
  - Everything else, as before: older models take `disabled`; a `cli:` slug's shim maps it
    to the CLI's own settings; an OpenRouter slug is OpenRouter's to translate.
*/

/** The request fields this reads and may rewrite. */
export interface ThinkingParams {
  readonly model: string;
  readonly thinking?: { readonly type: string } | undefined;
  readonly output_config?:
    | { readonly effort?: string | null | undefined; readonly [field: string]: unknown }
    | null
    | undefined;
}

const THINKS_ALWAYS = /^claude-(?:opus-5-5|sonnet-5-5|fable-|mythos-)/u;
const DISABLED_UP_TO_HIGH = /^claude-(?:opus-5(?:$|-(?!5))|haiku-5-5)/u;
const OVER_HIGH = new Set(['xhigh', 'max']);

/** The Messages API id behind a slug, or undefined for a slug another backend translates. */
function messagesApiModel(slug: string): string | undefined {
  const id = slug.startsWith('api:') ? slug.slice('api:'.length) : slug;
  return id.startsWith('cli:') || id.includes('/') ? undefined : id.toLowerCase();
}

/** `params` with a `disabled` thinking in the form its model accepts; anything else unchanged. */
export function withModelThinking<P extends ThinkingParams>(params: P): P {
  if (params.thinking?.type !== 'disabled') return params;
  const id = messagesApiModel(params.model);
  if (id === undefined) return params;
  if (THINKS_ALWAYS.test(id)) {
    const rest = Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'thinking'));
    return { ...rest, output_config: { ...params.output_config, effort: 'low' } } as unknown as P;
  }
  if (DISABLED_UP_TO_HIGH.test(id) && OVER_HIGH.has(params.output_config?.effort ?? '')) {
    return { ...params, output_config: { ...params.output_config, effort: 'high' } };
  }
  return params;
}
