import type { AiContextReadApi } from '@craftkit/builder-schema';

import type { AiTemplateContext } from '../types';

/**
 * The page templates a run is offered. A template written in the other direction (an Arabic
 * page for an English one) is left out: the model should not apply it, and listing both
 * languages of every template doubled the list each request pays for (2026-10-13: 30 → 15).
 */
export function collectTemplates(
  ctx: AiContextReadApi,
  full: boolean,
): readonly AiTemplateContext[] {
  const { dir } = ctx.store.getState().doc;
  return ctx.registry
    .compositions(ctx.surface)
    .filter((composition) => composition.dir === undefined || composition.dir === dir)
    .map((composition) => ({
      id: composition.id,
      name: composition.name,
      rootType: composition.rootType,
      nodeCount: composition.nodeCount,
      // A model without the catalog cannot author them.
      ...(full ? { blockTypes: [...composition.blockTypes] } : {}),
    }));
}
