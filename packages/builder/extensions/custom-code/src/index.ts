/*
  @craftkit/builder-custom-code — the assistant's free-composition block.

  One block, deliberately. Its value is not a component library; it is the
  ability to answer a request the catalog has no shape for while keeping the
  document validated, undoable, and renderable by the same paths as everything
  else.
*/
import {
  isCustomCodeJsMetaSchema,
  isCustomCodeJsParamsSchema,
  isCustomCodeTreeSchema,
  isCustomCssSchema,
  isCustomJsSchema,
} from '@craftkit/builder-schema';
import type { TrustedExtensionManifest } from '@craftkit/builder-schema';

import { CustomCodeBlock, customCodeSchema } from './CustomCodeBlock';
// Pure (no component): the scene settings' visibility rule rides in the manifest.
import { sceneParamsHidden } from './CustomCodeParamsField/scene-params';
// P2-tree-commands additions
import { treeNodeCommands } from './commands';
// end P2-tree-commands additions
// P9-design-system-ui additions
import { SymbolInstanceBlock, customCodeSymbolSchema } from './SymbolInstanceBlock';
// end P9-design-system-ui additions

export const builderCustomCode: TrustedExtensionManifest = {
  tier: 1,
  name: 'custom-code',
  version: '0.1.0',
  contributes: {
    blocks: [
      { schema: customCodeSchema, render: CustomCodeBlock },
      // P9-design-system-ui additions: symbol instances (style-manager DESIGN.md §G).
      { schema: customCodeSymbolSchema, render: SymbolInstanceBlock },
      // end P9-design-system-ui additions
    ],
    // P2-tree-commands additions: path-addressed element edits (style-manager
    // DESIGN.md §D.2) as page commands — one validated, labelled, undoable
    // write path for the panel, canvas, layers, clipboard and agent.
    commands: { ...treeNodeCommands },
    // end P2-tree-commands additions
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
      // Free-code mode (2026-10-09): a region's own script, found by the `customJs()` marker.
      {
        id: 'craftkit.custom-code.js',
        match: (schema) => (isCustomJsSchema(schema) ? 100 : 0),
        load: () =>
          import('./CustomCodeJsField/CustomCodeJsField').then((module) => ({
            default: module.default,
          })),
      },
      /*
        Pixi Studio (DESIGN D8), both by their markers. The scene settings edit
        `jsParams` against the spec beside them, so the row is handed its
        siblings; with no spec and no value there is nothing to tune and the
        row (and its section) is left out.
      */
      {
        id: 'craftkit.custom-code.script-params',
        match: (schema) => (isCustomCodeJsParamsSchema(schema) ? 100 : 0),
        siblings: true,
        hidden: sceneParamsHidden,
        load: () =>
          import('./CustomCodeParamsField/CustomCodeParamsField').then((module) => ({
            default: module.default,
          })),
      },
      /*
        `jsMeta` is the Studio's library reference and the param spec: it is
        written by the Studio and the agent, read by the scene settings, and
        never shown as fields — so it has no row, and no component to load.
      */
      {
        id: 'craftkit.custom-code.script-meta',
        match: (schema) => (isCustomCodeJsMetaSchema(schema) ? 100 : 0),
        hidden: true,
        load: () =>
          Promise.reject(new Error('The script library reference is written by the Studio.')),
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
// P2-tree-commands additions
export * from './commands';
// end P2-tree-commands additions
// P9-design-system-ui additions
export {
  SymbolInstanceBlock,
  customCodeSymbolSchema,
  type SymbolInstanceBlockProps,
} from './SymbolInstanceBlock';
// end P9-design-system-ui additions
