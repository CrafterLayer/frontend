/**
 * The models the picker offers, as the server says they are NOW.
 *
 * `VITE_AI_PLAN_MODELS` is the list the app starts with and keeps if the server cannot be
 * asked. The server's `GET /v1/models` (apps/ai-server `handler.ts`) is the truth: its
 * configured models, plus every free OpenRouter model listed this minute, minus a free one
 * OpenRouter withdrew. Free slugs come and go, so a list typed into an env file goes stale.
 */

type Env = Readonly<Record<string, unknown>>;

/**
 * `GET /v1/models` beside the plan endpoint, or `undefined` with no endpoint (the offline
 * provider has no server to ask). The plan endpoint may carry a path (`…:8787/plan`); the
 * models route lives at the server's root.
 */
export function modelsEndpointFromEnv(env: Env): string | undefined {
  const raw = env['VITE_AI_PLAN_ENDPOINT'];
  const endpoint = typeof raw === 'string' ? raw.trim() : '';
  if (endpoint === '') return undefined;
  try {
    return new URL('/v1/models', endpoint).toString();
  } catch {
    return undefined;
  }
}

/**
 * The model ids of a `/v1/models` body, in the server's order (the default first, the
 * configured next, the live free ones last); `undefined` when the body is not one, so a
 * garbled answer keeps the list the picker already has instead of emptying it.
 */
export function readOfferedModels(body: unknown): readonly string[] | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const models: unknown = (body as { models?: unknown }).models;
  if (!Array.isArray(models)) return undefined;
  const ids = (models as unknown[]).flatMap((entry) => {
    const id: unknown =
      typeof entry === 'object' && entry !== null ? (entry as { id?: unknown }).id : undefined;
    return typeof id === 'string' && id.trim() !== '' ? [id.trim()] : [];
  });
  // A server that offers nothing is not an answer: keep what the picker has.
  return ids.length === 0 ? undefined : [...new Set(ids)];
}

/** Whether two lists name the same models in the same order (so state keeps its identity). */
export function sameModels(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
