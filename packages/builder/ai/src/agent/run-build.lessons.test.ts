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
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { createCraftkitAiSkillRegistry } from '../skills';
import type {
  AiPlan,
  AiPlanProvider,
  AiPlanValidationIssue,
  AssembledAiContext,
  PagePlanCandidate,
} from '../types';
import { BUILD_LESSONS_PROVIDER_ID, buildLessonsOf } from './build-lessons';
import { validatePagePlan } from './page-plan/validate-page-plan';
import { runAiBuild } from './run-build';

/*
  Build lessons in a real build (2026-10-13): the writers of one page learn from each other. A
  scripted writer makes the same mistake in every section that is not the hero — lorem ipsum
  where finished copy belongs — until a "Lessons from this build so far" fragment names it.
  Sections are written one after another, so each writer starts after the one before it landed.
  (The mistake was an h1 in a band until code learned to fix that before the check, tidy-section.ts:
  a lesson is only ever needed for what the writer alone can repair.)
*/

const NullRender: BlockRenderComponent = () => null;

function kernel(): BuilderKernel {
  const manifest: TrustedExtensionManifest = {
    tier: 1,
    name: 'lessons-build-fixture',
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
              js: z.string().max(32_000).default(''),
            }),
            examples: [],
          }),
          render: NullRender,
        },
      ],
    },
  };
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: { root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: [] } } },
  };
  return createBuilder({
    document,
    extensions: [manifest],
    ports: { clock: { now: () => 1 }, ids: seededIds('lessons-build') },
  });
}

const PLAN: PagePlanCandidate = {
  intent: 'replace',
  locale: { lang: 'en' },
  title: 'Northlight Coffee | Amman roastery',
  description: 'Specialty coffee roasted in Amman every morning.',
  tokens: {
    bg: 'stone-50',
    surface: 'white',
    ink: 'stone-900',
    muted: 'stone-600',
    accent: 'emerald-800',
    onAccent: 'white',
    border: '#e7e5e4',
    fontDisplay: { family: 'Archivo Black' },
    fontBody: { family: 'Archivo', weights: [400, 600] },
    radius: 'md',
    signature: 'one oversized origin name per section',
  },
  primaryCta: { label: 'Order beans', href: '#order' },
  sections: [
    { key: 'header', role: 'header', title: 'Header', anchorId: 'top', purpose: 'Brand.' },
    {
      key: 'hero',
      role: 'hero',
      title: 'Roasted this morning',
      anchorId: 'hero',
      purpose: 'Say what the roastery is.',
    },
    { key: 'origins', role: 'band', title: 'Our origins', anchorId: 'origins', purpose: 'Farms.' },
    { key: 'menu', role: 'band', title: 'The menu', anchorId: 'menu', purpose: 'Drinks.' },
    { key: 'story', role: 'band', title: 'Our story', anchorId: 'story', purpose: 'History.' },
    { key: 'order', role: 'cta', title: 'Order today', anchorId: 'order', purpose: 'Order.' },
    { key: 'footer', role: 'footer', title: 'Footer', anchorId: 'footer', purpose: 'Hours.' },
  ],
};

/** A section that honours its contract — save for its copy, lorem ipsum when it `slips`. */
function section(request: string, slips: boolean): CustomCodeRoot {
  const anchor = /ANCHOR:[^\n]*id="([^"]+)"/u.exec(request)?.[1] ?? 'missing';
  const title = /SECTION \d+ OF \d+: ([^\n]+)/u.exec(request)?.[1] ?? 'Section';
  const action = /PRIMARY ACTION: "([^"]+)" → (\S+)/u.exec(request);
  const cta = (request.includes('ROLE: HERO') || request.includes('ROLE: CTA')) && action !== null;
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        attributes: { id: anchor },
        className: 'py-16',
        children: [
          {
            kind: 'element',
            tag: request.includes('ROLE: HERO') ? 'h1' : 'h2',
            text: title,
            children: [],
          },
          {
            kind: 'element',
            tag: 'p',
            text: slips ? 'Lorem ipsum dolor sit amet.' : 'Roasted in small batches.',
            children: [],
          },
          ...(cta
            ? [
                {
                  kind: 'element' as const,
                  tag: 'a' as const,
                  className: 'ck-btn',
                  attributes: { href: action[2] ?? '#' },
                  text: action[1] ?? '',
                  children: [],
                },
              ]
            : []),
        ],
      },
    ],
  };
}

interface Write {
  readonly title: string;
  /** The lessons fragment this writer was handed, if any. */
  readonly lessons: string | undefined;
}

/**
 * The writer: lorem ipsum in every section unless it is the hero — until it reads the lesson
 * (`learns`). Its repair answers with finished copy, unless `repairFixes` is false.
 */
