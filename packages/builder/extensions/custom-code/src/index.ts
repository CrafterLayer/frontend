/*
  @craftkit/builder-custom-code — the assistant's free-composition block.

  One block, deliberately. Its value is not a component library; it is the
  ability to answer a request the catalog has no shape for while keeping the
  document validated, undoable, and renderable by the same paths as everything
  else.
*/
import { isCustomCodeTreeSchema, isCustomCssSchema } from '@craftkit/builder-schema';
import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import { CustomCodeBlock, customCodeSchema } from './CustomCodeBlock';

export const builderCustomCode: TrustedExtensionManifest = {
  tier: 1,
  name: 'custom-code',
  version: '0.1.0',
  contributes: {
    blocks: [{ schema: customCodeSchema, render: CustomCodeBlock }],
    /*
      Both controls match on a DECLARATION, never on a property name — the rule
      `richText()` established. `pageCss` on the page root is not this pack's
      prop and is not named `css`, and it still resolves to the CSS control,
      because what it shares is the marker.

      Lazily loaded: an Inspector session that never selects a composed region
      pays nothing for either editor.
    */
    fieldTypes: [
      {
        id: 'craftkit.custom-code.tree',
        match: (schema) => (isCustomCodeTreeSchema(schema) ? 100 : 0),
        load: () =>
          import('./CustomCodeTreeField/CustomCodeTreeField').then((module) => ({
            default: module.default,
          })),
      },
      {
        id: 'craftkit.custom-code.css',
        match: (schema) => (isCustomCssSchema(schema) ? 100 : 0),
        load: () =>
          import('./CustomCodeCssField/CustomCodeCssField').then((module) => ({
            default: module.default,
          })),
      },
    ],
  },
};

export {
  CustomCodeBlock,
  customCodeSchema,
  findCssRejection,
  scopeCustomCodeCss,
  type CssRejection,
  type CustomCodeBlockProps,
  type CustomCodeCssPolicy,
} from './CustomCodeBlock';
