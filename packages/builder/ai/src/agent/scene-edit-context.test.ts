import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCodeTree,
  customCss,
  defineBlockSchema,
  emptyCustomCodeTree,
  type BlockRenderComponent,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { parseTreeMarkup } from '../plan/tree-markup';
import {
  createCraftkitAiSkillRegistry,
  type AiSkillPrepareOptions,
  type AiSkillRegistry,
} from '../skills';
import type { AiPlan, AiPlanProvider, AssembledAiContext } from '../types';
import { runAiAgent } from './run-agent';
import { SCENE } from './run-agent.incident-fixtures';
import { sceneEditContext } from './scene-edit-context';
import type { AiAgentEvent, RunAiAgentOptions } from './types';

const NullRender: BlockRenderComponent = () => null;

const blocks: TrustedExtensionManifest = {
  tier: 1,
  name: 'scene-edit-fixture',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'The page root.',
          props: z.object({ title: z.string().default('') }),
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

const STORY_JS = `const s=await ck.scene({libs:['dialogue','anim','fx']});
const cast=s.lib.dialogue.cast([{id:'rumi',name:'Rumi',color:'#f59e0b',title:'hero'}]);
const fx=s.lib.fx.create(s.app,{reducedMotion:s.reducedMotion,rng:s.random});
s.dispose(()=>fx.dispose());`;

const NIGHT_JS = `const s=await ck.scene({libs:['fx']});
const fx=s.lib.fx.create(s.app,{reducedMotion:s.reducedMotion,rng:s.random});
if(!s.editor&&!s.reducedMotion)fx.weather('stars',{density:.4});
s.dispose(()=>fx.dispose());`;

const GAME_JS = `const s=await ck.scene({libs:['tilemap','anim','fx']});
const world=s.lib.tilemap.world(s.app,{tileSize:32,rows:['#p.c#'],legend:{'#':{style:'stone',solid:true}}});
let vy=0;const step=dt=>{const m=world.move({x:0,y:0,w:8,h:8},0,vy*dt);if(m.onGround)vy=-420};
s.dispose(s.fixedTick(step,{step:1/60,maxSteps:5}));`;

type Region = readonly [id: string, label: string, markup: string, js?: string];

/** A bookshop landing whose middle band is a story scene. */
const STORY_PAGE: readonly Region[] = [
  [
    'hero',
    'Welcome',
    `<section id='hero'><h1>Moonlight Books</h1><p>Stories for little readers.</p></section>`,
  ],
  [
    'tale',
    'The Moon Fox',
    `<section id='tale'><h2>The Moon Fox</h2><p>Rumi looks for the moon.</p></section>`,
    STORY_JS,
  ],
  [
    'contact',
    'Contact',
    `<section id='contact'><h2>Contact us</h2><p>Write to the shop.</p></section>`,
  ],
];

/** A café whose hero is a night-sky mural. */
const NIGHT_PAGE: readonly Region[] = [
  ['sky', 'Night sky', `<section id='sky'><h1>Open late</h1></section>`, NIGHT_JS],
  [
    'menu',
    'Menu',
    `<section id='menu'><h2>Our coffees</h2><p>Espresso and cardamom.</p></section>`,
  ],
];

function documentOf(regions: readonly Region[]): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'Home' },
        slots: { default: regions.map(([id]) => id) },
      },
      ...Object.fromEntries(
        regions.map(([id, label, markup, js]) => [
          id,
          {
            id,
            type: 'customCode',
            props: { label, tree: parseTreeMarkup(markup), css: '', js: js ?? '' },
          },
        ]),
      ),
    },
  } as unknown as BuilderDocument;
}

function kernelFor(regions: readonly Region[] = STORY_PAGE): BuilderKernel {
  return createBuilder({
    document: documentOf(regions),
    extensions: [blocks],
    ports: { clock: fixedClock(1), ids: seededIds('scene-edit') },
  });
}

/** A harmless model answer, valid on every fixture page: retitle the page. */
const relabel: AiPlan = {
  rationale: 'Retitle the page.',
  commands: [{ command: 'setProp', args: { id: 'root', key: 'title', value: 'Home page' } }],
};

interface Recorded {
  readonly provider: AiPlanProvider;
  readonly contexts: AssembledAiContext[];
}

function recording(plan: AiPlan = relabel): Recorded {
  const contexts: AssembledAiContext[] = [];
  return {
    contexts,
    provider: {
      propose: (_request, context) => {
        contexts.push(context);
        return Promise.resolve(plan);
      },
    },
  };
}

