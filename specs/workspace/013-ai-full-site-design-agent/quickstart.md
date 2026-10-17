# Quickstart: Validating the AI Full-Site Design Agent

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

How to prove this feature works, end to end, without trusting anyone's summary. Every scenario here
runs against the deterministic offline provider, so none of it needs a network, a model, or an API
key.

Contracts: [site-model](./contracts/site-model.md) · [stage-pipeline](./contracts/stage-pipeline.md)
· [asset-library](./contracts/asset-library.md). Shapes: [data-model.md](./data-model.md).

---

## Prerequisites

```bash
export PATH="/usr/bin:/bin:$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
cd /Users/abode/Documents/craftkit-builder/frontend
pnpm install --frozen-lockfile
```

Add `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false` to any command where pnpm attempts a forbidden
auto-install.

Two environment facts that cost time when forgotten:

- **`pnpm --filter X test -- <path>` does not filter to that path.** Pass the path directly, or run
  `pnpm exec vitest run <path>` from inside the package.
- **Read pnpm's own exit code.** `pnpm verify > log; echo $?` reports the _echo's_ status. Capture
  pnpm's exit in braces or read the log tail.

---

## Scenario 1 — A brief becomes a site (US1)

Proves FR-016 to FR-025 and SC-001.

```bash
pnpm exec vitest run packages/builder/ai/src/pipeline
```

Expect: all five stages named in order; each intermediate validated before the next begins; the run
ends with an `AssemblyPlan` of **commands**, never a site object; the first stage's `start` event
fires before any other work.

In the app:

```bash
pnpm --filter @craftkit/playground dev    # port 5175 — 5173 is the user's own app
```

Enter a one-paragraph business brief. Expect named stage progress, a site of ≥4 pages, and copy that
mentions the business. No filler text anywhere.

---

## Scenario 2 — One design language across every page (US2)

Proves FR-009 to FR-015, SC-009.

```bash
pnpm exec vitest run packages/builder/schema/src/theme
pnpm exec vitest run packages/builder/renderer/src/resolve
```

Then the contrast gate, which **must** run in Chromium — jsdom cannot resolve a custom property or
compute a rendered colour:

```bash
# Stories are COLOCATED in packages; apps/storybook only aggregates them.
# Precedent: packages/builder/theme/src/contrast.stories.tsx (the chrome gate).
cd apps/storybook
pnpm exec vitest run --project=storybook \
  ../../packages/builder/renderer/src/resolve/generated-contrast.stories.tsx
```

Expect: every pairing the generated system authorizes meets 4.5:1 for normal text and 3:1 for large
text. The count of failures is zero, computed, not asserted.

Then change one token in the playground's design-system panel. Expect every page to change with it,
with no page regenerated.

---

## Scenario 3 — Refinement patches, it does not regenerate (US3)

Proves FR-035 to FR-040, SC-007, SC-011.

```bash
pnpm exec vitest run packages/builder/ai/src/refine
```

Expect: nodes outside the named target are byte-identical; a hand edit made after generation
survives; the change is **one** undo step; a request naming a page that does not exist is refused
and writes nothing.

Manual check worth doing once, because it is the failure everyone assumes is handled:

1. Generate a site.
2. Hand-edit a heading on the About page.
3. Ask for "make the hero darker".
4. Confirm the About page edit is untouched, then undo once and confirm only the hero reverts.

---

## Scenario 4 — The site round-trips (non-negotiable)

Proves FR-008, SC-003, SC-014.

```bash
pnpm exec vitest run packages/builder/transforms/src/codec/site-codec.test.ts
```

Expect four laws green:

1. Manifest law — 1,000 `fast-check` cases, fixed seeds.
2. Composition law — a site projection decomposes into its manifest plus its page texts, losslessly
   and order-independently.
3. Page law — the existing per-page law, reused verbatim.
4. Non-vacuity — a `parseSite` returning `[]` forever fails the gate.

And that a page lifted out of a site validates alone (SC-014).

---

## Scenario 5 — The codec stays off the render thread

Proves that feature 011's SC-005 still holds at site scope.

```bash
pnpm exec vitest run packages/builder/extensions/code-view/src/worker/off-thread.test.ts
pnpm exec vitest run packages/builder/extensions/code-view/src/containment.test.ts
```

Expect: main-thread modules cannot import the codec at all (static), and a typing burst invokes it
**zero** times in the render realm (counted, not timed). Both must be true for `{kind:'site'}` and
`{kind:'page'}`, not only for the original scopes.

---

## Scenario 6 — Every page works at every width (US5)

Proves FR-041 to FR-043, SC-008. Chromium only — jsdom cannot measure a box.

```bash
cd apps/storybook
pnpm exec vitest run --project=storybook \
  ../../packages/builder/extensions/blocks-marketing/src/responsive.stories.tsx
```

Expect zero horizontal overflow and zero content overlaps at 360, 768, 1024, and 1440. Then generate
from an Arabic brief and confirm the document direction and every layout follow it.

---

## Scenario 7 — Imagery resolves, and nothing is invented (US6)

Proves FR-044 to FR-051, SC-012.

```bash
pnpm exec vitest run packages/builder/ai/src/assets
pnpm exec vitest run packages/builder/schema/src/assets
```

Expect: every reference resolves to a held asset; the count of invented addresses is **zero**; an
empty library still produces a complete site with labelled absences rather than grey boxes.

---

## Scenario 8 — Nothing partial, ever (SC-010)

```bash
pnpm exec vitest run packages/builder/ai/src/pipeline/generate-site.test.ts
```

Expect: a scripted failure at stage 4 leaves the workspace byte-identical to its prior state, and a
cancellation mid-run does the same. Capture the state before, compare after — do not infer it from
the absence of an error.

---

## Full gate

This feature changes layer 0, so the full gate is required before handoff. Nothing downstream is
unaffected.

```bash
pnpm format:check
pnpm check:workspace      # ADR 0003 layer law — the gate for every new dependency edge
pnpm check:components     # must report 64 (baseline was 58)
pnpm check:boundaries
PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm verify
```

---

## What this quickstart cannot prove

Three of the spec's success criteria are **not** reachable from a terminal, and pretending otherwise
would be the exact failure the spec was written to prevent:

- **SC-004 (distinctiveness)** needs ten briefs across ten unrelated industries and a recorded
  threshold comparison. Phase H.
- **SC-006 (blind comparison)** needs at least three human raters and a reference-competitor account
  the user supplies. Phase H. No automated substitute counts.
- **"Professional"** is judged by that recorded evaluation, not by the implementing agent's opinion
  of its own output.

A green suite here means the machinery is correct. It does not mean the sites are good — that is a
separate, human measurement, and it is deliberately Phase H rather than an assumption.
