import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { chromium, type Browser, type Locator, type Page } from 'playwright';

/**
 * SPIKE S4 / the evidence driver.
 *
 * WHAT IT IS: the one thing that turns "the tests are green" into "the product
 * did it". Every delivery in the plan ends by running this against a real
 * playground and citing the file it writes; a delivery with no evidence file is
 * not finished, however many unit tests pass.
 *
 * WHY IT HAD TO BE WRITTEN: earlier verification notes in this repo cite "live
 * Playwright proof", but there is no Playwright project anywhere — those runs
 * were a person driving an MCP browser by hand, which cannot be re-run, cannot
 * fail a gate, and leaves nothing to diff against the next delivery.
 *
 * WHAT IT DELIBERATELY IS NOT: a test framework. It asserts nothing and never
 * exits non-zero on a product outcome. It RECORDS what happened — milestones
 * with timestamps, the kernel's own transaction count before and after, and a
 * screenshot — and a human or a later gate reads the file. A driver that judged
 * would tempt everyone to make the judgement pass; a driver that only witnesses
 * cannot be gamed.
 *
 * It imports nothing from this workspace on purpose: Playwright plus Node
 * builtins only, so Node runs the TypeScript directly and the driver can never
 * be broken by the code it is meant to observe.
 */

const DEFAULT_URL = 'http://127.0.0.1:5199';
/** Long because a real provider answers in minutes; the local one in moments. */
const SETTLE_TIMEOUT_MS = 660_000;
const STEP_TIMEOUT_MS = 30_000;
/** How often the build card's rows are read while a run is in flight. */
const SECTIONS_POLL_MS = 250;
/** A row mid-re-render is skipped, not waited on: the poller must keep moving. */
const ROW_READ_TIMEOUT_MS = 1_000;

/** The panel's modes, by the label a person clicks. */
const MODE_LABEL = { ask: 'Ask', auto: 'Auto', plan: 'Plan' } as const;
type PanelMode = keyof typeof MODE_LABEL;

export interface DriveOptions {
  readonly url: string;
  readonly request: string;
  readonly name: string;
  readonly outDir: string;
  readonly headless: boolean;
  /** Apply the proposal the assistant returns, then undo it once. */
  readonly applyAndUndo: boolean;
  /**
   * The mode to select before sending, or undefined to leave the panel's own
   * default. A page-sized request in Ask stops at the approval card; the same
   * request in Auto runs the whole split build, which is the only way to
   * witness how many sections are written at once.
   */
  readonly mode: PanelMode | undefined;
  /**
   * The document fixture to open first (the playground's "Fixture" select:
   * `landing`, `empty`, `inline`, `code-view`), or undefined for whatever the
   * playground opens by itself. A page-sized request on the demo landing page
   * and the same request on an empty page are two different products — the
   * 2026-09-05 run proved it: on `landing` the scaffold created no labelled
   * regions and the build silently fell back to one ordinary run.
   */
  readonly fixture: string | undefined;
  /**
   * Where to keep the raw AI wire traffic — each POST to the plan endpoint as
   * `<stamp>-<name>-call-NN-request.json` and `-response.txt` — or undefined
   * to keep none. Not the evidence directory: a request body is the whole
   * assembled context (tens of thousands of characters) and belongs beside a
   * debugging session, not in a committed record. Every call also leaves two
   * milestones in the evidence itself, so the per-call timing is kept even
   * when the bodies are not.
   */
  readonly captureDir: string | undefined;
}

interface Milestone {
  readonly at: number;
  readonly sinceStartMs: number;
  readonly what: string;
  readonly detail?: string;
}

