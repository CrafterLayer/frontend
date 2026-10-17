# Contract: Agent Skills and Bounded Runs

**Owner**: `@craftkit/builder-ai` (layer 2), with the human-labelled atomic door implemented by
`@craftkit/builder-core` (layer 1).

This contract adds reusable expertise without adding a write path. A skill is validated data. It may
shape context and narrow commands; it cannot execute code, grant authority, construct a document, or
bypass the kernel.

---

## 1. Skill definition and manifest

```ts
export interface AiSkillDefinitionV1 {
  schemaVersion: 1;
  id: string; // namespaced, stable, safe characters only
  name: string;
  description: string;
  version: string; // semver
  instructions: string;
  tags?: readonly string[];
  source?: 'builtin' | 'host';
  trust?: 'builtin' | 'reviewed' | 'untrusted';
  activation?:
    | { mode: 'explicit' }
    | { mode: 'always' }
    | {
        mode: 'auto';
        keywords?: readonly string[];
        selectedBlockTypes?: readonly string[];
      };
  priority?: number; // deterministic optional-auto ordering, higher first
  dependencies?: readonly string[];
  conflicts?: readonly string[];
  restrictToCommands?: readonly string[];
  references?: Readonly<Record<string, string>>;
}

export interface AiSkillManifestV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  version: string;
  tags: readonly string[];
  source: 'builtin' | 'host';
  trust: 'builtin' | 'reviewed' | 'untrusted';
  activation: AiSkillDefinitionV1['activation'];
  dependencies: readonly string[];
  conflicts: readonly string[];
  restrictToCommands?: readonly string[];
  referencePaths: readonly string[];
  contentFingerprint: string;
}
```

`defineAiSkill()` performs runtime validation, canonical sorting/copying, and fingerprinting. It
rejects duplicate list entries, unsafe ids or reference paths, invalid versions, empty required
text, oversized content, executable values, and unsupported `schemaVersion` values. Returned data is
detached from caller-owned arrays/objects. `contentFingerprint` uses the explicit
`skill-v1-sha256-<64 lowercase hex>` format over the complete canonical content; a 32-bit checksum
is not sufficient for audit pins or cache identity.

The exported v1 storage bounds are 4 KiB per metadata entry, 64 KiB for the canonical aggregate
manifest metadata, 128 KiB for instructions, 64 references, 128 KiB per reference, 256 KiB across
references, and 256 definitions per registry. Limits are measured as UTF-8 bytes and apply before
and after normalization where normalization can change an entry. The request budget charges the
exact serialized `AiActiveSkillContext`, not only instruction/reference bodies.

V1 carries instructions and references only. It has no scripts, URLs, functions, imports, package
installation, filesystem paths outside its own logical reference names, or process/network hooks.

---

## 2. Progressive registry

```ts
export interface AiSkillRegistry {
  list(): readonly AiSkillManifestV1[];
  get(id: string): AiSkillManifestV1 | undefined;
  readSkill(id: string): string;
  listReferences(id: string): readonly string[];
  readReference(id: string, path: string): string;
  prepare(options: AiSkillPrepareOptions): AiPreparedSkillContext;
}
```

`list()` and `get()` never expose the full instruction or reference bodies. `readSkill()` and
`readReference()` are explicit progressive-disclosure operations. The registry is immutable after
construction; duplicate ids fail the whole construction rather than replacing an entry silently.

`prepare()` receives the current request, selected block types, explicit ids, whether auto-matching
is enabled, trust policy, and hard limits. The output contains:

- a catalog of all discoverable metadata;
- full bodies only for active skills;
- pinned `{ id, version, contentFingerprint, reason }` activations;
- a deterministic token estimate;
- structured omissions for optional auto candidates; and
- the effective command restriction.

---

## 3. Resolution law

Resolution order is semantic, never caller-array order:

1. Validate all explicit ids.
2. Add always-on trusted skills.
3. Expand dependencies depth-first in canonical id order; reject cycles and unknown dependencies.
4. Add deterministic auto-matches ordered by priority/source/id.
5. Reject conflicts involving an explicit/required/always skill. For two optional auto candidates,
   retain the canonical winner and record why the other was omitted.
6. Enforce maximum active count and token budget. Mandatory content that cannot fit is an error;
   optional auto content may be omitted with an observable reason.

The same definitions, request, selection, and policy MUST produce byte-identical prepared context,
regardless of registry or explicit-id input order.

Untrusted skills are discoverable but cannot activate unless the host explicitly opts into
`allowUntrusted`. Auto-matching never silently elevates an untrusted skill.

---

## 4. Command policy

```ts
export interface AiCommandPolicy {
  allowedCommands?: readonly string[];
  deniedCommands?: readonly string[];
  maxCommands: number;
}
```

The effective policy is restrictive:

```text
registered kernel commands
  ∩ host/session allowedCommands (when present)
  ∩ every active skill restrictToCommands (when present)
  − host/session deniedCommands
```

