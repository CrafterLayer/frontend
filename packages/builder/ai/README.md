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

- One canonical provider envelope. Blocks, templates, document state, and selection each have one
  structured representation; `fragments` is reserved for additive host, memory, and active-Skill
  context. Every fragment is frozen and preserves its `source`, `kind`, and `trust` boundary. The
  envelope also carries the effective command catalog as JSON Schema data, the versioned plan-output
  contract, explicit policy-omission counts, and block-declared property intent. Context collectors
  receive a detached, deeply frozen snapshot and a data-only registry catalog—never `dispatch`,
  event or subscription handles, renderers, Zod instances, command implementations, stored
  composition nodes, or live registry objects.
- `AiPlanProvider`, a one-method provider port. A future model-backed adapter implements the same
  `propose(request, context)` contract.
- `createLocalAiPlanProvider()`, a deterministic, offline implementation that scores the request
  against registry-owned types, descriptions, prop names, and examples. It adapts requested list
  counts when the chosen example and schema support them. For example, “add a pricing section with
  three plans” emits one real `insertNode` command with three schema-valid plans. A full-page or
  template request chooses a registered composition and emits one atomic `insertComposition`
  command.
- Runtime plan validation through the real kernel door, authenticated `AiValidatedProposal` values
  that pin plan + effective policy + Skill activations + context identity, and `applyAiPlan()` for
  explicit AI-authored dispatch.
- A versioned, immutable Skills registry with metadata-only discovery, explicit body/reference
  reads, deterministic request-local activation, dependencies, conflicts, trust policy, content
  fingerprints backed by SHA-256, and hard count/token limits.
