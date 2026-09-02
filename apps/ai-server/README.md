# `@craftkit/ai-server`

The Claude server behind `createRemoteAiPlanProvider`. One route, one POST, three
possible answers.

Until this existed the assistant's entire remote path was a contract with nothing
on the other end: the wire was specified and tested, and every request went
nowhere.

## Run it

```bash
export ANTHROPIC_API_KEY=sk-ant-...      # or put it in apps/ai-server/.env (git-ignored; see .env.example)
pnpm --filter @craftkit/ai-server dev    # = vite build && node --env-file-if-exists=.env dist/main.js
```

It is **built, then run** — never run from source. Node can strip types but does
not resolve extensionless imports, and every workspace package imports
`'./types'` rather than `'./types.ts'`. `node --experimental-strip-types
src/main.ts` fails on the first import inside `@craftkit/builder-ai` while the
typecheck and the tests both pass; that is exactly how the first version of this
server was green on every gate and did not start. The Vite SSR build resolves
the way the tests do and emits one plain ESM file (`dist/main.js`, ~20 kB) with
the workspace bundled in and only the SDK external.

**Check who owns port 8787 first.** This repo also has an older dev bridge,
`scripts/ai-plan-bridge.mjs`, which listens on the same port and builds its own
prompt. If it is running, the playground talks to it and none of this server's
behaviour (catalog modes, free colours, icons, skills in the cached segment)
reaches the model — silently. `lsof -nP -iTCP:8787 -sTCP:LISTEN` names the
process; stop it before starting this one. Both CAN listen at once: the bridge
binds IPv4 `127.0.0.1:8787` and this server binds `*:8787` including IPv6, so
neither fails with "address in use" — the browser then reaches this server on
`::1` while `curl 127.0.0.1` reaches the bridge, and the two disagree. Exactly
one line in that `lsof` output is the only acceptable state.

Then point the playground at it and restart Vite:

```bash
# apps/playground/.env.local
VITE_AI_PLAN_ENDPOINT=http://localhost:8787
```

That is the whole wiring. `planProviderFromEnv` already reads those variables;
with the endpoint unset the deterministic offline provider keeps answering, so
nothing breaks by not running this.

| Variable | Default | Meaning |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Standard SDK resolution. **Unset does not mean no credentials**: the SDK also reads `ANTHROPIC_AUTH_TOKEN` and an `ant auth login` profile, so a bare client works after `ant auth login`. |
| `PORT` | `8787` | |
| `CRAFTKIT_AI_MODEL` | `claude-opus-5` | Override deliberately, with a measurement. |
| `CRAFTKIT_AI_TOKEN` | — | When set, every request must carry `Authorization: Bearer <token>`. Set it for anything but localhost. |
| `CRAFTKIT_AI_CLI_EFFORT` | CLI default | CLI backend only. `low`/`medium`/`high`/`xhigh`/`max`. Passed as `--effort`; unset means the flag is omitted entirely, so an inherited `CLAUDE_EFFORT` cannot decide it. The reasoning **text** is redacted on this path, so effort buys plan quality, not narration. |
| `CRAFTKIT_AI_CLI_TIMEOUT_MS` | `600000` | CLI backend only (`CRAFTKIT_AI_BACKEND=cli`). Whole-run cap. A full-page plan is 15–25k output tokens and the CLI writes ~80 a second, so three to five minutes is normal; a cap near two minutes kills every real plan mid-generation. |
| `CRAFTKIT_AI_ALLOWED_ORIGINS` | loopback, any port | Comma-separated browser origins (`https://app.example.com`). An explicit list replaces the loopback default. A browser request from any other origin is refused with 403 before the model is called; requests with no `Origin` (curl, servers) are unaffected. |

## What it does with a request

1. Validates the body is an `AiPlanWireRequest` of the version it understands.
2. Builds a two-segment system prompt — rules, then catalog — and puts the
   document and the request in `messages`.
3. Calls Claude with `output_config.format` set to the JSON Schema **the request
   carried**, so the shape the model is constrained to and the shape the
   validator accepts cannot drift apart.
4. Answers with the plan, a refusal, or a versioned invalid-output report.

It never applies anything. The plan crosses back to the client and walks the
same registry and scratch-kernel validation any plan does — a wrong server can
produce a rejected proposal, never a damaged document.

## The prompt layout is the cost design

Prompt caching is a prefix match, and Claude renders `tools` → `system` →
`messages`. So:

```
system[0]  rules        frozen text, no interpolation
system[1]  catalog      ← cache breakpoint
messages   document, history, request
```

The catalog is the expensive half and the half that never changes between turns;
the document changes every turn. Put them the other way round and one typed
character re-bills tens of thousands of tokens. `canonicalJsonStringify` on the
client is what makes the prefix genuinely stable rather than accidentally so.

The breakpoint is only written when the segment is large enough to cache
(~1024 tokens). A `cache_control` that never caches reads as a working
optimisation in review while the bill says otherwise.

**Watch `cachedShare` in the log line.** Near zero means something got into the
prefix that changes per request, and the catalog is being paid for every time.

## Streaming

The client advertises `text/event-stream`; when it does, `status` frames carry
Claude's own reasoning summary and exactly one `result` frame ends the stream.
The narration is the model's actual consideration rather than an invented
spinner — a plan takes tens of seconds, and a silent wait that long reads as a
hang.

A client disconnect aborts the Claude request. Nothing keeps generating a plan
nobody will read.

## Failure mapping

The client's error taxonomy is only as good as this table, so each row is
deliberate:

| Situation | Answer | Why |
| --- | --- | --- |
| Safety decline | `200` + `{refusal}` | It is an ANSWER. A 4xx would read as an outage and lose the explanation. |
| Output cut off at `max_tokens` | `200` + `{invalidOutput}` | With advice to ask for a smaller change. |
| Unparseable output | `200` + `{invalidOutput}` | Clearer here than as a schema violation two layers later. |
| Rate limited | `429` | The client treats it as retryable. |
| Bad upstream request | `400` | Terminal; retrying will not help. |
| Missing/invalid API key | `500` + plain sentence | A deployment mistake, said plainly. |
| Client hung up | `499`, no body | Not a failure to log. |

No raw SDK message and no stack ever reaches the client.

## Tests

39 tests, none of which call the API. Two layers, deliberately:

- **`handler.test.ts`** verifies the TRANSLATION — every way Claude can answer
  or fail becoming one of the three shapes the client knows how to read —
  through platform `Request`/`Response`, with a faked SDK client.
- **`server.test.ts`** drives the Node adapter over a real loopback socket:
  header flattening, body assembly, streaming write order, abort on client
  disconnect, and the 500 fallback. This layer is where the first version
  failed to start while every other gate was green; it is not allowed to be
  untested again.

```bash
pnpm --filter @craftkit/ai-server test
```

## Not done here

- **No rate limiting, no request queue.** One process, one request at a time per
  connection. Put it behind whatever your deployment already uses.
- **No conversation storage.** History arrives on the wire from the client, which
  owns it.
- **No live smoke test in CI.** Running one would need a real key and would bill
  a real account on every push.
