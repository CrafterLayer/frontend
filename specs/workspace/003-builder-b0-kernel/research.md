# Research & Decisions: Builder B0 Kernel Foundation

All decisions verified 2026-08-25. Format: Decision / Rationale / Alternatives considered. Sources:
live npm registry + published type declarations + this repo's validators and contract tests + the
five-round-reviewed execution plan.

## R1 — Dependency pins (registry-verified)

**Decision**: Catalog adds exact pins `zod: 4.4.3`, `immer: 11.1.18`, `zustand: 5.0.15`,
`nanoid: 6.0.1`, `fast-check: 4.9.0`.

**Rationale**:

- All published ≥ 6 days ago (registry timestamps checked) — clears `minimumReleaseAge: 1440` with
  margin.
- `zod@4.4.3` is already in the lockfile transitively → pinning the same version dedupes and cannot
  trip `trustPolicy: no-downgrade`. Verified locally that `zod/v4/core/to-json-schema` ships (the
  AI-context derivation needs it).
- `immer@11.1.18` d.ts verified: `produceWithPatches`, `enablePatches`, `applyPatches`,
  `Patch { op: "replace"|"remove"|"add"; path: (string|number)[]; value? }` — the exact API the
  kernel contract assumes (v10-era shape unchanged).
- `zustand@5.0.15` `package.json` verified: exports `./*` (so `zustand/vanilla` resolves) and **all
  four peers are optional** (`peerDependenciesMeta`) — satisfies `strictPeerDependencies` without
  installing React.
- `nanoid@6.0.1` verified: pure ESM, `engines` allow Node 24 (workspace is `type: module`, Node
  24.19.0).
- `fast-check@4.9.0` introduces one new transitive (`pure-rand@^8`) absent from the lockfile → no
  downgrade path exists.

**Alternatives considered**: floating ranges (rejected — catalog policy pins exact); newest
immer/zustand at publish-day freshness (rejected — `minimumReleaseAge` risk for zero benefit);
`uuid` instead of nanoid (rejected — larger, no benefit for opaque ids).

## R2 — Internal-packages mode (no build step)

**Decision**: Both packages export `{ ".": "./src/index.ts" }` (plus `"./testing"` on core), no
`build` script.

**Rationale**: Matches the `@craftkit/test-config`/`@craftkit/eslint-config` precedent; consumers
are workspace-internal only in B0; turbo skips absent scripts so existing task graph and contract
tests are untouched; extraction/build (`tsup`, dist exports) is a later-milestone concern that must
not tax kernel iteration speed.

**Alternatives considered**: built packages with dist exports like `@craftkit/query` (rejected for
B0 — build+declaration wiring buys nothing without external consumers; revisit at OSS extraction).

## R3 — Dependency-law enforcement

**Decision**: Extend `@craftkit/workspace-tools`: (a) discovery `MEMBER_ROOTS` gains
`packages/builder` (with every stale "apps/* and packages/*" contract text — error messages, JSDoc,
README, fixtures/tests — updated in the same change); (b) new `validate-builder-boundaries.mjs`
wired into `check-workspace`: layer map schema=0, core=1, engines=2, shell=3, extensions=4,
editor=5; builder members depend only on strictly-lower builder layers plus tooling packages;
extensions never on extensions; non-builder members may access the builder family only through the
future `@craftkit/builder` preset (their other dependencies remain governed by existing rules —
Storybook→UI unaffected, covered by an explicit test).

**Rationale**: Repo-native, deterministic, CI-fatal via existing `check:workspace`; respects the
documented 001-research decision to defer experimental Turbo tags; the discovery extension is
required under any variant (otherwise builder packages are invisible to `check:workspace` and
`workspace:*` references to them are flagged unknown).

**Alternatives considered**: Turbo boundaries tags (rejected now — experimental, explicitly deferred
by 001; bare `turbo boundaries` stays as defense-in-depth); eslint-only import bans (rejected —
manifest-level dependency edges, not just import sites, must be validated).

## R4 — Slots model (document structure)