A skill list is never unioned to grant a command. A skill omitting `restrictToCommands` adds no
restriction and no authority. Validation issues use `policy-rejected` and are fed into the single
bounded repair attempt; the same policy is rechecked before grouped application.

---

## 5. Assembled context and cache identity

`AssembledAiContext` gains additive optional fields for compatibility:

```ts
interface AssembledAiContext {
  // existing fields...
  skillCatalog?: readonly AiSkillManifestV1[];
  skills?: readonly AiSkillActivationPin[];
}
```

The catalog fragment contains metadata only. Each active skill is a separate structured fragment
whose body is deterministic JSON, not interpolated XML/Markdown control tags. Active bodies appear
exactly once. `skills` contains version/fingerprint/reason pins rather than duplicating those
bodies.

A plan-cache key covers the entire assembled context plus request and conversation history. Changing
memory, any fragment, block/template catalog, selection, active skill version/body, or fingerprint
is therefore a miss. `AbortSignal.aborted` is checked before cache lookup and before a cached result
is returned.

An extension `AiContextProvider` receives a least-authority `AiContextReadApi`, not `KernelApi`.
State and selection are detached, deeply frozen request snapshots. The registry surface is a frozen,
data-only catalog: block props are JSON Schema; block renderers/Zod objects, stored composition
nodes, widget payloads, command implementations, subscriptions, events, and mutation doors are
absent. Provider and selection arrays are snapshotted before collection, so one provider cannot
change what a later provider sees or what final context records.

---

## 6. Bounded agent run

```ts
export interface RunAiAgentOptions {
  runId: string;
  clock: ClockPort;
  kernel: BuilderKernel;
  provider: AiPlanProvider;
  request: string;
  validationPorts: AiValidationPorts;
  skillRegistry?: AiSkillRegistry;
  selectedSkillIds?: readonly string[];
  policy?: Partial<AiAgentPolicy>;
  apply?: 'never' | 'auto';
  signal?: AbortSignal;
  isCurrentRun?: (runId: string) => boolean;
  onEvent?: (event: AiAgentEvent) => void;
}
```

The default policy also caps the complete canonical serialized context at 64,000 estimated tokens;
this counts the actual provider/wire object, not only its convenience fragments. Hosts may lower
that bound per run. Invalid or exceeded limits fail before provider work.

States:

```text
started
  → resolving-skills
  → gathering-context
  → proposing
  → validating
  → proposed                    (apply: never)
  → applying → completed        (apply: auto)
  ↘ failed | cancelled
```

Every event contains `{ runId, seq, at, type }`; `seq` starts at 0 and increases by exactly one.
Time comes from the injected `ClockPort`. Exactly one terminal event (`run.completed`, `run.failed`,
or `run.cancelled`) may be emitted, and no event or application may occur afterward.

The runner checks cancellation and the host-owned synchronous `isCurrentRun` lease before cache or
provider work, after provider/repair results, before validation, and immediately before apply. A
lease answer other than `true` is cancellation: stale progress is suppressed, one terminal
`run.cancelled` event is emitted, and the live kernel remains untouched. `AbortSignal` remains the
cooperative resource-cancellation channel; the lease remains the final mutation authority when a
provider ignores it. The runner uses one repair by default and never silently performs a third
provider attempt. `apply: 'never'` returns a validated proposal for review; `apply: 'auto'` applies
the exact validated commands as one transaction. Command arguments must be JSON data, and the
validated plan is detached and deeply frozen before a proposal event or result exposes it; telemetry
observers therefore cannot mutate post-validation authority.

Remote transport accepts JSON or SSE but byte-counts the stream and rejects responses above the
configured `maxResponseBytes` (1 MiB by default), including an early `Content-Length` refusal.
Remote/local/cache proposal and repair paths check caller cancellation before work and after async
results, preserving caller aborts as `AbortError` rather than converting them into timeouts. SSE
accepts LF or CRLF frame delimiters and rejects a second result or any later data frame.

---

## 7. Grouped application

The core door accepts a backward-compatible options form:

```ts
export interface GroupedDispatchOptions {
  author?: Author;
  label?: string;
}

kernel.dispatchGroup(steps, { author: 'ai', label: humanLabel });
```

The old `dispatchGroup(steps, author)` form remains accepted. The label is stored in the
transaction's `command` field, because that is the current history-facing human label. Preflight
executes the complete batch through the scratch kernel's grouped door; live apply repeats the same
grouped path. A mid-group failure changes no document, log, history, or persistence position. When
no label is supplied, AI application derives a bounded label from the plan rationale. Post-commit
event/store observer failures are isolated from transaction outcome and from later observers.

---

## 8. Explicit refusals

- No skill script or executable hook.
- No URL/file import in this package.
- No skill can add commands, tools, network, process, filesystem, or document-write authority.
- No raw skill text is treated as platform/system policy.
- No global active-skill singleton.
- No cache identity that omits context or skill fingerprints.
- No browser-parsed XML/pseudo-tool commands.
- No direct document/site result accepted from a provider.
- No third provider attempt under the default contract.
