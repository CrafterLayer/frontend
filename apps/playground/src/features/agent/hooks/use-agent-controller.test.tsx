/**
 * The controller (SPEC §7.3, §8 WP-16), held to the honesty rules of SPEC §6.5 with real
 * engines: real kernels through the real door, the real `runAiBuild` / `runAiAgent` /
 * `planAiPage`, and scripted providers (`testing/scripted-engine.ts`).
 *
 * - build → drafted → ordered landing: ink only after `task.completed`, in page order;
 * - Stop → zero writes after it, and the queue pauses;
 * - Ask → nothing written before Build, and an edited plan is built verbatim;
 * - Plan mode → nothing written, and Build builds the plan on the card;
 * - the queue is revalidated against the page before it runs;
 * - row Undo touches only its section and says `changedSince` when it cannot;
 * - successor runs write exactly the named sections, in place;
 * - a question writes nothing; an Ask edit writes only on Apply;
 * - a direct edit asks no model; a model edit runs on the host's fast model; a picked
 *   catalog suggestion is answered from the catalog;
 * - Improve replaces the draft, Restore brings it back, typing forgets it;
 * - an unclear request runs nothing until its questions are answered, and "Send as
 *   written" runs the words untouched.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AiBuildOwnEvent, BuilderKernel } from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import { capabilitiesFromEngine } from '../model/capabilities';
import type { AgentController, BuildRecordView, TurnView } from '../model/view-types';
import {
  BUILD_REQUEST,
  PLAN_TITLES,
  createBuildKernel,
  createEditKernel,
  createPlanKernel,
  editProvider,
  fillFor,
  historyLabels,
  memoryStorage,
  planningProvider,
  recordingProvider,
  refusingProvider,
  regionId,
  regionList,
  regionsOf,
  scriptBuild,
  scriptedEnhancer,
  wordsProvider,
} from '../testing/scripted-engine';
import { useAgentController, type UseAgentControllerOptions } from './use-agent-controller';

const THREE = ['Hero', 'Proof', 'Pricing'] as const;
const PLAN_REQUEST =
  'Build a landing page for my specialty coffee roastery in Amman, Northlight Coffee';
const WAIT = { timeout: 20_000 } as const;

type Options = Partial<UseAgentControllerOptions> & { readonly kernel: BuilderKernel };

function mount(options: Options) {
  const storage = memoryStorage();
  const events: AiBuildOwnEvent[] = [];
  const hook = renderHook((props: UseAgentControllerOptions) => useAgentController(props), {
    initialProps: {
      locale: 'en',
      storage,
      enhancer: null,
      onBuildEvent: (event) => events.push(event),
      ...options,
    },
  });
  const c = (): AgentController => hook.result.current;
  return { ...hook, c, storage, events };
}

function ask(c: () => AgentController, text: string): void {
  act(() => {
    c().setDraft(text);
  });
  act(() => {
    c().send();
  });
}

type ViewByKind = { [T in TurnView as T['kind']]: T['view'] };

function turnsOf<K extends TurnView['kind']>(c: () => AgentController, kind: K): ViewByKind[K][] {
  const views: ViewByKind[K][] = [];
  for (const turn of c().state.turns) {
    if (turn.kind === kind) views.push(turn.view as ViewByKind[K]);
  }
  return views;
}

/** The first record of `kind` on screen; a test that expects one fails loudly without it. */
function firstOf<K extends TurnView['kind']>(c: () => AgentController, kind: K): ViewByKind[K] {
  const view = turnsOf(c, kind)[0];
  if (view === undefined) throw new Error(`No ${kind} record on screen.`);
  return view;
}

function build(c: () => AgentController): BuildRecordView {
  const view = turnsOf(c, 'build').at(-1);
  if (view === undefined) throw new Error('No build record on screen.');
  return view;
}

function states(view: BuildRecordView): string[] {
  return view.rows.map((row) => row.state);
}

async function settled(c: () => AgentController): Promise<void> {
  await waitFor(() => {
    expect(c().state.run).toBeNull();
  }, WAIT);
}

