/**
 * An interrupted first build is recoverable (2026-11-06), through the real controller, the
 * real engine and the vault's run journal over a memory store:
 * - the journal is written as the build goes, so a tab that dies mid-build leaves a record
 *   that reads "interrupted after 3 of 7", and a reload finds it;
 * - the page's newest build, read back, offers to continue where it stopped or keep what was
 *   built; Continue writes only the sections the journal had pending; Keep dismisses, for good;
 * - a completed build, or one the person undid, never offers it;
 * - Stop while the plan is still streaming, after sections landed early: the record says what
 *   landed, and Continue writes the rest instead of starting over.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AiPlan, AiPlanProvider, BuilderKernel, JsonValue } from '@craftkit/builder';
import { describe, expect, it, vi } from 'vitest';

import {
  createRunJournal,
  describeRun,
  landedUnits,
  pendingUnits,
  runEnding,
  type DocumentRunJournal,
  type RunJournal,
  type RunRecord,
} from '../../vault/run-journal';
import { createMemoryVaultStore } from '../../vault/store';
import type { AgentCheckpointPort } from '../model/checkpoints';
import type { AgentController, BuildRecordView } from '../model/view-types';
import {
  BUILD_REQUEST,
  coffeePlan,
  createBuildKernel,
  createPlanKernel,
  historyLabels,
  memoryStorage,
  regionsOf,
  scriptBuild,
  type MemoryStorage,
} from '../testing/scripted-engine';
import { useAgentController, type UseAgentControllerOptions } from './use-agent-controller';

// A jsdom suite: the scene probe needs a browser, and these tests are about landing.
vi.mock('./agent-controller/scene-probe-options', () => ({ sceneProbeOptions: () => ({}) }));

const SEVEN = ['Header', 'Hero', 'Menu', 'Story', 'Visit', 'Order', 'Footer'] as const;
const HELD = ['Story', 'Visit', 'Order', 'Footer'];
const DOC = 'playground/empty';
const WAIT = { timeout: 20_000 } as const;

type Options = Partial<UseAgentControllerOptions> & { readonly kernel: BuilderKernel };

function mount(options: Options) {
  const hook = renderHook((props: UseAgentControllerOptions) => useAgentController(props), {
    initialProps: { locale: 'en', storage: memoryStorage(), enhancer: null, ...options },
  });
  const c = (): AgentController => hook.result.current;
  return { ...hook, c };
}

function ask(c: () => AgentController, text: string): void {
  act(() => {
    c().setDraft(text);
  });
  act(() => {
    c().send();
  });
}

function build(c: () => AgentController): BuildRecordView {
  const turn = c().state.turns.findLast((entry) => entry.kind === 'build');
  if (turn?.kind !== 'build') throw new Error('No build record on screen.');
  return turn.view;
}

async function settled(c: () => AgentController): Promise<void> {
  await waitFor(() => {
    expect(c().state.run).toBeNull();
  }, WAIT);
}

/** The one record the journal holds for the document. */
async function onlyRecord(journal: RunJournal): Promise<RunRecord> {
  const [record, ...more] = await journal.list(DOC);
  if (record === undefined || more.length > 0) throw new Error('Expected exactly one record.');
  return record;
}

/** A tab's journal that can die: from `die()` on, nothing it is told reaches the store. */
function dyingTab(journal: RunJournal) {
  let dead = false;
  const alive = (write: () => Promise<void>): Promise<void> => (dead ? Promise.resolve() : write());
  const port: DocumentRunJournal = {
    docId: DOC,
    journal: {
      ...journal,
      record: (runId, event) => alive(() => journal.record(runId, event)),
      settle: (runId, result) => alive(() => journal.settle(runId, result)),
      fail: (runId, reason) => alive(() => journal.fail(runId, reason)),
      halt: (runId) => alive(() => journal.halt(runId)),
      decline: (runId) => alive(() => journal.decline(runId)),
      keep: (runId) => alive(() => journal.keep(runId)),
      reopen: (runId) => alive(() => journal.reopen(runId)),
    },
  };
  return {
    port,
    die: () => {
      dead = true;
    },
  };
}

