# `@craftkit/workspace-tools`

Private, repository-owned checks for the monorepo dependency graph and the complete UI component
artifact contract. The package uses only Node.js standard-library APIs, performs read-only
inspection, and reports every detectable violation in one run.

## Commands

Run these stable contracts from the repository root:

```bash
pnpm check:workspace
pnpm check:components
```

Both commands accept an optional repository path when validating an isolated fixture. A successful
workspace check reports the direct member count. A successful component check reports the discovered
component count. Failures go to standard error, contain a stable diagnostic code and
repository-relative owner path, and exit non-zero. Neither command rewrites manifests or component
files.

## Workspace ownership and failures

The workspace checker owns discovery of direct `apps/*/package.json` and `packages/*/package.json`
members. Nested fixtures and generated directories do not become workspace members. It rejects:

- missing or duplicate package names;
- members that are not private before an approved publishing plan exists;
- internal references other than the exact `workspace:*` selector;
- `workspace:` selectors whose target is not a direct member;
- app-to-app and package-to-app dependency direction;
- internal cycles, with the cycle path in the diagnostic; and
- packages without an explicit, repository-local `exports` surface.

The component checker discovers PascalCase component folders below `packages/*/src/components` and
`apps/*/src/**/components`. Each component must own `<Name>.tsx`, `index.ts`, `<Name>.stories.tsx`,
`<Name>.docs.mdx`, and `<Name>.test.tsx`. Content quality remains enforced by TypeScript, ESLint,
Vitest, and the central Storybook browser/a11y suite.

## Member creation checklist

1. Create exactly one direct `apps/<name>` or `packages/<name>` directory with a unique
   `package.json#name`.
2. Keep the member private until publication and versioning have an approved ADR.
3. Use `workspace:*` for every dependency on another workspace member.
4. Keep dependency flow `app -> package` or `package -> lower-level package`; never point an app at
   another app or a package at an app.
5. Give packages an explicit `exports` map whose file targets start with `./` and stay inside the
   package.
6. Add only real Turbo scripts for the member; a package without a runtime build does not need to
   invent one.
7. Run both root checks before opening review.

## Public module API

The package root exports `discoverWorkspace`, `validateWorkspace`, `discoverComponentFolders`,
`requiredComponentArtifacts`, and `validateComponents` for repository tests. The `./workspace` and
`./components` subpaths provide focused APIs. The two `craftkit-check-*` binaries are implementation
surfaces for root scripts; consumers should prefer the stable root command names.

## Troubleshooting

- `INVALID_WORKSPACE_RANGE`: replace the named internal dependency range with `workspace:*`.
- `MISSING_WORKSPACE_TARGET`: create or restore the named direct member, or remove the stale
  dependency.
- `APP_TO_APP_DEPENDENCY` / `PACKAGE_TO_APP_DEPENDENCY`: move the reusable contract into a
  deliberately owned package, then depend on that public package API.
- `WORKSPACE_DEPENDENCY_CYCLE`: follow the printed path and move the lowest-level contract below all
  cycle participants.
- `UNSAFE_PACKAGE_EXPORT_TARGET`: point the export at a `./` target inside the member.
- `MISSING_COMPONENT_ARTIFACT`: add every named artifact in the reported component folder; do not
  hide the missing responsibility in another component file.

If a diagnostic appears incorrect, reproduce it in an isolated fixture under this package's Node
test suite before changing the stable failure contract.