export interface DriveEvidence {
  readonly version: 1;
  readonly name: string;
  readonly url: string;
  readonly request: string;
  readonly startedAt: string;
  readonly milestones: readonly Milestone[];
  /*
    The kernel's transaction LOG length. It grows on a commit and does NOT
    shrink on undo — undo records no transaction (Law S) and removes none — so
    `afterUndo` equalling `afterApply` is correct, not a bug. Whether an undo
    actually happened is `undo` below.
  */
  readonly transactions: {
    readonly before: number;
    readonly afterApply: number | null;
    readonly afterUndo: number | null;
  };
  /** What the editor's own Undo/Redo controls said, before and after one undo. */
  readonly undo: {
    readonly canUndoBeforeApply: boolean;
    readonly canUndoAfterApply: boolean;
    readonly canRedoAfterUndo: boolean;
  } | null;
  /**
   * What the PRODUCT did. `failed` means the run ended without offering
   * anything to apply; `timeout` and a set `failure` mean the DRIVER could not
   * observe an ending, which is a different fact and is what `observed` says.
   */
  readonly outcome:
    'proposed' | 'applied' | 'undone' | 'awaiting-approval' | 'built' | 'failed' | 'timeout';
  /**
   * What the BUILD card showed, when the request routed to a split build: one
   * row per section with its status, read every quarter second and recorded as
   * a `sections` milestone on every change. `peakRunning` is the most rows seen
   * in `running` at one reading — the observable behind "how many sections are
   * written at once" — and `count` is the card's own "n/m" text at settle.
   * Null when no build card ever appeared.
   */
  readonly build: {
    readonly sections: number;
    readonly titles: readonly string[];
    readonly peakRunning: number;
    readonly final: readonly string[];
    readonly count: string | null;
  } | null;
  /**
   * Whether the driver watched the run to an ending. False means the record
   * says nothing about the product — only that the observation broke.
   */
  readonly observed: boolean;
  readonly consoleErrors: readonly string[];
  /**
   * The conversation as the panel showed it at settle, whitespace collapsed.
   * A screenshot shows one viewport of a long thread; this keeps the whole of
   * what the assistant said — the plan card, the skill activations, a build's
   * fallback — readable by a later reader without a browser.
   */
  readonly conversation: string;
  /** Names relative to the evidence directory, sharing this run's stamp. */
  readonly screenshots: readonly string[];
  /** Set only when the DRIVER broke. */
  readonly failure?: string;
  /** Set when the product ended in a way worth explaining to a later reader. */
  readonly note?: string;
}

function readOptions(argv: readonly string[]): DriveOptions {
  const flag = (name: string, fallback: string): string => {
    const hit = argv.find((arg) => arg.startsWith(`--${name}=`));
    return hit === undefined ? fallback : hit.slice(name.length + 3);
  };
  return {
    url: flag('url', process.env['CRAFTKIT_PLAYGROUND_URL'] ?? DEFAULT_URL),
    request: flag('request', 'Add a pricing section'),
    name: flag('name', 'drive'),
    outDir: resolve(flag('out', 'evidence/live')),
    headless: !argv.includes('--headed'),
    applyAndUndo: !argv.includes('--propose-only'),
    mode: parseMode(flag('mode', '')),
    fixture: flag('fixture', '') === '' ? undefined : flag('fixture', ''),
    captureDir: flag('capture', '') === '' ? undefined : resolve(flag('capture', '')),
  };
}

function parseMode(raw: string): PanelMode | undefined {
  if (raw === '') return undefined;
  if (raw === 'ask' || raw === 'auto' || raw === 'plan') return raw;
  // Loud, not lenient: a misspelt mode silently driving the default would
  // record an Ask run under an Auto name, and the file would lie for good.
  throw new Error(`--mode must be one of ask, auto, plan; got "${raw}".`);
}

/** One reading of the build card's section rows, in page order. */
interface SectionsReading {
  readonly titles: readonly string[];
  readonly statuses: readonly string[];
}

/**
 * The build card's own rows — `data-status` per section — or null while no
 * build card exists. Read through locators only, because this driver has no
 * DOM lib; and a row that re-renders mid-read is skipped (short timeout, then
 * null) rather than waited on, because a poller that blocks on one stale row
 * misses the very transitions it exists to record.
 */
