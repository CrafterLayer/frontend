import { afterEach, describe, expect, it, vi } from 'vitest';
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
import type { AiPlan, AiPlanProvider, AiPlanValidationIssue, PagePlanCandidate } from '../types';
import {
  DEFAULT_AI_BUILD_SCENE_TASK_TIMEOUT_MS,
  DEFAULT_AI_BUILD_TASK_TIMEOUT_MS,
  runAiBuild,
} from './run-build';
import { validatePagePlan } from './page-plan/validate-page-plan';

/*
  The scene check in a real build (creative-power Phase 1 B, 2026-10-12): a
  scene writer's code is held to `checkScene` before it lands, through the one
  repair round the section check already had; code that does not parse is
  turned back by the door itself; scene writers start first and run under the
  longer deadline.
*/

const NullRender: BlockRenderComponent = () => null;

function manifest(): TrustedExtensionManifest {
  return {
    tier: 1,
    name: 'scene-check-build-fixture',
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
    ports: { clock: { now: () => 1 }, ids: seededIds('scene-build') },
  });
}

const ports = () => ({ clock: { now: () => 1 }, ids: seededIds('scene-build-door') });

/** A roastery page whose `game` section (or hero) is where a scene goes. */
function plan(gameSection: 'hero' | 'menu'): PagePlanCandidate {
  const purpose = (key: string, own: string) =>
    key === gameSection ? `${own} A playable 2d game with stars.` : own;
  const candidate: PagePlanCandidate = {
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
        purpose: purpose('hero', 'Say what the roastery is.'),
      },
      {
        key: 'menu',
        role: 'band',
        title: 'Our coffees',
        anchorId: 'menu',
        purpose: purpose('menu', 'The coffees and their prices.'),
      },
      { key: 'order', role: 'cta', title: 'Order today', anchorId: 'order', purpose: 'Order.' },
      { key: 'footer', role: 'footer', title: 'Footer', anchorId: 'footer', purpose: 'Hours.' },
    ],
  };
  const result = validatePagePlan(candidate);
  if (!result.ok) throw new Error(result.issues.map(({ message }) => message).join('\n'));
  return candidate;
}

function regionIdOf(request: string): string {
  return /REGION ID: (\S+)/u.exec(request)?.[1] ?? 'missing';
}

/** What a writer that honours its contract writes, read back from its request. */
function honestSection(request: string): CustomCodeRoot {
  const anchor = /ANCHOR:[^\n]*id="([^"]+)"/u.exec(request)?.[1] ?? 'missing';
  const title = /SECTION \d+ OF \d+: ([^\n]+)/u.exec(request)?.[1] ?? 'Section';
  const hero = request.includes('ROLE: HERO');
  const action = /PRIMARY ACTION: "([^"]+)" → (\S+)/u.exec(request);
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

const SCENE_CSS = '.ck-scene{position:relative;aspect-ratio:16/9;min-height:320px}';
const FIXED =
  "const s=await ck.scene({libs:['fx']});\nconst fx=s.lib.fx.create(s.app,{reducedMotion:s.reducedMotion});\nif(!s.editor&&!s.reducedMotion)s.tick(t=>fx.update(t.dt));\ns.dispose(()=>fx.dispose());";
/** Passes the door, fails the scene check: line 2 looks up a hook the tree never carries. */
const BROKEN = FIXED.replace('\n', "\nconst go=ck.root.querySelector('[data-scene-action]');\n");
/** A slip code repairs before the check (tidy-section.ts): it uses s.lib.fx but lists only anim. */
const SLIPPED = FIXED.replace("libs:['fx']", "libs:['anim']");
/** The door refuses it: it does not parse. */
const UNPARSED = 'const s=await ck.scene({});\nconst x = ;';

interface Scripted {
  readonly provider: AiPlanProvider;
  readonly fills: { readonly request: string; readonly signal: AbortSignal | undefined }[];
  readonly repairs: (readonly AiPlanValidationIssue[])[];
}

function scripted(
  game: 'hero' | 'menu',
  sceneJs: string | undefined,
  repairJs?: string,
  hang?: boolean,
): Scripted {
  const fills: Scripted['fills'] = [];
  const repairs: Scripted['repairs'] = [];
  const writes = (request: string, js: string | undefined): AiPlan => {
    const id = regionIdOf(request);
    return {
      rationale: 'filled',
      commands: [
        { command: 'setProp', args: { id, key: 'tree', value: honestSection(request) } },
        ...(js === undefined
          ? []
          : [
              { command: 'setProp', args: { id, key: 'css', value: SCENE_CSS } },
              { command: 'setProp', args: { id, key: 'js', value: js } },
            ]),
      ],
    };
  };
  const isGame = (request: string) =>
    game === 'hero' ? request.includes('ROLE: HERO') : /OF \d+: Our coffees$/mu.test(request);
  const provider: AiPlanProvider = {
    propose(request, _context, live) {
      fills.push({ request, signal: live?.signal });
      if (hang === true && isGame(request)) {
        return new Promise<AiPlan>((_resolve, reject) => {
          live?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        });
      }
      return Promise.resolve(writes(request, isGame(request) ? sceneJs : undefined));
    },
    repair(request, _context, _plan, issues) {
      repairs.push(issues);
      return Promise.resolve(writes(request, repairJs));
    },
    proposePagePlan: () =>
      Promise.resolve({ pagePlan: plan(game), rationale: 'A roastery with a game.' }),
  };
  return { provider, fills, repairs };
}

