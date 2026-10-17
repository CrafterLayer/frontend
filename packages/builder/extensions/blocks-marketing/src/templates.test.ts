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

const ENGLISH_IDS = ['saas-launch', 'creative-agency', 'commerce-launch', 'professional-services'];

describe('professional marketing templates', () => {
  it('is valid Tier-2 data and keeps the four historical English ids, each with an Arabic twin', () => {
    const validation = validateTier2Manifest(marketingTemplates);
    expect(validation.ok).toBe(true);
    expect(marketingTemplates.version).toBe('2.0.0');

    const ids = (marketingTemplates.contributes?.compositions ?? []).map(
      (composition) => composition.id,
    );
    for (const id of ENGLISH_IDS) {
      expect(ids, id).toContain(id);
      expect(ids, `${id}-ar`).toContain(`${id}-ar`);
    }
    expect(ids.slice(0, 8)).toEqual(ENGLISH_IDS.flatMap((id) => [id, `${id}-ar`]));
    expect(
      (marketingTemplates.contributes?.compositions ?? []).every(
        (composition) => Object.keys(composition.nodes).length >= 20,
      ),
    ).toBe(true);
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

  it('frames every page with registered chrome and covers the major marketing jobs', () => {
    const usedTypes = new Set(
      (marketingTemplates.contributes?.compositions ?? []).flatMap((composition) =>
        Object.values(composition.nodes).map((node) => node.type),
      ),
    );

    for (const type of [
      'pageHeader',
      'navLinks',
      'pageFooter',
      'richText',
      'announcementBar',
      'promoBanner',
      'hero',
      'image',
      'logoCloud',
      'features',
      'bento-grid',
      'content-section',
      'stats',
      'processSteps',
      'team',
      'portfolioGrid',
      'productGrid',
      'testimonials',
      'comparisonTable',
      'faq',
      'blogGrid',
      'contact',
      'formSection',
      'newsletter',
      'cta',
    ]) {
      expect(usedTypes, type).toContain(type);
    }
  });
});
