/**
 * A site build (T230, 2026-10-12): "Build a 4-page website: home, about, services,
 * contact" builds every page of the site, under ONE run. Before it, the request was built
 * as one page and the thread said so (`siteAsOnePage`, still the answer of a host that
 * cannot open pages).
 *
 * - The site is planned first: the provider's site plan when it can make one, else the
 *   pages read from the words (`planAiSite`). One line in the thread stands for the site:
 *   it says the pages are being planned, then names them, and the run ends on a line that
 *   says how many were built.
 * - The first page is the home page. It is built into the page on screen when that page is
 *   empty (or holds only an unfilled skeleton), else into a new page; every other page is
 *   opened through the host's `addPage` without becoming current, so the person keeps
 *   watching the home page.
 * - Every page is built at once, each its own build record with its page named in the
 *   head, and all of them share ONE writers' pool: the person's worker count (1, 3 or 6)
 *   is how many sections are written at a time across the whole site, never per page.
 * - One lease, claimed once and given back once: Stop ends every page.
 * - T230b: once every page has settled, each page that was built gets its header menu and
 *   footer link list pointed at the site's built pages (`linkSitePages`, the `nav.pages`
 *   tool), the page's own link marked current: one labelled AI transaction per page, part
 *   of that page's record. A page with no menu is left as it is.
 */
import {
  type AiSitePlan,
  type BuilderDocument,
  type BuilderKernel,
  createAiWriterPool,
  DEFAULT_AI_BUILD_BUDGET_MS,
  linkSitePages,
  planAiSite,
  sitePlanFromRequest,
  summarizeDocumentForIntent,
} from '@craftkit/builder';

import { siteLabels } from '../../copy/site-labels';
import { initialBuildProgress, landedCount } from '../../model/build-progress';
import { preflightPorts } from '../../model/runs';
import { agentScriptSiteFor } from '../../model/script-site';
import type { AnswerTurn, BuildTurn } from '../../model/turns';
import type { AssistantMode } from '../../model/view-types';

import { failBuild } from './build-settle';
import type { Env, Flow } from './controller-state';
import {
  creativeMark,
  engineRequest,
  historyFor,
  markNotRun,
  openExchange,
  type Outgoing,
  type Placement,
} from './exchange';
import { buildPage, type SitePagePart } from './page-build';
import { claim, release, setRun, type Slot } from './run-lease';
import { say } from './run-outcomes';
import { insertAfter, locateTurn, patchKind, patchTurn } from './turn-plumbing';

/* ── Which page wrote what ───────────────────────────────────────────────────── */

/**
 * The AI transactions each page of the run landed. A site's page lenses share one log and
 * one event bus, so neither says which page a transaction wrote: the page whose document
 * changed does. Undo build and the record's history are then the page's own, never the
 * site's (the run's own list, `collected`, holds every page's).
 */
interface PageLedger {
  readonly follow: (kernel: BuilderKernel) => void;
  readonly of: (kernel: BuilderKernel) => readonly string[];
  readonly dispose: () => void;
}

function documentOf(kernel: BuilderKernel): BuilderDocument | undefined {
  try {
    return kernel.getDocument();
  } catch {
    // A page removed while its site was built has no document left to compare.
    return undefined;
  }
}

function pageLedger(): PageLedger {
  const pages = new Map<BuilderKernel, { seen: BuilderDocument | undefined; ids: string[] }>();
  const buses = new Map<unknown, () => void>();
  return {
    follow: (kernel) => {
      if (pages.has(kernel)) return;
      pages.set(kernel, { seen: documentOf(kernel), ids: [] });
      const bus = kernel.context.events;
      if (buses.has(bus)) return;
      const off = bus.on('tx.applied', ({ tx }) => {
        for (const [page, entry] of pages) {
          const now = documentOf(page);
          if (now === entry.seen) continue;
          entry.seen = now;
          if (tx.author === 'ai') entry.ids.push(tx.id);
        }
      });
      buses.set(bus, off);
    },
    of: (kernel) => [...(pages.get(kernel)?.ids ?? [])],
    dispose: () => {
      for (const off of buses.values()) off();
      buses.clear();
    },
  };
}

/* ── The site ────────────────────────────────────────────────────────────────── */

/** One page of the site, as its record knows it. */
interface SitePageRun {
  readonly turnId: string;
  readonly runId: string;
  readonly title: string;
  readonly request: string;
}

/** The page on screen takes the home page when nothing of the person's is on it. */
function takesHome(kernel: BuilderKernel): boolean {
  const page = summarizeDocumentForIntent(kernel.getDocument());
  return page.nodeCount === 0 || page.placeholderOnly;
}

