import Anthropic from '@anthropic-ai/sdk';

import { CLI_EFFORT_LEVELS, createCliClient } from './cli-client';
import { parseAllowedOrigins, withCors } from './cors';
import { createHandler } from './handler';
import {
  OPENROUTER_EFFORT_LEVELS,
  createOpenRouterClient,
  probeOpenRouterModels,
} from './openrouter-client';
import { createRoutingClient, isCliModel } from './routing-client';
import { createNodeServer } from './server';

/**
 * The runnable entry: configuration from the environment, then listen.
 *
 * Everything with behaviour lives in `handler.ts` (the contract) and
 * `server.ts` (the Node adapter), both of which are tested without a network
 * or a key. This file is the only one that reads `process.env` and the only
 * one that binds a port, which is what keeps it too small to hide a bug in.
 */

/*
  `--env-file` turns a blank `KEY=` line into `''`, which `??` does not treat
  as absent — `Number('')` is `0`, not NaN, so an empty `PORT=` would silently
  bind port 0 rather than falling back to 8787. Every optional var reads
  through this so a blank line means "unset" everywhere, not just for PORT.
*/
function setting(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
}

/** A startup mistake, said once and fatally: a server that starts and then fails every request is worse. */
function refuseToStart(message: string): never {
  console.error(`[ai-server] ${message}`);
  process.exit(1);
}

