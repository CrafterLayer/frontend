import { fastestModel } from './model-policy';

/**
 * Which model ✨ Improve answers on (7fb6d05): kept here so handler.ts stays within its size
 * baseline.
 */

/** `cli:` (the subscription), `api:` (the API key), or '' for an OpenRouter slug. */
export function routeOf(model: string): string {
  return /^(cli|api):/u.exec(model)?.[1] ?? '';
}

/*
  Still the fastest model, but on the ROUTE the person picked: with an `api:` model
  chosen, the enhancer answering through the subscription read as "the picker changed
  nothing" (2026-10-12). An OpenRouter pick, or a configured enhancer already on the
  picked route, keeps the configured enhancer.
*/
export function enhancerModelFor(
  options: {
    readonly enhanceModel?: string | undefined;
    readonly model?: string | undefined;
    readonly models?: readonly string[] | undefined;
  },
  picked: string,
): string | undefined {
  const allowed = [options.model, ...(options.models ?? [])].filter(
    (entry): entry is string => entry !== undefined,
  );
  const configured = options.enhanceModel ?? fastestModel(allowed);
  const route = routeOf(picked);
  return route === '' || (configured !== undefined && routeOf(configured) === route)
    ? configured
    : (fastestModel(allowed.filter((entry) => routeOf(entry) === route)) ?? configured);
}
