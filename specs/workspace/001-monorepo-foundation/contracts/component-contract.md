# Contract: Shared UI Component

## Public package surface

`@craftkit/ui` exposes the component only through its package root:

```ts
import { Button } from '@craftkit/ui';
import type { ButtonProps } from '@craftkit/ui';
```

Consumers may import the package stylesheet through `@craftkit/ui/styles.css`. Source-path
and component-folder deep imports are not supported.

## Button API

`ButtonProps` extends the native button contract and adds:

| Prop | Type | Default | Contract |
| --- | --- | --- | --- |
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'primary'` | Visual intent only; does not alter semantics |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | Controls hit-area/presentation |
| `loading` | `boolean` | `false` | Sets busy state and prevents duplicate activation |
| `fullWidth` | `boolean` | `false` | Fills available inline size |
| `loadingLabel` | `string` | `'Loading'` | Accessible loading text |

The component forwards its React 19 `ref` prop to the native `<button>`, defaults native
`type` to `button`, preserves consumer classes, and exposes no imperative component API.
When loading, it is disabled, carries `aria-busy="true"`, and retains an accessible name.

## Accessibility and behavior

- Native button keyboard behavior remains intact for Enter and Space.
- Disabled and loading buttons do not invoke the action callback.
- Focus indication is visible and not color-only.
- Variants meet the catalog's automated axe gate.
- Layout uses logical properties and is valid in LTR and RTL.
- The component does not fetch, access application state, or depend on a product theme.

## Required evidence

The delivery includes its five artifact files, package-level lint/types/tests/build,
Storybook static build, interaction play test, and a11y story test.
