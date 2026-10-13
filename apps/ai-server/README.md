# `@craftkit/ai-server`

The model server behind `createRemoteAiPlanProvider`: Claude through the Anthropic SDK by default,
or any model OpenRouter fronts through one OpenRouter key. One route, one POST, three possible
answers.

Until this existed the assistant's entire remote path was a contract with nothing on the other end:
the wire was specified and tested, and every request went nowhere.

## Run it

```bash
export ANTHROPIC_API_KEY=sk-ant-...      # or put it in apps/ai-server/.env (git-ignored; see .env.example)
pnpm --filter @craftkit/ai-server dev    # = vite build && node --env-file-if-exists=.env dist/main.js
```

Or any model OpenRouter fronts, with one key — in `apps/ai-server/.env`:

```bash
CRAFTKIT_AI_BACKEND=openrouter
OPENROUTER_API_KEY=sk-or-...
CRAFTKIT_AI_MODEL=anthropic/claude-sonnet-4.5   # an OpenRouter slug, vendor/model — required on this backend
```

It is **built, then run** — never run from source. Node can strip types but does not resolve
extensionless imports, and every workspace package imports `'./types'` rather than `'./types.ts'`.
`node --experimental-strip-types src/main.ts` fails on the first import inside
`@craftkit/builder-ai` while the typecheck and the tests both pass; that is exactly how the first
version of this server was green on every gate and did not start. The Vite SSR build resolves the
way the tests do and emits one plain ESM file (`dist/main.js`, ~20 kB) with the workspace bundled in
and only the SDK external.

**Check who owns port 8787 first.** This repo also has an older dev bridge,
`scripts/ai-plan-bridge.mjs`, which listens on the same port and builds its own prompt. If it is
running, the playground talks to it and none of this server's behaviour (catalog modes, free
colours, icons, skills in the cached segment) reaches the model — silently.
`lsof -nP -iTCP:8787 -sTCP:LISTEN` names the process; stop it before starting this one. Both CAN
listen at once: the bridge binds IPv4 `127.0.0.1:8787` and this server binds `*:8787` including
IPv6, so neither fails with "address in use" — the browser then reaches this server on `::1` while
`curl 127.0.0.1` reaches the bridge, and the two disagree. Exactly one line in that `lsof` output is
the only acceptable state.

Then point the playground at it and restart Vite:

```bash
# apps/playground/.env.local
VITE_AI_PLAN_ENDPOINT=http://localhost:8787
VITE_CODE_RUNTIME_ENDPOINT=http://127.0.0.1:8787
VITE_CODE_RUNTIME_TOKEN=replace-with-a-local-development-token
VITE_CODE_PREVIEW_URL_TEMPLATE=http://{project}.localhost:5175/
```

Start the isolated preview origin in a second terminal. It reverse-proxies immutable artifact
capabilities from the runtime, so scripts and styles stay on the project-specific preview origin:

```bash
VITE_CODE_RUNTIME_ENDPOINT=http://127.0.0.1:8787 pnpm --filter @craftkit/code-preview dev
```

Production needs the equivalent `/artifacts/*` reverse proxy on a preview domain template such as
`https://{project}.preview.example.com/`, with a separate site origin per project. A shared preview
origin does not isolate one project's CPU or storage from another project.

`planProviderFromEnv` already reads the plan variables; with the endpoint unset the deterministic
offline provider keeps answering. The code runtime has no fake production fallback: a missing or
failed compiler returns an explicit error and the editor retains the last successful artifact.

## Code and authored-Agent endpoints

- `POST /v1/code/compile` accepts `{ "snapshot": RuntimeSnapshot }`. It compiles virtual authored
  files in a disposable process without executing them, stores the result in a bounded memory
  artifact store, and returns capability URLs plus source handles.
- `GET /artifacts/:artifactId/:file?access=...` serves an immutable compiled file. The unguessable
  capability is required; missing and wrong capabilities both return `404`.
- `POST /v1/code/export` accepts `{ "pages": ExportPage[], "artifactIds": string[] }`. Every page,
  project, and source revision must match its artifact. Authored JavaScript is prerendered only in a
  disposable Playwright browser context with network and service workers blocked. A canonical URL is
  optional because no published domain is assumed.
