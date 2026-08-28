# @craftkit/builder-code-view

The code view: read and edit the current document — or the selected subtree — as canonical JSON,
applying through the same kernel door every other edit uses. Layer 4 of the builder dependency law
(ADR 0003). Extensions never import extensions.

Normative source:
[`specs/workspace/011-builder-b4-transforms-code-view`](../../../../specs/workspace/011-builder-b4-transforms-code-view/contracts/builder-transforms.md)
(§3 the worker, §4 the panel).

## Two entrypoints, deliberately

- `@craftkit/builder-code-view` — the manifest (`codeViewExtension`), the panel and error
  components, and `createCodeViewWorkerClient()`. This entry reaches `./worker` **dynamically or as
  types only**, so a session that never opens the panel loads none of it — proven statically in
  `containment.test.ts` and counted in the loader gate (SC-006).
- `@craftkit/builder-code-view/testing` — `createLoopbackWorkerLike()` and
  `createTransformWorkerClient()`. Test tooling. Re-exporting these from the production entry once
  put `worker/client.ts` and `worker/protocol.ts` on every consumer's initial module graph; the
  split is what keeps that from coming back.

## The panel's laws (contract §4)

A dirty draft is pinned to the `{scope, revision}` that PRODUCED it, so an external edit underneath
the author becomes a visible conflict instead of a silent revert. Invalid text changes nothing and
reports per line, with the error list wired into the textarea's `aria-describedby` while errors
exist. A valid edit applies as exactly ONE transaction that one undo reverses. Panel chrome inherits
the host application's direction; the JSON textarea is always `dir="ltr"`, including for Arabic
string content. Escape leaves, and the gates name the exact element focus lands on —
`not.toHaveFocus()` passes when focus falls to `<body>`, which is the defect a focus gate exists to
catch.

## The worker (contract §3)

A handwritten typed `postMessage` protocol, not Comlink: `ProjectionDef` holds FUNCTIONS, which
cannot be structured-cloned. Generation counting drops stale answers; one request is in flight with
at most one coalesced behind it; the document crosses once per revision and typing carries text
only. Every value crossing back is CHECKED, never asserted — a non-serializable patch becomes a
protocol error instead of a `DataCloneError` that would kill the worker.

## Development

```bash
pnpm --filter @craftkit/builder-code-view lint
pnpm --filter @craftkit/builder-code-view typecheck
pnpm --filter @craftkit/builder-code-view test
```