function scripted(options: { readonly learns: boolean; readonly repairFixes?: boolean }) {
  const repairs: (readonly AiPlanValidationIssue[])[] = [];
  const writes: Write[] = [];
  const answer = (request: string, slips: boolean): AiPlan => {
    const id = /REGION ID: (\S+)/u.exec(request)?.[1] ?? 'missing';
    return {
      rationale: 'filled',
      commands: [{ command: 'setProp', args: { id, key: 'tree', value: section(request, slips) } }],
    };
  };
  const lessonsIn = (context: AssembledAiContext): string | undefined =>
    context.fragments.find(({ source }) => source === BUILD_LESSONS_PROVIDER_ID)?.body;
  const provider: AiPlanProvider = {
    propose(request, context) {
      const lessons = lessonsIn(context);
      writes.push({ title: /SECTION \d+ OF \d+: ([^\n]+)/u.exec(request)?.[1] ?? '?', lessons });
      const hero = request.includes('ROLE: HERO');
      const learned = options.learns && lessons?.includes('placeholder-left:') === true;
      return Promise.resolve(answer(request, !hero && !learned));
    },
    repair(request, _context, _plan, issues) {
      repairs.push(issues);
      return Promise.resolve(answer(request, options.repairFixes === false));
    },
    proposePagePlan: () => {
      const checked = validatePagePlan(PLAN);
      if (!checked.ok) throw new Error(checked.issues.map(({ message }) => message).join('\n'));
      return Promise.resolve({ pagePlan: PLAN, rationale: 'A roastery.' });
    },
  };
  return { provider, repairs, writes };
}

function build(provider: AiPlanProvider, runId: string) {
  return {
    runId,
    clock: { now: () => 1 },
    kernel: kernel(),
    provider,
    request: 'Build a landing page for my specialty coffee roastery in Amman',
    validationPorts: { clock: { now: () => 1 }, ids: seededIds(`${runId}-door`) },
    skillRegistry: createCraftkitAiSkillRegistry(),
    // One writer at a time: each section starts after the one before it landed.
    fillConcurrency: 1,
  };
}

function copyRepairs(repairs: readonly (readonly AiPlanValidationIssue[])[]): number {
  return repairs.filter((issues) =>
    issues.some(({ message }) => message.startsWith('placeholder-left:')),
  ).length;
}

describe('runAiBuild — build lessons (2026-10-13)', () => {
  it('spares the later writers the repair the first one needed', async () => {
    // The control: a writer that never reads the lesson repeats the mistake in every section.
    const deaf = scripted({ learns: false });
    const control = await runAiBuild(build(deaf.provider, 'lessons-control'));
    expect(control.outcome).toBe('completed');
    expect(copyRepairs(deaf.repairs)).toBe(4);

    const pupil = scripted({ learns: true });
    const options = build(pupil.provider, 'lessons-taught');
    const result = await runAiBuild(options);

    expect(result.outcome).toBe('completed');
    // The first band's writer made the mistake and was repaired; nobody after it did.
    expect(copyRepairs(pupil.repairs)).toBe(1);
    expect(pupil.repairs).toHaveLength(1);
    const repaired = result.tasks.filter(({ check }) => check?.repaired === true);
    expect(repaired.map(({ sectionKey }) => sectionKey)).toEqual(['origins']);
    expect(result.tasks.every(({ check }) => (check?.issues ?? []).length === 0)).toBe(true);
    expect(buildLessonsOf(options)).toEqual([
      "placeholder-left: write finished, realistic copy — never XXX, 0000, lorem or a field's name",
    ]);
  });

  it('hands the lessons only to writers that start after a repair FIXED something', async () => {
    const pupil = scripted({ learns: true });
    await runAiBuild(build(pupil.provider, 'lessons-order'));

    // The header and footer are written by the skeleton itself: five writers, in page order.
    expect(pupil.writes.map(({ title, lessons }) => [title, lessons !== undefined])).toEqual([
      ['Roasted this morning', false],
      ['Our origins', false],
      ['The menu', true],
      ['Our story', true],
      ['Order today', true],
    ]);
    expect(pupil.writes[2]?.lessons).toBe(
      [
        'Earlier sections of THIS page were sent back for these and fixed in their repair round. Get them right the first time:',
        "- placeholder-left: write finished, realistic copy — never XXX, 0000, lorem or a field's name",
      ].join('\n'),
    );

    // A repair that fixes nothing teaches nothing: no writer is ever handed a lesson.
    const stubborn = scripted({ learns: true, repairFixes: false });
    const options = build(stubborn.provider, 'lessons-unfixed');
    await runAiBuild(options);
    expect(stubborn.writes.every(({ lessons }) => lessons === undefined)).toBe(true);
    expect(copyRepairs(stubborn.repairs)).toBe(4);
    expect(buildLessonsOf(options)).toEqual([]);
  });

  it('starts every build with no lessons, even one run on a reused options object', async () => {
    const pupil = scripted({ learns: true });
    const options = build(pupil.provider, 'lessons-first');
    await runAiBuild(options);
    expect(buildLessonsOf(options)).toHaveLength(1);
    // The same object, run again as another build: a new run id is a new memory.
    const second = scripted({ learns: true });
    Object.assign(options, {
      runId: 'lessons-second',
      kernel: kernel(),
      provider: second.provider,
    });
    await runAiBuild(options);
    expect(second.writes[0]?.lessons).toBeUndefined();
    expect(copyRepairs(second.repairs)).toBe(1);
  });
});
