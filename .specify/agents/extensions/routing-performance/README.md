# Routing Performance Extension

This local Spec Kit extension provides one shared command for Claude, Codex, and Cursor:

- `speckit.routing-performance.optimize` analyzes route code loading, destination data prefetch,
  heavy component boundaries, and measured production output.

The source command loads `.specify/agents/rules/routing-performance.md` as its detailed
contract. Install or update it from the repository root with:

```bash
specify extension add .specify/agents/extensions/routing-performance --dev --force
```

Then reconcile every supported integration through `specify integration use`; generated
skill folders are outputs and must not be edited directly.