/** A page keeper that only records what it was asked to save. */
function checkpoints(): AgentCheckpointPort & { readonly saved: string[] } {
  const saved: string[] = [];
  return {
    saved,
    before: () => undefined,
    restoreBefore: () => Promise.resolve('missing'),
    list: () => Promise.resolve([]),
    restore: () => Promise.resolve('missing'),
    save: (label) => {
      saved.push(label);
      return Promise.resolve(undefined);
    },
    subscribe: () => () => undefined,
  };
}

/**
 * A seven-section build whose tab dies after three sections landed: the conversation as it
 * was saved at that moment, the vault store the journal wrote, and the page itself.
 */
async function crashAfterThree() {
  const kernel = createBuildKernel();
  const store = createMemoryVaultStore();
  const first = scriptBuild(kernel, SEVEN, { hold: HELD });
  const tab = dyingTab(createRunJournal({ store, now: () => 1_000 }));
  const storage = memoryStorage();
  const before = mount({ kernel, provider: first.provider, storage, runJournal: tab.port });
  ask(before.c, BUILD_REQUEST);
  await waitFor(() => {
    expect(build(before.c).landed).toBe(3);
  }, WAIT);
  const journal = createRunJournal({ store, now: () => 2_000 });
  await waitFor(async () => {
    expect(landedUnits(await onlyRecord(journal))).toHaveLength(3);
  }, WAIT);
  // The crash: no more writes from this tab, then it is gone.
  tab.die();
  const saved: MemoryStorage = memoryStorage(Object.fromEntries(storage.data));
  before.unmount();
  return { kernel, store, saved };
}

/** The reload: a new tab over the same storage, store and page. */
function reload(
  kernel: BuilderKernel,
  store: ReturnType<typeof createMemoryVaultStore>,
  storage: MemoryStorage,
) {
  const script = scriptBuild(kernel, SEVEN);
  const keeper = checkpoints();
  const journal = createRunJournal({ store, now: () => 3_000 });
  const tab = mount({
    kernel,
    provider: script.provider,
    storage,
    checkpoints: keeper,
    runJournal: { docId: DOC, journal },
  });
  return { ...tab, script, keeper, journal };
}

describe('a build interrupted by a crash, met again after a reload', () => {
  it('leaves a journal that reads “interrupted after 3 of 7”, and survives the reload', async () => {
    const { kernel, store, saved } = await crashAfterThree();
    const record = await onlyRecord(createRunJournal({ store, now: () => 3_000 }));
    expect(runEnding(record)).toBe('interrupted');
    expect(describeRun(record)).toBe('interrupted after 3 of 7 sections');
    expect(record).toMatchObject({ request: BUILD_REQUEST, status: 'running' });
    expect(landedUnits(record).map((unit) => unit.label)).toEqual([
      'Assistant: 1/7 — Header',
      'Assistant: 2/7 — Hero',
      'Assistant: 3/7 — Menu',
    ]);
    expect(pendingUnits(record).map((unit) => unit.title)).toEqual(HELD);

    const { c } = reload(kernel, store, saved);
    await waitFor(() => {
      expect(build(c).recovery).toEqual({ landed: 3, total: 7 });
    }, WAIT);
    expect(build(c).phase).toBe('interrupted');
  }, 60_000);

  it('continues where it stopped: only the pending sections are written, then it is done', async () => {
    const { kernel, store, saved } = await crashAfterThree();
    const page = reload(kernel, store, saved);
    await waitFor(() => {
      expect(build(page.c).recovery).toBeDefined();
    }, WAIT);
    const landedBefore = historyLabels(kernel);

    act(() => {
      page.c().finishRest(build(page.c).turnId);
    });
    await waitFor(() => {
      expect(build(page.c).phase).toBe('done');
    }, WAIT);
    expect([...page.script.fills].sort()).toEqual([...HELD].sort());
    expect(historyLabels(kernel).slice(0, landedBefore.length)).toEqual(landedBefore);
    expect(historyLabels(kernel).slice(landedBefore.length).sort()).toEqual(
      [
        'Assistant: 4/7 — Story',
        'Assistant: 5/7 — Visit',
        'Assistant: 6/7 — Order',
        'Assistant: 7/7 — Footer',
      ].sort(),
    );
    expect(regionsOf(kernel)).toMatchObject({
      Header: 'Body for Header.',
      Footer: 'Body for Footer.',
    });
    expect(build(page.c).recovery).toBeUndefined();
    // The partial page was kept as a version before it changed again.
    expect(page.keeper.saved).toEqual([`Build (interrupted): ${BUILD_REQUEST}`]);
    await waitFor(async () => {
      expect(runEnding(await onlyRecord(page.journal))).toBe('completed');
    }, WAIT);
  }, 60_000);

  it('keeps what was built: the offer goes, for good, and the partial page is a version', async () => {
    const { kernel, store, saved } = await crashAfterThree();
    const page = reload(kernel, store, saved);
    await waitFor(() => {
      expect(build(page.c).recovery).toBeDefined();
    }, WAIT);
    const transactions = kernel.transactions().length;

    act(() => {
      page.c().keepBuild?.(build(page.c).turnId);
    });
    expect(build(page.c).recovery).toBeUndefined();
    // Nothing written to the page: what landed stays exactly as it is.
    expect(kernel.transactions()).toHaveLength(transactions);
    expect(page.keeper.saved).toEqual([`Build (interrupted): ${BUILD_REQUEST}`]);
    await waitFor(async () => {
      expect((await onlyRecord(page.journal)).kept).toBe(true);
    }, WAIT);

    // And after another reload it is still kept (the reloaded tab saved into `saved`).
    const again = memoryStorage(Object.fromEntries(saved.data));
    page.unmount();
    const later = reload(kernel, store, again);
    await act(async () => {
      await Promise.resolve();
    });
    expect(build(later.c).recovery).toBeUndefined();
  }, 60_000);
});