- `AiCompositionPolicy`, one per-run object deciding how much of the registry crosses the wire
  (`catalogMode`) and how strictly the classes an assistant writes are policed. Every key is
  optional; every omission resolves to the freest behaviour that works, which is what lets a future
  guard arrive as one more optional key rather than a signature change through four layers. See
  [What the assistant may see, and what it may build](#what-the-assistant-may-see-and-what-it-may-build).
- `runAiAgent()`, a UI-independent bounded coordinator with sequenced typed events, classified
  failures, injected time/run id, real cancellation plus host-owned supersession leases, one repair
  at most, review-only or automatic apply, and exactly one terminal event.
- `runAiBuild()`, the split-page coordinator: one scaffold followed by section fills that are
  written concurrently and landed in document order. Its automatic pool starts at three writers,
  grows by one for each further group of three sections, and stops at six; callers may still pass
  `fillConcurrency` for an exact fixed pool.

## Usage

```ts
import { applyAiPlan, createLocalAiPlanProvider, runAiAgent } from '@craftkit/builder-ai';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

const proposalPorts = {
  clock: fixedClock(0),
  ids: seededIds('ai-proposal-preflight'),
};

const result = await runAiAgent({
  runId: 'assistant-turn-1',
  clock: fixedClock(0),
  kernel,
  provider: createLocalAiPlanProvider(),
  request: 'add a pricing section with three plans',
  validationPorts: proposalPorts,
  apply: 'never',
});

// Proposal-only mode has not changed the document. The authenticated proposal
// already pins the exact plan, effective authority, Skills, and context identity.
const application = applyAiPlan({
  kernel,
  proposal: result.proposal,
  validationPorts: {
    clock: fixedClock(0),
    ids: seededIds('ai-apply-preflight'),
  },
});
```

Validation ports are injected and dedicated to the scratch kernel. Do not borrow the live kernel's
stateful port instances: a preflight insertion consumes IDs in the scratch session. Production code
must inject equivalent deterministic capabilities rather than reaching for ambient time or entropy.
Low-level compatibility calls may pass `plan + policy` together; omitting policy or combining a
validated proposal with substituted plan/policy data fails closed.

### Split-build concurrency

Omit `fillConcurrency` for the adaptive default. Three sections use three writers; four through six
use four; seven through nine use five; and ten through twelve use six. The task count changes only
how much provider latency overlaps—it does not add sections or model calls. Proposals still land in
page order and are revalidated against the live kernel at that moment. Pass a number to hold an
exact limit, including `1` for a fully sequential build.

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

// `result.proposal` is authenticated and immutable, but nothing changed until the host applies it.
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

The built-in registry ships sixteen reviewed Skills for the free-composition agent: one always-on
**craft manual** (region shell, links, direction, type, the classes the door refuses), and
auto-activated playbooks — page composition, CV/portfolio, occasion pages (invitation, farewell,
greeting, condolence), conversion recipes, structure recipes, visual direction, design direction,
design tokens, motion, scroll journeys, copywriting, Arabic/RTL, accessibility review,
delivery-quality UI review — plus the explicit **precise-edit** restriction.

Four of them are adaptations of published Skills, credited in the source. Two carry a verified
permissive licence: **visual direction** from Anthropic's `frontend-design` (Apache-2.0) and
**design tokens** from wshobson's `tailwind-design-system` (MIT). Two more were adapted at the
owner's request from `oso95/scroll-world` (**scroll journeys**) and
`nextlevelbuilder/ui-ux-pro-max-skill` (**delivery-quality UI review**); their upstream licences
have NOT been verified here, so check them before this package is distributed.

None is copied: each was rewritten against what this agent can actually emit — the site's utility
vocabulary, `--t-*` roles and `ck-` classes — and the mechanisms that do not exist here (`@theme`,
`tailwind.config`, `@apply`, `dark:`, arbitrary values; and for the two newest, video generation, a
scroll-scrubbed `<video>` timeline, JavaScript, and the upstream's CSV corpora and Python search
tooling) are named as refusals so the model stops reaching for them. Visual direction is a
DEPENDENCY of all three page archetypes: a page composed without a point of view is the failure that
Skill exists to prevent. Because the craft manual is mandatory, a host's `maxSkillTokens` must leave
room for it (≈400 tokens); a budget below that fails the run rather than silently dropping the
floor.

An `auto` activation has three triggers, any of which is enough: `keywords` (lower-cased substrings
of the request), `selectedBlockTypes` (the selection carries a node of that type), and `scripts`
(`'arabic'` or `'latin'`: the request contains any character of that writing system). The Arabic/RTL
Skill uses `scripts: ['arabic']`, so every Arabic request gets the direction expertise whatever verb
it opens with; keyword-only activation had made the same page type come out differently depending on
whether the writer said "صمم لي" or "اعمل". The built-ins are budgeted so that a request activates
the floor plus at most three auto Skills — a page archetype, its copywriting dependency, and the
language — within the default `maxSkillTokens`; the page archetypes (landing, CV, occasion) conflict
with each other and the highest priority wins.

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

### Observable events and typed retry UX

`onEvent` receives a discriminated `AiAgentEvent` stream. `seq` is monotonic inside one `runId`,
`at` comes from the injected clock, and exactly one of `run.completed`, `run.cancelled`, or
`run.failed` is terminal. Observer exceptions are isolated and cannot change the run outcome.

```ts
await runAiAgent({
  // ...kernel, provider, request, runId, clock, validationPorts
  onEvent(event) {
    if (event.type === 'skills.resolved') {
      showActivationPins(event.activations); // id, version, fingerprint, reason
    } else if (event.type === 'plan.progress') {
      showProgress(event.text);
    } else if (event.type === 'run.failed') {
      showFailure({
        code: event.error.code,
        message: event.error.message,
        canRetry: event.error.retryable,
      });
    }
  },
});
```

Known failures are exposed as frozen `AiRunFailure` data with `source`, stable `code`, human
`message`, `retryable`, and optional HTTP `status`. Provider codes distinguish refusal, invalid
output, HTTP status, timeout, network, response/resource limits, stream protocol, endpoint policy,
cancellation, and observer failure. The runner additionally classifies context-budget, memory,
Skill/policy, plan-validation, proposal-integrity, kernel, and unknown failures.

Retry only when `retryable === true`, and always create a fresh `runId` and cancellation controller.
Do not infer retryability from prose or HTTP status alone. Context-budget, policy, unsafe-command,
and explicit-refusal failures require changed input or host policy and are intentionally not
retryable. The original error is still thrown to the caller after `run.failed`, so non-UI hosts may
use ordinary `try/catch` while telemetry consumes the typed event.

### Unsafe commands and property intent

- The live registry is the upper authority bound; session and active-Skill policies can only reduce
  it.
- `applyPatches` is denied by default even when registered. A host must explicitly allow it, and
  every nested patch consumes the bounded operation budget before any scratch or live dispatch.
- Properties declared with `propertyIntents.kinds['utility-classes']` are human-only. AI plans that
  author them through `setProp`, `setResponsive`, `insertNode`, or nested patches are rejected.
- Providers receive only the effective command catalog and JSON argument contracts. Registered
  implementations and Zod objects never cross the provider boundary.
- Preview and apply re-check the authenticated proposal's pinned authority. A copied proposal,
  substituted plan, broader policy, or missing compatibility policy fails closed.

## The site pipeline

A whole site — pages, sections, copy, palette — is five stages with validation between each, in
`src/pipeline/`. It follows the same rule as everything else here: `generateSite()` is handed **no
kernel**, and the `commands: AssemblyStep[]` on the `GeneratedSite` it returns are the only part
anything writes from.

```text
sitemap → structure → content (per page, pool of 3) → design system → assembly
```

Each stage is validated the moment it lands, not at the end, because the cost of finding out late is
the whole site: a structure naming an unregistered block is discoverable immediately; discovered at
assembly it has already been paid for with a content call per page. A rejection the validator marks
REPAIRABLE is asked once more with the reasons; anything else fails the run immediately. Either way,
nothing has been written.

**Applying.** `applySiteCommands({ kernel, commands, assets })` sends the steps into a DRAFT site
kernel one at a time. One at a time, not as a group, because a group is produced in a single pass
and cannot read back an id minted halfway through it — and Law D says only the kernel's port may
mint one. An assembly step names its SITEMAP page; the applier watches pages come into existence and
keeps the map from one to the other. Colliding addresses are made unique and **reported** as
`renamed`, because a person who asked for `/home` and silently got `/home-2` will look for a page
that is not there.

The one-transaction promise is not lost, it is moved to the commit: `commitGeneratedSite` puts a
whole generation onto the live site as a single `applySitePatches` — one transaction, one undo. It
takes the site diff and the fingerprint as **ports** rather than importing the codec, because
`@craftkit/builder-ai` and `@craftkit/builder-transforms` are both layer 2 and the dependency law
refuses sideways edges.

**Refinement.** `refineSite()` resolves a follow-up to its target before asking a model anything, so
a request naming a page the site does not have is refused for free. A page refinement routes through
`runAiAgent` pointed at that page's lens — the identical machinery a generation uses — and a colour
refinement goes through `setDesignToken`, the door that already owns legibility.

## Pictures

`selectAssets()` fills image positions from an `AssetLibraryPort`, directed by the brief and by each
picture's own mood and palette as the library recorded them — the design system contributes the
colours a match is scored against, and nothing else. `selectFrom()` is the same scoring without the
listing, for a caller that already holds the pictures. It returns `ImageProp`, which is
`AssetRef | { absent, reason }`, and there is **no path through it that produces a string**. A
generated `src` — a plausible-looking URL a model wrote — renders as a broken image on someone's
site, cannot be validated, and is indistinguishable from a real one until a visitor sees it.

Everything else follows from that:

- An empty, unavailable, or unsuitable library is a normal outcome, not a failure. Each affected
  position gets a sentence saying what was wanted and why there is nothing there.
- The assembly stage is given the catalogue and refuses any id outside it, and the applier registers
  every chosen picture in the site's own asset table **before** the command that uses it.
- The site's table holds COPIES, which is why a picture later deleted from the library degrades one
  image rather than invalidating a site.

## Undo semantics

The kernel grouped door accepts both the legacy `kernel.dispatchGroup(steps, author)` form and
`kernel.dispatchGroup(steps, { author, label })`. It runs every step over ONE immer produce — one
human-labelled transaction, one history entry, one undo, and atomic failure. Scratch preflight and
live AI application use this same grouped path. Grouping happens inside the door, never by writing
patches or documents around it. Post-commit event/store observers are isolated: a broken UI or
telemetry listener cannot turn an already committed transaction into a false agent failure or stop
delivery to later observers.

## Testing subpath

`@craftkit/builder-ai/testing` exports `createScriptedAiPlanProvider()` and
`createScriptedSiteStageProvider()` for consumer tests that need to exercise provider rejection, a
stage that fails once and succeeds on the retry, or a stage that never returns so a cancellation has
something to cancel — without a model or a network. `createFixedAssetLibrary()` is the picture
equivalent: fixed entries so selection is reproducible, and an `unavailable`/`hang` switch so a
degradation can be caused on purpose rather than assumed.

## Connecting a server

> A reference implementation ships in this repo: [`apps/ai-server`](../../../apps/ai-server) — one
> POST to Claude with the prompt laid out for caching, the plan constrained to the schema the
> request carries, and every failure translated into the taxonomy below.
> `pnpm --filter @craftkit/ai-server dev`, then `VITE_AI_PLAN_ENDPOINT=http://localhost:8787`.

`createRemoteAiPlanProvider({ endpoint })` turns one HTTP endpoint into an `AiPlanProvider`. The
wire contract lives in `src/provider/wire.ts` and is exported (`AiPlanWireRequest`,
`AiPlanWireResponse`, `AI_PLAN_WIRE_VERSION`) so a TypeScript server can import the exact types.

The provider POSTs:

```jsonc
{
  "version": 1,
  "request": "add a pricing section with three plans",
  "context": {
    "blocks": [...],
    "templates": [...],
    "document": {...},
    "selection": {...},
    "commands": [{ "name": "insertNode", "argsSchema": {...} }],
    "outputContract": { "version": 1, "schema": {...} },
    "fragments": [
      { "source": "acme.brand-voice", "kind": "instruction", "trust": "reviewed", "title": "Active AI skill: acme.brand-voice", "body": "...", "tokens": 42 }
    ],
    "omissions": [{ "source": "commands", "reason": "policy-filtered", "omittedCount": 3 }]
  },
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

Provider failures extend `AiProviderError`, so hosts read `code`, `retryable`, and optional `status`
without parsing the human sentence. The remote adapter defaults to HTTPS-only endpoints, refuses
redirects, sends `credentials: 'omit'` with `referrerPolicy: 'no-referrer'`, and accepts HTTP only
through the explicit development-only `allowInsecureHttp` option. JSON and SSE responses are
byte-counted while streaming and capped at 1 MiB by default (`maxResponseBytes` is configurable); an
oversized declared `Content-Length` is rejected before the body is read. Caller-supplied auth goes
in `headers`; the fetch implementation is injectable for tests.

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
switches from the local deterministic provider to the remote one — no code change. For the local
Claude CLI development bridge, generate a random session secret and put the same value in
`AI_BRIDGE_TOKEN` (bridge process) and `VITE_AI_PLAN_TOKEN` (playground). The bridge binds only to
`127.0.0.1`, allows only the configured `AI_BRIDGE_ALLOWED_ORIGINS`, disables Claude tools and
customizations, caps bodies/output, and returns `429` when its bounded concurrency is occupied.
Never reuse the development bridge as a production assistant server.

## What the assistant may see, and what it may build

Two decisions, one object. `AiCompositionPolicy` is passed per run — never read from module state,
so two runs in the same process may disagree — and every key is optional, with every `undefined`
resolving to the freest behaviour that works.

### The catalog is a cost, and the cost is a choice

Measured on the playground's real registry, the block catalog was **57,851 of 61,578 tokens** — 94%
of a request, against a 64,000 budget — because every registered block shipped its full JSON Schema,
examples, and slot table whether or not the request touched it.

```ts
await generateAiPlan({
  kernel,
  provider,
  request: 'a CV page',
  validationPorts,
  composition: { catalogMode: 'index' },
});
```

| `catalogMode`      | What crosses the wire                                                                                                                                     | Real registry                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `'full'` (default) | every block, in full                                                                                                                                      | 63,782 tokens                                           |
| `'scoped'`         | names for all, detail for the types in scope                                                                                                              | 9,484                                                   |
| `'index'`          | `type` + `description` only                                                                                                                               | 8,330                                                   |
| `'none'`           | the escape hatch, plus the types in scope, in full; every block **already on the page** by name and prop keys only — **no other block, not even by name** | **~4,500 on an empty page, ~9,000 on the landing page** |

`'none'` is "the model builds the page": from elements, the utility vocabulary, and scoped CSS. A
registered block reaches it only when the person adds one to the request by selecting or
@-mentioning it — the selection becomes `scopedBlockTypes`, and exactly those blocks arrive with
their schemas, referenceable as `component` nodes. The input is what the person wants from the site,
not an inventory of what exists.

`'scoped'` with no explicit `scopedBlockTypes` derives them from the SELECTION — which is exactly
"the user pointed at this block and asked to change it". Deriving it here rather than at the call
site is what keeps it from disagreeing with the selection the same request was assembled against.

**The default is `full` deliberately.** A cheaper default is correct only for a host whose assistant
can build without per-block schemas; trading cost for a broken proposal is not a trade this library
makes on a caller's behalf.

### The escape hatch is exempt from that economy

`customCode` keeps full detail in every mode (`alwaysDetailedBlockTypes`, default `['customCode']`).
Without the exemption, `index` mode would tell the model an escape hatch exists and give it no way
to write one — strictly worse than either endpoint. It costs ~1,000 tokens, fixed, whatever the
registry's size.

The block stores a TREE, not markup, so the document stays JSON and the door still validates every
write. Two node kinds:

```jsonc
{
  "kind": "root",
  "children": [
    {
      "kind": "element",
      "tag": "section",
      "className": "grid gap-8 bg-surface p-16 md:grid-cols-3",
      "children": [
        { "kind": "element", "tag": "h1", "className": "ck-name text-6xl", "text": "Reem Haddad" },
        { "kind": "component", "component": "card", "props": {} }, // any registered block, by type
      ],
    },
  ],
}
```

A `component` node resolves through the registry and is validated against that block's OWN schema
before rendering — free composition is not unvalidated composition. An unknown type, or props that
fail, render `UnknownBlock` rather than a half-configured component.

### Colours are free (by product decision)

A custom-code tree may use Tailwind's whole palette (`bg-slate-900`, `text-blue-500`,
`from-indigo-500` — all generated) and any exact value in its `css` (`#1e3a8a`, `rgb()`, gradients,
an https background image). Such colours do not follow the site theme — re-point `--t-accent` and
they stay put — and that trade was chosen deliberately after a first version refused "white text on
a travel photo" as a colour violation. The roles (`bg-accent`, `var(--t-accent)`) remain available
and are recommended when a page should re-theme.

