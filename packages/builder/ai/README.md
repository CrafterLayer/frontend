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

- Three `AiContextProvider` implementations for the registered block vocabulary, current selection,
  and flat document shape. Block context includes model-facing descriptions, JSON Schema props
  summaries, few-shot examples, and accepted slots. Every fragment carries a deterministic
  character-based token estimate for budgeting.
- `AiPlanProvider`, a one-method provider port. A future model-backed adapter implements the same
  `propose(request, context)` contract.
- `createLocalAiPlanProvider()`, a deterministic, offline implementation that scores the request
  against registry-owned types, descriptions, prop names, and examples. It adapts requested list
  counts when the chosen example and schema support them. For example, “add a pricing section with
  three plans” emits one real `insertNode` command with three schema-valid plans.
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

The current kernel has no transaction-group API. `applyAiPlan()` therefore reports
`mode: 'sequence'` and dispatches commands in order. Each command uses the kernel's native history
semantics. The local provider currently emits one insertion command for block-generation requests,
so that concrete generation path is one transaction and one undo step. A future multi-command plan
is a clearly visible sequence until core provides a genuine grouped dispatch contract; this package
must not fake grouping by writing patches or documents around the door.

## Testing subpath

`@craftkit/builder-ai/testing` exports `createScriptedAiPlanProvider()` for consumer tests that need
to exercise provider rejection or application without a model or network.
