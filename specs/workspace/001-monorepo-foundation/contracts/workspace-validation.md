# Contract: Workspace Validation CLI

## Commands

```bash
pnpm check:workspace
pnpm check:components
```

Both commands run from the repository root, write human-readable diagnostics to standard
error, and exit non-zero when any contract violation exists. Success output reports the
number of validated members or components and exits zero.

## `check:workspace`

The command discovers only direct directories matching `apps/*/package.json` and
`packages/*/package.json`. It MUST report all detectable failures in one run, including:

- missing or duplicate member names;
- a missing target named by a `workspace:` dependency;
- an existing internal member referenced without `workspace:`;
- an app depending on another app;
- a package depending on an app;
- an internal dependency cycle, including its path;
- a non-private app or foundation package;
- a package without explicit `exports` or an export target escaping its directory; and
- a required member task or metadata field that is absent for its declared member role.

Diagnostics use repository-relative owner paths and the exact dependency name. The CLI
does not rewrite manifests.

## `check:components`

The command discovers PascalCase direct component folders within approved component roots.
For each `<Name>` it requires:

```text
<Name>.tsx
<Name>.stories.tsx
<Name>.docs.mdx
<Name>.test.tsx
index.ts
```

It reports every missing file with the component's repository-relative folder. It ignores
test fixtures, generated output, `node_modules`, and non-component support directories. The
CLI validates artifact presence; ESLint, TypeScript, Vitest, and Storybook validate content.

## Stability

These commands are CI contracts. Renaming them or weakening a failure requires a new
workspace specification and documentation update.