describe('useAgentController: builds', () => {
  it('lands sections in page order, a finished draft waits its turn and is never ink', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { hold: ['Hero'] });
    const { c } = mount({ kernel, provider: script.provider });

    ask(c, BUILD_REQUEST);

    // Proof and Pricing are written while Hero is held: drafted, not landed (SPEC §1).
    await waitFor(() => {
      expect(states(build(c))).toEqual(['writing', 'drafted', 'drafted']);
    }, WAIT);
    expect(build(c).landed).toBe(0);
    expect(regionsOf(kernel)).toEqual({ Hero: '', Proof: '', Pricing: '' });
    expect(c().state.run?.statusKey).toBe('build.blocked');

    act(() => {
      script.gates.get('Hero')?.resolve(fillFor(kernel, 'Hero'));
    });
    await settled(c);

    expect(build(c).phase).toBe('done');
    expect(build(c).landed).toBe(3);
    // The transaction log reads top to bottom: every section landed in page order.
    expect(historyLabels(kernel)).toEqual([
      'Assistant: page skeleton',
      'Assistant: 1/3 — Hero',
      'Assistant: 2/3 — Proof',
      'Assistant: 3/3 — Pricing',
    ]);
    expect(c().state.announcement?.key).toBe('build.done');
  }, 60_000);

  it('writes nothing after Stop, pauses the queue and empties the composer', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { hold: ['Proof'] });
    const { c, events } = mount({ kernel, provider: script.provider });

    ask(c, BUILD_REQUEST);
    await waitFor(() => {
      expect(regionsOf(kernel)['Hero']).toBe('Body for Hero.');
    }, WAIT);
    // A request typed while it runs becomes the one queued request.
    ask(c, 'how do I change the font on this page?');
    expect(c().state.queue).toMatchObject({ status: 'editable' });
    expect(c().state.send).toBe('running-queued');

    const writesAtStop = kernel.transactions().length;
    const eventsAtStop = events.length;
    act(() => {
      c().stop();
    });
    expect(c().state.run?.stopping).toBe(true);
    // The held writer finishes after Stop: nothing of it may land.
    act(() => {
      script.gates.get('Proof')?.resolve(fillFor(kernel, 'Proof'));
    });
    await settled(c);

    expect(kernel.transactions()).toHaveLength(writesAtStop);
    expect(events.slice(eventsAtStop).map((event) => event.type)).not.toContain('task.completed');
    expect(regionsOf(kernel)).toEqual({ Hero: 'Body for Hero.', Proof: '', Pricing: '' });
    const record = build(c);
    expect(record.phase).toBe('stopped');
    expect(states(record)).toEqual(['landed', 'notWritten', 'notWritten']);
    expect(record.actions).toMatchObject({ finishRest: 2, removeEmpty: 2 });
    // FR-054: the queued request waits for Continue, and the composer is free again.
    expect(c().state.queue).toMatchObject({ status: 'paused' });
    expect(c().state.draft).toBe('');
    expect(turnsOf(c, 'answer')).toHaveLength(0);
  }, 60_000);

  it('finishes the rest in place, writing exactly the sections that were not written', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { hold: ['Proof'] });
    const provider = {
      ...script.provider,
      propose: (...args: Parameters<typeof script.provider.propose>) => {
        args[2]?.onUsage?.({
          inputTokens: 10,
          outputTokens: 4,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        });
        return script.provider.propose(...args);
      },
    };
    const { c } = mount({ kernel, provider });

    ask(c, BUILD_REQUEST);
    await waitFor(() => {
      expect(regionsOf(kernel)['Hero']).toBe('Body for Hero.');
    }, WAIT);
    act(() => {
      c().stop();
    });
    act(() => {
      script.gates.get('Proof')?.resolve(fillFor(kernel, 'Proof'));
    });
    await settled(c);
    const asked = script.fills.length;
    const bubbles = turnsOf(c, 'user').length;

    act(() => {
      c().finishRest(build(c).turnId);
    });
    await waitFor(() => {
      expect(build(c).phase).toBe('done');
    }, WAIT);
    await settled(c);

    // Only the two unwritten sections were asked for, and Hero was not touched.
    expect(script.fills.slice(asked).sort()).toEqual(['Pricing', 'Proof']);
    expect(regionList(kernel)).toEqual([
      ['Hero', 'Body for Hero.'],
      ['Proof', 'Body for Proof.'],
      ['Pricing', 'Body for Pricing.'],
    ]);
    expect(build(c).landed).toBe(3);
    const telemetry = c().state.turns.find((turn) => turn.kind === 'build')?.telemetry;
    expect(Object.values(telemetry?.attempts ?? {})).toHaveLength(6);
    expect(
      Object.values(telemetry?.attempts ?? {}).reduce(
        (sum, usage) => sum + (usage?.inputTokens ?? 0),
        0,
      ),
    ).toBe(60);
    // A successor is an action, never a sentence posted as the person's turn.
    expect(turnsOf(c, 'user')).toHaveLength(bubbles);
  }, 60_000);

  it('retries only the failed section, in its own region', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { refuse: ['Proof'] });
    const { c } = mount({ kernel, provider: script.provider });

    ask(c, BUILD_REQUEST);
    await settled(c);
    expect(build(c).phase).toBe('partial');
    expect(build(c).actions.retryFailed).toBe(1);
    const failed = build(c).rows.find((row) => row.state === 'failed');
    expect(failed).toMatchObject({ title: 'Proof', canRetry: true });

    script.refused.delete('Proof');
    const asked = script.fills.length;
    act(() => {
      c().retrySections(build(c).turnId, [failed?.key ?? '']);
    });
    await waitFor(() => {
      expect(build(c).phase).toBe('done');
    }, WAIT);
    await settled(c);

    expect(script.fills.slice(asked)).toEqual(['Proof']);
    expect(regionsOf(kernel)).toEqual({
      Hero: 'Body for Hero.',
      Proof: 'Body for Proof.',
      Pricing: 'Body for Pricing.',
    });
    expect(historyLabels(kernel).at(-1)).toBe('Assistant: 2/3 — Proof');
  }, 60_000);

  it('puts one section back forward, leaves a hand edit alone and says changedSince', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { c } = mount({ kernel, provider: script.provider });

    ask(c, BUILD_REQUEST);
    await settled(c);
    const record = build(c);
    expect(record.rows.every((row) => row.undo?.kind === 'undo')).toBe(true);

    act(() => {
      kernel.dispatch('setProp', {
        id: regionId(kernel, 'Hero'),
        key: 'tree',
        value: 'Written by hand.',
      });
    });
    act(() => {
      c().undoSection(record.turnId, regionId(kernel, 'Proof'));
    });

    expect(regionsOf(kernel)).toEqual({
      Hero: 'Written by hand.',
      Proof: '',
      Pricing: 'Body for Pricing.',
    });
    expect(historyLabels(kernel).at(-1)).toBe('Assistant: revert 2/3 — Proof');
    const proof = build(c).rows.find((row) => row.title === 'Proof');
    expect(proof).toMatchObject({ state: 'undone', undo: { kind: 'redo' } });

    // Hero was changed by hand after it was built: its Undo refuses, and says why.
    const before = kernel.transactions().length;
    act(() => {
      c().undoSection(record.turnId, regionId(kernel, 'Hero'));
    });
    expect(kernel.transactions()).toHaveLength(before);
    expect(regionsOf(kernel)['Hero']).toBe('Written by hand.');
    expect(build(c).rows.find((row) => row.title === 'Hero')?.undo).toEqual({
      kind: 'unavailable',
      why: 'changedSince',
    });

    // Redo puts the section back as the writer left it, forward again.
    act(() => {
      c().redoSection(record.turnId, regionId(kernel, 'Proof'));
    });
    expect(regionsOf(kernel)['Proof']).toBe('Body for Proof.');
    expect(build(c).rows.find((row) => row.title === 'Proof')).toMatchObject({
      state: 'landed',
      undo: { kind: 'undo' },
    });
  }, 60_000);

  it('undoes the whole build while it is the newest history, and redoes it', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { c } = mount({ kernel, provider: script.provider });

    ask(c, BUILD_REQUEST);
    await settled(c);
    expect(build(c).actions.undoBuild).toBe(true);

    act(() => {
      c().undoBuild(build(c).turnId);
    });
    expect(regionList(kernel)).toEqual([]);
    expect(build(c).phase).toBe('undone');
    expect(build(c).actions.redoBuild).toBe(true);

    act(() => {
      c().redoBuild(build(c).turnId);
    });
    expect(regionList(kernel).map(([label]) => label)).toEqual([...THREE]);
    expect(build(c).phase).toBe('done');

    // A later change of the person's own sits on top now: Undo build would take it too.
    act(() => {
      kernel.dispatch('setProp', { id: regionId(kernel, 'Hero'), key: 'tree', value: 'Mine.' });
    });
    await waitFor(() => {
      expect(build(c).actions.undoBuild).toBe(false);
    });
  }, 60_000);

  it('with the engine’s Undo build, puts back every section it can, newest first, and no more', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { c } = mount({
      kernel,
      provider: script.provider,
      capabilities: { ...capabilitiesFromEngine(), rowUndo: true, undoBuild: true },
    });

    ask(c, BUILD_REQUEST);
    await settled(c);
    // A hand edit sits on top: a kernel undo would take it too, so the build goes back by rows.
    act(() => {
      kernel.dispatch('setProp', { id: regionId(kernel, 'Hero'), key: 'tree', value: 'Mine.' });
    });
    act(() => {
      c().undoBuild(build(c).turnId);
    });

    expect(regionsOf(kernel)).toEqual({ Hero: 'Mine.', Proof: '', Pricing: '' });
    expect(historyLabels(kernel).slice(-2)).toEqual([
      'Assistant: revert 3/3 — Pricing',
      'Assistant: revert 2/3 — Proof',
    ]);
    // Not every section went back, so the build does not claim to be undone.
    expect(build(c).phase).not.toBe('undone');
    expect(build(c).rows.find((row) => row.title === 'Hero')?.undo).toEqual({
      kind: 'unavailable',
      why: 'changedSince',
    });
  }, 60_000);

  it('removes the empty sections a stopped build left, as one change', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { hold: ['Proof'] });
    const { c } = mount({ kernel, provider: script.provider });

    ask(c, BUILD_REQUEST);
    await waitFor(() => {
      expect(regionsOf(kernel)['Hero']).toBe('Body for Hero.');
    }, WAIT);
    act(() => {
      c().stop();
    });
    await settled(c);

    const before = kernel.transactions().length;
    act(() => {
      c().removeEmpty(build(c).turnId);
    });
    expect(regionList(kernel)).toEqual([['Hero', 'Body for Hero.']]);
    expect(kernel.transactions()).toHaveLength(before + 1);
    expect(build(c).actions.removeEmpty).toBe(0);
  }, 60_000);

  it('builds a site request as one page and says so after the record', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const { c } = mount({ kernel, provider: script.provider });

    ask(c, 'build a 3-page website for my bakery: home, menu and contact');
    await settled(c);

    expect(build(c).phase).toBe('done');
    const kinds = c().state.turns.map((turn) => turn.kind);
    expect(kinds).toEqual(['user', 'build', 'end']);
    expect(turnsOf(c, 'end')[0]?.key).toBe('siteAsOnePage');
    // The end note is part of the build's exchange: the record stays open.
    expect(build(c).collapsed).toBe(false);
  }, 60_000);

  it('opens a new page through the host when it can, and builds there', async () => {
    const kernel = createBuildKernel();
    kernel.dispatch('insertNode', {
      type: 'region',
      parentId: 'root',
      props: { label: 'Existing', tree: 'Written by hand.' },
    });
    const fresh = createBuildKernel();
    const script = scriptBuild(fresh, THREE);
    const titles: string[] = [];
    const { c } = mount({
      kernel,
      provider: script.provider,
      addPage: (title) => {
        titles.push(title);
        return Promise.resolve({ kernel: fresh });
      },
    });

    ask(c, BUILD_REQUEST);
    await settled(c);

    expect(titles).toEqual([BUILD_REQUEST]);
    expect(regionList(kernel)).toEqual([['Existing', 'Written by hand.']]);
    expect(regionList(fresh).map(([label]) => label)).toEqual([...THREE]);
    expect(turnsOf(c, 'end')).toEqual([]);
  }, 60_000);
});

