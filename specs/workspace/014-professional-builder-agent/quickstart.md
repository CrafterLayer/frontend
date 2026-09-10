# Quickstart Validation: Professional Builder and Agent

## Prerequisites

- Node 24.19.x and pnpm 11.23.0.
- No live provider is required for contract and offline integration checks.
- Live model and visual benchmark runs require configured provider access and three independent raters.

## M0 vertical slice

1. Open a v1 fixture and confirm it migrates without content changes.
2. Create a code-backed page from the reference TSX fixture.
3. Compile and show it through the isolated preview application.
4. Select a nested heading, edit its literal content, and inspect the source diff.
5. Undo, redo, persist, reload, and confirm source and preview revision.
6. Export the page and directly load its route with working navigation and interaction.

Expected: one site history, exact target edits, no acknowledged data loss, and matching source,
preview, and export fingerprints.

## Recovery and concurrency

Run scripted cases for invalid source, overlapping builds, manual/Agent conflicts, cancellation at
every stage, reload during a run, and storage fallback. Late and stale work must never apply. The UI
must distinguish durable and session-only states.

## UI and accessibility

Exercise canvas selection, text editing, drag handles, insertion, Agent queue, page list, and site map
at 390/768/1024/1280/1440 widths, in LTR and RTL, with keyboard-only and reduced-motion modes.

## Security and export

Run hostile fixtures for parent DOM/storage access, forged messages, cross-project reads, unmanaged
imports, path traversal, and infinite loops. Directly load every export route with JavaScript enabled
and disabled; validate primary content, metadata, links, assets, and hydration.

## Evaluation

Run six representative cases across three routing policies, then the two best policies over the full
20-case corpus twice. Record accepted-output cost and separate first-preview, completion, and repair
latency. Three independent raters score anonymized screenshots.

## Required repository checks

```sh
pnpm check:workspace
pnpm check:components
pnpm check:boundaries
pnpm check:graph
pnpm verify
```

Read each exit code and rerun affected Turbo tasks with `--force` at least once before final evidence.

