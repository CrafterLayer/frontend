# `@craftkit/eslint-config`

Private ESLint 10 flat-config entrypoints:

- `@craftkit/eslint-config/base` — JavaScript plus type-aware strict TypeScript rules.
- `@craftkit/eslint-config/react` — stable React Hooks and refresh-boundary rules.
- `@craftkit/eslint-config/storybook` — current Storybook story guidance.

The root `eslint.config.mjs` composes these once for the entire workspace. Members use the
root config through normal ESLint ancestor discovery; do not copy plugin setup into each
package. Formatting remains Prettier's responsibility.
