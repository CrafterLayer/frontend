import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCodeJsMeta,
  customCodeJsParams,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type CustomCodeRoot,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { scenePreset } from '../scene-presets/catalog';
import { revertBuildSection, AiBuildRevertError } from './build-revert';
import { createCraftkitAiSkillRegistry } from '../skills';
import type { AiPlan, AiPlanProvider, PagePlanCandidate } from '../types';
import { DEFAULT_AI_BUILD_SCENE_INIT_TIMEOUT_MS, runAiBuild } from './run-build';

/*
  Ready scenes in a real build (2026-10-13): the owner's murals failed on time — the mural's
  writer wrote its whole scene by hand, ran past its deadline, and the retry started the same
  write again. A mural writer is now handed the ready scenes that fit its brief and may name
  one (`@preset:<id>`); the build puts the tested code in. A writer whose first attempt failed
  is told to place one, so the section lands instead of timing out twice.
*/

const NullRender: BlockRenderComponent = () => null;

function kernel(): BuilderKernel {
  const manifest: TrustedExtensionManifest = {
    tier: 1,
    name: 'ready-scene-build-fixture',
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
              jsMeta: customCodeJsMeta(),
              jsParams: customCodeJsParams(),
            }),
            examples: [],
          }),
          render: NullRender,
        },
      ],
    },
  };
  return createBuilder({
    document: {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'root',
      nodes: {
        root: { id: 'root', type: 'page', props: { title: 'Home' }, slots: { default: [] } },
      },
    },
    extensions: [manifest],
    ports: { clock: { now: () => 1 }, ids: seededIds('ready-scene-build') },
  });
}

/** A studio page whose hero is an aurora mural. */
const PLAN: PagePlanCandidate = {
  intent: 'replace',
  locale: { lang: 'en' },
  title: 'Northlight Studio | Amman',
  description: 'A design studio in Amman.',
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
    signature: 'one oversized word per section',
  },
  primaryCta: { label: 'Start a project', href: '#contact' },
  sections: [
    { key: 'header', role: 'header', title: 'Header', anchorId: 'top', purpose: 'Brand.' },
    {
      key: 'hero',
      role: 'hero',
      title: 'Northern lights',
      anchorId: 'hero',
      purpose: 'A calm aurora mural behind the studio name.',
    },
    { key: 'contact', role: 'cta', title: 'Say hello', anchorId: 'contact', purpose: 'Contact.' },
    { key: 'footer', role: 'footer', title: 'Footer', anchorId: 'footer', purpose: 'Hours.' },
  ],
};

const SCENE_CSS = '.ck-scene{position:relative;aspect-ratio:16/9;min-height:320px}';

