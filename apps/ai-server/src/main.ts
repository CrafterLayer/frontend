import Anthropic from '@anthropic-ai/sdk';

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

/*
  A bare client. It resolves credentials the way every Anthropic SDK does —
  ANTHROPIC_API_KEY, then ANTHROPIC_AUTH_TOKEN, then an `ant auth login`
  profile — so an unset API key is not the same as no credentials, and this
  file must not second-guess that resolution by demanding one.
*/
const client = new Anthropic();

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

createNodeServer(handle).listen(port, () => {
  console.log(`craftkit ai-server listening on http://localhost:${String(port)}`);
  console.log(`point the playground at it: VITE_AI_PLAN_ENDPOINT=http://localhost:${String(port)}`);
});