describe('useAgentController: Ask and Plan', () => {
  it('Ask: writes nothing before Build, then builds the edited plan verbatim', async () => {
    const kernel = createPlanKernel();
    const { c } = mount({ kernel, provider: planningProvider() });
    act(() => {
      c().setMode('ask');
    });

    ask(c, PLAN_REQUEST);
    await waitFor(() => {
      expect(turnsOf(c, 'page-plan')[0]).toMatchObject({ status: 'ready', approval: true });
    }, WAIT);
    const plan = firstOf(c, 'page-plan');
    expect(plan.sections.map((section) => section.title)).toEqual(PLAN_TITLES);
    expect(plan.editable).toBe(true);
    expect(kernel.transactions()).toHaveLength(0);
    // Awaiting a decision: the plan card is the surface, not a RunBar.
    expect(c().state.run).toBeNull();

    const menu = plan.sections.find((section) => section.title === 'Our coffees');
    act(() => {
      c().editPlan(plan.turnId, { kind: 'rename', key: menu?.key ?? '', title: 'Our beans' });
    });
    expect(firstOf(c, 'page-plan').edited).toBe(true);
    expect(kernel.transactions()).toHaveLength(0);

    act(() => {
      c().build(plan.turnId);
    });
    await waitFor(() => {
      expect(turnsOf(c, 'build')[0]?.phase).toBe('done');
    }, WAIT);
    await settled(c);

    // The same turn inked in place, and exactly the edited plan was built.
    expect(build(c).turnId).toBe(plan.turnId);
    expect(regionList(kernel).map(([label]) => label)).toEqual([
      'Header',
      'Roasted this morning',
      'Our beans',
      'Order today',
      'Footer',
    ]);
  }, 60_000);

  it('Ask: Discard answers the held question, and nothing is written', async () => {
    const kernel = createPlanKernel();
    const { c } = mount({ kernel, provider: planningProvider() });
    act(() => {
      c().setMode('ask');
    });
    ask(c, PLAN_REQUEST);
    await waitFor(() => {
      expect(turnsOf(c, 'page-plan')[0]?.status).toBe('ready');
    }, WAIT);

    act(() => {
      c().discard(firstOf(c, 'page-plan').turnId);
    });
    await settled(c);
    expect(turnsOf(c, 'end')[0]?.key).toBe('planDiscarded');
    expect(kernel.transactions()).toHaveLength(0);
  }, 60_000);

  it('Plan mode: plans without writing, then Build builds the plan on the card', async () => {
    const kernel = createPlanKernel();
    const provider = planningProvider();
    const { c } = mount({ kernel, provider });
    act(() => {
      c().setMode('plan');
    });

    ask(c, PLAN_REQUEST);
    await settled(c);
    const plan = firstOf(c, 'page-plan');
    expect(plan).toMatchObject({ status: 'ready', approval: false, note: 'exact', editable: true });
    expect(kernel.transactions()).toHaveLength(0);
    expect(provider.planCalls()).toBe(1);

    act(() => {
      c().build(plan.turnId);
    });
    await waitFor(() => {
      expect(turnsOf(c, 'build')[0]?.phase).toBe('done');
    }, WAIT);
    await settled(c);
    expect(regionList(kernel).map(([label]) => label)).toEqual(PLAN_TITLES);
    // The plan is built, not asked for again.
    expect(provider.planCalls()).toBe(1);
    // A section the skeleton wrote in full has no earlier version: no Undo, never a false one.
    const footer = build(c).rows.find((row) => row.title === 'Footer');
    expect(footer?.undo).toBeUndefined();
  }, 60_000);
});

