import { describe, expect, it, vi } from 'vitest';
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
import { checkScene } from './page-plan/check-scene';
import type { LandedSection } from './page-plan/types';
import { validatePagePlan } from './page-plan/validate-page-plan';
import { runAiBuild } from './run-build';
import type { SceneProbe, SceneProbeContext, SceneProbeReport } from './scene-probe';

/*
  The scene RUN in a real build (creative-power Phase 2 E, 2026-10-12): a host that can run a
  scene passes `sceneProbe`; a scene section whose code the static check passed is run before it
  lands, and what that finds goes to the section's ONE repair round — never a second. A build
  without a probe runs nothing (every other run-build test is that build).
*/

const NullRender: BlockRenderComponent = () => null;

function kernel(): BuilderKernel {
  const manifest: TrustedExtensionManifest = {
    tier: 1,
    name: 'scene-probe-build-fixture',
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
    ports: { clock: { now: () => 1 }, ids: seededIds('probe-build') },
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
      purpose: 'Say what the roastery is. A playable 2d game with stars.',
    },
    { key: 'order', role: 'cta', title: 'Order today', anchorId: 'order', purpose: 'Order.' },
    { key: 'footer', role: 'footer', title: 'Footer', anchorId: 'footer', purpose: 'Hours.' },
  ],
};

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
/** Passes every static rule; throws when it runs. */
const THROWS = `${FIXED}\nhero.position.set(1,1);`;
/** Fails the static check: it looks up an id no element carries (only its writer can fix that). */
const STATIC_BROKEN = `${FIXED}\ndocument.getElementById('score');`;

