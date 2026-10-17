# `@craftkit/typescript-config`

Private, strict TypeScript configuration entrypoints for workspace members:

- `@craftkit/typescript-config/base.json` — shared language and correctness rules.
- `@craftkit/typescript-config/node.json` — Node ESM tooling.
- `@craftkit/typescript-config/react-library.json` — React 19 libraries.
- `@craftkit/typescript-config/storybook.json` — central catalog and browser tests.

Members extend the closest entrypoint and add only member-specific includes, paths, output, or
framework requirements. Relaxing a strict flag requires a documented owning-member reason; do not
fork these files into apps.