describe('a build that needs no recovery never offers it', () => {
  it('a completed build, read back, offers nothing', async () => {
    const kernel = createBuildKernel();
    const store = createMemoryVaultStore();
    const journal = createRunJournal({ store, now: () => 1_000 });
    const storage = memoryStorage();
    const first = mount({
      kernel,
      provider: scriptBuild(kernel, SEVEN).provider,
      storage,
      runJournal: { docId: DOC, journal },
    });
    ask(first.c, BUILD_REQUEST);
    await waitFor(() => {
      expect(build(first.c).phase).toBe('done');
    }, WAIT);
    await waitFor(async () => {
      expect(runEnding(await onlyRecord(journal))).toBe('completed');
    }, WAIT);
    first.unmount();

    const page = reload(kernel, store, memoryStorage(Object.fromEntries(storage.data)));
    await act(async () => {
      await Promise.resolve();
    });
    expect(build(page.c).recovery).toBeUndefined();
  }, 60_000);

  it('a build the person undid, read back, offers nothing', async () => {
    const kernel = createBuildKernel();
    const store = createMemoryVaultStore();
    const journal = createRunJournal({ store, now: () => 1_000 });
    const storage = memoryStorage();
    const first = mount({
      kernel,
      provider: scriptBuild(kernel, SEVEN).provider,
      storage,
      runJournal: { docId: DOC, journal },
    });
    ask(first.c, BUILD_REQUEST);
    await waitFor(() => {
      expect(build(first.c).actions.undoBuild).toBe(true);
    }, WAIT);
    act(() => {
      first.c().undoBuild(build(first.c).turnId);
    });
    expect(build(first.c).phase).toBe('undone');
    first.unmount();

    const page = reload(kernel, store, memoryStorage(Object.fromEntries(storage.data)));
    await act(async () => {
      await Promise.resolve();
    });
    expect(build(page.c).phase).toBe('undone');
    expect(build(page.c).recovery).toBeUndefined();
  }, 60_000);
});

/* ── Stop while the plan streams, after sections landed early ─────────────── */

type Json = Record<string, unknown>;

/** The fixture's plan in the streamed shape: an outline of titles, then one brief per section. */
function compactPlan(): Json {
  const plan = coffeePlan() as unknown as Json;
  const sections = plan['sections'] as Json[];
  return {
    ...plan,
    sections: sections.map(({ key, role, title, anchorId, variant }) => ({
      key,
      role,
      title,
      anchorId,
      ...(variant === undefined ? {} : { variant }),
    })),
    briefs: sections.map(({ key, purpose, mustSay }) => ({
      key,
      purpose,
      ...(mustSay === undefined ? {} : { mustSay }),
    })),
  };
}

function sectionTree(request: string): JsonValue {
  const title = /SECTION \d+ OF \d+: ([^\n]+)/u.exec(request)?.[1] ?? 'Section';
  return {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        children: [{ kind: 'element', tag: 'h2', text: title, children: [] }],
      },
    ],
  };
}