function pageRecord(env: Env, run: SitePageRun, now: number): BuildTurn {
  return {
    id: run.turnId,
    kind: 'build',
    request: run.request,
    progress: initialBuildProgress(run.runId, now),
    status: 'running',
    outcomes: {},
    page: run.title,
    ...creativeMark(env, run.request),
  };
}

/** A page a site is built on, and where it lives when the host says (T230b). */
interface OpenedPage {
  readonly kernel: BuilderKernel;
  readonly address?: string | undefined;
}

/** The address of the page on screen, from the site the host hands the panel; "/" without one. */
function addressOnScreen(kernel: BuilderKernel): string {
  try {
    return (
      agentScriptSiteFor(kernel)
        ?.pages()
        .find((page) => page.current)?.slug ?? '/'
    );
  } catch {
    return '/';
  }
}

/**
 * The kernel each page is built on: the page on screen for the home page when it takes it
 * (and keeps its address), else a page the host opens (the home page made current, the
 * others not). Null for a page a Stop came before; the error for a page the host could not
 * open.
 */
async function openPage(
  flow: Flow,
  slot: Slot,
  index: number,
  run: SitePageRun,
): Promise<OpenedPage | Error | null> {
  const { kernel, addPage } = flow.env().options;
  if (slot.controller.signal.aborted) return null;
  if (index === 0 && takesHome(kernel)) return { kernel, address: addressOnScreen(kernel) };
  if (addPage === undefined) return new Error('This host cannot open a page.');
  try {
    return await addPage(run.title, index === 0 ? {} : { current: false });
  } catch (cause) {
    return cause instanceof Error ? cause : new Error(String(cause));
  }
}

/** The run waits on the person while any page holds at its plan card (Ask). */
function heldPages(flow: Flow, slot: Slot): SitePagePart['hold'] {
  let held = 0;
  return (on) => {
    held = Math.max(0, held + (on ? 1 : -1));
    setRun(
      flow,
      slot,
      held > 0 ? { awaiting: true, activity: 'plan' } : { awaiting: false, activity: 'build' },
    );
  };
}

/** Build every page of a planned site under the run `slot` holds; settles when all have. */
async function buildSite(
  flow: Flow,
  slot: Slot,
  site: { readonly id: string; readonly plan: AiSitePlan; readonly mode: AssistantMode },
  history: ReturnType<typeof historyFor>,
): Promise<readonly SitePageBuilt[]> {
  const env = flow.env();
  const runs = site.plan.pages.map((page, index): SitePageRun => ({
    turnId: env.sessions.nextId('turn'),
    runId: `${slot.runId}/page-${String(index + 1)}`,
    title: page.title,
    request: page.request,
  }));
  // Every page's record at once, in site order: the person sees the whole site from the start.
  const now = flow.clock.now();
  insertAfter(
    flow,
    slot.sessionId,
    site.id,
    runs.map((run) => pageRecord(env, run, now)),
  );
  const first = runs[0];
  setRun(flow, slot, {
    activity: 'build',
    ...(first === undefined ? {} : { turnId: first.turnId }),
  });
  // Stop ends every page: each record says it is stopping until its build settles.
  const stopping = (): void => {
    for (const run of runs) {
      patchKind(flow, slot.sessionId, run.turnId, 'build', (turn) =>
        turn.status === 'running' ? { ...turn, stopping: true } : turn,
      );
    }
  };
  slot.controller.signal.addEventListener('abort', stopping, { once: true });
  const ledger = pageLedger();
  const engine = {
    writerPool: createAiWriterPool(flow.ui.getState().workers),
    // Pages share the writers, so each waits its turn: the budget is the site's.
    buildBudgetMs: DEFAULT_AI_BUILD_BUDGET_MS * runs.length,
  };
  const hold = heldPages(flow, slot);
  const builds: Promise<void>[] = [];
  const opened: (OpenedPage | undefined)[] = [];
  try {
    for (const [index, run] of runs.entries()) {
      const page = await openPage(flow, slot, index, run);
      opened.push(page instanceof Error || page === null ? undefined : page);
      if (page === null) {
        patchTurn(flow, slot.sessionId, run.turnId, () => ({
          id: run.turnId,
          kind: 'end',
          key: 'stoppedBeforeChange',
        }));
        continue;
      }
      if (page instanceof Error) {
        failBuild(flow, slot, run.turnId, null, run.request, page);
        continue;
      }
      const { kernel } = page;
      ledger.follow(kernel);
      builds.push(
        buildPage(flow, slot, {
          turnId: run.turnId,
          kernel,
          request: run.request,
          pointed: [],
          history,
          anchor: null,
          plan: { approval: site.mode === 'ask', notes: [], landed: () => ledger.of(kernel) },
          site: { runId: run.runId, title: run.title, engine, hold },
        }),
      );
    }
    await Promise.all(builds);
  } finally {
    ledger.dispose();
    slot.controller.signal.removeEventListener('abort', stopping);
  }
  return runs.map((run, index) => {
    const page = opened[index];
    return page === undefined ? { run } : { run, page };
  });
}