`colourPolicy: 'tokens'` restores the theming law for trees. It never left for a registered block's
own `className` prop, and the kernel door's raw-literal law still applies to every prop except those
declared as `customCss()` or `customCodeTree()`.

### Two laws bound what it may write, and they are not the same law

|       | `findRejectedUtilities`                           | `unknownUtilityClasses`                      |
| ----- | ------------------------------------------------- | -------------------------------------------- |
| asks  | may a document STORE this class?                  | will this class HAVE any CSS?                |
| law   | theming — no arbitrary values, no default palette | generation — Tailwind emits only what it saw |
| shape | denylist                                          | allowlist (2,697 utilities)                  |

The door runs **both** over a tree. The second exists because a class Tailwind never generated has
no CSS at all: it works in dev if some other file happens to mention it, vanishes from the
production build, and reports nothing either way. Refusing at the door turns that silence into a
named validation issue. Set `enforceUtilityVocabulary: false` where the CSS comes from somewhere
other than this workspace's vocabulary.

The vocabulary is DATA (`UTILITY_VOCABULARY`), and the application's Tailwind `@source inline(...)`
directives are generated from it — one source, two consumers, with a test that fails if they drift.

### Icons

`{ "kind": "icon", "name": "map-pin" }` draws a [Lucide](https://lucide.dev/icons/) icon by its
kebab-case name — a leaf node with optional `size`, `strokeWidth`, `className`, and `label` (present
⇒ `role="img"`; absent ⇒ decorative and hidden). It is a node kind rather than an `svg` tag on
purpose: an authored `<svg>` is a drawing surface, and a surface accepts everything the tree exists
to make unrepresentable. A name is not a surface — the renderer draws the set's path data itself,
synchronously, so the static publish path emits the same markup as the canvas.

The 1,791 names live at layer 0 (`lucideIconNames()`, generated from the installed package by
`pnpm --filter @craftkit/builder-renderer generate:icons`), so the door refuses an unknown icon by
name without this package depending on the icon library; a renderer test proves every listed name
resolves in the installed set. **Lucide ships no brand logos** — no `github`, `linkedin`, `twitter`
— and the prompt says so, steering the model to `link`/`globe` beside the text instead.

### Links and buttons

`a` and `button` are in the tag vocabulary (35 tags), each with a policy the renderer enforces: an
`href` passes the same `safeHref` rule as a rich-text link (https, mailto, tel, relative — never
`javascript:`), an external link gets `rel="noopener noreferrer"`, only `target="_blank"` is
honoured, and on the editing canvas a click on a link is swallowed so the editor is never navigated
away. A `button` is always `type="button"` — a styled affordance with no handler and no submit;
behaviour is wired by a registered block or the host, never by the tree.

### Region-scoped CSS, and the `ck-` namespace

A region's `css` prop is sanitised (refused: `@import` except from Google Fonts / bunny.net,
`url(http://…)` and `url(//…)`, `expression()`, `behavior`, `-moz-binding`, `javascript:`, an early
`</style>`) and scoped by rewriting every selector to `[data-ck="<nodeId>"] …`. `@keyframes` and
`@font-face` pass through untouched — they carry no selectors, and prefixing one silently breaks the
animation. `url(https://…)` is allowed: a background photo is ordinary design work.