- `POST /v1/agent/run` accepts version `1`, `mode: "ask" | "plan" | "auto"`, run/project/revision
  identities, a design contract, a project index, and bounded independent units. Ask and Plan must
  own no files and always return `changes: []`. Auto returns complete-file proposals for its exact
  owned paths; the client still compiles and commits them with revision checks. Send
  `Accept: text/event-stream` to receive each completed `unit` before the final `result`.

All POST routes require `Authorization: Bearer <CRAFTKIT_AI_TOKEN>` when the token is configured.
Artifact GETs use their own scoped capability so a module script can load without exposing the API
token to authored code.

| Variable                          | Default                        | Meaning                                                                                                                                                                                                                                                                                |
| --------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`               | —                              | Standard SDK resolution. **Unset does not mean no credentials**: the SDK also reads `ANTHROPIC_AUTH_TOKEN` and an `ant auth login` profile, so a bare client works after `ant auth login`.                                                                                             |
| `PORT`                            | `8787`                         |                                                                                                                                                                                                                                                                                        |
| `CRAFTKIT_AI_MODEL`               | `claude-opus-5`                | Override deliberately, with a measurement. On the `openrouter` backend it is required and must be a `vendor/model` slug.                                                                                                                                                               |
| `CRAFTKIT_AI_LUNA_MODEL`          | —                              | OpenRouter slug for cheap context/copy work. Authored Agent runs stay disabled unless at least one role model is configured and all selected routes pass the live capability probe.                                                                                                    |
| `CRAFTKIT_AI_TERRA_MODEL`         | —                              | OpenRouter slug for ordinary authored-code work.                                                                                                                                                                                                                                       |
| `CRAFTKIT_AI_SOL_MODEL`           | —                              | OpenRouter slug for design and visual-review work.                                                                                                                                                                                                                                     |
| `CRAFTKIT_AI_ASTRA_MODEL`         | —                              | OpenRouter slug reserved for the single bounded escalation.                                                                                                                                                                                                                            |
| `CRAFTKIT_AI_MODELS`              | —                              | Comma-separated models a request may name in its `x-craftkit-ai-model` header (the playground picker), beyond the default. Unset ⇒ only the default is accepted; any other choice is refused with 400. The server owns this list, never the browser.                                   |
| `CRAFTKIT_AI_FALLBACK`            | —                              | OpenRouter backend only. A `cli:` entry that answers instead when an OpenRouter model is rate limited, overloaded, or unreachable (429/502); the panel's progress line says it switched. Unset ⇒ those failures reach the panel with Retry.                                            |
| `CRAFTKIT_AI_BACKEND`             | `sdk`                          | `sdk` (the Anthropic Messages API), `openrouter` (any model behind one OpenRouter key), or `cli` (dev only). Anything else refuses to start.                                                                                                                                           |
| `OPENROUTER_API_KEY`              | —                              | OpenRouter backend only, and required there. From openrouter.ai/keys.                                                                                                                                                                                                                  |
| `CRAFTKIT_AI_OPENROUTER_EFFORT`   | model default                  | OpenRouter only. `none`/`minimal`/`low`/`medium`/`high`/`xhigh`, sent as `reasoning.effort`. Unset sends no reasoning field at all. When the model reasons, its reasoning narrates the progress line.                                                                                  |
| `CRAFTKIT_AI_OPENROUTER_STRICT`   | per model                      | OpenRouter only. Unset ⇒ constrained decoding only for Anthropic/OpenAI models that declare `structured_outputs`; every other model gets the schema as text only (a provider's guided decoding once turned every command name into a single letter). `true`/`false` forces it for all. |
| `CRAFTKIT_AI_MAX_TOKENS`          | `32000`                        | Output ceiling per answer. Raise it for models that can write more; the OpenRouter backend clamps each request to the chosen model's own limit, so a high value is safe.                                                                                                               |
| `CRAFTKIT_AI_OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` | OpenRouter only. A proxy goes here.                                                                                                                                                                                                                                                    |
| `CRAFTKIT_AI_TOKEN`               | —                              | When set, every request must carry `Authorization: Bearer <token>`. Set it for anything but localhost.                                                                                                                                                                                 |
| `CRAFTKIT_AI_CLI_EFFORT`          | CLI default                    | CLI backend only. `low`/`medium`/`high`/`xhigh`/`max`. Passed as `--effort`; unset means the flag is omitted entirely, so an inherited `CLAUDE_EFFORT` cannot decide it. The reasoning **text** is redacted on this path, so effort buys plan quality, not narration.                  |
| `CRAFTKIT_AI_CLI_TIMEOUT_MS`      | `600000`                       | CLI backend only (`CRAFTKIT_AI_BACKEND=cli`). Whole-run cap. A full-page plan is 15–25k output tokens and the CLI writes ~80 a second, so three to five minutes is normal; a cap near two minutes kills every real plan mid-generation.                                                |
| `CRAFTKIT_AI_ALLOWED_ORIGINS`     | loopback, any port             | Comma-separated browser origins (`https://app.example.com`). An explicit list replaces the loopback default. A browser request from any other origin is refused with 403 before the model is called; requests with no `Origin` (curl, servers) are unaffected.                         |

