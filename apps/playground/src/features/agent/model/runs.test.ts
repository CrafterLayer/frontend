import * as builder from '@craftkit/builder';
import type { AiBuildEvent, BuilderKernel } from '@craftkit/builder';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { createPlaygroundKernel } from '../../preview/create-playground-kernel';
import * as runs from './runs';
import {
  PLAN_MODE_SKILL_ID,
  blocksAtVersion,
  impactOfProposal,
  isBuildOwnEvent,
  lastDropped,
  lastFollowUp,
  ownsRun,
  preflightPorts,
  routeRequest,
  skillsForMode,
  withImpact,
  type AnsweredTurn,
} from './runs';
import type { EditTurn, ProposalTurn, StepPlanTurn, Turn } from './turns';

/*
  Real v2 turns, typed as `Turn`: a contract drift between `turns.ts` and this module fails
  the typecheck here instead of passing on a hand-made shape.
*/
const dropped = [
  {
    step: 3,
    command: 'setProp',
    reason:
      'The grouped plan was rejected by the kernel door: Type "hero" declares no prop "glow".',
  },
];
const you = (id: string): Turn => ({ id, kind: 'user', text: 'Make the hero darker', context: [] });
const edit = (id: string, extra: Partial<EditTurn> = {}): Turn => ({
  id,
  kind: 'edit',
  origin: 'request',
  status: 'done',
  changes: [],
  ...extra,
});
const proposal = (id: string, extra: Partial<ProposalTurn> = {}): Turn => ({
  id,
  kind: 'proposal',
  status: 'ready',
  changes: [],
  ...extra,
});
const steps = (id: string): StepPlanTurn => ({
  id,
  kind: 'step-plan',
  status: 'ready',
  steps: [],
  text: 'Darken the hero.',
  dropped: 2,
});

describe('what v2 deleted (SPEC §7.4)', () => {
  it('has no keyword routing: activatesBuildArchetype / BUILD_ARCHETYPES are gone (P0-1)', () => {
    expect(Object.keys(runs)).not.toContain('activatesBuildArchetype');
    expect(Object.keys(runs)).not.toContain('BUILD_ARCHETYPES');
  });

  it('has no retrySkippedRequest: a retry is a successor run, never an English sentence posted as the person', () => {
    expect(Object.keys(runs)).not.toContain('retrySkippedRequest');
  });
});

describe('ownsRun', () => {
  it('is true only for the run that holds the lease', () => {
    expect(ownsRun(null, 'run-1')).toBe(false);
    const lease = { runId: 'run-1', controller: new AbortController() };
    expect(ownsRun(lease, 'run-1')).toBe(true);
    expect(ownsRun(lease, 'run-2')).toBe(false);
  });
});

describe('isBuildOwnEvent', () => {
  it('tells the orchestrator’s own events from a step’s ordinary ones', () => {
    const own = { type: 'task.completed', runId: 'b' } as unknown as AiBuildEvent;
    const build = { type: 'build.planned', runId: 'b' } as unknown as AiBuildEvent;
    const step = { type: 'run.completed', runId: 'b/fill-1' } as unknown as AiBuildEvent;
    expect(isBuildOwnEvent(own)).toBe(true);
    expect(isBuildOwnEvent(build)).toBe(true);
    expect(isBuildOwnEvent(step)).toBe(false);
  });
});

describe('skillsForMode', () => {
  it('leaves the host’s own selection alone outside Plan', () => {
    expect(skillsForMode('ask', ['craftkit.landing-page'])).toEqual(['craftkit.landing-page']);
    expect(skillsForMode('auto', undefined)).toBeUndefined();
  });

  it('adds the plan skill in Plan mode, once, keeping what the host pinned', () => {
    expect(skillsForMode('plan', ['craftkit.landing-page'])).toEqual([
      'craftkit.landing-page',
      PLAN_MODE_SKILL_ID,
    ]);
    expect(skillsForMode('plan', [PLAN_MODE_SKILL_ID])).toEqual([PLAN_MODE_SKILL_ID]);
    expect(skillsForMode('plan', undefined)).toEqual([PLAN_MODE_SKILL_ID]);
  });
});