describe('useAgentController: edits and questions', () => {
  it('answers a question in words and writes nothing', async () => {
    const kernel = createEditKernel();
    const provider = wordsProvider('Open Theme and pick a display face.');
    const { c } = mount({ kernel, provider });

    ask(c, 'how do I change the font on this page?');
    await settled(c);

    expect(turnsOf(c, 'answer')[0]?.text).toBe('Open Theme and pick a display face.');
    expect(provider.calls()).toBe(1);
    expect(kernel.transactions()).toHaveLength(0);
    expect(c().state.announcement?.key).toBe('answer.ready');
  }, 30_000);

  it('Ask edit: the page changes only on Apply, and Undo takes it back', async () => {
    const kernel = createEditKernel();
    kernel.setSelection(['selected-hero']);
    const { c } = mount({
      kernel,
      provider: editProvider([
        {
          command: 'setProp',
          args: { id: 'selected-hero', key: 'heading', value: 'Welcome home' },
        },
      ]),
    });
    act(() => {
      c().setMode('ask');
    });
    expect(c().state.chips).toEqual([
      { kind: 'selection', id: 'selected-hero', label: 'Hero', stale: false },
    ]);

    ask(c, 'change the heading to Welcome home');
    await settled(c);
    const proposal = firstOf(c, 'proposal');
    expect(proposal).toMatchObject({ status: 'ready', pageUnchanged: true, target: 'Hero' });
    expect(proposal.changes).toEqual([
      { kind: 'changed', label: 'Heading', before: 'Existing section', after: 'Welcome home' },
    ]);
    expect(kernel.getDocument().nodes['selected-hero']?.props['heading']).toBe('Existing section');
    expect(kernel.transactions()).toHaveLength(0);

    act(() => {
      c().apply(proposal.turnId);
    });
    expect(kernel.getDocument().nodes['selected-hero']?.props['heading']).toBe('Welcome home');
    const applied = firstOf(c, 'edit');
    expect(applied).toMatchObject({ phase: 'done', origin: 'proposal', undo: { kind: 'undo' } });

    act(() => {
      c().undoEdit(applied.turnId);
    });
    expect(kernel.getDocument().nodes['selected-hero']?.props['heading']).toBe('Existing section');
    expect(firstOf(c, 'edit').phase).toBe('undone');
  }, 30_000);

  it('Auto edit applies at once, and offers no Undo once a later change sits on top', async () => {
    const kernel = createEditKernel();
    kernel.setSelection(['selected-hero']);
    const { c } = mount({
      kernel,
      provider: editProvider([
        { command: 'setProp', args: { id: 'selected-hero', key: 'heading', value: 'Clinic' } },
      ]),
    });

    ask(c, 'change the heading to Clinic');
    await settled(c);
    const edit = firstOf(c, 'edit');
    expect(edit).toMatchObject({ phase: 'done', target: 'Hero', undo: { kind: 'undo' } });
    expect(kernel.getDocument().nodes['selected-hero']?.props['heading']).toBe('Clinic');

    act(() => {
      kernel.dispatch('setProp', { id: 'selected-hero', key: 'heading', value: 'Mine' });
    });
    // No greyed Undo under a build row's reason ("this section changed after it was built").
    await waitFor(() => {
      expect(firstOf(c, 'edit').undo).toBeUndefined();
    });
    expect(firstOf(c, 'edit').phase).toBe('done');
  }, 30_000);

  it('an edit the model answers in words alone is an answer, never "already matched"', async () => {
    // Auto: no command, so nothing landed; the model's words are the record.
    const kernel = createEditKernel();
    kernel.setSelection(['selected-hero']);
    const provider = wordsProvider('Which page should the link open?');
    const { c } = mount({ kernel, provider });
    ask(c, 'change the heading');
    await settled(c);
    expect(turnsOf(c, 'edit')).toEqual([]);
    expect(turnsOf(c, 'answer')[0]?.text).toBe('Which page should the link open?');
    expect(c().state.announcement?.key).toBe('answer.ready');
    expect(kernel.transactions()).toHaveLength(0);

    // Ask: no command is no proposal either, so there is no Apply that can do nothing.
    const asked = mount({ kernel: createEditKernel(), provider: wordsProvider('Which page?') });
    act(() => {
      asked.c().setMode('ask');
    });
    ask(asked.c, 'change the heading');
    await settled(asked.c);
    expect(turnsOf(asked.c, 'proposal')).toEqual([]);
    expect(turnsOf(asked.c, 'answer')[0]?.text).toBe('Which page?');
  }, 30_000);
});

