# @craftkit/ui

Private, domain-agnostic React primitives for CraftKit applications. The package exposes only its
documented root API and stylesheet; source-path deep imports are unsupported.

## Public API

```tsx
import { Button } from '@craftkit/ui';
import type { ButtonProps } from '@craftkit/ui';
import '@craftkit/ui/styles.css';
```

Every component is owned by one folder under `src/components/` and ships atomically with its
implementation, local export, typed Storybook story, authored MDX guide, and behavior test. Add
support files only when they own a real responsibility.

## Package commands

```bash
pnpm --filter @craftkit/ui lint
pnpm --filter @craftkit/ui typecheck
pnpm --filter @craftkit/ui test
pnpm --filter @craftkit/ui test:coverage
pnpm --filter @craftkit/ui build
```

`build` produces the ESM entrypoint, declarations, source maps, and `dist/styles.css`. Use the
central `@craftkit/storybook` member for visual, interaction, and accessibility review.
