import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createSiteBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  emptyDocument,
  siteFromDocument,
  type BlockRenderComponent,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { applyAiPlan } from './apply-plan';

/*
  A plan that turns the page Arabic — `setDocMeta {dir:'rtl'}`, exactly what the
  craft manual tells the model to emit — is rehearsed on a document kernel and
  accepted, then applied through the page lens the PRODUCT uses, where the site
  door refuses a page turning on its own. Seen live 2026-09-05 as
  "site/structural-violation" on Apply. The door must say it the site's way.
*/

const NullRender: BlockRenderComponent = () => null;

const blocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'direction-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({ title: z.string().default(''), lang: z.string().default('') }),
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

function lens() {
  const site = createSiteBuilder({
    site: siteFromDocument(emptyDocument('site', 'ltr')),
    extensions: [blocks],
    ports: { clock: fixedClock(1), ids: seededIds('dir') },
  });
  return { site, page: site.page(site.currentPage()) };
}

const ports = { clock: fixedClock(2), ids: seededIds('dir-ports') };
const policy = { allowedCommands: ['setDocMeta', 'setProp'], maxCommands: 4, maxOperations: 4 };

describe('applyAiPlan on a site kernel page lens', () => {
  it('turns the whole site when the plan turns the page, in one transaction', () => {
    const { site, page } = lens();
    const applied = applyAiPlan({
      kernel: page,
      validationPorts: ports,
      plan: {
        rationale: 'Arabic copy needs an rtl page.',
        commands: [
          { command: 'setDocMeta', args: { dir: 'rtl' } },
          { command: 'setProp', args: { id: 'root', key: 'lang', value: 'ar' } },
        ],
      },
      policy,
    });

    expect(applied.transactions).toHaveLength(1);
    expect(page.getDocument().dir).toBe('rtl');
    expect(site.getSite().dir).toBe('rtl');
    expect(page.getDocument().nodes['root']?.props['lang']).toBe('ar');
    expect(site.validate().ok).toBe(true);
    expect(site.transactions()).toHaveLength(1);
    expect(site.canUndo()).toBe(true);
  });

  it('is the only door that answers: a direct page-scoped turn is still refused by the site', () => {
    /*
      The recovery lives in applyAiPlan on purpose — the AI plan path is the
      one caller whose commands come from a model that cannot know the site
      exists. Moving the catch down into the lens would make `setDocMeta {dir}`
      mean something different through a page kernel than anywhere else, and
      this is the test that notices.
    */
    const { page } = lens();
    expect(() =>
      page.dispatchGroup([{ command: 'setDocMeta', args: { dir: 'rtl' } }], {
        author: 'ai',
        label: 'direct',
      }),
    ).toThrow(/setSiteDirection/);
    expect(page.getDocument().dir).toBe('ltr');
  });

  it('leaves a plan alone when it does not touch direction', () => {
    const { page } = lens();
    const applied = applyAiPlan({
      kernel: page,
      validationPorts: ports,
      plan: {
        rationale: 'Name the page.',
        commands: [{ command: 'setProp', args: { id: 'root', key: 'title', value: 'Home' } }],
      },
      policy,
    });
    expect(applied.transactions).toHaveLength(1);
    expect(page.getDocument().dir).toBe('ltr');
    expect(page.getDocument().nodes['root']?.props['title']).toBe('Home');
  });
});