async function readSections(panel: Locator): Promise<SectionsReading | null> {
  const rows = await panel
    .getByRole('list', { name: 'Sections' })
    .last()
    .locator('li.pg-chat__task')
    .all();
  if (rows.length === 0) return null;
  try {
    const statuses = await Promise.all(
      rows.map((row) => row.getAttribute('data-status', { timeout: ROW_READ_TIMEOUT_MS })),
    );
    const titles = await Promise.all(
      rows.map((row) =>
        row.locator('.pg-chat__task-title').textContent({ timeout: ROW_READ_TIMEOUT_MS }),
      ),
    );
    return {
      statuses: statuses.map((status) => status ?? 'unknown'),
      titles: titles.map((title) => (title ?? '').trim()),
    };
  } catch {
    return null;
  }
}

/** `4 sections · running 1,2,3,4` — positions are 1-based, as the card shows them. */
function describeSections(reading: SectionsReading): string {
  const positions = new Map<string, string[]>();
  reading.statuses.forEach((status, index) => {
    positions.set(status, [...(positions.get(status) ?? []), String(index + 1)]);
  });
  const groups = [...positions].map(([status, at]) => `${status} ${at.join(',')}`);
  return `${String(reading.statuses.length)} sections · ${groups.join(' · ')}`;
}

interface SectionsWatch {
  readonly peakRunning: number;
  readonly last: SectionsReading | null;
}

/**
 * Watch the build card until told to stop, recording a milestone on every
 * change of the rows' statuses and a screenshot each time more rows are seen
 * running at once than before. The wave is what this exists to witness: a
 * unit test can pin how many writers a pool STARTS, only a live run can show
 * that many model calls actually in flight together against a real server.
 */
function watchSections(
  panel: Locator,
  page: Page,
  mark: (what: string, detail?: string) => void,
  snapshot: (label: string) => Promise<void>,
): { readonly stop: () => Promise<SectionsWatch> } {
  const halt = new AbortController();
  let peakRunning = 0;
  let last: SectionsReading | null = null;
  const loop = (async (): Promise<SectionsWatch> => {
    while (!halt.signal.aborted) {
      try {
        const reading = await readSections(panel);
        if (reading !== null && reading.statuses.join() !== last?.statuses.join()) {
          last = reading;
          mark('sections', describeSections(reading));
          const running = reading.statuses.filter((status) => status === 'running').length;
          if (running > peakRunning) {
            peakRunning = running;
            if (running >= 2) await snapshot(`wave-${String(running)}`);
          }
        }
        await page.waitForTimeout(SECTIONS_POLL_MS);
      } catch {
        // The page is closing under the poller; the run's own failure is
        // recorded by the driver, and the watch simply ends.
        break;
      }
    }
    return { peakRunning, last };
  })();
  return {
    stop: () => {
      halt.abort();
      return loop;
    },
  };
}

/** The kernel's own counter, read from the DOM rather than guessed at. */
async function transactionCount(page: Page): Promise<number> {
  const text = await page.getByTestId('pg-tx-count').textContent({ timeout: STEP_TIMEOUT_MS });
  const parsed = Number.parseInt((text ?? '').trim(), 10);
  return Number.isNaN(parsed) ? -1 : parsed;
}

/** Poll the kernel's own counter until it satisfies `done`, or give up loudly. */
async function waitForCount(page: Page, done: (count: number) => boolean): Promise<number> {
  const deadline = Date.now() + STEP_TIMEOUT_MS;
  for (;;) {
    const count = await transactionCount(page);
    if (done(count)) return count;
    if (Date.now() > deadline) {
      throw new Error(
        `The transaction count never satisfied the wait; last read ${String(count)}.`,
      );
    }
    await page.waitForTimeout(100);
  }
}

