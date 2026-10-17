import {
  createBuilder,
  createSiteBuilder,
  defineBlockSchema,
  type BuilderKernel,
  type BuilderSiteKernel,
} from '@craftkit/builder';

import { fivePageSite, fixedClock, seededIds } from '@craftkit/builder/testing';
import { z } from 'zod';

/**
 * A kernel for the UX audit, and nothing else.
 *
 * Its own file because a `.stories.tsx` may only export stories, and because a
 * panel audited from a hand-written approximation of itself proves nothing
 * about the panel — the audit needs the REAL component, which needs a real
 * kernel.
 */
const Null = () => null;

const page = defineBlockSchema({
  type: 'page',
  description: 'The page root.',
  props: z.object({}),
  slots: { default: { allow: ['hero'], max: 4 } },
  examples: [],
});

const hero = defineBlockSchema({
  type: 'hero',
  description: 'An opening section.',
  props: z.object({ heading: z.string().default('Your headline') }),
  examples: [],
});

export function auditKernel(): BuilderKernel {
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: {
        root: { id: 'root', type: 'page', props: {}, slots: { default: ['hero1'] } },
        hero1: { id: 'hero1', type: 'hero', props: { heading: 'A ceramics studio' } },
      },
    },
    extensions: [
      {
        tier: 1,
        name: 'ux-audit.vocabulary',
        version: '0.0.0',
        contributes: {
          blocks: [
            { schema: page, render: Null },
            { schema: hero, render: Null },
          ],
        },
      },
    ],
    ports: { clock: fixedClock(), ids: seededIds('audit') },
  });
}

/** A site with five pages, for auditing the page navigator. */
export function auditSiteKernel(): BuilderSiteKernel {
  return createSiteBuilder({
    site: fivePageSite(),
    ports: { clock: fixedClock(), ids: seededIds('audit-site') },
  });
}
