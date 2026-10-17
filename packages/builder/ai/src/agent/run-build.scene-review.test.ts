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

import type { AiSceneReview, AiSceneReviewRequest } from '../provider/scene-review-wire';
import { createCraftkitAiSkillRegistry } from '../skills';
import type { AiPlan, AiPlanProvider, AiPlanValidationIssue, PagePlanCandidate } from '../types';
import { buildLessonsOf } from './build-lessons';
import { validatePagePlan } from './page-plan/validate-page-plan';
import { runAiBuild } from './run-build';
import type { SceneProbe, SceneProbeContext, SceneProbeReport } from './scene-probe';

/*
  The build LOOKS at the scene it wrote (visual self-review, 2026-10-13): a provider that can see
  (`reviewScene`) is shown the probe's pictures of each scene section beside its contract, and
  what it says visibly fails goes to the section's ONE repair round as `scene-visual` — once per
  scene section per build, at its first check, never on the repaired answer.
*/

const NullRender: BlockRenderComponent = () => null;

function kernel(): BuilderKernel {
  const manifest: TrustedExtensionManifest = {
    tier: 1,
    name: 'scene-review-build-fixture',
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
    ports: { clock: { now: () => 1 }, ids: seededIds('review-build') },
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
const SCENE =
  "const s=await ck.scene({libs:['fx']});\nconst fx=s.lib.fx.create(s.app,{reducedMotion:s.reducedMotion});\nif(!s.editor&&!s.reducedMotion)s.tick(t=>fx.update(t.dt));\ns.dispose(()=>fx.dispose());";
const SCRIMMED = `${SCENE}\n// the title now sits on a scrim`;
/** Fails the static check: it looks up an id no element carries (only its writer can fix that). */
const STATIC_BROKEN = `${SCENE}\ndocument.getElementById('score');`;

function scripted(sceneJs: string, repairJs: string, review?: AiPlanProvider['reviewScene']) {
  const repairs: (readonly AiPlanValidationIssue[])[] = [];
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
    propose: (request) =>
      Promise.resolve(writes(request, request.includes('ROLE: HERO') ? sceneJs : undefined)),
    repair(request, _context, _plan, issues) {
      repairs.push(issues);
      return Promise.resolve(writes(request, repairJs));
    },
    proposePagePlan: () => {
      const checked = validatePagePlan(PLAN);
      if (!checked.ok) throw new Error(checked.issues.map(({ message }) => message).join('\n'));
      return Promise.resolve({ pagePlan: PLAN, rationale: 'A roastery with a game.' });
    },
    ...(review === undefined ? {} : { reviewScene: review }),
  };
  return { provider, repairs };
}

const DESKTOP = { dataUrl: 'data:image/jpeg;base64,REVTSw==', width: 640, height: 360, ink: 0.4 };
const PHONE = { dataUrl: 'data:image/jpeg;base64,UEhPTkU=', width: 201, height: 360, ink: 0.3 };

/** What `probeScene` reports: a clean run, with its pictures when the context asks for them. */
function probed(context: SceneProbeContext, desktop = DESKTOP): SceneProbeReport {
  const frame = (thumbnail: typeof DESKTOP) => ({
    region: { x: 0, y: 0, width: 1280, height: 720 },
    canvas: { rect: { x: 0, y: 0, width: 1280, height: 720 } },
    controls: [],
    overflowX: 0,
    blank: false,
    fps: 60,
    errors: [],
    click: null,
    hidden: false,
    settledMs: 900,
    waitedMs: 100,
    ranMs: 700,
    ...(context.thumbnails === true ? { thumbnail } : {}),
  });
  return {
    status: 'done',
    expectCanvas: true,
    stylesComplete: true,
    passes: [
      {
        status: 'done',
        report: frame(desktop),
        pass: { name: 'desktop', width: 1280, reducedMotion: false },
      },
      {
        status: 'done',
        report: frame(PHONE),
        pass: { name: 'mobile', width: 390, reducedMotion: false },
      },
    ],
    skipped: [],
    elapsedMs: 900,
  };
}

function recordingProbe(desktop = DESKTOP) {
  const contexts: SceneProbeContext[] = [];
  const probe: SceneProbe = (_section, context) => {
    contexts.push(context);
    return Promise.resolve(probed(context, desktop));
  };
  return { probe, contexts };
}

const SEEN_WRONG: AiSceneReview = {
  ok: false,
  findings: [
    {
      where: 'desktop',
      problem: 'The title sits on the brightest stars and cannot be read.',
      fix: 'Put a dark scrim (rgba(0,0,0,.45)) behind the title block',
    },
    {
      where: 'phone',
      problem: 'The Start button is cut off at the right edge',
      fix: 'Wrap the controls',
    },
  ],
};

function build(provider: AiPlanProvider, sceneProbe: SceneProbe, over: object = {}) {
  return {
    runId: 'review-build',
    clock: { now: () => 1 },
    kernel: kernel(),
    provider,
    request: 'Build a website with a playable 2d game with stars',
    validationPorts: { clock: { now: () => 1 }, ids: seededIds('review-build-door') },
    skillRegistry: createCraftkitAiSkillRegistry(),
    freeCode: true,
    sceneProbe,
    ...over,
  };
}

vi.setConfig({ testTimeout: 20_000 });

describe('runAiBuild — looking at the scene before it lands (visual self-review)', () => {
  it('shows the pictures with the contract once, and sends what was seen to the one repair round', async () => {
    const asked: AiSceneReviewRequest[] = [];
    const review = vi.fn((request: AiSceneReviewRequest) => {
      asked.push(request);
      return Promise.resolve(SEEN_WRONG);
    });
    const script = scripted(SCENE, SCRIMMED, review);
    const { probe, contexts } = recordingProbe();
    const options = build(script.provider, probe);

    const result = await runAiBuild(options);

    expect(result.outcome).toBe('completed');
    expect(review).toHaveBeenCalledTimes(1);
    const [request] = asked;
    expect(request?.image).toEqual({
      mediaType: 'image/jpeg',
      base64: 'REVTSw==',
      width: 640,
      height: 360,
    });
    expect(request?.phone?.base64).toBe('UEhPTkU=');
    expect(request?.contract).toEqual({
      title: 'Roasted this morning',
      purpose: 'Say what the roastery is. A playable 2d game with stars.',
      mustSay: [],
    });
    expect(request?.lang).toBe('en');
    expect(request?.brief?.palette).toEqual(
      expect.arrayContaining(['bg #fafaf9', 'accent #065f46']) as unknown,
    );
    expect(request?.brief?.setting).toMatch(/·/u);
    // Pictures only for the first run of the scene; the repaired one is run, never looked at.
    expect(contexts).toEqual([
      { lang: 'en', dir: 'ltr', thumbnails: true },
      { lang: 'en', dir: 'ltr' },
    ]);
    expect(script.repairs).toHaveLength(1);
    expect(script.repairs[0]?.map(({ message }) => message)).toEqual([
      'scene-visual: Seen in the rendered section: The title sits on the brightest stars and cannot be read — Put a dark scrim (rgba(0,0,0,.45)) behind the title block.',
      'scene-visual: Seen in the rendered section on a 390 px phone: The Start button is cut off at the right edge — Wrap the controls.',
    ]);
    const hero = result.tasks.find(({ sectionKey }) => sectionKey === 'hero');
    expect(hero?.check).toEqual({ issues: [], repaired: true });
    expect(options.kernel.getDocument().nodes[hero?.id ?? '']?.props['js']).toBe(SCRIMMED);
    // What was SEEN is not checked again after the repair: it never becomes a lesson.
    expect(buildLessonsOf(options)).toEqual([]);
  });

  it('lands the scene as written when the picture looks right', async () => {
    const review = vi.fn(() => Promise.resolve({ ok: true, findings: [] }));
    const script = scripted(SCENE, SCRIMMED, review);
    const result = await runAiBuild(build(script.provider, recordingProbe().probe));
    expect(review).toHaveBeenCalledTimes(1);
    expect(script.repairs).toHaveLength(0);
    expect(result.tasks.find(({ sectionKey }) => sectionKey === 'hero')?.check).toEqual({
      issues: [],
      repaired: false,
    });
  });

  it('looks at nothing when told not to, when it cannot, or when the picture is blank', async () => {
    for (const [label, over, desktop] of [
      ['visualReview: false', { visualReview: false }, DESKTOP],
      ['no free code', { freeCode: false }, DESKTOP],
      ['blank picture', {}, { ...DESKTOP, ink: 0 }],
    ] as const) {
      const review = vi.fn(() => Promise.resolve(SEEN_WRONG));
      const script = scripted(SCENE, SCRIMMED, review);
      const { probe } = recordingProbe(desktop);
      await runAiBuild(build(script.provider, probe, over));
      expect(review, label).not.toHaveBeenCalled();
      // (Without free code the writer's page code is not the page's, whatever else it costs.)
      if (label !== 'no free code') expect(script.repairs, label).toHaveLength(0);
    }
    // A provider that cannot see is never asked for pictures at all.
    const blind = scripted(SCENE, SCRIMMED);
    const { probe, contexts } = recordingProbe();
    await runAiBuild(build(blind.provider, probe));
    expect(contexts).toEqual([{ lang: 'en', dir: 'ltr' }]);
  });

  it('claims its one look at the first check: a scene the static check sends back is never looked at', async () => {
    const review = vi.fn(() => Promise.resolve(SEEN_WRONG));
    const script = scripted(STATIC_BROKEN, SCENE, review);
    const { probe, contexts } = recordingProbe();
    const result = await runAiBuild(build(script.provider, probe));
    expect(review).not.toHaveBeenCalled();
    // Only the repaired scene ran, without pictures; the repair landed.
    expect(contexts).toEqual([{ lang: 'en', dir: 'ltr' }]);
    expect(result.tasks.find(({ sectionKey }) => sectionKey === 'hero')?.check).toEqual({
      issues: [],
      repaired: true,
    });
  });

  it('costs nothing when the review fails', async () => {
    const review = vi.fn(() => Promise.reject(new Error('The server cannot see.')));
    const script = scripted(SCENE, SCRIMMED, review);
    const result = await runAiBuild(build(script.provider, recordingProbe().probe));
    expect(review).toHaveBeenCalledTimes(1);
    expect(script.repairs).toHaveLength(0);
    expect(result.tasks.find(({ sectionKey }) => sectionKey === 'hero')?.status).toBe('applied');
  });
});