describe('useAgentController: fast edits', () => {
  it('a zero-token direct edit reads like any edit, instantly, with Undo', async () => {
    // The owner's own request: a one-word title change must not wait on a model.
    const kernel = createPlanKernel(['التعليم والشهادات', 'الخبرات']);
    const provider = refusingProvider();
    const { c } = mount({ kernel, provider });

    ask(c, 'تغيير عنوان قسم التعليم والشهادات إلى مرحبا');
    await settled(c);

    expect(provider.calls()).toBe(0);
    expect(kernel.transactions()).toHaveLength(1);
    expect(JSON.stringify(kernel.getDocument().nodes['mine-0']?.props['tree'])).toContain('مرحبا');
    const edit = turnsOf(c, 'edit')[0];
    expect(edit).toMatchObject({ phase: 'done', origin: 'request', undo: { kind: 'undo' } });
    // It names the section it changed, not «عُدِّلت الصفحة» (SPEC §3.6).
    expect(edit?.target).toBe('التعليم والشهادات');

    act(() => {
      if (edit !== undefined) c().undoEdit(edit.turnId);
    });
    expect(JSON.stringify(kernel.getDocument().nodes['mine-0']?.props['tree'])).not.toContain(
      'مرحبا',
    );
    expect(turnsOf(c, 'edit')[0]?.phase).toBe('undone');
  }, 30_000);

  it('runs a model edit on the host’s fast edit model', async () => {
    const kernel = createEditKernel();
    kernel.setSelection(['selected-hero']);
    const provider = recordingProvider([
      {
        command: 'setProp',
        args: { id: 'selected-hero', key: 'heading', value: 'A warmer welcome' },
      },
    ]);
    const { c } = mount({ kernel, provider, editModel: 'vendor/fast:free', editEffort: 'low' });

    // Not a direct edit: nothing in the words is the heading's new text.
    ask(c, 'give this heading a warmer, friendlier tone');
    await settled(c);

    expect(provider.live[0]).toMatchObject({ model: 'vendor/fast:free', effort: 'low' });
    expect(kernel.getDocument().nodes['selected-hero']?.props['heading']).toBe('A warmer welcome');
  }, 30_000);

  it('answers a picked catalog suggestion from the catalog, never the provider', async () => {
    const kernel = createEditKernel();
    const provider = refusingProvider();
    const { c } = mount({ kernel, provider });

    const picked = c().state.suggestions.find((suggestion) => suggestion.source === 'catalog');
    expect(picked).toBeDefined();
    // A suggestion fills the box (SuggestionList) and never sends; the person sends it.
    ask(c, picked?.text ?? '');
    await settled(c);

    expect(provider.calls()).toBe(0);
    expect(kernel.transactions().length).toBeGreaterThan(0);
    expect(turnsOf(c, 'edit')[0]?.phase).toBe('done');
  }, 30_000);
});

