# Workspace Governance Extension

This local Spec Kit extension gives every installed integration the same three
operational commands:

- `speckit.workspace.review` performs the required read-only implementation review;
- `speckit.workspace.handoff` updates the canonical continuity files; and
- `speckit.workspace.commit` generates a commit message from the real diff without
  committing.

The `professional-sdd` workflow invokes these commands as explicit engine steps so their
status is visible and review/handoff are not executed twice. Direct command users invoke
the matching operation when they are not running the full workflow. The extension source
lives under `.specify/agents/`; install or reconcile it through Spec Kit instead of
editing generated agent skills.