const port = Number(setting('PORT') ?? 8787);
const authToken = setting('CRAFTKIT_AI_TOKEN');
const model = setting('CRAFTKIT_AI_MODEL');
/*
  The models a request may name in `x-craftkit-ai-model`, beyond the default.
  The server owns this list, not the browser: the panel's picker only offers
  what its own env says, and anything outside this list is refused with 400.
*/
const models = (setting('CRAFTKIT_AI_MODELS') ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter((entry) => entry !== '');
/*
  The output ceiling per answer. Unset ⇒ claude.ts's 32k, which fits a
  full-page plan; raise it for models that can write more (the OpenRouter
  backend clamps to what each model actually allows). A blank or unparseable
  value keeps the default rather than silently becoming 0.
*/
const rawMaxTokens = Number(setting('CRAFTKIT_AI_MAX_TOKENS'));
const maxTokens = Number.isInteger(rawMaxTokens) && rawMaxTokens > 0 ? rawMaxTokens : undefined;
const allowedOriginsSetting = setting('CRAFTKIT_AI_ALLOWED_ORIGINS');
// Refuses a malformed list here, at startup, rather than at the first browser.
const allowedOrigins = parseAllowedOrigins(allowedOriginsSetting);

/*
  Which backend answers. `sdk` (the default) is the Anthropic Messages API;
  `openrouter` reaches any model behind one OpenRouter key; `cli` is the
  DEV-ONLY escape hatch that routes plans through the local `claude` CLI so
  `prompt.ts` can be tested before any key exists (see cli-client.ts for what
  stops being faithful — never set it in a deployment anyone but you talks to).
  An unknown value is refused rather than silently becoming `sdk`, because a
  typo here would bill a different account than the one intended.
*/
const BACKENDS = ['sdk', 'cli', 'openrouter'] as const;
const rawBackend = setting('CRAFTKIT_AI_BACKEND') ?? 'sdk';
const backend =
  BACKENDS.find((name) => name === rawBackend) ??
  refuseToStart(`CRAFTKIT_AI_BACKEND="${rawBackend}" is not one of ${BACKENDS.join(', ')}.`);

/*
  The CLI's whole-run cap. Left alone it is ten minutes, which is what a
  full-page plan actually takes at the CLI's ~80 output tokens a second; it is
  configurable because the honest answer depends on the size of the page being
  asked for. A blank or unparseable value keeps the default rather than
  silently becoming 0.
*/
const rawCliTimeout = Number(setting('CRAFTKIT_AI_CLI_TIMEOUT_MS'));
const cliTimeoutMs = Number.isFinite(rawCliTimeout) && rawCliTimeout > 0 ? rawCliTimeout : undefined;

/*
  Validated here rather than passed through: the CLI answers an unknown level
  with a warning on stderr and then silently uses its default, so a typo would
  quietly change the reasoning budget of every plan.
*/
const rawEffort = setting('CRAFTKIT_AI_CLI_EFFORT');
const cliEffort = CLI_EFFORT_LEVELS.find((level) => level === rawEffort);
if (rawEffort !== undefined && cliEffort === undefined) {
  console.warn(
    `WARNING: CRAFTKIT_AI_CLI_EFFORT="${rawEffort}" is not one of ${CLI_EFFORT_LEVELS.join(', ')}. ` +
      "Ignoring it and leaving the CLI's default effort in place.",
  );
}

/** The dev CLI client for one model, sharing the CLI settings above. */
function createCliBackend(cliModel: string | undefined): Anthropic {
  return createCliClient({
    ...(cliModel === undefined ? {} : { model: cliModel }),
    ...(cliEffort === undefined ? {} : { effort: cliEffort }),
    ...(cliTimeoutMs === undefined ? {} : { timeoutMs: cliTimeoutMs }),
    // The run log: without it a plan is four minutes of an idle terminal.
    onLog: (line) => {
      console.log(`[ai-server] ${line}`);
    },
  });
}

/*
  OpenRouter has no lazy credential resolution and no default model that
  means anything — its slugs are `vendor/model`, and the SDK's default
  `claude-opus-5` is not one — so both are demanded at startup.

  HYBRID: a `cli:` entry in CRAFTKIT_AI_MODELS (or CRAFTKIT_AI_FALLBACK) is the
  local `claude` CLI — the owner's own subscription — behind the same picker.
  See routing-client.ts.
*/
async function createOpenRouterBackend(): Promise<Anthropic> {
  const apiKey =
    setting('OPENROUTER_API_KEY') ??
    refuseToStart(
      'CRAFTKIT_AI_BACKEND=openrouter needs OPENROUTER_API_KEY. Put it in apps/ai-server/.env and restart.',
    );
  /*
    The default may itself be a `cli:` entry (HYBRID with the CLI answering
    unless the picker says otherwise); anything else must be an OpenRouter
    slug, `vendor/model`.
  */
  if (model === undefined || (!isCliModel(model) && !model.includes('/'))) {
    refuseToStart(
      'CRAFTKIT_AI_BACKEND=openrouter needs CRAFTKIT_AI_MODEL set to an OpenRouter slug — vendor/model, ' +
        `such as anthropic/claude-sonnet-4.5 — or a cli: entry${model === undefined ? '' : `; "${model}" is neither`}.`,
    );
  }
  const cliSlugs = [...(isCliModel(model) ? [model] : []), ...models.filter(isCliModel)];
  const openRouterSlugs = models.filter((entry) => !isCliModel(entry));
  /*
    The OpenRouter shim needs a model of its own only when a request names
    none, which never happens through the handler; when the default is a
    `cli:` entry, the first OpenRouter slug stands in.
  */
  const openRouterDefault = isCliModel(model) ? (openRouterSlugs[0] ?? model) : model;
  for (const entry of openRouterSlugs) {
    if (!entry.includes('/')) {
      console.warn(
        `WARNING: CRAFTKIT_AI_MODELS entry "${entry}" is not an OpenRouter slug (vendor/model) ` +
          'nor a cli: entry; a request that names it will fail at OpenRouter.',
      );
    }
  }
  const rawFallback = setting('CRAFTKIT_AI_FALLBACK');
  const fallback = rawFallback !== undefined && isCliModel(rawFallback) ? rawFallback : undefined;
  if (rawFallback !== undefined && fallback === undefined) {
    console.warn(
      `WARNING: CRAFTKIT_AI_FALLBACK="${rawFallback}" is not a cli: entry (cli:haiku, cli:sonnet, or bare cli:). Ignoring it.`,
    );
  }
  const rawOpenRouterEffort = setting('CRAFTKIT_AI_OPENROUTER_EFFORT');
  const effort = OPENROUTER_EFFORT_LEVELS.find((level) => level === rawOpenRouterEffort);
  if (rawOpenRouterEffort !== undefined && effort === undefined) {
    console.warn(
      `WARNING: CRAFTKIT_AI_OPENROUTER_EFFORT="${rawOpenRouterEffort}" is not one of ` +
        `${OPENROUTER_EFFORT_LEVELS.join(', ')}. Ignoring it and leaving the model's default reasoning in place.`,
    );
  }
  const rawStrict = setting('CRAFTKIT_AI_OPENROUTER_STRICT');
  const strict = rawStrict === undefined ? undefined : ['1', 'true', 'yes', 'on'].includes(rawStrict.toLowerCase());
  const baseUrl = setting('CRAFTKIT_AI_OPENROUTER_BASE_URL');

  /*
    Asked once, here: which of the configured slugs OpenRouter still lists,
    which decode straight into the plan schema, and how much each may write.
    A withdrawn slug is named now, in the terminal, not by the first request
    that fails on it.
  */
  const slugs = [...new Set([openRouterDefault, ...openRouterSlugs])].filter((slug) => !isCliModel(slug));
  const facts = await probeOpenRouterModels(slugs, { ...(baseUrl === undefined ? {} : { baseUrl }) });
  if (facts.size === 0) {
    console.warn(
      "WARNING: could not read OpenRouter's model list; strict decoding and output ceilings are unknown for this run.",
    );
  }
  for (const slug of slugs) {
    const fact = facts.get(slug);
    if (fact === undefined) continue;
    if (!fact.listed) {
      console.warn(
        `WARNING: OpenRouter does not list "${slug}" right now; a request naming it will fail. ` +
          'Check https://openrouter.ai/models and update CRAFTKIT_AI_MODEL / CRAFTKIT_AI_MODELS.',
      );
      continue;
    }
    const price =
      fact.promptPerMillion === undefined || fact.completionPerMillion === undefined
        ? ''
        : `, $${String(fact.promptPerMillion)}/M in, $${String(fact.completionPerMillion)}/M out`;
    const decoding =
      fact.structuredOutputs && /^(anthropic|openai)\//u.test(slug)
        ? 'strict schema decoding'
        : fact.structuredOutputs
          ? 'schema as text (provider decoding not trusted)'
          : 'schema as text only';
    console.log(
      `[ai-server] ${slug}: ${decoding}, ` +
        `max output ${fact.maxOutputTokens === undefined ? 'unknown' : String(fact.maxOutputTokens)} tokens${price}`,
    );
  }

  const openrouter = createOpenRouterClient({
    apiKey,
    model: openRouterDefault,
    models: facts,
    ...(effort === undefined ? {} : { effort }),
    ...(strict === undefined ? {} : { strict }),
    ...(baseUrl === undefined ? {} : { baseUrl }),
    onLog: (line) => {
      console.log(`[ai-server] ${line}`);
    },
  });
  if (cliSlugs.length === 0 && fallback === undefined) return openrouter;

  for (const slug of cliSlugs) {
    console.log(`[ai-server] ${slug}: the local \`claude\` CLI (your own subscription, no API billing)`);
  }
  if (fallback !== undefined) {
    console.log(`[ai-server] fallback: ${fallback} answers when an OpenRouter model is overloaded or unreachable`);
  }
  return createRoutingClient({
    openrouter,
    cli: createCliBackend,
    ...(fallback === undefined ? {} : { fallback }),
    onLog: (line) => {
      console.log(`[ai-server] ${line}`);
    },
  });
}

async function createClient(): Promise<Anthropic> {
  if (backend === 'cli') return createCliBackend(model);
  if (backend === 'openrouter') return createOpenRouterBackend();
  /*
    A bare client. It resolves credentials the way every Anthropic SDK does —
    ANTHROPIC_API_KEY, then ANTHROPIC_AUTH_TOKEN, then an `ant auth login`
    profile — so an unset API key is not the same as no credentials, and this
    file must not second-guess that resolution by demanding one.
  */
  return new Anthropic();
}

const client = await createClient();
if (backend === 'cli') {
  console.warn(
    '[ai-server] CRAFTKIT_AI_BACKEND=cli: plans are being generated by the local `claude` CLI, ' +
      'not the Anthropic API. No structured-output enforcement, no real refusal detection, no ' +
      'usage/cache metrics. Testing only — unset CRAFTKIT_AI_BACKEND once ANTHROPIC_API_KEY is set.',
  );
} else if (backend === 'openrouter') {
  const answerer = isCliModel(String(model))
    ? `the local \`claude\` CLI (${String(model)})`
    : `${String(model)} through OpenRouter`;
  console.log(
    `[ai-server] CRAFTKIT_AI_BACKEND=openrouter: plans are generated by ${answerer}` +
      (models.length === 0 ? '.' : `; a request may also name ${models.join(', ')}.`),
  );
} else if (client.apiKey === null && client.authToken === null) {
  /*
    Not fatal — the SDK may still resolve a profile lazily — but loud, because
    a server that starts cleanly and then fails every request with a generic
    sentence is exactly what happened once. The request-time translation in
    handler.ts names the same cause to the panel.
  */
  console.warn(
    'WARNING: no ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN in the environment. ' +
      'Unless an SDK profile resolves, every plan will fail. Put the key in apps/ai-server/.env and restart, ' +
      'set CRAFTKIT_AI_BACKEND=openrouter with an OPENROUTER_API_KEY, ' +
      'or set CRAFTKIT_AI_BACKEND=cli for a dev-only fallback through the local `claude` CLI.',
  );
}

const handle = createHandler({
  client,
  ...(authToken === undefined ? {} : { authToken }),
  ...(model === undefined ? {} : { model }),
  ...(models.length === 0 ? {} : { models }),
  ...(maxTokens === undefined ? {} : { maxTokens }),
  /*
    The start of every answer, so a plan the validator refuses two layers
    later ("names unknown command "e"") can be read here in the model's own
    words. Bounded: the log is a place to look, not a place to store plans.
  */
  onAnswer: (text) => {
    const flat = text.replace(/\s+/gu, ' ').trim();
    console.log(
      `[ai-server] answer: ${flat.length.toLocaleString('en-US')} characters, starts «${flat.slice(0, 240)}${flat.length > 240 ? '…' : ''}»`,
    );
  },
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