const neverCalled: AiPlanProvider = {
  propose: () => Promise.reject(new Error('A direct edit must not ask the provider.')),
};

/** The craftkit registry, recording what each run asked it to prepare. */
function spied(): {
  readonly registry: AiSkillRegistry;
  readonly prepared: AiSkillPrepareOptions[];
} {
  const inner = createCraftkitAiSkillRegistry();
  const prepared: AiSkillPrepareOptions[] = [];
  return {
    prepared,
    registry: {
      list: () => inner.list(),
      get: (id) => inner.get(id),
      readSkill: (id) => inner.readSkill(id),
      listReferences: (id) => inner.listReferences(id),
      readReference: (id, path) => inner.readReference(id, path),
      prepare: (options) => {
        prepared.push(options);
        return inner.prepare(options);
      },
    },
  };
}

function options(
  kernel: BuilderKernel,
  provider: AiPlanProvider,
  extra: Partial<RunAiAgentOptions> = {},
): RunAiAgentOptions {
  return {
    runId: 'scene-edit',
    clock: fixedClock(0),
    kernel,
    provider,
    request: 'make it calmer',
    selection: ['tale'],
    validationPorts: { clock: fixedClock(2), ids: seededIds('scene-edit-ports') },
    skillRegistry: createCraftkitAiSkillRegistry(),
    freeCode: true,
    apply: 'never',
    ...extra,
  };
}

const PIXI = 'craftkit.pixi-';
const SCENE_PINS = ['craftkit.pixi-stories', 'craftkit.pixi-director', 'craftkit.pixi-v8-core'];

type Result = Awaited<ReturnType<typeof runAiAgent>>;

function pixiActivations(result: Result): string[] {
  return result.proposal.skillActivations
    .filter(({ id }) => id.startsWith(PIXI))
    .map(({ id, reason }) => `${id}:${reason}`);
}

function allActivations(result: Result): string[] {
  return result.proposal.skillActivations.map(({ id, reason }) => `${id}:${reason}`);
}

function brief(context: AssembledAiContext | undefined): string | undefined {
  return context?.fragments.find(({ source }) => source === 'craftkit:creative-brief')?.body;
}

/** The run's own prepare (the fit checks ask with an empty request). */
function runPrepare(prepared: readonly AiSkillPrepareOptions[]): AiSkillPrepareOptions | undefined {
  return prepared.filter(({ request }) => request !== '').at(-1);
}

