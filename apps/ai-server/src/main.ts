import Anthropic from '@anthropic-ai/sdk';

import { parseAllowedOrigins, withCors } from './cors';
import { createHandler } from './handler';
import { createNodeServer } from './server';

/**
 * The runnable entry: configuration from the environment, then listen.
 *
 * Everything with behaviour lives in `handler.ts` (the contract) and
 * `server.ts` (the Node adapter), both of which are tested without a network
 * or a key. This file is the only one that reads `process.env` and the only
 * one that binds a port, which is what keeps it too small to hide a bug in.
 */

const port = Number(process.env['PORT'] ?? 8787);
const authToken = process.env['CRAFTKIT_AI_TOKEN'];
const model = process.env['CRAFTKIT_AI_MODEL'];
const allowedOriginsSetting = process.env['CRAFTKIT_AI_ALLOWED_ORIGINS'];
// Refuses a malformed list here, at startup, rather than at the first browser.
const allowedOrigins = parseAllowedOrigins(allowedOriginsSetting);

/*
  A bare client. It resolves credentials the way every Anthropic SDK does —
  ANTHROPIC_API_KEY, then ANTHROPIC_AUTH_TOKEN, then an `ant auth login`
  profile — so an unset API key is not the same as no credentials, and this
  file must not second-guess that resolution by demanding one.
*/
const client = new Anthropic();
if (client.apiKey === null && client.authToken === null) {
  /*
    Not fatal — the SDK may still resolve a profile lazily — but loud, because
    a server that starts cleanly and then fails every request with a generic
    sentence is exactly what happened once. The request-time translation in
    handler.ts names the same cause to the panel.
  */
  console.warn(
    'WARNING: no ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN in the environment. ' +
      'Unless an SDK profile resolves, every plan will fail. Put the key in apps/ai-server/.env and restart.',
  );
}

const handle = createHandler({
  client,
  ...(authToken === undefined ? {} : { authToken }),
  ...(model === undefined ? {} : { model }),
  onUsage: (usage) => {
    console.log(
      `plan in=${String(usage.inputTokens)} out=${String(usage.outputTokens)} ` +
        `cache_read=${String(usage.cacheReadTokens)} cache_write=${String(usage.cacheWriteTokens)} ` +
        `cached=${(usage.cachedShare * 100).toFixed(0)}%`,
    );
  },
});

createNodeServer(withCors(handle, allowedOrigins)).listen(port, () => {
  console.log(`craftkit ai-server listening on http://localhost:${String(port)}`);
  console.log(`point the playground at it: VITE_AI_PLAN_ENDPOINT=http://localhost:${String(port)}`);
  console.log(
    allowedOriginsSetting === undefined || allowedOriginsSetting.trim() === ''
      ? 'browser origins allowed: loopback (localhost, 127.0.0.1, [::1]) on any port'
      : `browser origins allowed: ${allowedOriginsSetting}`,
  );
});
