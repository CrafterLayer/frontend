# `@craftkit/builder-ai`

Headless command-planning engine for CraftKit Builder.

## The rule that must not be broken

**AI proposes kernel commands. It never creates, replaces, or writes a `BuilderDocument`.**

Every proposal is an ordered list of `{ command, args }`. Before the proposal is returned, this
package looks up every command in the live registry, parses its arguments with that command's own
schema, and dispatches the complete sequence through a scratch kernel. Application then sends the
same commands through the live kernel with `author: 'ai'`. The normal door therefore remains the
only document write path, including its slot, capacity, props, JSON-purity, transaction, and history
laws.

Do not add an API that accepts generated document objects. A provider that emits a document instead
of commands bypasses the invariant this package exists to preserve.

## What ships

- Four `AiContextProvider` implementations for the registered block vocabulary, page-template
  catalog, current selection, and flat document shape. Block context includes model-facing
  descriptions, JSON Schema props summaries, few-shot examples, and accepted slots; template context
  names each composition, its root type, section count, and block vocabulary. Every fragment carries
  a deterministic character-based token estimate for budgeting.
- `AiPlanProvider`, a one-method provider port. A future model-backed adapter implements the same
  `propose(request, context)` contract.
- `createLocalAiPlanProvider()`, a deterministic, offline implementation that scores the request
  against registry-owned types, descriptions, prop names, and examples. It adapts requested list
  counts when the chosen example and schema support them. For example, “add a pricing section with
  three plans” emits one real `insertNode` command with three schema-valid plans. A full-page or
  template request chooses a registered composition and emits one atomic `insertComposition`
  command.
- Runtime plan validation through the real kernel door, plus `applyAiPlan()` for explicit
  AI-authored dispatch.

## Usage

```ts
import { applyAiPlan, createLocalAiPlanProvider, generateAiPlan } from '@craftkit/builder-ai';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

const plan = await generateAiPlan({
  kernel,
  provider: createLocalAiPlanProvider(),
  request: 'add a pricing section with three plans',
  validationPorts: {
    clock: fixedClock(0),
    ids: seededIds('ai-preflight'),
  },
});

const application = applyAiPlan({
  kernel,
  plan,
  validationPorts: {
    clock: fixedClock(0),
    ids: seededIds('ai-apply-preflight'),
  },
});
```

Validation ports are injected and dedicated to the scratch kernel. Do not borrow the live kernel's
stateful port instances: a preflight insertion consumes IDs in the scratch session. Production code
must inject equivalent deterministic capabilities rather than reaching for ambient time or entropy.

## Undo semantics

The kernel now provides the genuine grouped contract this section used to wait for:
`kernel.dispatchGroup(steps, author)` runs every step over ONE immer produce — one transaction, one
history entry, one undo, and atomic (a failing step commits nothing). `applyAiPlan()` uses it and
reports `mode: 'group'`, which makes the panel's "one entry in history, one undo" literally true for
a plan of any size. Grouping happens inside the door, never by writing patches or documents around
it.

## Testing subpath

`@craftkit/builder-ai/testing` exports `createScriptedAiPlanProvider()` for consumer tests that need
to exercise provider rejection or application without a model or network.

## Connecting a server

`createRemoteAiPlanProvider({ endpoint })` turns one HTTP endpoint into an `AiPlanProvider`. The
wire contract lives in `src/provider/wire.ts` and is exported (`AiPlanWireRequest`,
`AiPlanWireResponse`, `AI_PLAN_WIRE_VERSION`) so a TypeScript server can import the exact types.

The provider POSTs:

```jsonc
{
  "version": 1,
  "request": "add a pricing section with three plans",
  "context": { "fragments": [...], "totalTokens": 812, "blocks": [...], "templates": [...], "document": {...}, "selection": {...} },
  // Present only on the single repair retry after a rejected proposal:
  "attempt": { "plan": { ... }, "issues": [{ "code": "invalid-args", "message": "...", "step": 0 }] }
}
```

The server answers `200` with either a plan or an explicit refusal:

```jsonc
{ "rationale": "Insert a pricing section.", "commands": [{ "command": "insertNode", "args": { ... } }] }
// or
{ "refusal": "I could not turn that into a change." }
```

Everything else stays client-side: the response still walks the live registry, per-command args
schemas, and the scratch-kernel dry run. A wrong server can produce a rejected proposal, never a
document write. Providers with a `repair` method (the remote one has it) get exactly one retry with
the rejected plan and its issues; there is no third attempt.

Transport errors surface as `RemoteAiProviderError` with a human sentence (unreachable, status,
non-JSON, malformed shape, or `timed out after <ms>`; default timeout 30s, configurable via
`timeoutMs`). Auth goes in `headers`; the fetch implementation is injectable for tests.

### Streaming and cancellation (optional)

The provider advertises `accept: text/event-stream, application/json` on every POST. A server may
answer the same request as SSE — any number of `event: status` frames (`data: {"text": "..."}`)
narrating the work, then exactly one `event: result` frame whose data is the usual wire response.
Status text feeds the UI's live progress line; a server that ignores the header and answers plain
JSON stays fully conformant.

Cancellation is the closed connection: `propose`/`repair` accept `{ signal, onProgress }`
(`AiProposeOptions`), Stop in the UI aborts the fetch, and a conforming server kills the underlying
model work when the request closes. A caller's own abort surfaces as the platform `AbortError`,
never as a provider error.

In the playground, set `VITE_AI_PLAN_ENDPOINT=https://your-server/plan` and the AssistantPanel
switches from the local deterministic provider to the remote one — no code change.

## Planning, memory, and caching

- **Conversation history.** `generateAiPlan({ history })` (and `AiProposeOptions.history`) carries
  the chat so far — `{ role, text }` turns, oldest first — onto the wire as `history`, so "make it
  blue" can resolve against what the previous turn added. The AssistantPanel sends its thread
  automatically.
- **Session memory.** `createMemoryContextProvider({ load })` turns any host-owned note store into a
  context fragment every provider sees. The engine owns the seam, never the storage: the panel feeds
  it the rationale of each applied plan; another product can feed it preferences from a database.
  Pass it alongside `BUILDER_AI_CONTEXT_PROVIDERS` via `contextProviders`.
- **Plan caching.** `createCachingAiPlanProvider(inner, { capacity })` wraps any provider with an
  LRU keyed on (request, document, selection, history): a repeated ask on an unchanged page answers
  instantly and costs nothing. `repair` is never cached — a repair exists because the cached shape
  of an answer was wrong.
- **Staged planning.** A plan may carry `followUp`: when a request is too big for one safe plan, the
  provider delivers the most valuable stage and words the next request there, in the requester's
  language. UIs offer it as a one-tap continuation; nothing runs automatically. The dev bridge pairs
  this with a hard per-plan command cap.
- **Step titles.** Each plan step may carry `title`, the provider's own human sentence in the
  requester's language; UIs show it instead of the command name, with the command kept visible as
  the technical truth. `previewAiPlan()` returns the WOULD-BE document for a look-before-apply
  dialog, and validation charges a plan only for NEW damage — a pre-existing schema violation in the
  live document never blocks an unrelated edit.

## Taking this engine to another project

The package is headless and portable by construction. It needs exactly three things from a host: a
`BuilderKernel` (document + registry + door), deterministic `AiValidationPorts` for rehearsals, and
an `AiPlanProvider` (local, remote via the wire contract above, wrapped in caching, or your own).
Everything UI-side — panels, preview dialogs, progress, stop — consumes only the public API of this
package, so a different product embeds the same engine by implementing the same three seams and
nothing else.