function options(script: Scripted, request: string) {
  return {
    runId: 'scene-build',
    clock: { now: () => 1 },
    kernel: kernel(),
    provider: script.provider,
    request,
    validationPorts: ports(),
    skillRegistry: createCraftkitAiSkillRegistry(),
    freeCode: true,
  };
}

vi.setConfig({ testTimeout: 20_000 });

afterEach(() => {
  vi.useRealTimers();
});

describe('runAiBuild — the scene check (creative-power Phase 1 B)', () => {
  it('sends a scene the check refuses back in the one repair round, and lands the repaired scene', async () => {
    const script = scripted('hero', BROKEN, FIXED);
    const build = options(script, 'Build a website with a playable 2d game with stars');

    const result = await runAiBuild(build);

    expect(result.outcome).toBe('completed');
    expect(script.repairs).toHaveLength(1);
    const sent = (script.repairs[0] ?? []).map(({ message }) => message);
    expect(
      sent.some((line) => line.startsWith('scene-dom:') && line.includes('data-scene-action')),
    ).toBe(true);
    expect(sent.some((line) => line.endsWith('(at js line 2)'))).toBe(true);
    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(hero?.status).toBe('applied');
    expect(hero?.check).toEqual({ issues: [], repaired: true });
    expect(build.kernel.getDocument().nodes[hero?.id ?? '']?.props['js']).toBe(FIXED);
    // Ordinary sections write no code and are checked as before.
    const menu = result.tasks.find(({ sectionKey }) => sectionKey === 'menu');
    expect(menu?.check).toEqual({ issues: [], repaired: false });
  });

  it('shares the writing deadline with repair, keeps the first scene, and rejects a late repair', async () => {
    vi.useFakeTimers();
    const script = scripted('hero', BROKEN, FIXED);
    const stop = new AbortController();
    const events: unknown[] = [];
    let repairCalls = 0;
    let repairSignal: AbortSignal | undefined;
    let lateAnswer: AiPlan | undefined;
    let release: (answer: AiPlan) => void = () => undefined;
    const pending = new Promise<AiPlan>((resolve) => {
      release = resolve;
    });
    const build = {
      ...options(script, 'Build a website with a playable 2d game with stars'),
      provider: {
        ...script.provider,
        propose: async (request, context, live) => {
          if (request.includes('ROLE: HERO'))
            await new Promise((resolve) => setTimeout(resolve, 40));
          return script.provider.propose(request, context, live);
        },
        repair: (request, _context, _plan, _issues, live) => {
          repairCalls += 1;
          repairSignal = live?.signal;
          const id = regionIdOf(request);
          lateAnswer = {
            rationale: 'Late repair',
            commands: [
              { command: 'setProp', args: { id, key: 'tree', value: honestSection(request) } },
              { command: 'setProp', args: { id, key: 'css', value: SCENE_CSS } },
              { command: 'setProp', args: { id, key: 'js', value: FIXED } },
            ],
          };
          return pending;
        },
      } satisfies AiPlanProvider,
      taskTimeoutMs: 50,
      signal: stop.signal,
    };
    let completed = false;
    const done = runAiBuild({ ...build, onEvent: (event) => events.push(event) }).then((result) => {
      completed = true;
      return result;
    });

    try {
      await vi.advanceTimersByTimeAsync(51);
      expect(repairSignal?.aborted).toBe(true);
      expect(completed).toBe(true);
      const result = await done;
      const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
      expect(result.outcome).toBe('completed');
      expect(hero?.status).toBe('applied');
      expect(hero?.attempts).toBe(1);
      expect(hero?.check?.repaired).toBe(true);
      expect(hero?.check?.issues.some(({ code }) => code === 'scene-dom')).toBe(true);
      expect(repairCalls).toBe(1);
      expect(build.kernel.getDocument().nodes[hero?.id ?? '']?.props['js']).toBe(BROKEN);

      const document = build.kernel.getDocument();
      const transactions = build.kernel.transactions().length;
      const eventCount = events.length;
      if (lateAnswer === undefined) throw new Error('The repair was never requested.');
      release(lateAnswer);
      await vi.advanceTimersByTimeAsync(0);
      expect(build.kernel.getDocument()).toBe(document);
      expect(build.kernel.transactions()).toHaveLength(transactions);
      expect(events).toHaveLength(eventCount);
    } finally {
      stop.abort();
      if (lateAnswer !== undefined) release(lateAnswer);
      await vi.advanceTimersByTimeAsync(0);
      await done;
    }
  });

  it('cancels a stalled scene probe within the attempt budget and keeps validated work', async () => {
    vi.useFakeTimers();
    const script = scripted('hero', FIXED);
    let probeSignal: AbortSignal | undefined;
    const build = {
      ...options(script, 'Build a website with a playable 2d game with stars'),
      taskTimeoutMs: 50,
      sceneProbe: (_section: unknown, context: { signal?: AbortSignal }) => {
        probeSignal = context.signal;
        return new Promise<never>(() => undefined);
      },
    };
    let completed = false;
    const done = runAiBuild(build).then((result) => {
      completed = true;
      return result;
    });
    await vi.advanceTimersByTimeAsync(51);
    expect(completed).toBe(true);
    expect(probeSignal?.aborted).toBe(true);
    const result = await done;
    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(hero?.status).toBe('applied');
    expect(hero?.check).toBeUndefined();
    expect(build.kernel.getDocument().nodes[hero?.id ?? '']?.props['js']).toBe(FIXED);
    expect(script.repairs).toEqual([]);
  });

  it('repairs a slip code can fix before the check: no repair round, the repaired scene lands', async () => {
    const script = scripted('hero', SLIPPED, BROKEN);
    const build = options(script, 'Build a website with a playable 2d game with stars');

    const result = await runAiBuild(build);

    expect(result.outcome).toBe('completed');
    expect(script.repairs).toHaveLength(0);
    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(hero?.status).toBe('applied');
    expect(hero?.check).toEqual({ issues: [], repaired: false });
    expect(build.kernel.getDocument().nodes[hero?.id ?? '']?.props['js']).toBe(
      FIXED.replace("libs:['fx']", "libs:['fx','anim']"),
    );
  });

  it('turns code that does not parse back at the door, with its line, before the check sees it', async () => {
    const script = scripted('hero', UNPARSED, FIXED);
    const build = options(script, 'Build a website with a playable 2d game with stars');

    const result = await runAiBuild(build);

    expect(result.outcome).toBe('completed');
    expect(script.repairs.length).toBeGreaterThan(0);
    expect(script.repairs[0]?.[0]?.message).toContain('syntax error at line 2');
    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(hero?.status).toBe('applied');
    expect(build.kernel.getDocument().nodes[hero?.id ?? '']?.props['js']).toBe(FIXED);
  });

  it('starts the scene writer first, with the same number of writers', async () => {
    const script = scripted('menu', FIXED);
    const result = await runAiBuild({
      ...options(script, 'Build a landing page for my specialty coffee roastery in Amman'),
      fillConcurrency: 1,
    });

    expect(result.outcome).toBe('completed');
    // Page order would start the hero; the menu writes the scene, so it goes first.
    expect(script.fills[0]?.request).toMatch(/^SECTION 3 OF 5: Our coffees$/mu);
    expect(script.fills[1]?.request).toContain('ROLE: HERO');
    expect(result.tasks.map(({ status }) => status)).toEqual([
      'applied',
      'applied',
      'applied',
      'applied',
      'applied',
    ]);
  });

  it('gives a scene writer 420 s instead of 240 s when the caller set no deadline', async () => {
    expect(DEFAULT_AI_BUILD_TASK_TIMEOUT_MS).toBe(240_000);
    expect(DEFAULT_AI_BUILD_SCENE_TASK_TIMEOUT_MS).toBe(420_000);
    vi.useFakeTimers();
    const script = scripted('hero', FIXED, undefined, true);
    const done = runAiBuild(options(script, 'Build a website with a playable 2d game with stars'));

    await vi.advanceTimersByTimeAsync(DEFAULT_AI_BUILD_TASK_TIMEOUT_MS + 1_000);
    const scene = script.fills.find(({ request }) => request.includes('ROLE: HERO'));
    expect(scene?.signal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(
      DEFAULT_AI_BUILD_SCENE_TASK_TIMEOUT_MS - DEFAULT_AI_BUILD_TASK_TIMEOUT_MS,
    );
    expect(scene?.signal?.aborted).toBe(true);

    // The second attempt runs under the same deadline, then the section reports its timeout.
    await vi.advanceTimersByTimeAsync(DEFAULT_AI_BUILD_SCENE_TASK_TIMEOUT_MS + 1_000);
    const result = await done;
    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(hero?.reasonCode).toBe('timeout');
    expect(hero?.reason).toContain('420000ms');
  });
});