describe('lastFollowUp over v2 turns', () => {
  it('takes the conversation as it is stored: `readonly Turn[]` fits', () => {
    expectTypeOf<readonly Turn[]>().toExtend<readonly AnsweredTurn[]>();
  });

  it('finds nothing in an empty conversation', () => {
    expect(lastFollowUp([])).toBeUndefined();
  });

  it('reads the follow-up of the NEWEST answer, past what the person wrote', () => {
    const turns: readonly Turn[] = [
      edit('t1', { followUp: 'old' }),
      you('t2'),
      proposal('t3', { followUp: 'new' }),
    ];
    expect(lastFollowUp(turns)).toBe('new');
  });

  it('stops at the newest answer even when that one has none', () => {
    expect(lastFollowUp([edit('t1', { followUp: 'old' }), steps('t2')])).toBeUndefined();
  });
});

describe('lastDropped over v2 turns', () => {
  it('reads the steps the NEWEST answer’s salvage lost, where v2 keeps them', () => {
    expect(lastDropped([])).toBeUndefined();
    expect(lastDropped([edit('t1', { salvaged: { kept: 2, dropped } })])).toEqual(dropped);
    expect(lastDropped([proposal('t1', { salvaged: { kept: 1, dropped } }), you('t2')])).toEqual(
      dropped,
    );
  });

  it('lets a stale salvage go once a newer answer arrives', () => {
    expect(
      lastDropped([edit('t1', { salvaged: { kept: 2, dropped } }), you('t2'), edit('t3')]),
    ).toBeUndefined();
  });

  it('never reads a step plan’s count of refused commands as dropped steps', () => {
    expect(lastDropped([steps('t1')])).toBeUndefined();
  });
});

describe('withImpact and preflightPorts', () => {
  it('keeps a missing impact missing under exactOptionalPropertyTypes', () => {
    expect(withImpact(undefined)).toEqual({});
    expect('impact' in withImpact(undefined)).toBe(false);
  });

  it('hands every preflight the system ports, never the live kernel’s id source', () => {
    const ports = preflightPorts();
    expect(ports.clock).toBe(builder.systemClock);
    expect(ports.ids).toBe(builder.systemIds);
  });
});

/*
  A REAL validated proposal: `createAiValidatedProposal` is not on the facade, and a
  hand-built object would fail the proposal's authentication, so an Ask-mode run
  (`apply: 'never'`) over a provider that answers with one fixed plan makes it.
*/
async function proposalFor(kernel: BuilderKernel): Promise<builder.AiValidatedProposal> {
  const result = await builder.runAiAgent({
    runId: 'impact-probe',
    clock: builder.systemClock,
    kernel,
    provider: {
      propose: () =>
        Promise.resolve({
          rationale: 'Sharpen the hero heading.',
          commands: [
            {
              command: 'setProp',
              args: { id: 'hero', key: 'heading', value: 'Pages you can prove' },
            },
          ],
        }),
    },
    request: 'Sharpen the hero heading',
    selection: ['hero'],
    validationPorts: preflightPorts(),
    apply: 'never',
  });
  return result.proposal;
}

describe('impactOfProposal', () => {
  it('rehearses the proposal on a scratch kernel and reports what it would change', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    const before = kernel.getDocument();
    const impact = impactOfProposal(kernel, await proposalFor(kernel));

    expect(impact?.changed).toContain('hero');
    expect(impact?.empty).toBe(false);
    // A rehearsal, not a run: the live page and its history are untouched.
    expect(kernel.getDocument()).toBe(before);
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('says nothing, rather than failing the card, when the proposal can no longer be rehearsed', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    const proposal = await proposalFor(kernel);
    // The page moved on: the block the proposal edits is gone, so its preview throws.
    kernel.dispatch('removeNode', { id: 'hero' });
    expect(() =>
      builder.previewAiPlan({ kernel, proposal, validationPorts: preflightPorts() }),
    ).toThrow();

    expect(impactOfProposal(kernel, proposal)).toBeUndefined();
  });
});