/** One page of the site after its build: its record, and the page it was built on. */
interface SitePageBuilt {
  readonly run: SitePageRun;
  readonly page?: OpenedPage;
}

/**
 * Point every built page's menus at the site's built pages (T230b): one AI transaction per
 * page, labelled in the person's language and added to that page's record, so its Undo
 * build takes it too. A page with no menu, or one the door refuses, keeps its own menus.
 */
function linkBuiltPages(flow: Flow, slot: Slot, built: readonly SitePageBuilt[]): void {
  const linked = built.flatMap(({ run, page }) =>
    page?.address === undefined ? [] : [{ run, kernel: page.kernel, href: page.address }],
  );
  if (linked.length < 2 || slot.controller.signal.aborted) return;
  const pages = linked.map(({ run, href }) => ({ label: run.title, href }));
  const label = siteLabels(flow.env().options.locale).linked;
  for (const { run, kernel, href } of linked) {
    let tx: ReturnType<typeof linkSitePages>;
    try {
      tx = linkSitePages({
        kernel,
        pages,
        current: href,
        label,
        validationPorts: preflightPorts(),
      });
    } catch {
      continue;
    }
    if (tx === null) continue;
    const id = tx.id;
    patchKind(flow, slot.sessionId, run.turnId, 'build', (turn) => ({
      ...turn,
      transactionIds: [...(turn.transactionIds ?? []), id],
    }));
  }
}

/**
 * Build the site a request asks for (see the header), or answer false before anything
 * happens when its words ask for one page after all: the caller builds that page.
 */
export async function runSite(
  flow: Flow,
  outgoing: Outgoing,
  placement: Placement,
  mode: AssistantMode,
): Promise<boolean> {
  const env = flow.env();
  const request = engineRequest(outgoing);
  if (sitePlanFromRequest(request, { assumeSite: true }) === null) return false;
  const labels = siteLabels(env.options.locale);
  const siteId = placement.recordTurnId ?? env.sessions.nextId('turn');
  const history = historyFor(flow, placement);
  const slot = claim(flow, placement.sessionId, siteId, 'plan');
  if (slot === null) return true;
  const line = (text: string): AnswerTurn => ({ id: siteId, kind: 'answer', text, request });
  const anchor = openExchange(flow, placement, outgoing, line(labels.planning));
  env.mood.beginRun(slot.runId, '');
  say(flow, 'build.started');
  try {
    let plan: AiSitePlan | null;
    try {
      const signal = slot.controller.signal;
      plan = await planAiSite({
        request,
        provider: env.provider,
        signal,
        history,
        assumeSite: true,
      });
    } catch {
      // Only a Stop rejects the plan (a failing provider falls back to the words).
      plan = null;
    }
    if (plan === null) {
      patchTurn(flow, slot.sessionId, siteId, () => ({
        id: siteId,
        kind: 'end',
        key: 'stoppedBeforeChange',
      }));
      markNotRun(flow, slot.sessionId, anchor);
      say(flow, 'stopped.none');
      env.mood.settleTurn({ runId: slot.runId, outcome: 'stopped' });
      return true;
    }
    const titles = plan.pages.map(({ title }) => title);
    patchTurn(flow, slot.sessionId, siteId, () => line(labels.building(titles)));
    const pages = await buildSite(flow, slot, { id: siteId, plan, mode }, history);
    const runs = pages.map(({ run }) => run);
    // Built as its record says "Page built": completed, with sections on the page.
    const records = runs.map((run) => locateTurn(flow, run.turnId)?.turn);
    const landed = (turn: (typeof records)[number]): number =>
      turn?.kind === 'build' ? landedCount(turn.progress) : 0;
    const complete = pages.filter((_, index) => {
      const turn = records[index];
      return turn?.kind === 'build' && turn.progress.phase === 'completed' && landed(turn) > 0;
    });
    linkBuiltPages(flow, slot, complete);
    const built = complete.map(({ run }) => run);
    const last = runs.at(-1)?.turnId ?? siteId;
    if (built.length > 0) {
      const text = labels.built(
        built.map(({ title }) => title),
        runs.length,
      );
      insertAfter(flow, slot.sessionId, last, [
        { id: env.sessions.nextId('turn'), kind: 'answer', text },
      ]);
    } else if (slot.controller.signal.aborted && records.every((turn) => landed(turn) === 0)) {
      markNotRun(flow, slot.sessionId, anchor);
    }
  } finally {
    release(flow, slot);
  }
  return true;
}