describe('useAgentController: the queue', () => {
  it('revalidates the queued request before it runs: a target that is gone does not run', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { hold: ['Proof'] });
    const { c } = mount({ kernel, provider: script.provider });

    ask(c, BUILD_REQUEST);
    await waitFor(() => {
      expect(regionsOf(kernel)['Hero']).toBe('Body for Hero.');
    }, WAIT);
    const hero = regionId(kernel, 'Hero');
    act(() => {
      kernel.setSelection([hero]);
    });
    ask(c, 'make this section darker');
    expect(c().state.queue).toMatchObject({ status: 'editable', text: 'make this section darker' });

    // The person deletes the block the queued request is about, while the build runs.
    act(() => {
      kernel.dispatch('removeNode', { id: hero });
    });
    expect(c().state.queue?.status).toBe('missing');
    act(() => {
      script.gates.get('Proof')?.resolve(fillFor(kernel, 'Proof'));
    });
    await settled(c);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(c().state.queue?.status).toBe('missing');
    expect(c().state.run).toBeNull();
    expect(turnsOf(c, 'user')).toHaveLength(1);
  }, 60_000);

  it('runs the queued request after the run ends, and a paused one only on Continue', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { hold: ['Proof'] });
    const { c } = mount({ kernel, provider: script.provider });

    ask(c, BUILD_REQUEST);
    await waitFor(() => {
      expect(regionsOf(kernel)['Hero']).toBe('Body for Hero.');
    }, WAIT);
    ask(c, 'how do I change the font on this page?');
    act(() => {
      c().stop();
    });
    await settled(c);
    expect(c().state.queue?.status).toBe('paused');
    expect(turnsOf(c, 'answer')).toHaveLength(0);

    act(() => {
      c().continueQueued();
    });
    await waitFor(() => {
      expect(turnsOf(c, 'answer')).toHaveLength(1);
    }, WAIT);
    expect(c().state.queue).toBeNull();
    expect(turnsOf(c, 'user').map((turn) => turn.text)).toEqual([
      BUILD_REQUEST,
      'how do I change the font on this page?',
    ]);
  }, 60_000);
});