The refusal list is matched against a **normalised** copy — comments stripped, CSS escapes decoded —
so `@\69mport`, `u\72l(`, and `@/**/import` are seen for what the browser will make of them; the
rendered text stays the author's own. A web-font `@import` from an allowed host is lifted in front
of the scoped rules, where CSS requires it.

Hook it with `ck-`-prefixed classes. That namespace is the one exemption from the generation law,
because its CSS is expected to come from the region itself — without it the `css` prop would exist
and be unusable, since no selector could match a class the door admitted. Brackets are refused even
under the prefix: `ck-[17px]` is an arbitrary value wearing a prefix, and the namespace grants no
exemption from the theming law.

## Planning, memory, and caching

- **Conversation history.** `generateAiPlan({ history })` (and `AiProposeOptions.history`) carries
  the chat so far — `{ role, text }` turns, oldest first — onto the wire as `history`, so "make it
  blue" can resolve against what the previous turn added. The AssistantPanel sends its thread
  automatically.
- **Session memory.** `createMemoryContextProvider({ load })` accepts bounded, host-authored v1
  records (`source: 'host'`, `trust: 'reviewed'`, typed outcome kind, summary, and optional command
  names) and serializes them as one provenance-labelled data fragment. Unknown fields are discarded;
  model rationale or instruction-looking text never becomes durable trusted memory. Register the
  provider through `contributes.aiContext` or pass it through `additionalContextProviders`; both
  compose additively with registry contributions.