/** What a writer that honours its contract writes, read back from its request. */
function honestTree(request: string): CustomCodeRoot {
  const anchor = /ANCHOR:[^\n]*id="([^"]+)"/u.exec(request)?.[1] ?? 'missing';
  const title = /SECTION \d+ OF \d+: ([^\n]+)/u.exec(request)?.[1] ?? 'Section';
  const action = /PRIMARY ACTION: "([^"]+)" → (\S+)/u.exec(request);
  const hero = request.includes('ROLE: HERO');
  const cta = (hero || request.includes('ROLE: CTA')) && action !== null;
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        attributes: { id: anchor },
        className: 'ck-scene py-16',
        children: [
          { kind: 'element', tag: hero ? 'h1' : 'h2', text: title, children: [] },
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

function writes(request: string, js?: string): AiPlan {
  const id = /REGION ID: (\S+)/u.exec(request)?.[1] ?? 'missing';
  return {
    rationale: 'filled',
    commands: [
      { command: 'setProp', args: { id, key: 'tree', value: honestTree(request) } },
      ...(js === undefined
        ? []
        : [
            { command: 'setProp', args: { id, key: 'css', value: SCENE_CSS } },
            { command: 'setProp', args: { id, key: 'js', value: js } },
          ]),
    ],
  };
}

interface Script {
  readonly provider: AiPlanProvider;
  readonly requests: string[];
}

/** A provider whose mural writer answers `mural(request, attempt)`. */
/** What the mural writer answers: its `js`, or `HANG` to never answer. */
const HANG = Symbol('hang');

function script(mural: (request: string, attempt: number) => string | typeof HANG): Script {
  const requests: string[] = [];
  let muralAttempts = 0;
  const provider: AiPlanProvider = {
    propose(request, _context, live) {
      requests.push(request);
      if (!request.includes('ROLE: HERO')) return Promise.resolve(writes(request));
      muralAttempts += 1;
      const js = mural(request, muralAttempts);
      if (js !== HANG) return Promise.resolve(writes(request, js));
      return new Promise<AiPlan>((_resolve, reject) => {
        live?.signal?.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    },
    repair: (request) => Promise.resolve(writes(request)),
    proposePagePlan: () => Promise.resolve({ pagePlan: PLAN, rationale: 'A studio page.' }),
  };
  return { provider, requests };
}

function build(given: Script) {
  return {
    runId: 'ready-scene-build',
    clock: { now: () => 1 },
    kernel: kernel(),
    provider: given.provider,
    request: 'Build a website for my design studio with a calm aurora mural',
    validationPorts: { clock: { now: () => 1 }, ids: seededIds('ready-scene-door') },
    skillRegistry: createCraftkitAiSkillRegistry(),
    freeCode: true,
  };
}

const AURORA = scenePreset('aurora-curtains')?.code;

vi.setConfig({ testTimeout: 20_000 });

afterEach(() => {
  vi.useRealTimers();
});

describe('runAiBuild — ready scenes for murals (2026-10-13)', () => {
  it('hands the mural writer the ready scenes that fit, and lands the one it names as tested code', async () => {
    const given = script(() => '@preset:aurora-curtains');
    const options = build(given);

    const result = await runAiBuild(options);

    expect(result.outcome).toBe('completed');
    const asked = given.requests.find((request) => request.includes('ROLE: HERO')) ?? '';
    expect(asked).toMatch(/READY SCENES[^\n]*aurora-curtains/u);
    // Only the scene's writer is offered scenes.
    const others = given.requests.filter((request) => !request.includes('ROLE: HERO'));
    expect(others.length).toBeGreaterThan(0);
    for (const request of others) expect(request).not.toContain('READY SCENES');
    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(hero?.status).toBe('applied');
    expect(hero?.check).toEqual({ issues: [], repaired: false });
    expect(options.kernel.getDocument().nodes[hero?.id ?? '']?.props['js']).toBe(AURORA);
  });

  it('places a ready scene when the first write runs out of time, instead of timing out twice', async () => {
    vi.useFakeTimers();
    const given = script((request, attempt) => {
      if (attempt === 1) return HANG;
      expect(request).toContain('The first attempt at this section failed');
      return '@preset:aurora-curtains';
    });
    const options = build(given);
    const done = runAiBuild(options);

    await vi.advanceTimersByTimeAsync(180_000 + 1_000);
    const result = await done;

    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(hero?.status).toBe('applied');
    expect(options.kernel.getDocument().nodes[hero?.id ?? '']?.props['js']).toBe(AURORA);
    expect(given.requests.filter((request) => request.includes('ROLE: HERO'))).toHaveLength(2);
  });

  it('initializes a whole section from one marker, preserves settings through the probe and reverts them safely', async () => {
    const given = script(() => '@preset:aurora-curtains');
    const propose = given.provider.propose.bind(given.provider);
    const options = build({
      ...given,
      provider: {
        ...given.provider,
        propose: async (request, context, live) => {
          if (!request.includes('ROLE: HERO')) return propose(request, context, live);
          const id = /REGION ID: (\S+)/u.exec(request)?.[1] ?? 'missing';
          return {
            rationale: 'Ready scene',
            commands: [
              { command: 'setProp', args: { id, key: 'js', value: '@preset:aurora-curtains' } },
              { command: 'setProp', args: { id, key: 'jsParams', value: { speed: 0.5 } } },
            ],
          };
        },
      },
    });
    const probed: unknown[] = [];
    const result = await runAiBuild({
      ...options,
      sceneProbe: (section) => {
        probed.push(section.jsParams);
        return Promise.resolve({
          status: 'ok',
          expectCanvas: true,
          stylesComplete: true,
          passes: [],
          skipped: [],
          elapsedMs: 1,
        });
      },
    });
    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(result.outcome).toBe('completed');
    expect(hero?.status).toBe('applied');
    expect(hero?.check?.issues).toEqual([]);
    expect(probed).toContainEqual({ speed: 0.5 });
    const props = options.kernel.getDocument().nodes[hero?.id ?? '']?.props;
    expect(props?.['jsMeta']).toMatchObject({ ref: { tier: 'builtin', id: 'aurora-curtains' } });
    expect(props?.['jsParams']).toEqual({ speed: 0.5 });
    expect(JSON.stringify(props?.['tree'])).toContain('Start a project');
    if (hero === undefined) throw new Error('No hero');
    options.kernel.dispatch('setProp', { id: hero.id, key: 'jsParams', value: { speed: 0.75 } });
    expect(() => revertBuildSection(options.kernel, hero, options.validationPorts)).toThrow(
      AiBuildRevertError,
    );
    options.kernel.undo();
    revertBuildSection(options.kernel, hero, options.validationPorts);
    expect(options.kernel.getDocument().nodes[hero.id]?.props['js']).toBe('');
    expect(options.kernel.getDocument().nodes[hero.id]?.props['jsParams']).toEqual({});
    expect(options.kernel.getDocument().nodes[hero.id]?.props['jsMeta']).toEqual({});
  });

  it('aborts an explicitly named initializer at its short deadline and retries the compact answer', async () => {
    vi.useFakeTimers();
    const given = script((_request, attempt) => (attempt === 1 ? HANG : '@preset:aurora-curtains'));
    const options = {
      ...build(given),
      request: 'Build a design studio website using aurora-curtains',
    };
    const done = runAiBuild(options);
    await vi.advanceTimersByTimeAsync(DEFAULT_AI_BUILD_SCENE_INIT_TIMEOUT_MS + 1_000);
    const result = await done;
    expect(result.outcome).toBe('completed');
    expect(given.requests.filter((request) => request.includes('ROLE: HERO'))).toHaveLength(2);
    expect(given.requests.find((request) => request.includes('ROLE: HERO'))).toContain(
      'SCENE INITIALIZATION v1:',
    );
  });

  it('completes a marker-only repair with matching copy, scene code and metadata', async () => {
    const shown: unknown[] = [];
    const given = script(() => '@preset:aurora-curtains');
    const propose = given.provider.propose.bind(given.provider);
    const options = build({
      ...given,
      provider: {
        ...given.provider,
        // The hero's first write forgets its call to action: the check sends it back once.
        propose: async (request, context, live) => {
          const plan = await propose(request, context, live);
          if (!request.includes('ROLE: HERO')) return plan;
          const id = /REGION ID: (\S+)/u.exec(request)?.[1] ?? 'missing';
          const bare: CustomCodeRoot = { kind: 'root', children: [] };
          return {
            ...plan,
            commands: plan.commands.map((step) =>
              (step.args as { key?: unknown }).key === 'tree'
                ? { command: 'setProp', args: { id, key: 'tree', value: bare } }
                : step,
            ),
          };
        },
        repair: (request, _context, plan) => {
          shown.push(
            plan.commands.find(({ args }) => (args as { key?: unknown }).key === 'js')?.args,
          );
          const id = /REGION ID: (\S+)/u.exec(request)?.[1] ?? 'missing';
          return Promise.resolve({
            rationale: 'Use another ready backdrop and restore the required copy locally',
            commands: [
              { command: 'setProp', args: { id, key: 'js', value: '@preset:flow-field-silk' } },
            ],
          });
        },
      },
    });

    const result = await runAiBuild(options);

    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ key: 'js', value: '@preset:aurora-curtains' });
    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(hero?.status).toBe('applied');
    expect(hero?.check?.repaired).toBe(true);
    const props = options.kernel.getDocument().nodes[hero?.id ?? '']?.props;
    expect(props?.['js']).toBe(scenePreset('flow-field-silk')?.code);
    expect(props?.['jsMeta']).toMatchObject({ ref: { id: 'flow-field-silk' } });
    expect(props?.['jsParams']).toEqual({});
    expect(JSON.stringify(props?.['tree'])).toContain('Northern lights');
    expect(JSON.stringify(props?.['tree'])).toContain('Start a project');
    expect(hero?.check?.issues).toEqual([]);
  });

  it.each(['const forbidden = true;', '@preset:flow-field-silk'])(
    'refuses a repair that bypasses the explicitly allowed initializer with %s',
    async (repairCode) => {
      const given = script(() => '@preset:aurora-curtains');
      const propose = given.provider.propose.bind(given.provider);
      const options = {
        ...build({
          ...given,
          provider: {
            ...given.provider,
            propose: async (request, context, live) => {
              const answer = await propose(request, context, live);
              if (!request.includes('ROLE: HERO')) return answer;
              return {
                ...answer,
                commands: answer.commands.map((step) =>
                  (step.args as { key?: unknown }).key === 'tree'
                    ? {
                        ...step,
                        args: { ...(step.args as object), value: { kind: 'root', children: [] } },
                      }
                    : step,
                ),
              };
            },
            repair: (request) => Promise.resolve(writes(request, repairCode)),
          },
        }),
        request: 'Build a design studio website using aurora-curtains',
      };
      const result = await runAiBuild(options);
      const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
      const props = options.kernel.getDocument().nodes[hero?.id ?? '']?.props;
      expect(props?.['js']).toBe(AURORA);
      expect(props?.['jsMeta']).toMatchObject({ ref: { id: 'aurora-curtains' } });
      expect(hero?.check?.issues.length).toBeGreaterThan(0);
    },
  );
});