describe('useAgentController: Improve and clarify', () => {
  it('Improve replaces the draft, Restore brings the words back, typing forgets them', async () => {
    const kernel = createEditKernel();
    const enhancer = scriptedEnhancer(() => ({
      enhanced: 'Build a one-page site for a dental clinic in Amman with WhatsApp booking.',
      understood: 'A dental clinic page in Amman',
      changes: ['Named the city'],
    }));
    const { c } = mount({ kernel, provider: wordsProvider('unused'), enhancer });
    expect(c().state.enhancement.status).toBe('idle');

    act(() => {
      c().setDraft('dental page amman');
    });
    act(() => {
      c().enhanceDraft();
    });
    await waitFor(() => {
      expect(c().state.enhancement.status).toBe('enhanced');
    });
    expect(c().state.draft).toBe(
      'Build a one-page site for a dental clinic in Amman with WhatsApp booking.',
    );
    expect(c().state.enhancement).toMatchObject({
      understood: 'A dental clinic page in Amman',
      canRestore: true,
    });
    expect(c().state.announcement?.key).toBe('enhance.ready');
    expect(enhancer.calls[0]).toMatchObject({ text: 'dental page amman', locale: 'en' });

    act(() => {
      c().restoreDraft();
    });
    expect(c().state.draft).toBe('dental page amman');
    expect(c().state.enhancement.status).toBe('idle');

    act(() => {
      c().enhanceDraft();
    });
    await waitFor(() => {
      expect(c().state.enhancement.status).toBe('enhanced');
    });
    act(() => {
      c().setDraft(`${c().state.draft} Add prices.`);
    });
    expect(c().state.enhancement.status).toBe('idle');
    act(() => {
      c().restoreDraft();
    });
    expect(c().state.draft).toContain('Add prices.');
  }, 30_000);

  it('a failed Improve leaves the draft as it was, and no enhancer hides the action', async () => {
    const kernel = createEditKernel();
    const failing = mount({
      kernel,
      provider: wordsProvider('unused'),
      enhancer: scriptedEnhancer(() => new Error('The assistant server could not be reached.')),
    });
    act(() => {
      failing.c().setDraft('dental page');
    });
    act(() => {
      failing.c().enhanceDraft();
    });
    await waitFor(() => {
      expect(failing.c().state.enhancement.status).toBe('failed');
    });
    expect(failing.c().state.draft).toBe('dental page');

    const none = mount({
      kernel: createEditKernel(),
      provider: wordsProvider('unused'),
      enhancer: null,
    });
    expect(none.c().state.enhancement.status).toBe('unavailable');
  }, 30_000);

  it('an unclear request runs nothing until its questions are answered, then runs the rewrite', async () => {
    const kernel = createBuildKernel();
    const provider = wordsProvider('Teal reads calm and clinical.');
    const enhancer = scriptedEnhancer((input) =>
      input.answers === undefined
        ? {
            understood: 'You want the page in another colour',
            questions: [
              { id: 'colour', text: 'Which colour?', choices: ['Teal', 'Navy'] },
              { id: 'where', text: 'Where?', choices: ['Everywhere', 'Only the header'] },
            ],
          }
        : { enhanced: 'Which colour suits a dental clinic, teal everywhere?' },
    );
    const { c } = mount({ kernel, provider, enhancer });

    // "make it blue" on an empty page: an edit the router is only 0.5 sure of.
    ask(c, 'make it blue');
    await waitFor(() => {
      expect(c().state.clarify?.status).toBe('asking');
    });
    expect(c().state.draft).toBe('');
    // No exchange opened, but the person's own words stay on screen as their bubble.
    expect(c().state.turns.map((turn) => turn.kind)).toEqual(['user']);
    const bubble = c().state.turns[0];
    expect(bubble?.kind === 'user' ? bubble.view.text : null).toBe('make it blue');
    expect(provider.calls()).toBe(0);
    expect(c().state.announcement?.key).toBe('clarify.ready');

    act(() => {
      c().answerClarify('colour', 'Teal');
    });
    expect(c().state.clarify?.status).toBe('asking');
    expect(provider.calls()).toBe(0);
    act(() => {
      c().answerClarify('where', 'Everywhere');
    });
    await settled(c);
    await waitFor(() => {
      expect(turnsOf(c, 'answer')).toHaveLength(1);
    }, WAIT);

    expect(c().state.clarify).toBeNull();
    // The person's turn shows the rewritten request: it is what ran.
    expect(turnsOf(c, 'user')[0]?.text).toBe(
      'Which colour suits a dental clinic, teal everywhere?',
    );
    expect(enhancer.calls.at(-1)?.answers).toEqual([
      { id: 'colour', question: 'Which colour?', answer: 'Teal' },
      { id: 'where', question: 'Where?', answer: 'Everywhere' },
    ]);
  }, 30_000);

  it('Send as written runs the words untouched; Dismiss puts them back in the box', async () => {
    const kernel = createBuildKernel();
    const provider = wordsProvider('A plan.');
    const enhancer = scriptedEnhancer(() => ({
      understood: 'Unclear',
      questions: [{ id: 'q1', text: 'What should change?', choices: ['Colour', 'Layout'] }],
    }));
    const { c } = mount({ kernel, provider, enhancer });
    act(() => {
      c().setMode('plan');
    });

    ask(c, 'make it blue');
    await waitFor(() => {
      expect(c().state.clarify?.status).toBe('asking');
    });
    act(() => {
      c().dismissClarify();
    });
    expect(c().state.clarify).toBeNull();
    expect(c().state.draft).toBe('make it blue');
    expect(provider.calls()).toBe(0);

    act(() => {
      c().send();
    });
    await waitFor(() => {
      expect(c().state.clarify?.status).toBe('asking');
    });
    act(() => {
      c().sendAsWritten();
    });
    await settled(c);
    await waitFor(() => {
      expect(turnsOf(c, 'step-plan')[0]?.status).toBe('ready');
    }, WAIT);
    expect(turnsOf(c, 'user')[0]?.text).toBe('make it blue');
    expect(provider.calls()).toBe(1);
    expect(kernel.transactions()).toHaveLength(0);
  }, 30_000);

  it('a failed check never builds an unsure page: it is planned, and nothing is written', async () => {
    // "a pricing page" beside content routes to a new page at 0.6. With the check timed out,
    // running it as written opened a new page and built it whole, unasked.
    const kernel = createPlanKernel(['About us', 'Contact']);
    const provider = planningProvider();
    const enhancer = scriptedEnhancer(() => new Error('The request timed out.'));
    let pagesOpened = 0;
    const { c } = mount({
      kernel,
      provider,
      enhancer,
      addPage: () => {
        pagesOpened += 1;
        return Promise.resolve({ kernel: createPlanKernel() });
      },
    });

    ask(c, 'a pricing page');
    await settled(c);
    await waitFor(() => {
      expect(turnsOf(c, 'page-plan')[0]?.status).toBe('ready');
    }, WAIT);
    expect(enhancer.calls).toHaveLength(1);
    expect(c().state.clarify).toBeNull();
    expect(firstOf(c, 'page-plan')).toMatchObject({ approval: false });
    expect(turnsOf(c, 'build')).toEqual([]);
    expect(provider.planCalls()).toBe(1);
    expect(pagesOpened).toBe(0);
    expect(kernel.transactions()).toHaveLength(0);

    // A newer request is its own, not a change to the unsure plan (merged, it would build).
    ask(c, 'make the headings bigger');
    await settled(c);
    await waitFor(() => {
      expect(turnsOf(c, 'answer')).toHaveLength(1);
    }, WAIT);
    expect(turnsOf(c, 'page-plan')[0]?.status).toBe('ready');
    expect(turnsOf(c, 'end')).toEqual([]);
    expect(turnsOf(c, 'build')).toEqual([]);
    expect(provider.planCalls()).toBe(1);
    expect(pagesOpened).toBe(0);
    expect(kernel.transactions()).toHaveLength(0);
  }, 60_000);

  it('a failed check on an unsure edit still runs it as written', async () => {
    // "make it blue" on an empty page: an edit the router is only 0.5 sure of.
    const kernel = createBuildKernel();
    const provider = wordsProvider('Blue what? The page is empty.');
    const enhancer = scriptedEnhancer(() => new Error('The request timed out.'));
    const { c } = mount({ kernel, provider, enhancer });
    ask(c, 'make it blue');
    await settled(c);
    await waitFor(() => {
      expect(turnsOf(c, 'answer')).toHaveLength(1);
    }, WAIT);
    expect(enhancer.calls).toHaveLength(1);
    expect(provider.calls()).toBe(1);
    expect(turnsOf(c, 'page-plan')).toEqual([]);
  }, 30_000);

  it('a low-confidence request with no questions runs as it is', async () => {
    const kernel = createBuildKernel();
    const provider = wordsProvider('A plan.');
    const enhancer = scriptedEnhancer(() => ({ understood: 'Clear enough' }));
    const { c } = mount({ kernel, provider, enhancer });
    act(() => {
      c().setMode('plan');
    });
    ask(c, 'make it blue');
    await settled(c);
    await waitFor(() => {
      expect(turnsOf(c, 'step-plan')[0]?.status).toBe('ready');
    }, WAIT);
    expect(c().state.clarify).toBeNull();
    expect(enhancer.calls).toHaveLength(1);
  }, 30_000);
});