## Background batches

The agent's big jobs (the same request on every page of a site) go through the Message Batches API
at half price, answered within 24 hours. `batch-routes.ts` has the contract; builder-ai's
`createAiBatchRunner` drives it.

- `POST /batch` accepts `{ "version": 1, "model"?: string, "items": [{ "id", "request" }] }`: 1 to
  100 items, each an ordinary `/plan` body held to `/plan`'s checks and sent as exactly the request
  `/plan` would stream for it (one-hour cache breakpoints included). Answers the batch's state.
- `GET /batch/:id` answers `{ version, id, status, counts, createdAt, endedAt, expiresAt }`;
  `POST /batch/:id/cancel` stops it.
- `GET /batch/:id/results` (`409` until `status` is `ended`) answers one entry per item, keyed by
  id: `{ id, body, usage }` where `body` is exactly what `/plan` would have answered, or
  `{ id, error: { type, message } }` for an item that errored, expired or was cancelled.

Only the Messages API batches: the `sdk` backend with `ANTHROPIC_API_KEY`, or `api:` models beside
OpenRouter. On the `cli` backend, or OpenRouter with no `api:` model or key, `/batch` answers `501`
naming what is missing; an item whose model only the CLI or OpenRouter serves answers `409`.

## Concurrency

There is no request cap here, on purpose. A page-sized request in the playground is a split build
(`runAiBuild` in `@craftkit/builder-ai`): one scaffold call, then one call per section, with up to
`fillConcurrencyFor(n)` sections in flight at once — as many writers as sections up to three, four
for four to six sections, five for seven to nine, six at most. On the CLI backend every in-flight
request is one `claude` process, so the busiest moment of a twelve-section page is six processes on
this machine; the pool's own ceiling is the only limiter this server relies on. A cancelled request
— the person pressed Stop, or a section ran past its own deadline — reaches the child: the handler
passes `request.signal` through and `cli-client.ts` kills the whole process group, so an abandoned
section stops billing.

Do not put the old `scripts/ai-plan-bridge.mjs` on this port for a build. Its
`AI_BRIDGE_MAX_CONCURRENT` defaults to 1 (hard ceiling 4) and answers the rest with 429, so every
parallel section beyond the first is retried once and then skipped — a build that looks slower and
emptier for no reason visible in the panel.

## Ready-scene initialization

A mural writer can return one `setProp` command with `js: "@preset:<id>"`. Builder AI completes the
responsive region locally with the tested scene, contract title and required copy, applicable
primary action, and declared scene metadata/settings. Authored tree/CSS and custom scene code stay
authored. This uses the existing backdrop catalog; games and stories retain their own scene path.

The compact initialization-only brief carries an exact standalone
`SCENE INITIALIZATION v1: <id>|<id>...` line with one to four offered ids. `/plan` applies its fast
policy only when Free code is on and the call carries both `craftkit.build-fill` and a Pixi skill.
General `READY SCENES` advice does not qualify. This lane uses low effort, compatible thinking-off
behavior, and an 8,192-token output ceiling. An explicit `high`, `xhigh`, or `max` request retains
its effort and ordinary scene output capacity. Bespoke scenes keep reasoning at medium or the higher
section budget, with the default 48,000-token scene ceiling; larger deployment ceilings are
preserved for those calls.

On OpenRouter, initialization sends `reasoning.enabled: false` for supported Claude lines or a model
that declares `reasoning.mandatory: false`. Known always-thinking Claude 5.5/Fable/Mythos lines,
mandatory models, and unknown models retain low effort. General and deep calls retain their existing
mapping. This follows the
[OpenRouter reasoning contract](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens);
the output ceiling remains subject to the selected model's own capacity.