/**
 * A planner that streams its whole answer at once and then never finishes it (until Stop
 * aborts it). Each writer answers at once, except the `held` sections' while `holding`;
 * `asked` lists the regions written, in order.
 */
function neverFinishingPlanner(held: ReadonlySet<string>) {
  const asked: string[] = [];
  let holding = true;
  const text = JSON.stringify({ version: 1, rationale: 'A warm page.', pagePlan: compactPlan() });
  const provider: AiPlanProvider = {
    propose(request) {
      const id = /REGION ID: (\S+)/u.exec(request)?.[1];
      const title = /SECTION \d+ OF \d+: ([^\n]+)/u.exec(request)?.[1] ?? '';
      if (id !== undefined) asked.push(id);
      if (holding && held.has(title)) return new Promise<AiPlan>(() => undefined);
      return Promise.resolve<AiPlan>({
        rationale: 'Filled.',
        commands:
          id === undefined
            ? []
            : [{ command: 'setProp', args: { id, key: 'tree', value: sectionTree(request) } }],
      });
    },
    proposePagePlan(_request, _context, live) {
      live?.onDraft?.({ kind: 'start' });
      live?.onDraft?.({ kind: 'text', text });
      return new Promise((_resolve, reject) => {
        live?.signal?.addEventListener(
          'abort',
          () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true },
        );
      });
    },
  };
  return {
    provider,
    asked,
    release: () => {
      holding = false;
    },
  };
}

describe('Stop while the plan streams, after sections landed early', () => {
  it('records what landed, and Continue writes the rest instead of starting over', async () => {
    const kernel = createPlanKernel();
    const held = new Set(['Our coffees', 'Order today']);
    const planner = neverFinishingPlanner(held);
    const store = createMemoryVaultStore();
    const journal = createRunJournal({ store, now: () => 1_000 });
    const { c } = mount({
      kernel,
      provider: planner.provider,
      runJournal: { docId: DOC, journal },
    });
    ask(c, 'Build a landing page for my specialty coffee roastery in Amman, Northlight Coffee');
    // Every section but the held two lands while the planner has still not answered.
    await waitFor(() => {
      const rows = build(c).rows;
      expect(rows).toHaveLength(5);
      expect(rows.every((row) => held.has(row.title) || row.state === 'landed')).toBe(true);
    }, WAIT);
    const landedTitles = build(c)
      .rows.filter((row) => !held.has(row.title))
      .map((row) => row.title);
    await waitFor(async () => {
      expect(landedUnits(await onlyRecord(journal)).map((unit) => unit.title)).toEqual(
        landedTitles,
      );
    }, WAIT);
    act(() => {
      c().stop();
    });
    await settled(c);

    const stopped = build(c);
    expect(stopped.phase).toBe('stopped');
    expect(stopped.rows.filter((row) => row.state === 'landed').map((row) => row.title)).toEqual(
      landedTitles,
    );
    expect(stopped.actions.finishRest).toBe(2);
    let record = await onlyRecord(journal);
    await waitFor(async () => {
      record = await onlyRecord(journal);
      expect(runEnding(record)).toBe('stopped');
    }, WAIT);
    expect(landedUnits(record).map((unit) => unit.title)).toEqual(landedTitles);
    expect(landedUnits(record).every((unit) => unit.label !== undefined)).toBe(true);
    expect(record.outline?.map((entry) => entry.title)).toEqual([
      'Header',
      'Roasted this morning',
      'Our coffees',
      'Order today',
      'Footer',
    ]);
    const pending = pendingUnits(record).map((unit) => unit.id);
    expect(pendingUnits(record).map((unit) => unit.title)).toEqual([...held]);

    const history = historyLabels(kernel);
    planner.asked.length = 0;
    planner.release();
    act(() => {
      c().finishRest(stopped.turnId);
    });
    await waitFor(() => {
      expect(build(c).phase).toBe('done');
    }, WAIT);
    // Only the sections that had not landed were written; nothing was laid out again.
    expect([...planner.asked].sort()).toEqual([...pending].sort());
    expect(historyLabels(kernel).slice(0, history.length)).toEqual(history);
    expect(historyLabels(kernel)).toHaveLength(history.length + pending.length);
    await waitFor(async () => {
      expect(runEnding(await onlyRecord(journal))).toBe('completed');
    }, WAIT);
  }, 60_000);
});
