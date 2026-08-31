import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createBuilder, insertedNodeId } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  validateTier2Manifest,
  type BlockRenderComponent,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { blocksMarketing } from './index';
import { marketingTemplates } from './templates';

const NullRender: BlockRenderComponent = () => null;
const templateHost: TrustedExtensionManifest = {
  tier: 1,
  name: 'marketing-template-host',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Template test page.',
          props: z.object({}),
          slots: { default: { allow: ['stack'] } },
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

function templateKernel() {
  const kernel = createBuilder({
    extensions: [templateHost, blocksMarketing],
    ports: { clock: fixedClock(), ids: seededIds('template') },
  });
  kernel.extensions.hydrateDeclarative(marketingTemplates);
  return kernel;
}

describe('professional marketing templates', () => {
  it('is valid Tier-2 data and exposes four original responsive page compositions', () => {
    const validation = validateTier2Manifest(marketingTemplates);
    expect(validation.ok).toBe(true);

    const compositions = marketingTemplates.contributes?.compositions ?? [];
    expect(compositions.map((composition) => composition.id)).toEqual([
      'saas-launch',
      'creative-agency',
      'commerce-launch',
      'professional-services',
    ]);
    expect(compositions.every((composition) => Object.keys(composition.nodes).length >= 9)).toBe(
      true,
    );
  });

  it('inserts every template through one transaction, validates it, and undoes it exactly', () => {
    for (const composition of marketingTemplates.contributes?.compositions ?? []) {
      const kernel = templateKernel();
      const before = structuredClone(kernel.getDocument());
      const tx = kernel.dispatch('insertComposition', {
        compositionId: composition.id,
        parentId: 'root',
      });

      expect(insertedNodeId(tx.patches), composition.id).toBeDefined();
      expect(kernel.transactions(), composition.id).toHaveLength(1);
      expect(kernel.validate(), composition.id).toEqual([]);
      expect(kernel.undo(), composition.id).toBe(true);
      expect(kernel.getDocument(), composition.id).toEqual(before);
    }
  });

  it('covers every major marketing job with at least one ready composition', () => {
    const usedTypes = new Set(
      (marketingTemplates.contributes?.compositions ?? []).flatMap((composition) =>
        Object.values(composition.nodes).map((node) => node.type),
      ),
    );

    for (const type of [
      'announcementBar',
      'hero',
      'logoCloud',
      'features',
      'bento-grid',
      'content-section',
      'stats',
      'processSteps',
      'team',
      'testimonials',
      'comparisonTable',
      'faq',
      'blogGrid',
      'contact',
      'newsletter',
      'cta',
    ]) {
      expect(usedTypes, type).toContain(type);
    }
  });
});
