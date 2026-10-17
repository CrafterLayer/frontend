import { z } from 'zod';

import {
  defineBlockSchema,
  libraryIdSchema,
  SYMBOL_INSTANCE_BLOCK_TYPE,
  symbolOverridesSchema,
} from '@craftkit/builder-schema';

/**
 * An INSTANCE of a site symbol (style-manager DESIGN.md §G "Components /
 * symbols").
 *
 * The master tree lives once in the site library (`library.symbols[id]`);
 * an instance stores only which symbol it shows and what it changes. Editing
 * the master updates every instance; an instance's overrides (text, classes,
 * attributes, addressed by path inside the master) survive that edit, and an
 * override whose path no longer resolves is skipped rather than misapplied.
 *
 * Rendered through the same custom-code renderer as a region, on the canvas
 * and in the export, from `SiteDesignContext` — the instance carries no copy
 * of the master to drift out of date.
 */
export const customCodeSymbolSchema = defineBlockSchema({
  type: SYMBOL_INSTANCE_BLOCK_TYPE,
  description:
    'An instance of a reusable site symbol (a component defined once in the site design library). `symbolId` names the symbol; `overrides` change this instance only: `{path, text?, className?, attributes?}` where `path` is child indices inside the symbol tree. Editing the symbol updates every instance. Only place one for a symbol id the site library already holds; to change the shared design, edit the symbol, not the instance.',
  props: z.object({
    /** The Layers name of this instance. */
    label: z.string().max(80).default('Symbol'),
    symbolId: libraryIdSchema,
    overrides: symbolOverridesSchema.default([]),
  }),
  propertyGroups: {
    label: { tab: 'content', section: 'Identity' },
    symbolId: { tab: 'content', section: 'Symbol' },
    overrides: { tab: 'advanced', section: 'Overrides' },
  },
  examples: [],
});

export type SymbolInstanceBlockProps = z.output<typeof customCodeSymbolSchema.props>;