- **Plan caching.** `createCachingAiPlanProvider(inner, { capacity })` wraps any provider with an
  LRU keyed on the request, conversation, and the complete canonical assembled context — fragments,
  memory, blocks/property intent, templates, selection, document, effective commands, output
  contract, omissions, Skill catalog, and activation fingerprints. A changed input is always a miss;
  object insertion order is irrelevant, an aborted hit never returns, and `repair` is never cached.
- **Staged planning.** A plan may carry `followUp`: when a request is too big for one safe plan, the
  provider delivers the most valuable stage and words the next request there, in the requester's
  language. UIs offer it as a one-tap continuation; nothing runs automatically. The dev bridge pairs
  this with a hard per-plan command cap.
- **Step titles.** Each plan step may carry `title`, the provider's own human sentence in the
  requester's language; UIs show it instead of the command name, with the command kept visible as
  the technical truth. `previewAiPlan()` returns the WOULD-BE document for a look-before-apply
  dialog, and validation charges a plan only for NEW damage — a pre-existing schema violation in the
  live document never blocks an unrelated edit.

## Why `p-limit` is not a dependency

One agent request remains sequential: resolve Skills, assemble context, propose, validate/repair
once, then optionally apply. `runAiBuild` owns its small bounded writer pool directly because the
scaffold already gives it a finite task list and ordered landing slots. The development bridge must
not queue untrusted inbound work: it admits bounded active requests and returns `429` for the rest.
`p-limit` would add a Promise queue but would not bound pending requests, so it remains the wrong
primitive for that security boundary.

## Taking this engine to another project

The package is headless and portable by construction. It needs exactly three things from a host: a
`BuilderKernel` (document + registry + door), deterministic `AiValidationPorts` for rehearsals, and
an `AiPlanProvider` (local, remote via the wire contract above, wrapped in caching, or your own).
Everything UI-side — panels, preview dialogs, progress, stop — consumes only the public API of this
package, so a different product embeds the same engine by implementing the same three seams and
nothing else.