describe('runAiAgent — a creative edit gets the scene’s playbooks and brief', () => {
  it('a selected story region and words that name nothing pin the story, director and core playbooks, with the brief', async () => {
    const { provider, contexts } = recording();
    const result = await runAiAgent(options(kernelFor(), provider));

    expect(result.source).toBe('model');
    expect(pixiActivations(result)).toEqual(
      expect.arrayContaining(SCENE_PINS.map((id) => `${id}:explicit`)),
    );
    // The companions a build's story writer gets come too: dialogue, animation, effects, graphics.
    expect(pixiActivations(result)).toEqual(
      expect.arrayContaining([
        'craftkit.pixi-dialogue:explicit',
        'craftkit.pixi-animation:explicit',
        'craftkit.pixi-effects:explicit',
      ]),
    );
    const body = brief(contexts[0]);
    expect(body).toContain('KIND: story');
    expect(body).toContain("LIBS: ck.scene({ libs: ['dialogue', 'anim', 'fx'] })");
    // The cast the scene's code declares keeps its name in the edit.
    expect(body).toContain('rumi=Rumi');
  });

  it('a business band on the same page is edited exactly as before', async () => {
    const on = recording();
    const off = recording();
    const spy = spied();
    const scene = await runAiAgent(
      options(kernelFor(), on.provider, { selection: ['contact'], skillRegistry: spy.registry }),
    );
    const plain = await runAiAgent(
      options(kernelFor(), off.provider, { selection: ['contact'], freeCode: false }),
    );

    expect(pixiActivations(scene)).toEqual([]);
    expect(allActivations(scene)).toEqual(allActivations(plain));
    expect(runPrepare(spy.prepared)?.selectedSkillIds).toBeUndefined();
    expect(brief(on.contexts[0])).toBeUndefined();
  });

  it('whole-page words that do not speak of the scene leave the run as it was', async () => {
    const { provider, contexts } = recording();
    const result = await runAiAgent(
      options(kernelFor(), provider, { request: 'make the copy friendlier', selection: [] }),
    );

    expect(pixiActivations(result)).toEqual([]);
    expect(brief(contexts[0])).toBeUndefined();
  });

  it('free code off: the selected story is edited exactly as before', async () => {
    const { provider, contexts } = recording();
    const spy = spied();
    const result = await runAiAgent(
      options(kernelFor(), provider, { freeCode: false, skillRegistry: spy.registry }),
    );

    expect(pixiActivations(result)).toEqual([]);
    expect(runPrepare(spy.prepared)?.selectedSkillIds).toBeUndefined();
    expect(brief(contexts[0])).toBeUndefined();
  });

  it('the person’s own skill picks come first, the scene’s playbooks after them', async () => {
    const spy = spied();
    const pick = 'craftkit.accessibility-review';
    const result = await runAiAgent(
      options(kernelFor(), recording().provider, {
        request: 'add a read-aloud button',
        skillRegistry: spy.registry,
        selectedSkillIds: [pick],
      }),
    );

    const selected = runPrepare(spy.prepared)?.selectedSkillIds ?? [];
    expect(selected[0]).toBe(pick);
    expect(selected.slice(1, 4)).toEqual(SCENE_PINS);
    expect(new Set(selected).size).toBe(selected.length);
    expect(allActivations(result)).toContain(`${pick}:explicit`);
  });

  it('a pick the person already made is not pinned twice', async () => {
    const spy = spied();
    await runAiAgent(
      options(kernelFor(), recording().provider, {
        skillRegistry: spy.registry,
        selectedSkillIds: ['craftkit.pixi-director'],
      }),
    );

    const selected = runPrepare(spy.prepared)?.selectedSkillIds ?? [];
    expect(selected[0]).toBe('craftkit.pixi-director');
    expect(selected.filter((id) => id === 'craftkit.pixi-director')).toHaveLength(1);
    expect(selected).toContain('craftkit.pixi-stories');
  });

  it('a direct edit of the story region is untouched: no skills prepared, no provider asked', async () => {
    const spy = spied();
    const events: AiAgentEvent[] = [];
    const kernel = kernelFor();
    const result = await runAiAgent(
      options(kernel, neverCalled, {
        request: 'call it Moon Tales',
        skillRegistry: spy.registry,
        apply: 'auto',
        onEvent: (event) => events.push(event),
      }),
    );

    expect(result).toMatchObject({ status: 'applied', source: 'direct', tokens: 0 });
    expect(result.proposal.skillActivations).toEqual([]);
    expect(spy.prepared).toEqual([]);
    expect(events.find(({ type }) => type === 'skills.resolved')).toMatchObject({
      activations: [],
      totalTokens: 0,
    });
    expect(kernel.getDocument().nodes['tale']?.props['js']).toBe(STORY_JS);
  });

  it('pinned playbooks are shed from the end to fit a tight skill budget, never failing the run', async () => {
    const result = await runAiAgent(
      options(kernelFor(), recording().provider, { policy: { maxSkillTokens: 3_000 } }),
    );

    expect(result.source).toBe('model');
    expect(pixiActivations(result)).toEqual([
      'craftkit.pixi-stories:explicit',
      'craftkit.pixi-v8-core:dependency',
    ]);
    expect(result.skills?.totalTokens).toBeLessThanOrEqual(3_000);
  });

  it('«خلّي الليل أغمق» on the whole page reaches the night mural', async () => {
    const { provider, contexts } = recording();
    const result = await runAiAgent(
      options(kernelFor(NIGHT_PAGE), provider, {
        request: 'خلّي الليل أغمق',
        selection: [],
      }),
    );

    expect(pixiActivations(result)).toEqual(
      expect.arrayContaining([
        'craftkit.pixi-murals:explicit',
        'craftkit.pixi-director:explicit',
        'craftkit.pixi-v8-core:explicit',
      ]),
    );
    const body = brief(contexts[0]);
    expect(body).toContain('KIND: scene');
    expect(body).toContain('LANGUAGE: ar');
    expect(body).toContain("fx.weather('stars')");
  });

  it('a host that serves its own brief keeps it; the pins still come', async () => {
    const { provider, contexts } = recording();
    const own = {
      id: 'craftkit:creative-brief',
      collect: () => ({
        source: 'craftkit:creative-brief',
        kind: 'data' as const,
        trust: 'reviewed' as const,
        title: 'Host brief',
        body: 'HOST BRIEF',
      }),
    };
    const result = await runAiAgent(
      options(kernelFor(), provider, { additionalContextProviders: [own] }),
    );

    expect(brief(contexts[0])).toBe('HOST BRIEF');
    expect(pixiActivations(result)).toContain('craftkit.pixi-stories:explicit');
  });

  it('autoSkills: false pins nothing but still carries the brief', async () => {
    const { provider, contexts } = recording();
    const result = await runAiAgent(options(kernelFor(), provider, { autoSkills: false }));

    expect(pixiActivations(result)).toEqual([]);
    expect(brief(contexts[0])).toContain('KIND: story');
  });

  it('a build’s own step is never read as an edit', async () => {
    const spy = spied();
    await runAiAgent(
      options(kernelFor(), recording().provider, {
        runId: 'build/section-1',
        skillRegistry: spy.registry,
      }),
    );

    expect(runPrepare(spy.prepared)?.selectedSkillIds).toBeUndefined();
  });
});

