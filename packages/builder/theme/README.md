# @craftkit/builder-theme

The builder's **chrome** design system: every colour, space, radius, type step and shell measurement
the editor's interface reads, defined once and overridable at runtime.

Layer 2 of the builder dependency law (ADR 0003), with **zero runtime dependencies**. Headless — it
is data plus one generated stylesheet.

## Chrome is not content

Two theming systems live in this repo and they are deliberately separate:

|             | themes                     | owned by                     |
| ----------- | -------------------------- | ---------------------------- |
| **Chrome**  | the editor around the page | this package (`--bldr-*`)    |
| **Content** | the page being edited      | `@craftkit/builder-renderer` |

An author editing a dark website must not be forced into a dark editor, and a dark editor must never
repaint their light page. The canvas therefore always shows the page in the page's own theme.

## The defect this package closed

Before it, twenty stylesheets read `var(--bldr-selection, #4f46e5)` and **nothing anywhere defined
`--bldr-selection`.** Every component ran on its fallback; two files disagreed about what
`--bldr-accent` fell back to; theming was impossible because there was no set of names to re-point.

A fallback looks exactly like a theme until you try to change one, which is why the fix is not "add
a stylesheet" but a **checked contract**:

- `contract.ts` lists every token as a closed union, so a theme that forgets one fails
  **typecheck**;
- the stylesheet is **generated** from the themes, and a test fails if the checked-in file drifts;
- `coverage.test.ts` walks the workspace, extracts every `--bldr-…` any source reads, and fails on
  the first one the contract does not carry — with a non-vacuous guard, so an empty scan cannot
  pass.

## Using it

An application that imports only `@craftkit/builder` already has the tokens; the preset imports
them. For a stylesheet-only host (Storybook's preview, a test harness):

```ts
import '@craftkit/builder/css';
```

### Overriding — the point of the package

Overriding is a **runtime** act. Name only what changes; everything else keeps cascading:

```tsx
import { themeStyle } from '@craftkit/builder';

<div style={themeStyle({ accent: '#0f766e', 'accent-soft': '#ccfbf1' })}>
  <Builder … />
</div>;
```

Because custom properties cascade, overriding on **any** ancestor re-themes everything beneath it —
including floating chrome portalled into the host document, which a class-based approach would miss.

Attribute switches are available for the two prepared axes, and they are independent: a host may run
the dark theme comfortably or the light theme tight.

```html
<html data-bldr-theme="dark" data-bldr-density="compact"></html>
```

`data-bldr-theme` is absent by default, which is the "follow the operating system" state. The
stylesheet handles all three states — the bare `:root` carries the complete light palette, the media
query is guarded with `:not([data-bldr-theme='light'])` so an explicit light choice beats a dark OS,
and both attribute selectors restate the palettes so the switch wins in either direction. Each state
also sets `color-scheme`, so native checkboxes, radios, selects, scrollbars, and other user-agent
widgets use the same light or dark palette as the editor chrome.

## Layout, and why the shell is measured here

`tokens/layout.ts` declares the width of every band of the editor — rail, panel, inspector,
assistant, top bar, status bar, dock — plus the space, radius and type scales. A workspace tool is
judged on how little screen it wastes, and waste creeps in when each panel picks its own padding.
Two densities ship: `comfortable` (the default) and `compact`, which gives a 13-inch screen more
canvas rather than a smaller copy of everything.

The space scale is a **4px** rhythm, not 8px: a dense tool needs the odd 4, 12 and 20 to keep a 28px
control from carrying 16px of air on each side.

## Primitives and semantics

`tokens/primitives.ts` holds the ramps — which violet. `contract.ts` holds the semantics — what that
violet is _for_. Components read only the semantic names, which is what lets one theme decision move
every label at once. A token named after a component (`--bldr-inspector-label`) would defeat that,
so there are none.

## Development

```bash
pnpm --filter @craftkit/builder-theme lint
pnpm --filter @craftkit/builder-theme typecheck
pnpm --filter @craftkit/builder-theme test

# after changing a token or a theme:
UPDATE_THEME_CSS=1 pnpm --filter @craftkit/builder-theme test
```