describe('useAgentController: conversations', () => {
  it('keeps a build across a reload, revived: its rows cannot claim a working Undo', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE);
    const first = mount({ kernel, provider: script.provider });
    ask(first.c, BUILD_REQUEST);
    await settled(first.c);
    first.unmount();

    const second = renderHook(() =>
      useAgentController({ kernel, locale: 'en', storage: first.storage, enhancer: null }),
    );
    const revived = second.result.current.state.turns.find((turn) => turn.kind === 'build');
    expect(revived?.kind).toBe('build');
    if (revived?.kind !== 'build') return;
    expect(revived.view.revived).toBe(true);
    expect(revived.view.rows.every((row) => row.undo?.kind === 'unavailable')).toBe(true);
    // The v2 key only.
    expect([...first.storage.data.keys()]).toEqual(['pg-agent-sessions-v2']);
  }, 60_000);

  it('does not open a new conversation while a run is live', async () => {
    const kernel = createBuildKernel();
    const script = scriptBuild(kernel, THREE, { hold: ['Hero'] });
    const { c } = mount({ kernel, provider: script.provider });
    ask(c, BUILD_REQUEST);
    await waitFor(() => {
      expect(c().state.run).not.toBeNull();
    });
    act(() => {
      c().newConversation();
    });
    expect(c().state.sessions).toHaveLength(1);
    act(() => {
      script.gates.get('Hero')?.resolve(fillFor(kernel, 'Hero'));
    });
    await settled(c);
    act(() => {
      c().newConversation();
    });
    expect(c().state.sessions).toHaveLength(2);
    expect(c().state.turns).toEqual([]);
  }, 60_000);
});