describe('sceneEditContext — what the scene’s code says it is', () => {
  const registry = createCraftkitAiSkillRegistry();
  const level: Region = [
    'level',
    'Level one',
    `<section id='level'><h2>Level one</h2></section>`,
    GAME_JS,
  ];

  it('reads a tile world with jumps as a platformer', () => {
    const scene = sceneEditContext({
      request: 'make it harder',
      document: documentOf([level]),
      selection: ['level'],
      registry,
    });

    expect(scene?.skillIds.slice(0, 3)).toEqual([
      'craftkit.pixi-games',
      'craftkit.pixi-director',
      'craftkit.pixi-v8-core',
    ]);
    expect(scene?.skillIds).toContain('craftkit.pixi-tile-worlds');
  });

  it('reads plain scene code as a mural', () => {
    const scene = sceneEditContext({
      request: 'slower please',
      document: documentOf(NIGHT_PAGE),
      selection: ['sky'],
      registry,
    });

    expect(scene?.skillIds.slice(0, 3)).toEqual([
      'craftkit.pixi-murals',
      'craftkit.pixi-director',
      'craftkit.pixi-v8-core',
    ]);
  });

  it('finds a scene inside a focused section, and none in a business band', () => {
    const document = documentOf([...STORY_PAGE]);
    const focused = sceneEditContext({
      request: 'make it calmer',
      document,
      selection: [],
      focus: { nodeIds: ['tale'], kind: 'edit' },
    });
    const business = sceneEditContext({
      request: 'make it calmer',
      document,
      selection: ['hero'],
    });

    expect(focused?.regions.map(({ id }) => id)).toEqual(['tale']);
    expect(business).toBeUndefined();
  });

  it.each([
    ['add a jump to the game', true],
    ['the character should wave', true],
    ['زيد مستوى جديد', true],
    ['خلي القصة أهدأ', true],
    ['make the footer links bigger', false],
    ['غيّر لون الأزرار', false],
  ])('on the whole page, «%s» speaks of the scene: %s', (request, expected) => {
    const scene = sceneEditContext({
      request,
      document: documentOf([...STORY_PAGE]),
      selection: [],
    });

    expect(scene !== undefined).toBe(expected);
  });

  it('pins nothing without a registry, and still plans the brief', () => {
    const scene = sceneEditContext({
      request: 'make it calmer',
      document: documentOf([...STORY_PAGE]),
      selection: ['tale'],
    });

    expect(scene?.skillIds).toEqual([]);
    expect(scene?.brief.id).toBe('craftkit:creative-brief');
  });
});

/** A page with content and no scene: where a new mural is added as an edit. */
const PLAIN_PAGE: readonly Region[] = [
  [
    'menu',
    'Menu',
    `<section id='menu'><h2>Our coffees</h2><p>Espresso and cardamom.</p></section>`,
  ],
];

function readyScenes(context: AssembledAiContext | undefined): string | undefined {
  return context?.fragments.find(({ source }) => source === 'craftkit:ready-scenes')?.body;
}