function scripted(sceneJs: string, repairJs: string) {
  const repairs: (readonly AiPlanValidationIssue[])[] = [];
  const proposals: string[] = [];
  const writes = (request: string, js: string | undefined): AiPlan => {
    const id = /REGION ID: (\S+)/u.exec(request)?.[1] ?? 'missing';
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
  const provider: AiPlanProvider = {
    propose: (request) => {
      proposals.push(request);
      return Promise.resolve(writes(request, request.includes('ROLE: HERO') ? sceneJs : undefined));
    },
    repair(request, _context, _plan, issues) {
      repairs.push(issues);
      return Promise.resolve(writes(request, repairJs));
    },
    proposePagePlan: () => {
      const checked = validatePagePlan(PLAN);
      if (!checked.ok) throw new Error(checked.issues.map(({ message }) => message).join('\n'));
      return Promise.resolve({ pagePlan: PLAN, rationale: 'A roastery with a game.' });
    },
  };
  return { provider, repairs, proposals };
}

/** What `probeScene` would report: the throw, at its line, when the code still has it. */
function report(section: LandedSection): SceneProbeReport {
  const thrown = section.js?.includes('hero.position') === true;
  const frame = {
    region: { x: 0, y: 0, width: 1280, height: 720 },
    canvas: { rect: { x: 0, y: 0, width: 1280, height: 720 } },
    controls: [],
    overflowX: 0,
    blank: false,
    fps: 60,
    errors: thrown ? [{ message: 'hero is not defined', line: 5 }] : [],
    click: null,
    hidden: false,
    settledMs: 900,
    waitedMs: 100,
    ranMs: 700,
  };
  return {
    status: 'done',
    expectCanvas: true,
    stylesComplete: true,
    passes: [
      {
        status: 'done',
        report: frame,
        pass: { name: 'desktop', width: 1280, reducedMotion: false },
      },
    ],
    skipped: [],
    elapsedMs: 900,
  };
}

function build(script: ReturnType<typeof scripted>, sceneProbe?: SceneProbe) {
  return {
    runId: 'probe-build',
    clock: { now: () => 1 },
    kernel: kernel(),
    provider: script.provider,
    request: 'Build a website with a playable 2d game with stars',
    validationPorts: { clock: { now: () => 1 }, ids: seededIds('probe-build-door') },
    skillRegistry: createCraftkitAiSkillRegistry(),
    freeCode: true,
    ...(sceneProbe === undefined ? {} : { sceneProbe }),
  };
}

vi.setConfig({ testTimeout: 20_000 });

describe('runAiBuild — running the scene before it lands (creative-power Phase 2 E)', () => {
  it('keeps its fixtures honest: the throwing scene passes every static rule', () => {
    expect(checkScene({ tree: null, css: SCENE_CSS, js: THROWS })).toEqual([]);
    expect(checkScene({ tree: null, css: SCENE_CSS, js: STATIC_BROKEN })).not.toEqual([]);
  });

  it('sends what the run found to the one repair round, re-runs the repair, and lands it', async () => {
    const calls: { js: string | undefined; context: SceneProbeContext }[] = [];
    const probe: SceneProbe = (section, context) => {
      calls.push({ js: section.js, context });
      return Promise.resolve(report(section));
    };
    const script = scripted(THROWS, FIXED);
    const options = build(script, probe);

    const result = await runAiBuild(options);

    expect(result.outcome).toBe('completed');
    expect(script.repairs).toHaveLength(1);
    expect(script.repairs[0]?.map(({ message }) => message)).toContain(
      'scene-runtime: The scene threw "hero is not defined" at js line 5 — define hero before use (or fix its spelling). (at js line 5)',
    );
    // The hero alone carries a scene: it ran as written, then as repaired — in the page's language.
    expect(calls.map(({ js }) => js)).toEqual([THROWS, FIXED]);
    expect(calls[0]?.context).toEqual({
      lang: 'en',
      dir: 'ltr',
      signal: expect.any(AbortSignal) as unknown,
    });
    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(hero?.check).toEqual({ issues: [], repaired: true });
    expect(options.kernel.getDocument().nodes[hero?.id ?? '']?.props['js']).toBe(FIXED);
    const order = result.tasks.find(({ sectionKey }) => sectionKey === 'order');
    expect(order?.check).toEqual({ issues: [], repaired: false });
  });

  it('runs nothing while the static check still finds the scene wrong', async () => {
    const probe = vi.fn<SceneProbe>((section) => Promise.resolve(report(section)));
    const script = scripted(STATIC_BROKEN, FIXED);

    const result = await runAiBuild(build(script, probe));

    expect(script.repairs).toHaveLength(1);
    expect(script.repairs[0]?.every(({ message }) => !message.startsWith('scene-runtime'))).toBe(
      true,
    );
    // Only the repaired scene, which the static check passes, is run.
    expect(probe.mock.calls.map(([section]) => section.js)).toEqual([FIXED]);
    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(hero?.check).toEqual({ issues: [], repaired: true });
  });

  it('skips a scene still throwing after one repair and keeps its successful siblings', async () => {
    const probe: SceneProbe = (section) => Promise.resolve(report(section));
    const script = scripted(THROWS, THROWS);
    const options = build(script, probe);

    const result = await runAiBuild(options);

    expect(script.repairs).toHaveLength(1);
    expect(script.proposals.filter((request) => request.includes('ROLE: HERO'))).toHaveLength(1);
    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(hero).toMatchObject({ status: 'skipped', reasonCode: 'invalid', attempts: 1 });
    expect(hero?.reason).toContain('scene-runtime: The scene threw "hero is not defined"');
    expect(hero?.landing).toBeUndefined();
    expect(options.kernel.getDocument().nodes[hero?.id ?? '']?.props['js']).not.toBe(THROWS);
    expect(result.skipped).toBe(1);
    expect(result.applied).toBe(result.tasks.length - 1);
    expect(
      result.tasks
        .filter((task) => task.id !== hero?.id)
        .every(({ status }) => status === 'applied'),
    ).toBe(true);
  });

  it('skips a confirmed blank scene after one repair without another writer call', async () => {
    const probe: SceneProbe = (section) => {
      const measured = report(section);
      return Promise.resolve({
        ...measured,
        passes: measured.passes.map((pass) => ({
          ...pass,
          report: pass.report === null ? null : { ...pass.report, canvas: null, waitedMs: 2_000 },
        })),
      });
    };
    const script = scripted(FIXED, FIXED);
    const options = build(script, probe);

    const result = await runAiBuild(options);

    expect(script.repairs).toHaveLength(1);
    expect(script.proposals.filter((request) => request.includes('ROLE: HERO'))).toHaveLength(1);
    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(hero).toMatchObject({ status: 'skipped', reasonCode: 'invalid', attempts: 1 });
    expect(hero?.reason).toContain('scene-blank: The scene drew nothing');
    expect(hero?.landing).toBeUndefined();
    expect(options.kernel.getDocument().nodes[hero?.id ?? '']?.props['js']).not.toBe(FIXED);
    expect(result.applied).toBe(result.tasks.length - 1);
  });

  it.each(['missing', 'rejected'] as const)(
    'skips a confirmed runtime failure when repair is %s',
    async (repair) => {
      const script = scripted(THROWS, FIXED);
      const withoutRepair = { ...script.provider };
      delete withoutRepair.repair;
      const failedRepair = vi.fn(() => Promise.reject(new Error('Repair unavailable.')));
      const options = {
        ...build(script, (section) => Promise.resolve(report(section))),
        provider: repair === 'missing' ? withoutRepair : { ...withoutRepair, repair: failedRepair },
      };

      const result = await runAiBuild(options);

      const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
      expect(hero).toMatchObject({ status: 'skipped', reasonCode: 'invalid', attempts: 1 });
      expect(hero?.reason).toContain('scene-runtime');
      expect(script.proposals.filter((request) => request.includes('ROLE: HERO'))).toHaveLength(1);
      expect(failedRepair).toHaveBeenCalledTimes(repair === 'missing' ? 0 : 1);
      expect(result.applied).toBe(result.tasks.length - 1);
    },
  );

  it('keeps a usable scene when only nonfatal layout findings remain after repair', async () => {
    const probe: SceneProbe = (section) => {
      const measured = report(section);
      return Promise.resolve({
        ...measured,
        passes: measured.passes.map((pass) => ({
          ...pass,
          report: pass.report === null ? null : { ...pass.report, overflowX: 20 },
        })),
      });
    };
    const script = scripted(FIXED, FIXED);
    const options = build(script, probe);

    const result = await runAiBuild(options);

    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(script.repairs).toHaveLength(1);
    expect(hero?.status).toBe('applied');
    expect(hero?.check?.issues.map(({ code }) => code)).toEqual(['scene-layout']);
    expect(options.kernel.getDocument().nodes[hero?.id ?? '']?.props['js']).toBe(FIXED);
    expect(result.skipped).toBe(0);
    expect(result.applied).toBe(result.tasks.length);
  });

  it.each(['fixes', 'introduces'] as const)(
    'ranks scene usability before warning counts when a repair %s a runtime failure',
    async (repair) => {
      const probe: SceneProbe = (section) => {
        const measured = report(section);
        if (section.js === THROWS) return Promise.resolve(measured);
        return Promise.resolve({
          ...measured,
          passes: measured.passes.map((pass) => ({
            ...pass,
            report:
              pass.report === null
                ? null
                : {
                    ...pass.report,
                    overflowX: 20,
                    canvas: { rect: { x: 0, y: 0, width: 1280, height: 350 } },
                  },
          })),
        });
      };
      const script = repair === 'fixes' ? scripted(THROWS, FIXED) : scripted(FIXED, THROWS);
      const options = build(script, probe);

      const result = await runAiBuild(options);

      const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
      expect(script.repairs).toHaveLength(1);
      expect(script.proposals.filter((request) => request.includes('ROLE: HERO'))).toHaveLength(1);
      expect(hero?.status).toBe('applied');
      expect(hero?.check?.issues.map(({ code }) => code)).toEqual(['scene-layout', 'scene-layout']);
      expect(options.kernel.getDocument().nodes[hero?.id ?? '']?.props['js']).toBe(FIXED);
      expect(result.skipped).toBe(0);
    },
  );

  it('costs nothing when the probe fails, and runs nothing without one', async () => {
    const failing = scripted(THROWS, FIXED);
    const broken = await runAiBuild(
      build(failing, () => Promise.reject(new Error('This host cannot run scenes.'))),
    );
    expect(failing.repairs).toHaveLength(0);
    expect(broken.tasks.find(({ sectionKey }) => sectionKey === 'hero')?.check).toEqual({
      issues: [],
      repaired: false,
    });

    const headless = scripted(THROWS, FIXED);
    const plain = await runAiBuild(build(headless));
    expect(headless.repairs).toHaveLength(0);
    expect(plain.tasks.find(({ sectionKey }) => sectionKey === 'hero')?.check).toEqual({
      issues: [],
      repaired: false,
    });
  });
});
