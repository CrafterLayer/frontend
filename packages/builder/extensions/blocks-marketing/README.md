# `@craftkit/builder-blocks-marketing`

CraftKit's production marketing vocabulary: 32 responsive block types plus four original,
ready-to-insert landing-page templates. The package ships executable block schemas and renderers as
the trusted tier-1 `blocksMarketing` manifest; reusable page compositions ship separately as the
JSON-pure tier-2 `marketingTemplates` manifest.

Normative source:
[`specs/workspace/013-ai-full-site-design-agent`](../../../../specs/workspace/013-ai-full-site-design-agent/plan.md).
This remains a layer-4 extension: it depends on `@craftkit/builder-schema`, never on an application
or another extension.

## Block vocabulary

| Family                    | Registered types                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| Page chrome               | `pageHeader`, `pageFooter`, `navLinks`                                                     |
| Layout and media          | `stack`, `grid`, `image`, `richText`, `gallery`, `videoSection`                            |
| Opening, motion and trust | `announcementBar`, `promoBanner`, `hero`, `carousel`, `logoCloud`, `stats`, `testimonials` |
| Product story             | `features`, `bento-grid`, `content-section`, `processSteps`, `team`                        |
| Work and commerce         | `portfolioGrid`, `productGrid`                                                             |
| Conversion                | `pricing`, `pricingPlan`, `comparisonTable`, `cta`, `newsletter`, `formSection`            |
| Education and contact     | `faq`, `blogGrid`, `contact`                                                               |
| Data                      | `table` (semantic rows and columns), `chart` (script-free SVG bar, line, area, pie, donut) |

Every new component owns its implementation, zod schema, AI-ready examples, local export,
behavior-focused test, Storybook story, and MDX documentation. Section schemas expose explicit
content/design/advanced inspector groups and preserve optional/no-default compatibility for shared
typography and spacing controls.

## Ready templates

`marketingTemplates` contributes four original compositions inspired by the information architecture
of professional Tailwind marketing pages, without copying paid template code:

- `saas-launch` — product-led SaaS page.
- `creative-agency` — studio and portfolio page with case studies and editorial gallery.
- `commerce-launch` — editorial commerce launch with a featured product grid and promotional banner,
  available to `site` and `store` surfaces.
- `professional-services` — consulting and services page with a configurable enquiry form.

Each composition contains at least nine coherent sections, validates against the live block registry
before insertion, lands through one `insertComposition` transaction, and undoes in one step.

```ts
import { blocksMarketing, marketingTemplates } from '@craftkit/builder-blocks-marketing';
import { createBuilder } from '@craftkit/builder-core';

const kernel = createBuilder({ extensions: [blocksMarketing] });
kernel.extensions.hydrateDeclarative(marketingTemplates);
```

## Styling and safety

- Renderers use token-bound Tailwind utilities backed by `--t-*`; blocks do not name palette colors
  or store pixel/hex values in documents.
- Container-query layouts, logical properties, and direction-neutral spacing make the same block
  responsive and RTL-safe.
- Motion uses the closed, tokenized motion vocabulary and respects reduced-motion preferences.
- Links and form actions reject unsafe schemes such as `javascript:` at the schema door.
- Optional slots do not leak editing placeholders into a published or visually complete section.

## Development

```bash
pnpm --filter @craftkit/builder-blocks-marketing lint
pnpm --filter @craftkit/builder-blocks-marketing typecheck
pnpm --filter @craftkit/builder-blocks-marketing test
```

Stories render in the workspace Storybook with accessibility checks enabled at error level.
