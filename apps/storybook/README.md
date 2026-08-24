# @craftkit/storybook

Private workspace tooling for the single CraftKit component catalog. It discovers the colocated
`*.stories.tsx` and `*.docs.mdx` files owned by `@craftkit/ui`; it is not a product application and
must not own product routes or reusable runtime code.

## Commands

Build `@craftkit/ui` before running the catalog directly so the public stylesheet export exists. The
root Turbo graph handles this upstream dependency automatically.

```bash
pnpm --filter @craftkit/ui build
pnpm --filter @craftkit/storybook storybook
pnpm --filter @craftkit/storybook test:storybook
pnpm --filter @craftkit/storybook build-storybook
```

The browser test project runs stories in headless Playwright Chromium. Story interactions are
executed through the Storybook Vitest addon, and the global preview sets `a11y.test = 'error'`, so
detected accessibility violations fail the test rather than appearing as advisory output.

## Adding catalog content

Keep the implementation, local export, typed CSF story, authored MDX page, and behavior test
together in the owning component folder. The catalog only composes those package-owned artifacts; do
not duplicate component docs or stories here.
