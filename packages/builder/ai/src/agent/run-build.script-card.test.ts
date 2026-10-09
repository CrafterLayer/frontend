import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { SCRIPT_CARD } from '../script/api-card';
import { sectionKit } from '../section-kit';
import { createCraftkitAiSkillRegistry } from '../skills';
import type { AiPlan, AiPlanProvider, PagePlanCandidate } from '../types';
import { runAiBuild } from './index';
import { kitHasLongList, sectionScriptCard } from './section-script-card';

/*
  agent-script DESIGN §A.11 (script-wiring): a kit-backed section writer is
  shown the EDIT SCRIPT card only when its section is bulk — by its own words
  (`prefersScript`) or because its kit has a list of 6 or more. Every other
  writer's brief is unchanged, so the card costs nothing there.
*/

const QUIET = { title: 'Why us', purpose: 'Why we roast at home.', mustSay: [] as string[] };
const BULK = { title: 'Our menu', purpose: 'All 12 dishes with their prices.', mustSay: [] as string[] };

describe('sectionScriptCard', () => {
  it('reads a long list off the kit: features-list (8) yes, features-lead (4) no', () => {
    expect(kitHasLongList(sectionKit('features-list'))).toBe(true);
    expect(kitHasLongList(sectionKit('features-lead'))).toBe(false);
    expect(kitHasLongList(undefined)).toBe(false);
  });

  it('adds the card for bulk words or a long-list kit, and nothing otherwise', () => {
    expect(sectionScriptCard(QUIET, sectionKit('features-lead'))).toEqual([]);
    expect(sectionScriptCard(BULK, sectionKit('features-lead'))).toEqual(['', SCRIPT_CARD]);
    expect(sectionScriptCard(QUIET, sectionKit('features-list'))).toEqual(['', SCRIPT_CARD]);
    expect(
      sectionScriptCard({ title: 'الفريق', purpose: 'كل البطاقات بصور الفريق.', mustSay: [] }, undefined),
    ).toEqual(['', SCRIPT_CARD]);
  });
});

const NullRender: BlockRenderComponent = () => null;

function manifest(): TrustedExtensionManifest {
  return {
    tier: 1,
    name: 'script-card-build-fixture',
    version: '0.0.0',
    contributes: {
      blocks: [
        {
          schema: defineBlockSchema({
            type: 'page',
            description: 'The page root.',
            props: z.object({
              title: z.string().max(120).default(''),
              description: z.string().max(200).default(''),
              lang: z.string().max(12).default(''),
              slug: z.string().max(120).default(''),
              pageCss: customCss(20_000),
            }),
            slots: { default: { allow: ['customCode'] } },
            examples: [],
          }),
          render: NullRender,
        },
        {
          schema: defineBlockSchema({
            type: 'customCode',
            description: 'A freely composed region.',
            props: z.object({
              label: z.string().max(80).default('Custom section'),
              tree: customCodeTree().default(emptyCustomCodeTree()),
              css: customCss(8_000),
            }),
            examples: [],
          }),
          render: NullRender,
        },
      ],
    },
  };
}

function kernel(): BuilderKernel {
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: [] } } },
  };
  return createBuilder({
    document,
    extensions: [manifest()],
    ports: { clock: { now: () => 1 }, ids: seededIds('script-card') },
  });
}

function pagePlan(): PagePlanCandidate {
  return {
    intent: 'replace',
    locale: { lang: 'en' },
    title: 'Brew — a coffee roaster in Amman',
    description: 'Specialty coffee roasted in Amman.',
    tokens: {
      bg: 'white',
      surface: 'stone-50',
      ink: 'stone-900',
      muted: 'stone-600',
      accent: 'orange-700',
      onAccent: 'white',
      border: 'stone-200',
      fontDisplay: { family: 'Fraunces' },
      fontBody: { family: 'Manrope', weights: [400, 700] },
      radius: 'xl',
      signature: 'warm photos',
    },
    primaryCta: { label: 'Order now', href: '#menu' },
    sections: [
      { key: 'header', role: 'header', title: 'Header', anchorId: 'top', purpose: 'The brand.' },
      { key: 'hero', role: 'hero', title: 'Fresh coffee from Amman', anchorId: 'hero', purpose: 'What the roaster is.' },
      { key: 'why', role: 'band', title: QUIET.title, anchorId: 'why', purpose: QUIET.purpose, kit: 'features-lead' },
      { key: 'menu', role: 'band', title: BULK.title, anchorId: 'menu', purpose: BULK.purpose, kit: 'features-lead' },
      { key: 'offer', role: 'band', title: 'What we offer', anchorId: 'offer', purpose: 'What we offer.', kit: 'features-list' },
      { key: 'footer', role: 'footer', title: 'Footer', anchorId: 'footer', purpose: 'The address.' },
    ],
    facts: [],
  };
}

function regionIdOf(request: string): string {
  return /REGION ID: (\S+)/u.exec(request)?.[1] ?? 'missing';
}

function anchorOf(request: string): string {
  return /ANCHOR:[^\n]*id="([^"]+)"/u.exec(request)?.[1] ?? 'missing';
}

/** Every writer answers with plain markup; only its brief is under test. */
function markup(request: string): AiPlan {
  const title = /SECTION \d+ OF \d+: ([^\n]+)/u.exec(request)?.[1] ?? 'Section';
  return {
    rationale: 'write the section',
    commands: [
      {
        command: 'setProp',
        args: {
          id: regionIdOf(request),
          key: 'tree',
          value: `<section id='${anchorOf(request)}' class='py-16'><h2>${title}</h2><p>${title}.</p></section>`,
        },
      },
    ],
  };
}

describe('runAiBuild — the card in a kit writer’s brief', () => {
  it('reaches the bulk sections’ writers only', async () => {
    const requests: string[] = [];
    const provider: AiPlanProvider = {
      propose(request) {
        requests.push(request);
        return Promise.resolve(markup(request));
      },
      proposePagePlan() {
        return Promise.resolve({ pagePlan: pagePlan(), rationale: 'A warm roaster page.' });
      },
    };
    await runAiBuild({
      runId: 'script-card',
      clock: { now: () => 1 },
      kernel: kernel(),
      provider,
      request: 'Design a page for a coffee roaster in Amman',
      validationPorts: { clock: { now: () => 1 }, ids: seededIds('script-card-door') },
      skillRegistry: createCraftkitAiSkillRegistry(),
      target: 'replace',
      fillConcurrency: 1,
    });

    const briefOf = (title: string): string | undefined =>
      requests.find(
        (request) =>
          request.includes('ANSWER with ONE tool step') &&
          new RegExp(`SECTION \\d+ OF \\d+: ${title}\\n`, 'u').test(request),
      );
    const quiet = briefOf(QUIET.title);
    const bulk = briefOf(BULK.title);
    const longList = briefOf('What we offer');
    expect(quiet).toBeDefined();
    expect(bulk).toBeDefined();
    expect(longList).toBeDefined();
    expect(quiet).not.toContain(SCRIPT_CARD);
    expect(bulk).toContain(SCRIPT_CARD);
    expect(longList).toContain(SCRIPT_CARD);
    // After the section lane's tool list, before the answer line.
    const at = bulk?.indexOf(SCRIPT_CARD) ?? -1;
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(bulk?.indexOf('ANSWER with ONE tool step') ?? -1);
  });
});
