# Verification: Catalog economy and free composition (T212–T234)

**Feature**: [spec.md](./spec.md) · **Tasks**: T212–T234 · **Date**: 2026-09-01

Two problems that turned out to be one. The assistant's context was 96% spent before the user typed
anything, and the design space was bounded by a 54-block catalog that had to be exhaustive *because*
nothing else could express a shape. This record separates what was measured from what was asserted,
and names three defects the work itself introduced and then closed.

## The measurement that started it

`assembleAiContext` on the playground's landing fixture, via
`estimateAssembledAiContextTokens` — the same estimator the budget check uses:

| Part                                    | Tokens     | Share |
| --------------------------------------- | ---------- | ----- |
| Block catalog — 54 blocks, in full      | **57,851** | 94%   |
| The landing document itself             | 3,305      | 5%    |
| Templates, selection, output contract   | 375        | 1%    |
| **Total, per request**                  | **61,578** |       |

Against `DEFAULT_AI_CONTEXT_TOKEN_BUDGET = 64,000`
([generate-plan.ts:57](../../../packages/builder/ai/src/plan/generate-plan.ts#L57)). One choke point
produced all of it: `collectBlocks` shipped `propsSchema` + `examples` + `slots` for every registered
block on every request, with no filter.

## What the numbers are now

Measured against the real registry (55 blocks, every shipped pack), not a fixture:

| Mode                     | Tokens     | vs `full` | Per request at $5/MTok input |
| ------------------------ | ---------- | --------- | ---------------------------- |
| `full` (default, unchanged) | 63,782  | —         | $0.319                       |
| `scoped` (one block)     | 9,484      | −85%      | $0.047                       |
| **`index`**              | **8,330**  | **−87%**  | **$0.042**                   |

`index` decomposes as ~2,600 catalog + ~3,300 document + ~1,000 escape hatch. The document is the
floor no catalog mode moves, which is worth knowing before anyone optimises further.

Asserted at production size in
`apps/playground/src/features/preview/ai-context-cost.test.ts`, with the decomposition written into
the test so a regression names its own cause.

## What was proved, and what was only run

**Proved by test:**

- Each catalog mode's shape, and that `full` is byte-identical to the pre-policy behaviour.
- The escape hatch keeps full detail in every mode, and its exemption is a FIXED cost (one block),
  not a share of the catalog — asserted by differencing three assemblies rather than by a ratio that
  would silently track fixture headcount.
- Canvas and static publishing render a custom-code tree identically, including the component
  reference fallback; scoped CSS reaches published output; refused CSS does not.
- The injection surface: `<script>`/`<iframe>` are unrepresentable in the vocabulary, event-handler
  attributes are dropped, `javascript:` sources are dropped while https/relative/data-image survive,
  and markup inside a text node renders as text.
- Every one of the 7 refused CSS constructs, individually.
- That the two class laws cannot contradict: no vocabulary entry is one `findRejectedUtilities`
  rejects.
- That the shipped catalog example — the model's only instruction manual, and the one piece of
  catalog data present in every mode — passes every gate a real proposal passes.

**Run, not proved:**

- No browser evidence. Every renderer assertion is jsdom; the canvas has not been driven in
  Chromium for this slice, and nothing here should be read as browser proof.
- No live provider. `remote-provider` has no server behind it, so every token figure is of the
  request that WOULD be sent, not one that was.
- Prompt caching is argued from determinism (`canonicalJsonStringify` orders keys, so an unchanged
  registry serializes to identical bytes) and has not been observed against a cache.

## Three defects this work introduced and closed

Recorded because each was found by a test rather than by review, and because the second is the kind
that survives review:

1. **The `css` prop was unusable as first built.** A region carries `css` so it can express what
   utilities cannot; those rules need selectors, selectors need class names, and the vocabulary door
   refused every one of them. Closed by reserving `ck-` — exempt from the generation law precisely
   because its CSS comes from the region itself.
2. **A second source of truth about class names.** `findRejectedUtilities` already existed. It is
   not the same rule (theming vs generation, denylist vs allowlist) but the overlap was
   undocumented and the AI door ran only the new one. Closed by running both, documenting the
   split in a table, and adding the test that proves they cannot diverge.
3. **The reserved namespace laundered arbitrary values.** `ck-[17px]` passed the prefix check and
   thereby escaped the theming law. Closed by refusing brackets under the prefix.

## Gates

```
pnpm lint       28/28 tasks
pnpm typecheck  27/27 tasks
```

Per-package tests, green across two consecutive full runs:

| Package                       | Tests |
| ----------------------------- | ----- |
| `@craftkit/builder-schema`    | 248   |
| `@craftkit/builder-renderer`  | 135   |
| `@craftkit/builder-ai`        | 314   |
| `@craftkit/builder-custom-code` | 48  |
| `@craftkit/builder-shell`     | 729   |
| `@craftkit/builder-core`      | 124   |
| `@craftkit/builder`           | 115   |
| `@craftkit/playground`        | 92    |

**One pre-existing failure, not from this work**: `@craftkit/storybook` fails to index — a CSF file
tagged `autodocs` that also has a component docs page (`Builder/Shadcn/Tabs`). Reproduced on a clean
tree with this work stashed.

**One flake, investigated rather than assumed**: `kernel-laws.test.ts` intermittently fails its
final assertion under `pnpm test`'s parallel load. Measured in isolation, `validate()` costs 32ms at
a big/small ratio of 1.19 — unchanged by this slice, and far inside both assertions. The flaking one
is `expect(bigBest).toBeLessThan(2000)`, a wall-clock assertion in a test whose own comment argues
wall-clock assertions flake here. This work added parallel load (two packages, six suites) and so
fires it more often. Left alone deliberately: it is an unrelated guard test and its fix should be a
deliberate one-line decision by its owner, not a side effect of this phase.

## Residual risk

- **The default is still `full`.** Every host pays $0.32 a request until someone flips it. Safe to
  flip now that the escape hatch is exempt from the economy; deliberately left as a product call.
- **The `strict` CSS policy throws.** `scopeCustomCodeCss(..., 'strict')` raises "not implemented"
  by design, so the mode cannot silently behave like the permissive one before it is written.
- **The tree Inspector is a JSON surface.** Honest for v1 and built so the better answer — promoting
  a tree element into a real document node the existing canvas edits — does not require unbuilding
  it. Named as a later milestone, not as a gap in this one.