export async function drivePlayground(options: DriveOptions): Promise<DriveEvidence> {
  const startedAt = Date.now();
  const runStamp = stamp(startedAt);
  const milestones: Milestone[] = [];
  const consoleErrors: string[] = [];
  const screenshots: string[] = [];
  const mark = (what: string, detail?: string): void => {
    const at = Date.now();
    milestones.push({
      at,
      sinceStartMs: at - startedAt,
      what,
      ...(detail === undefined ? {} : { detail }),
    });
  };

  let browser: Browser | undefined;
  let outcome: DriveEvidence['outcome'] = 'failed';
  let observed = true;
  let failure: string | undefined;
  let note: string | undefined;
  let before = -1;
  let afterApply: number | null = null;
  let afterUndo: number | null = null;
  let undoRecord: DriveEvidence['undo'] = null;
  let build: DriveEvidence['build'] = null;
  let conversation = '';
  let watch: ReturnType<typeof watchSections> | undefined;

  try {
    browser = await chromium.launch({ headless: options.headless });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    /*
      Console errors are recorded, never thrown on. A run that produced a page
      AND logged a warning is a different fact from a run that crashed, and
      flattening the two would hide the more common one.
    */
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 400));
    });
    page.on('pageerror', (error) => {
      consoleErrors.push(`pageerror: ${error.message.slice(0, 400)}`);
    });

    /*
      Every POST to a `/plan` endpoint is one model call. The response event
      fires on headers, which for a streamed plan is the moment the call
      STARTS; its body resolves when the stream ends. Two milestones per call
      is what lets a reader see, from the evidence alone, whether calls ran
      one after another or together.
    */
    let calls = 0;
    const captureDir = options.captureDir;
    if (captureDir !== undefined) await mkdir(captureDir, { recursive: true });
    page.on('response', (response) => {
      const request = response.request();
      if (request.method() !== 'POST' || !new URL(response.url()).pathname.endsWith('/plan'))
        return;
      calls += 1;
      const call = String(calls).padStart(2, '0');
      mark('ai call started', call);
      const base =
        captureDir === undefined
          ? undefined
          : join(captureDir, `${runStamp}-${options.name}-call-${call}`);
      if (base !== undefined) {
        void writeFile(`${base}-request.json`, request.postData() ?? '', 'utf8').catch(
          () => undefined,
        );
      }
      void response
        .text()
        .then(async (text) => {
          mark('ai call ended', `${call} · ${String(text.length)} characters`);
          if (base !== undefined) await writeFile(`${base}-response.txt`, text, 'utf8');
        })
        .catch(() => {
          mark('ai call ended', `${call} · body unavailable`);
        });
    });

    await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS });
    mark('page loaded');

    if (options.fixture !== undefined) {
      // The picker lives in the rail's Settings panel ("Scenario harness"), not
      // in the product chrome; opening the Assistant afterwards closes it again.
      await page
        .getByRole('button', { name: 'Settings' })
        .first()
        .click({ timeout: STEP_TIMEOUT_MS });
      await page
        .getByRole('region', { name: 'Scenario harness' })
        .waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS });
      // `selectOption` fails loudly on an unknown value; a silent default here
      // would record a landing-page run under an empty-page name.
      await page.getByLabel('Fixture').selectOption(options.fixture, { timeout: STEP_TIMEOUT_MS });
      mark('fixture selected', options.fixture);
    }

    await page
      .getByRole('button', { name: 'Assistant' })
      .first()
      .click({ timeout: STEP_TIMEOUT_MS });
    const panel = page.getByRole('region', { name: 'Assistant' });
    await panel.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS });
    mark('assistant open');

    if (options.mode !== undefined) {
      const label = MODE_LABEL[options.mode];
      await panel.getByRole('radio', { name: label }).click({ timeout: STEP_TIMEOUT_MS });
      mark('mode selected', label);
    }

    before = await transactionCount(page);
    const canUndoBeforeApply = await page.locator('button[aria-label="Undo"]').isEnabled();
    mark(
      'transactions before',
      `${String(before)}; undo ${canUndoBeforeApply ? 'available' : 'unavailable'}`,
    );

    const thread = panel.getByRole('log', { name: 'Conversation' });
    const composer = panel.getByPlaceholder('Ask for a change…');
    await composer.click({ timeout: STEP_TIMEOUT_MS });
    /*
      Typed, not filled. `fill` sets the value in one shot, and the first run of
      this driver proved what that costs here: the text appeared in the box, the
      send control took focus, and NOTHING was sent — the panel's own draft
      state had never seen an input event it recognised. `pressSequentially`
      goes through the keyboard the way a person does, and Enter is the panel's
      documented send key.
    */
    await composer.pressSequentially(options.request, { delay: 8, timeout: STEP_TIMEOUT_MS });
    await composer.press('Enter');

    /*
      A request is SENT when the thread shows it, not when a control was
      clicked. Waiting on the echo is what separates driving the product from
      merely touching it.
    */
    await thread
      .getByText(options.request, { exact: false })
      .first()
      .waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS });
    mark('request sent', options.request);

    watch = watchSections(panel, page, mark, async (label) => {
      screenshots.push(await capture(page, options, runStamp, label));
    });

    /*
      Settled = the send control is offered again, OR the run stopped to ask.

      "Send is visible" alone is wrong, and expensively so: a page-sized request
      in Ask mode reaches the build orchestrator's approval point and WAITS for
      a human to press Build, with `busy` still true. The driver would then sit
      out the whole eleven-minute deadline and record a timeout for a run that
      was working exactly as designed. Racing the two signals is what makes the
      wait mean "the product is no longer moving on its own".
    */
    const approval = panel.getByRole('group', { name: 'Build this page' });
    await Promise.race([
      panel.getByRole('button', { name: 'Send' }).waitFor({
        state: 'visible',
        timeout: SETTLE_TIMEOUT_MS,
      }),
      approval.waitFor({ state: 'visible', timeout: SETTLE_TIMEOUT_MS }),
    ]);
    const awaitingApproval = await approval.isVisible().catch(() => false);
    mark('run settled', awaitingApproval ? 'waiting for approval' : 'idle');
    conversation = ((await thread.innerText().catch(() => '')) || '(empty)')
      .replace(/\s+/g, ' ')
      .slice(0, 12_000);
    if (awaitingApproval) {
      outcome = 'awaiting-approval';
      screenshots.push(await capture(page, options, runStamp, 'awaiting-approval'));
    }

    /*
      The build card, if there was one, read one last time AFTER settling so
      the final statuses are the settled ones and not the poller's last sample.
      A build is its own ending, like the approval card: it offers no Apply
      because every section already landed (or was skipped, and says so), and
      calling that "no Apply offered" would record every finished build as a
      failure.
    */
    const watched = await watch.stop();
    const finalReading = (await readSections(panel)) ?? watched.last;
    const built = finalReading !== null && !awaitingApproval;
    if (finalReading !== null) {
      build = {
        sections: finalReading.statuses.length,
        titles: finalReading.titles,
        peakRunning: Math.max(
          watched.peakRunning,
          finalReading.statuses.filter((status) => status === 'running').length,
        ),
        final: finalReading.statuses,
        count: await panel
          .locator('.pg-chat__tasks-count')
          .last()
          .textContent({ timeout: ROW_READ_TIMEOUT_MS })
          .catch(() => null),
      };
      mark(
        'build settled',
        `${describeSections(finalReading)} · peak running ${String(build.peakRunning)}`,
      );
    }
    if (built) outcome = 'built';

    const applyButton = panel.getByRole('button', { name: 'Apply' }).first();
    const proposed = await applyButton.isVisible().catch(() => false);
    /*
      An approval card is its own ending and must not be overwritten here: the
      run stopped to ask, and there is no Apply because there is not yet a plan
      to apply. A first draft of this line set `outcome` unconditionally and
      then compared against the value it had just destroyed — which the
      compiler caught, and which would otherwise have recorded every waiting
      run as a failure.
    */
    if (!awaitingApproval && !built) outcome = proposed ? 'proposed' : 'failed';
    if (!proposed && !awaitingApproval && !built) {
      /*
        Recorded as a note, not a `failure`: "the assistant refused", "it
        proposed nothing" and "Plan mode legitimately offers no Apply" are all
        product outcomes the driver observed correctly, and calling any of them
        a driver failure would make the exit code lie.
      */
      note = `The run settled without offering Apply. Last thread text: ${conversation.slice(0, 400)}`;
    }

    screenshots.push(await capture(page, options, runStamp, 'settled'));

    if (proposed && !awaitingApproval && options.applyAndUndo) {
      await applyButton.click({ timeout: STEP_TIMEOUT_MS });
      /*
        Polled from Node, not from a function injected into the page. This
        driver is a Node program with no DOM lib — reaching for `document` here
        typechecks nowhere and hides a real boundary. The count is already
        readable through the locator, so the wait is an ordinary loop.
      */
      afterApply = await waitForCount(page, (count) => count > before);
      outcome = 'applied';
      mark('applied', `transactions ${String(before)} → ${String(afterApply)}`);
      screenshots.push(await capture(page, options, runStamp, 'applied'));

      /*
        One undo for the whole generation is the plan's SC-011 promise, and the
        FIRST run of this driver proved the counter cannot witness it: the log
        length stayed at 1 after undoing, because undo removes nothing from the
        log. The editor's own Undo/Redo controls are the honest observable —
        Redo becomes available only when something was actually undone.
      */
      /*
        Scoped by attribute, not by name. TWO controls are called "Undo" once a
        plan has been applied — the editor's chrome button and the plan card's
        own — and by ROLE they are indistinguishable. The chrome pair carry
        `aria-label`; the panel's is a text button. Worth recording as a real
        ambiguity for the panel work, and worth being precise about here.
      */
      const undoButton = page.locator('button[aria-label="Undo"]');
      const redoButton = page.locator('button[aria-label="Redo"]');
      const canUndoAfterApply = await undoButton.isEnabled();
      await undoButton.click({ timeout: STEP_TIMEOUT_MS });
      await redoButton.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS });
      const canRedoAfterUndo = await redoButton.isEnabled();
      afterUndo = await transactionCount(page);
      undoRecord = { canUndoBeforeApply, canUndoAfterApply, canRedoAfterUndo };
      if (canRedoAfterUndo) outcome = 'undone';
      mark(
        'undone once',
        `redo now ${canRedoAfterUndo ? 'available' : 'unavailable'}; log stayed at ${String(afterUndo)}`,
      );
      screenshots.push(await capture(page, options, runStamp, 'undone'));
    }
  } catch (error) {
    failure = error instanceof Error ? error.message.slice(0, 600) : String(error);
    outcome = failure.toLowerCase().includes('timeout') ? 'timeout' : 'failed';
    observed = false;
    mark('driver failed', failure);
  } finally {
    // Stopped before the page goes away, so the poller never reads a closed page.
    await watch?.stop();
    await browser?.close();
  }

  const evidence: DriveEvidence = {
    version: 1,
    name: options.name,
    url: options.url,
    request: options.request,
    startedAt: new Date(startedAt).toISOString(),
    milestones,
    transactions: { before, afterApply, afterUndo },
    undo: undoRecord,
    build,
    outcome,
    observed,
    consoleErrors,
    conversation,
    screenshots,
    ...(failure === undefined ? {} : { failure }),
    ...(note === undefined ? {} : { note }),
  };

  const file = join(options.outDir, `${runStamp}-${options.name}.json`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  process.stdout.write(`${file}\n`);
  return evidence;
}

/**
 * Capture a screenshot and return the path RELATIVE to the evidence directory.
 *
 * Absolute paths were what this recorded first, and they are worthless in a
 * committed record: `/Users/<someone>/…` names a machine nobody else has. The
 * stamp is shared with the JSON file so a reader can see at a glance which run
 * a picture belongs to, rather than matching two independent clocks.
 */
async function capture(
  page: Page,
  options: DriveOptions,
  runStamp: string,
  label: string,
): Promise<string> {
  const name = `${runStamp}-${options.name}-${label}.png`;
  const file = join(options.outDir, name);
  await mkdir(dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: false });
  return name;
}

function stamp(at: number): string {
  return new Date(at).toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '')
) {
  const evidence = await drivePlayground(readOptions(process.argv.slice(2)));
  /*
    The driver never fails a build on a PRODUCT outcome — only on its own
    inability to observe one. The first version had this exactly backwards: a
    timeout, which is the driver seeing nothing, exited 0, while an ordinary
    refusal by the assistant exited 1. `observed` is now the single fact the
    exit code reads.
  */
  process.exitCode = evidence.observed ? 0 : 1;
}
