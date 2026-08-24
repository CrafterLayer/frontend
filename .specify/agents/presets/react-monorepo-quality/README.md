# React Monorepo Quality Preset

This preset wraps the official Spec Kit `plan`, `tasks`, and `implement` commands. It does
not fork the core workflow. It adds the repository's required monorepo scope, component
decomposition, Storybook, MDX documentation, behavioral testing, review, convergence, and
handoff obligations at runtime.

The source is owned under `.specify/agents/`. Install it with:

```bash
specify preset add --dev .specify/agents/presets/react-monorepo-quality --priority 5
```

Spec Kit 1.0.1 has no in-place local-preset update command. To update an installed copy,
remove it, run the add command above, then activate Claude, Codex, and Cursor once each to
recompose their skills. Never hand-edit generated integration skills.