**Decision**: Child membership lives in a per-node named-slots map
(`slots: Record<SlotName, NodeId[]>`); `"default"` is the reserved slot name for ordinary children;
slot names must be non-empty strings; empty slot arrays are never stored (commands normalize;
validator rejects). The older `children: NodeId[]` array is replaced entirely. User-confirmed
direction (in-session decision).

**Rationale**: The filtered-children model is ambiguous the moment two slots accept the same element
type (two identical columns); a unified map keeps the model flat, keeps per-slot order in one place,
and makes structural validation exact (exactly-once membership checkable in one pass).

**Alternatives considered**: `children + slot marker on each child` (rejected — per-slot order
becomes derived, two sources of truth); allow-list disambiguation with an overlap ban (rejected —
forbids legitimate block designs).

## R5 — Command registration pattern (strict-TS variance)

**Decision**: Author commands as `CommandInput<S extends z.ZodType>` (full inference);
`defineCommand` erases to a uniform `RegisteredCommand` whose `apply(args: unknown)` runs
`schema.parse` then the typed handler. Catalogs store `Record<string, RegisteredCommand>`.

**Rationale**: The naive `Record<string, CommandDef<S>>` fails strict TypeScript on
function-parameter contravariance (verified reasoning; flagged by external review). The erasure
pattern is variance-safe AND makes Law V structural — parsing happens inside the registered unit
itself, so no path delivers unparsed args to a handler.

**Alternatives considered**: `any`-typed command map (rejected — violates strictTypeChecked and the
repo's no-`any` culture); method-bivariance hacks (rejected — hides the unsoundness instead of
removing it).

## R6 — Determinism ports

**Decision**: `ClockPort { now(): number }` and `IdPort { newId(): string }` are injected kernel
capabilities. System implementations live in exactly two files (`ports/system-clock.ts`,
`ports/system-ids.ts`); eslint bans `Date.now`, `Math.random`, and `nanoid` imports everywhere else
in the two packages. Test fixtures provide fixed/seeded ports.

**Rationale**: Property tests and replay must be bit-for-bit reproducible (spec SC-003); confining
ambient nondeterminism to two lint-guarded files makes the guarantee structural.

**Alternatives considered**: ambient `Date.now`/`nanoid` with test-time mocking (rejected — mock
drift, no static guarantee); full DI container (rejected — two tiny interfaces suffice).

## R7 — JSON purity and single Node type

**Decision**: `Node.props` and `Node.responsive` are `Record<string, JsonValue>`
(`JsonValue = string | number | boolean | null | JsonValue[] | {[k]: JsonValue}`). Enforced three
ways: by type; by `defineBlockSchema` rejecting non-JSON-representable zod schemas
(date/bigint/function/undefined/symbol/map/set); by dispatch walking patch values (finite numbers
only). Because `Node` is JSON-pure by construction, tier-2 stored subtrees reuse `Node` directly —
no parallel "DeclarativeNode" type exists.

**Rationale**: "The JSON document is the only source of truth" must be a type-level fact, not prose;
unifying runtime and stored node types removes an entire class of conversion bugs.

**Alternatives considered**: `unknown` props + runtime-only checks (rejected — functions/bigint/NaN
representable by type, law violable silently); serialization-time sanitization (rejected — corrupts
instead of rejecting).

## R8 — Tier-2 schema shapes

**Decision**: Database rows never hold live zod instances. Tier-2 widget contracts and binding
shapes are `SchemaDescriptor` values (a JSON-Schema subset, itself `JsonValue`) compiled into zod
validators by a Tier-1 interpreter at hydration. B0 ships the descriptor type + the compile hook
contract; the full descriptor vocabulary grows in B6.

**Rationale**: Closes the impossibility in the reference docs (`shape: z.ZodTypeAny` inside a DB
row) and keeps the function-free guarantee absolute for tier-2.

**Alternatives considered**: serialized-zod (rejected — no stable public wire format); storing
validation only server-side (rejected — kernel must validate what it registers).

## R9 — ESLint purity mechanism

