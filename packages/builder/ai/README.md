# `@craftkit/builder-ai`

Headless command-planning engine for CraftKit Builder.

## The rule that must not be broken

**AI proposes kernel commands. It never creates, replaces, or writes a document or a site.**

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
  a deterministic character-based token estimate for budgeting. Extension collectors receive a
  detached, deeply frozen state snapshot and a data-only registry catalog—never `dispatch`, event or
  subscription handles, renderers, Zod instances, stored composition nodes, or live registry
  objects.
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
- A versioned, immutable Skills registry with metadata-only discovery, explicit body/reference
  reads, deterministic request-local activation, dependencies, conflicts, trust policy, content
  fingerprints backed by SHA-256, and hard count/token limits.
- `runAiAgent()`, a UI-independent bounded coordinator with sequenced events, injected time/run id,
  real cancellation plus host-owned supersession leases, one repair at most, review-only or
  automatic apply, and exactly one terminal event.

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

## Skills and bounded agent runs

A Skill is reviewed data, not executable code. It may add instructions and logical text references,
and it may **narrow** the commands available to one request. It cannot register commands, grant a
tool, run a script, import a URL, access the filesystem/network, or write Builder state.

The simplest safe setup uses the reviewed built-ins and runs in proposal-only mode by default:

```ts
import {
  createCraftkitAiSkillRegistry,
  createRemoteAiPlanProvider,
  runAiAgent,
} from '@craftkit/builder-ai';

let currentAssistantRunId: string | undefined;
const runId = 'assistant-turn-42';
currentAssistantRunId = runId;
const result = await runAiAgent({
  runId,
  clock: deterministicRunClock,
  kernel,
  provider: createRemoteAiPlanProvider({ endpoint: '/api/ai/plan' }),
  request: 'صمم صفحة هبوط احترافية',
  validationPorts: deterministicScratchPorts,
  skillRegistry: createCraftkitAiSkillRegistry(),
  apply: 'never',
  signal: abortController.signal,
  // Fail closed if a newer turn replaces this one, even when a provider ignores abort.
  isCurrentRun: (candidate) => candidate === currentAssistantRunId,
  onEvent: (event) => renderAgentProgress(event),
});

// `result.plan` is validated but nothing changed until the host explicitly applies it.
```

A host can supply its own Skill without changing this package or creating another write path:

```ts
import { createCraftkitAiSkillRegistry } from '@craftkit/builder-ai';

const skillRegistry = createCraftkitAiSkillRegistry([
  {
    schemaVersion: 1,
    id: 'acme.brand-voice',
    name: 'Acme brand voice',
    description: 'Apply the reviewed Acme writing rules.',
    version: '1.0.0',
    instructions: 'Use direct, concrete language. Preserve approved product names.',
    activation: { mode: 'explicit' },
    references: { 'voice/checklist.md': 'Short headings. Specific claims. One action per CTA.' },
    restrictToCommands: ['setProp'],
  },
]);

await runAiAgent({
  // same required ports/kernel/provider as above
  runId: 'brand-edit-7',
  clock: deterministicRunClock,
  kernel,
  provider,
  request: 'Rewrite the selected hero',
  validationPorts: deterministicScratchPorts,
  skillRegistry,
  selectedSkillIds: ['acme.brand-voice'],
  apply: 'auto',
});
```

Discovery is progressive: `registry.list()`/`get()` expose manifests and fingerprints, while
`readSkill()`/`readReference()` disclose bodies explicitly. A prepared request includes full bodies
only for active Skills. Activation is local to that run; there is no global active-Skill singleton.
Definitions are bounded before and after canonicalization: individual metadata entries, aggregate
manifest metadata, instructions, reference count, per-reference bytes, total reference bytes, and
registry size all have exported hard limits. The per-run Skill-token budget charges the exact active
Skill payload—including identity, rationale, restrictions, instructions, and references.

Command authority is always restrictive:

```text
live registered commands
  ∩ session allowedCommands
  ∩ every active Skill restriction
  − session deniedCommands
```

The same effective policy is checked during scratch validation and immediately before live grouped
application. The runner also bounds active Skills, Skill tokens, complete serialized context, and
plan command count. The context budget covers the canonical wire request, conversation history, and
the rejected attempt on the single repair—not only the assembled fragments. Untrusted Skills remain
discoverable but need explicit host opt-in.

For interactive surfaces, pass both controls: `AbortSignal` stops cooperative provider work, while
`isCurrentRun` is the synchronous authority check that prevents a late cache/provider result from
validating or applying after a newer run takes ownership. A missing or non-`true` lease answer fails
closed. Proposal-only runs emit `plan.proposed`; auto-apply runs transition directly from validation
to `plan.applying`.

## Undo semantics

The kernel grouped door accepts both the legacy `kernel.dispatchGroup(steps, author)` form and
`kernel.dispatchGroup(steps, { author, label })`. It runs every step over ONE immer produce — one
human-labelled transaction, one history entry, one undo, and atomic failure. Scratch preflight and
live AI application use this same grouped path. Grouping happens inside the door, never by writing
patches or documents around it. Post-commit event/store observers are isolated: a broken UI or
telemetry listener cannot turn an already committed transaction into a false agent failure or stop
delivery to later observers.

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
document write. Validated plans are detached and deeply frozen JSON command data before they reach
telemetry or callers, so an observer cannot rewrite the proposal after validation. Providers with a
`repair` method (the remote one has it) get exactly one retry with the rejected plan and its issues;
there is no third attempt.

Transport errors surface as `RemoteAiProviderError` with a human sentence (unreachable, status,
non-JSON, malformed shape, or `timed out after <ms>`; default timeout 30s, configurable via
`timeoutMs`). JSON and SSE responses are byte-counted while streaming and capped at 1 MiB by default
(`maxResponseBytes` is configurable); an oversized declared `Content-Length` is rejected before the
body is read. Auth goes in `headers`; the fetch implementation is injectable for tests.

### Streaming and cancellation (optional)

The provider advertises `accept: text/event-stream, application/json` on every POST. A server may
answer the same request as SSE — any number of `event: status` frames (`data: {"text": "..."}`)
narrating the work, then exactly one `event: result` frame whose data is the usual wire response.
Status text feeds the UI's live progress line; a server that ignores the header and answers plain
JSON stays fully conformant. LF and standard CRLF framing are accepted; duplicate result frames or
data after the result fail closed.

Cancellation is the closed connection: `propose`/`repair` accept `{ signal, onProgress }`
(`AiProposeOptions`), Stop in the UI aborts the fetch, and a conforming server kills the underlying
model work when the request closes. A caller's own abort surfaces as the platform `AbortError`,
never as a provider error. Remote, local, cache-hit, and repair paths re-check the signal after
every async boundary so an adapter that ignores abort still cannot return a stale result.

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
  Register it through `contributes.aiContext` and the live registry supplies it automatically, or
  pass an explicit `contextProviders` list when intentionally overriding provider selection.
- **Plan caching.** `createCachingAiPlanProvider(inner, { capacity })` wraps any provider with an
  LRU keyed on the request, conversation, and the complete canonical assembled context — fragments,
  memory, blocks, templates, selection detail, document, Skill catalog, and activation fingerprints.
  A changed input is always a miss; an aborted hit never returns. `repair` is never cached.
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