describe('runAiAgent — a new mural is offered the ready scenes that fit (2026-10-13)', () => {
  it('a mural added to a page hands the model the fitting ready scenes and the one-step tool', async () => {
    const { provider, contexts } = recording({
      rationale: 'Place the aurora.',
      commands: [
        { command: 'tool', args: { name: 'scene.preset', input: { preset: 'aurora-curtains' } } },
      ],
    });
    await runAiAgent(
      options(kernelFor(PLAIN_PAGE), provider, {
        request: 'Add a calm aurora mural section below the menu',
        selection: [],
      }),
    );

    const body = readyScenes(contexts[0]);
    expect(body).toContain('aurora-curtains');
    expect(body).toContain('ONE scene.preset step');
    expect(body).toContain('under 9,000 characters');
  });

  it('a game, a plain edit, or free code off is offered none', async () => {
    for (const extra of [
      { request: 'Add a snake game section below the menu' },
      { request: 'Make the menu copy friendlier' },
      { request: 'Add a calm aurora mural section below the menu', freeCode: false },
    ]) {
      const { provider, contexts } = recording(
        extra.freeCode === false
          ? {
              rationale: 'Place a closed mural.',
              commands: [
                {
                  command: 'tool',
                  args: { name: 'media.add', input: { kind: 'scene', scene: 'mesh-gradient' } },
                },
              ],
            }
          : relabel,
      );
      await runAiAgent(options(kernelFor(PLAIN_PAGE), provider, { selection: [], ...extra }));
      expect(readyScenes(contexts[0]), extra.request).toBeUndefined();
    }
  });

  it('a new story pins its director, graphics and dialogue companions automatically', async () => {
    const { provider } = recording(SCENE);
    const result = await runAiAgent(
      options(kernelFor(PLAIN_PAGE), provider, {
        request: 'Create an interactive story section',
        selection: [],
      }),
    );
    expect(pixiActivations(result)).toEqual(
      expect.arrayContaining([
        'craftkit.pixi-stories:explicit',
        'craftkit.pixi-director:explicit',
        'craftkit.pixi-dialogue:explicit',
        'craftkit.pixi-v8-graphics:explicit',
      ]),
    );
  });

  it('a standalone creative creation on a blank page pins its companions too', async () => {
    const { provider } = recording(SCENE);
    const result = await runAiAgent(
      options(kernelFor([]), provider, { request: 'Create an interactive story', selection: [] }),
    );
    expect(pixiActivations(result)).toEqual(
      expect.arrayContaining([
        'craftkit.pixi-stories:explicit',
        'craftkit.pixi-director:explicit',
        'craftkit.pixi-dialogue:explicit',
      ]),
    );
  });

  it('optional new-story companions fit the skill budget and respect automatic skills off', async () => {
    for (const autoSkills of [true, false]) {
      const { provider } = recording(SCENE);
      const result = await runAiAgent(
        options(kernelFor(PLAIN_PAGE), provider, {
          request: 'Create an interactive story section',
          selection: [],
          autoSkills,
          policy: { maxActiveSkills: 2, maxSkillTokens: 12_000 },
        }),
      );
      expect(result.proposal.skillActivations.length).toBeLessThanOrEqual(2);
      if (!autoSkills) expect(pixiActivations(result)).toEqual([]);
    }
  });
});

describe('runAiAgent — scene pins respect the person’s switches (2026-10-14)', () => {
  it('never pins a switched-off playbook on a scene edit; an explicit pick still wins', async () => {
    const off = { excludedSkillIds: ['craftkit.pixi-dialogue'] };
    const result = await runAiAgent(options(kernelFor(), recording().provider, off));
    expect(pixiActivations(result)).toEqual(
      expect.arrayContaining(SCENE_PINS.map((id) => `${id}:explicit`)),
    );
    expect(pixiActivations(result).join(' ')).not.toContain('craftkit.pixi-dialogue');
    const picked = await runAiAgent(
      options(kernelFor(), recording().provider, {
        ...off,
        selectedSkillIds: ['craftkit.pixi-dialogue'],
      }),
    );
    expect(pixiActivations(picked)).toContain('craftkit.pixi-dialogue:explicit');
  });

  it('never pins a switched-off companion of a new story', async () => {
    const result = await runAiAgent(
      options(kernelFor(PLAIN_PAGE), recording(SCENE).provider, {
        request: 'Create an interactive story section',
        selection: [],
        excludedSkillIds: ['craftkit.pixi-dialogue', 'craftkit.pixi-v8-graphics'],
      }),
    );
    expect(pixiActivations(result)).toContain('craftkit.pixi-stories:explicit');
    expect(pixiActivations(result).join(' ')).not.toMatch(/pixi-dialogue|pixi-v8-graphics/u);
  });
});