**Decision**: New `@craftkit/eslint-config` export `./headless`: `headlessConfig(files)` using
**core** `no-restricted-imports` with `allowTypeImports: true` (paths `react`, `react-dom`,
`zustand`→"use zustand/vanilla", `nanoid`; patterns `react/*`, `react-dom/*`, `**/*.css`),
`no-restricted-globals` (`window`, `document`, `navigator`), and `no-restricted-syntax` for
`Date.now`/`Math.random`; a scoped override exempts only the two system-port files. Composed into
the ROOT `eslint.config.mjs` for `packages/builder/{schema,core}/src/**`.

**Rationale**: Verified the installed eslint 10.9.0 core rule supports `allowTypeImports` (16
occurrences in the rule source) — the typescript-eslint extension rule is unnecessary; a
package-local flat config would shadow the single root config the repo lints through.

**Alternatives considered**: `@typescript-eslint/no-restricted-imports` (rejected — redundant with
core support in eslint ≥10); per-package eslint configs (rejected — shadows root config resolution).

## R10 — Headless TypeScript config

**Decision**: New additive `@craftkit/typescript-config/headless.json` = `base.json` +
`"lib": ["ES2024"]`. Both builder packages extend it.

**Rationale**: `base.json` leaves `lib` unset, which pulls DOM ambient types by default; restricting
`lib` turns any DOM usage into a compile error — the "zero DOM" law becomes structural.
(`react-library.json` adds DOM+react; `node.json` adds NodeNext/node types — both wrong for an
environment-agnostic kernel.)

**Alternatives considered**: lint-only DOM bans (rejected — typecheck-level guarantee is stronger
and free).

## R11 — Test configuration

**Decision**: New additive `@craftkit/test-config` export `./node` (`createNodeTestConfig`):
environment `node`, no react plugin, no jsdom setup, same coverage provider/thresholds (85/90/90/90)
as the react config. Tests colocated as `*.test.ts` (repo convention), fixtures under
`core/src/testing/`.

**Rationale**: Mirrors the existing factory pattern; keeps thresholds uniform;
`validate-components.mjs` only scans `src/components/*` so `testing/` is safe.

**Alternatives considered**: reusing the react config with jsdom (rejected — kernel must prove it
runs without a DOM; jsdom would mask violations).

## R12 — Documentation routing

**Decision**: Durable decisions from this feature become ADRs under `docs/architecture/decisions/`
(repo's documented ADR home; ADR 0002 precedent): "builder dependency-law enforcement" and "tier-2
versioning model". Feature requirements stay in this directory. The three
`specs/workspace/builder-core/*.md` docs receive a reference-material banner pointing here. No
AGENTS.md/CLAUDE.md addenda (constitution I/VI).

**Alternatives considered**: `specs/**/adr/` (rejected — contradicts the repo's documentation
routing table); editing the three reference docs in place (rejected — single normative source is
this feature).

## R13 — Performance enforcement (non-flaky)

**Decision**: B0 ships only Lane-A deterministic assertions: notification-count (exactly 1
subscriber notified per single-property change on the 1,000-node stress doc), patch-shape (a command
touches only its paths), O(1) catalog lookups (flat cost 10→1,000), plus the one timing budget the
spec sets (structural validation < 150 ms at 1,000 nodes, generous absolute ceiling). Trace-based
timing budgets (Lane B) start at B2a with median-of-5 on a dedicated job.

**Rationale**: Counting assertions cannot flake; the single timing budget has a ~10× headroom
ceiling; this operationalizes spec SC-005/SC-006 without rotting CI.

**Alternatives considered**: wall-clock budgets on every operation (rejected — flaky by construction
on shared runners).

## R14 — Reserved slot names

**Decision**: `"default"` is the reserved ordinary-children slot. Slot names must be non-empty; no
other names are reserved in B0.

**Rationale**: One reserved name covers the common case; further reservations would speculate ahead
of B1+ needs.

## R15 — Public testing surface

**Decision**: `@craftkit/builder-core` exposes `"./testing"` (fixtures incl. the 1,000-node stress
doc, fake extension, `createMemoryPersistence`, fixed ports). Approved exception to the
single-entrypoint discipline, recorded in plan.md Complexity Tracking with owner/rationale/removal
condition.

**Alternatives considered**: third `builder-testing` package (rejected — a workspace member for no
contract gain); duplicating fixtures per consumer (rejected — drift).