Writer deadlines belong to `runAiBuild`, not the server's token ceiling: an eligible backdrop
attempt defaults to three minutes, an initialization-only attempt to 90 seconds, ordinary sections
to four minutes, and game/story or other non-backdrop scenes to seven minutes. An explicit caller
`taskTimeoutMs` overrides these defaults, including the initialization cap.

Run the offline initializer measurement from the workspace root:

```bash
pnpm --filter @craftkit/builder-ai benchmark:scene-init
```

The recorded fixture covers 22 ready scenes and 1,100 local initialization runs, with 98.25% fewer
JSON payload characters for compact answers. It measures local CPU and exact serialized characters;
it does not measure provider tokens, billing, live generation latency, or rendered visual quality.

## What it does with a request

1. Validates the body is an `AiPlanWireRequest` of the version it understands.
2. Builds a two-segment system prompt — rules, then catalog — and puts the document and the request
   in `messages`.
3. Calls Claude with `output_config.format` set to the JSON Schema **the request carried**, so the
   shape the model is constrained to and the shape the validator accepts cannot drift apart.
4. Answers with the plan, a refusal, or a versioned invalid-output report.

It never applies anything. The plan crosses back to the client and walks the same registry and
scratch-kernel validation any plan does — a wrong server can produce a rejected proposal, never a
damaged document.

## The prompt layout is the cost design

Prompt caching is a prefix match, and Claude renders `tools` → `system` → `messages`. So:

```
system[0]  rules        frozen text, no interpolation
system[1]  catalog      ← cache breakpoint
messages   document, history, request
```

The catalog is the expensive half and the half that never changes between turns; the document
changes every turn. Put them the other way round and one typed character re-bills tens of thousands
of tokens. `canonicalJsonStringify` on the client is what makes the prefix genuinely stable rather
than accidentally so.

The breakpoint is only written when the segment is large enough to cache (~1024 tokens). A
`cache_control` that never caches reads as a working optimisation in review while the bill says
otherwise.

**Watch `cachedShare` in the log line.** Near zero means something got into the prefix that changes
per request, and the catalog is being paid for every time.

Same-prefix cold calls are staggered until the first call emits actual backend stream activity or
answer text. SDK stream events, CLI message/content events, and OpenRouter delta frames can release
the gate; a timer's "Waiting for the model to start" narration cannot. A failure releases waiting
siblings without claiming warmth, and waits remain bounded by 15 seconds and cancellation. Actual
provider cache-read usage remains the evidence that the provider reused its cache.

## Streaming

The client advertises `text/event-stream`; when it does, `status` frames report progress and exactly
one `result` frame ends the stream. Backends may also produce timed waiting narration while the
model is silent; those updates keep progress observable but never establish cache readiness.

A client disconnect aborts the Claude request. Nothing keeps generating a plan nobody will read.

## The OpenRouter backend

`CRAFTKIT_AI_BACKEND=openrouter` routes the same request through OpenRouter's chat-completions API
(`src/openrouter-client.ts`), so one key reaches every model OpenRouter fronts. It plugs in at the
seam the tests fake — `client.messages.stream` — so `prompt.ts`, `claude.ts` and `handler.ts` run
unmodified. What is translated:

- **Model.** `CRAFTKIT_AI_MODEL` must be an OpenRouter slug (`vendor/model`); the server refuses to
  start otherwise. The SDK default `claude-opus-5` is not one, and a wrong slug would fail every
  request with a sentence that blames the model.
- **Facts.** At startup the server asks OpenRouter what each configured slug IS: listed at all, able
  to decode straight into the plan schema, how much it may write, and what it costs. A slug
  OpenRouter no longer lists is named in the terminal then, not by the first request that fails on
  it; strict decoding is on for exactly the models that support it; and no request asks a model for
  more output than it can write.
- **Choice.** A request may name a model in `x-craftkit-ai-model` (the playground header's picker,
  fed by `VITE_AI_PLAN_MODELS`). It is honoured only if it is the default or in
  `CRAFTKIT_AI_MODELS`; anything else is a terminal `400` that names the slug. A public endpoint
  must not let a browser pick the most expensive model on someone else's key.