describe('blocksAtVersion', () => {
  it('lists the kernel’s blocks for its surface', () => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    expect(blocksAtVersion(kernel, 0).length).toBeGreaterThan(0);
  });
});

/*
  ROUTING: the panel's one question before a run, answered by the engine's `routeIntent`
  (SPEC §7.6 E0g), never by keyword substrings over the skill registry.
*/
describe('routeRequest (over the engine’s routeIntent)', () => {
  const skeleton = (): BuilderKernel => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    for (const label of ['Hero', 'Pricing', 'FAQ']) {
      kernel.dispatch('insertNode', {
        type: 'customCode',
        parentId: 'root',
        props: {
          label,
          tree: {
            kind: 'root',
            children: [
              {
                kind: 'element',
                tag: 'section',
                children: [{ kind: 'element', tag: 'h2', text: label }],
              },
            ],
          },
        },
      });
    }
    return kernel;
  };

  it('keeps an edit out of the build, however page-like its words (P0-1)', () => {
    for (const request of [
      'change the wedding date to June 12',
      'make the landing page darker',
      'fix spacing in the portfolio section',
    ]) {
      expect(builder.isBuildIntent(routeRequest(request))).toBe(false);
    }
  });

  it('builds a page ask the keywords never matched (P1-5)', () => {
    for (const request of ['Build a website for my bakery', 'اعمل صفحه هبوط لتطبيق توصيل']) {
      expect(builder.isBuildIntent(routeRequest(request))).toBe(true);
    }
  });

  it('owns an empty page, and puts a page ask beside a page that has content', () => {
    expect(
      routeRequest('Build a website for my bakery', {
        kernel: createPlaygroundKernel({ fixture: 'empty' }),
      }),
    ).toMatchObject({ kind: 'build-page', target: 'replace' });
    const landing = createPlaygroundKernel({ fixture: 'landing' });
    expect(routeRequest('اعمل صفحة هبوط لمقهى', { kernel: landing })).toMatchObject({
      kind: 'build-page',
      target: 'new-page',
    });
  });

  it('reads a skeleton nobody filled as a page to build', () => {
    expect(
      routeRequest('make me a landing page for my cafe', { kernel: skeleton() }),
    ).toMatchObject({
      kind: 'build-page',
      target: 'replace',
    });
  });

  it('reads a mention CHIP as pointing at a block: v2 chips carry ids, the text does not', () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    expect(routeRequest('landing for my app', { kernel }).kind).toBe('build-page');
    expect(routeRequest('landing for my app', { kernel, mentions: ['hero'] }).kind).toBe('edit');
  });

  it('ignores a chip whose block is gone, so a stale chip cannot turn a build into an edit', () => {
    const kernel = createPlaygroundKernel({ fixture: 'empty' });
    expect(routeRequest('a bakery in Amman', { kernel, mentions: ['gone'] }).kind).toBe(
      'build-page',
    );
  });

  it('still reads a legacy @id in reused v1 text', () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    expect(routeRequest('landing for my app @hero', { kernel }).kind).toBe('edit');
  });

  it('prefers the selection it is handed over the kernel’s, and never counts the page itself', () => {
    const landing = createPlaygroundKernel({ fixture: 'landing' });
    expect(routeRequest('landing for my app', { kernel: landing, selection: ['hero'] }).kind).toBe(
      'edit',
    );
    landing.setSelection(['hero']);
    expect(routeRequest('landing for my app', { kernel: landing }).kind).toBe('edit');

    const empty = createPlaygroundKernel({ fixture: 'empty' });
    empty.setSelection([empty.getDocument().rootId]);
    expect(routeRequest('a bakery in Amman', { kernel: empty }).kind).toBe('build-page');
  });

  it('routes on the words alone when it is handed no page', () => {
    expect(routeRequest('Build a website for my bakery')).toMatchObject({
      kind: 'build-page',
      target: 'new-page',
    });
  });
});
