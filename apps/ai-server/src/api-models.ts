import Anthropic from '@anthropic-ai/sdk';

/**
 * `api:` models beside `cli:` ones (3e0bc10): the Messages API on the owner's key, and the guard
 * that keeps that key away from the subscription CLI. Kept here so main.ts and cli-client.ts stay
 * within their size baselines.
 */

/*
  The `claude` CLI prefers an API key over the owner's login, so a key in this
  server's environment (there for `api:` models) would silently move every
  `cli:` run onto API billing. The child never sees one.
*/
export function subscriptionEnv(extra: Readonly<Record<string, string>> = {}): NodeJS.ProcessEnv {
  const rest: NodeJS.ProcessEnv = { ...process.env };
  delete rest['ANTHROPIC_API_KEY'];
  delete rest['ANTHROPIC_AUTH_TOKEN'];
  return { ...rest, ...extra };
}

/*
  `api:` entries: the Messages API on the owner's key. Built only when the picker
  lists one, so a key sitting in .env bills nothing until an `api:` model is chosen.
*/
export function createApiBackend(
  apiSlugs: readonly string[],
  key: string | undefined,
): Anthropic | undefined {
  const api = apiSlugs.length > 0 && key !== undefined ? new Anthropic({ apiKey: key }) : undefined;
  if (apiSlugs.length > 0 && api === undefined) {
    console.warn(
      `WARNING: ${apiSlugs.join(', ')} need ANTHROPIC_API_KEY in apps/ai-server/.env; requests naming them will fail.`,
    );
  }
  return api;
}

/** Says, at startup, which backend answers each `cli:` and `api:` model. */
export function logLocalBackends(cliSlugs: readonly string[], apiSlugs: readonly string[]): void {
  for (const slug of cliSlugs) {
    console.log(
      `[ai-server] ${slug}: the local \`claude\` CLI (your own subscription, no API billing)`,
    );
  }
  for (const slug of apiSlugs) {
    console.log(`[ai-server] ${slug}: the Anthropic API (billed to ANTHROPIC_API_KEY)`);
  }
}