- **Hybrid.** A `cli:haiku` / `cli:sonnet` / bare `cli:` entry in `CRAFTKIT_AI_MODELS` is the local
  `claude` CLI — the owner's own subscription, no API billing — behind the same picker
  (`src/routing-client.ts`). With `CRAFTKIT_AI_FALLBACK=cli:haiku`, a free OpenRouter model that is
  overloaded or unreachable hands the request to the CLI, and the progress line says so: a picker
  that silently changed who answered would be a lie.
- **Schema.** The request's output contract goes out as `response_format.json_schema` (enforced by
  the models that support it) AND as a text block after the cache breakpoint, for the ones that
  silently drop the format. A model that ignores it and fences the JSON, or talks around it, is
  unwrapped before parsing. `claude.ts` still parses and the client still validates, so a model that
  ignores everything produces a rejected proposal, never a damaged document.
- **Cache.** `cache_control` on the catalog segment passes through; OpenRouter forwards it to the
  models that honour it. OpenRouter's `prompt_tokens` includes cached tokens where the SDK's
  `input_tokens` excludes them, so usage is re-based before it reaches the `cachedShare` log line.
- **Narration.** A model that reasons (`CRAFTKIT_AI_OPENROUTER_EFFORT` set, and the model supports
  it) narrates the progress line with its own reasoning, as on the SDK path. One that does not gets
  the clock: "Waiting for the model to start", then "Writing the plan — 4,200 characters so far".
- **Failures.** Each becomes a plain sentence ending in OpenRouter's own message, with the status
  the client should act on: a rejected key or an empty balance is `500` (a deployment mistake), a
  rate limit is `429` (retry), an unknown slug or a blocked request is `400` (terminal), a provider
  outage or a stream that ends mid-plan is `502` (retry).

Not faithful: a non-Anthropic model has no `stop_reason: 'refusal'`. A provider content filter and
an OpenAI-style `refusal` delta are both mapped to the wire's refusal shape; anything else a model
does instead of a plan arrives as invalid output.

## Failure mapping

The client's error taxonomy is only as good as this table, so each row is deliberate:

| Situation                      | Answer                    | Why                                                                                                                                                                 |
| ------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safety decline                 | `200` + `{refusal}`       | It is an ANSWER. A 4xx would read as an outage and lose the explanation.                                                                                            |
| Single command `impossible`    | `200` + `{refusal}`       | The prompt's own "cannot express this" convention; the rationale is the sentence. No command by that name exists, so untranslated it surfaced as a validator error. |
| Output cut off at `max_tokens` | `200` + `{invalidOutput}` | With advice to ask for a smaller change.                                                                                                                            |
| Unparseable output             | `200` + `{invalidOutput}` | Clearer here than as a schema violation two layers later.                                                                                                           |
| Rate limited                   | `429`                     | The client treats it as retryable.                                                                                                                                  |
| Bad upstream request           | `400`                     | Terminal; retrying will not help.                                                                                                                                   |
| Missing/invalid API key        | `500` + plain sentence    | A deployment mistake, said plainly.                                                                                                                                 |
| Client hung up                 | `499`, no body            | Not a failure to log.                                                                                                                                               |

No raw SDK message and no stack ever reaches the client.

## Tests

None of the tests call an API or spawn a CLI. Three layers, deliberately:

- **`handler.test.ts`** verifies the TRANSLATION — every way Claude can answer or fail becoming one
  of the three shapes the client knows how to read — through platform `Request`/`Response`, with a
  faked SDK client.
- **`openrouter-client.test.ts`** and **`cli-client.test.ts`** verify the two non-SDK backends
  against a faked `fetch` and a faked child process: the request they send, the stream they parse,
  every failure becoming a sentence with a status, and the narration that keeps the panel's line
  moving through silence.
- **`server.test.ts`** drives the Node adapter over a real loopback socket: header flattening, body
  assembly, streaming write order, abort on client disconnect, and the 500 fallback. This layer is
  where the first version failed to start while every other gate was green; it is not allowed to be
  untested again.

```bash
pnpm --filter @craftkit/ai-server test
```

## Not done here

- **No rate limiting, no request queue.** One process, one request at a time per connection. Put it
  behind whatever your deployment already uses.
- **No conversation storage.** History arrives on the wire from the client, which owns it.
- **No live smoke test in CI.** Running one would need a real key and would bill a real account on
  every push.
