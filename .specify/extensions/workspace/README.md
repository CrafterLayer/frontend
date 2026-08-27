# Workspace Governance Extension

This local Spec Kit extension gives every installed integration the same four operational commands:

- `speckit.workspace.delegate` partitions approved work, delegates only bounded path-disjoint tasks,
  and requires the coordinator to verify the returned diff and evidence;
- `speckit.workspace.review` performs the required read-only implementation review;
- `speckit.workspace.handoff` updates the canonical continuity files; and
- `speckit.workspace.commit` generates a commit message from the real diff without committing.

The `professional-sdd` workflow invokes these commands as explicit engine steps so their status is
visible and review/handoff are not executed twice. Its delegation step defaults to `auto`, may be
disabled explicitly, and writes a run-local result that a separate engine step validates. `required`
therefore accepts only a verified delegated result and cannot silently advance when the transport is
unavailable. Direct command users invoke the matching operation when they are not running the full
workflow. The extension source lives under `.specify/agents/`; install or reconcile it through Spec
Kit instead of editing generated agent skills.

The cross-integration review command remains model-neutral. The `professional-sdd` workflow runs its
two Codex reviews through a packaged launcher that enforces a fresh ephemeral process,
`sandbox=read-only`, and `approval-policy=never`; `gpt-5.6-terra` is the default, with Luna
available only through an explicit workflow input override.

The delegation command is transport-neutral. Claude should prefer the official Codex plugin/app
server bridge when installed. The project currently uses `codex-craftkit-async` for observable,
read-only background work and keeps `codex-craftkit-worker` only as a synchronous compatibility
fallback for authorized writes. Async status reads local state every 30–55 seconds and does not
start another Codex call. See `docs/development/agent-collaboration.md` for setup, preflight, and
failure handling.
