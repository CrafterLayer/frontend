// Local tool -> validated plan -> real kernel -> DocumentView proof, without a model/provider.
// node apps/evals/src/browser/report-capabilities.mjs [http://127.0.0.1:5174]
import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const target = new URL(process.argv[2] ?? 'http://127.0.0.1:5174');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Local QA only');
const workspace = fileURLToPath(new URL('../../../../', import.meta.url));
const installedChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = existsSync(chromium.executablePath())
  ? undefined
  : existsSync(installedChrome)
    ? installedChrome
    : undefined;
const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const harnessUrl = new URL('/__report-capabilities-qa', target);
const pageErrors = [];
const blockedRequests = [];
const passes = [];
const screenshots = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  // Exercise the real renderer and tools without booting the unrelated editor App shell.
  if (url.href === harnessUrl.href) {
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body><div id="root"></div><script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => (type) => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        await import('/src/tailwind.css');
        await import(${JSON.stringify(`/@fs/${workspace}/packages/builder/editor/src/chrome.css`)});
        await Promise.all([['ibm-plex-sans', 'latin'], ['ibm-plex-sans-arabic', 'arabic']].flatMap(
          ([family, subset]) => [400, 500, 600].map((weight) => import(
            ${JSON.stringify(`/@fs/${workspace}/apps/playground/node_modules/@fontsource/`)} +
            family + '/' + subset + '-' + weight + '.css'
          ))
        ));
        window.reportCapabilitiesStylesReady = true;
        </script></body></html>`,
    });
  }
  if (
    ['http:', 'https:'].includes(url.protocol) &&
    (url.origin !== target.origin ||
      /^\/(?:plan|authored-run|v1\/(?:models|authored-runs))(?:[/?]|$)/u.test(url.pathname))
  ) {
    blockedRequests.push(url.origin + url.pathname);
    return route.abort();
  }
  return route.continue();
});

const FINANCE = 'Month,Revenue,Costs\nMar,$300,$90\nJan,$100,$40\nFeb,$200,$70';
const OPERATIONS = 'Month,Actual,Target\nMar,125,100\nJan,40,50\nFeb,80,100';
const MARKETING = 'Channel,Visits,Conversions\nEmail,1000,80\nSearch,2000,120\nSocial,500,25';
const DATA = {
  bar: MARKETING,
  hbar: MARKETING,
  line: 'Month,Visits\nJan,10\nFeb,20\nMar,30',
  area: 'Month,Visits\nJan,10\nFeb,20\nMar,30',
  combo: MARKETING,
  scatter: 'Spend,Conversions\n10,2\n20,3\n30,5',
  radar: 'Metric,Actual,Target\nQuality,80,90\nSpeed,70,80\nCoverage,95,100',
  funnel: 'Stage,Visitors\nView,1000\nSignup,200\nPurchase,50',
  gauge: 'Team,Actual,Max,Target\nA,80,100,90\nB,95,100,90',
  sparkline: 'Month,Visits\nJan,10\nFeb,20\nMar,30',
  pie: 'Channel,Visits\nEmail,10\nSearch,20\nSocial,5',
  donut: 'Channel,Visits\nEmail,10\nSearch,20\nSocial,5',
  waterfall: 'Stage,Change\nOpening,100\nIncome,60\nCosts,-40',
  heatmap: 'Channel,Mon,Tue\nEmail,10,15\nSearch,20,30',
  treemap: 'Channel,Visits\nEmail,10\nSearch,20\nSocial,5',
  histogram: 'Hours\n1\n2\n2\n4\n5',
  bubble: 'Spend,Conversions,Audience\n10,2,100\n20,3,200\n30,5,500',
  boxplot: 'Team,Min,Q1,Median,Q3,Max\nA,1,3,5,7,9\nB,2,4,6,8,10',
  candlestick: 'Date,Open,High,Low,Close\n2026-01-01,10,14,8,12\n2026-01-02,12,15,10,13',
  lollipop: 'Project,Variance\nA,10\nB,-5\nC,3',
  bullet: 'Team,Actual,Target\nA,80,100\nB,120,100',
};

async function mount(locale = 'en') {
  await page.evaluate(
    async ({ workspace, locale }) => {
      window.reportCapabilitiesQa?.dispose();
      const reactModule = await import('/node_modules/.vite/deps/react.js');
      const react = reactModule.default ?? reactModule;
      const domModule = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { createRoot } = domModule.default ?? domModule;
      const { DocumentView } = await import(
        `/@fs/${workspace}/packages/builder/editor/src/index.ts`
      );
      const { expandAgentTools, validateAiPlan, tryDirectTool } = await import(
        `/@fs/${workspace}/packages/builder/ai/src/index.ts`
      );
      const { createPlaygroundKernel } =
        await import('/src/features/preview/create-playground-kernel.ts');
      const kernel = createPlaygroundKernel({
        fixture: 'empty',
        dir: locale === 'ar' ? 'rtl' : 'ltr',
      });
      const host = document.createElement('main');
      host.id = 'report-capabilities-qa';
      host.dir = locale === 'ar' ? 'rtl' : 'ltr';
      host.style.cssText =
        'position:relative;z-index:9999;background:white;color:#161616;min-height:100vh';
      document.querySelector('#root').style.display = 'none';
      document.body.style.margin = '0';
      document.body.append(host);
      const root = createRoot(host);
      root.render(react.createElement(DocumentView, { kernel, isCanvas: false }));
      const snapshot = () => JSON.stringify(kernel.getDocument());
      function apply(plan) {
        const judged = validateAiPlan(plan, kernel);
        if (!judged.ok) throw new Error(JSON.stringify(judged.issues));
        kernel.dispatchGroup(judged.plan.commands);
        const issues = kernel.validate();
        if (issues.length > 0) throw new Error(JSON.stringify(issues));
        return Object.values(kernel.getDocument().nodes).map(({ id, type, props }) => ({
          id,
          type,
          props,
        }));
      }
      window.reportCapabilitiesQa = {
        snapshot,
        run(name, input) {
          const expanded = expandAgentTools(
            {
              rationale: 'Present supplied data.',
              commands: [{ command: 'tool', args: { name, input } }],
            },
            kernel,
          );
          if (expanded.issues.length > 0) throw new Error(JSON.stringify(expanded.issues));
          return apply(expanded.plan);
        },
        direct(text) {
          const direct = tryDirectTool(text, kernel);
          if (!direct) throw new Error('No deterministic tool matched the request.');
          return apply(direct.plan);
        },
        reject(name, input) {
          const before = snapshot();
          try {
            this.run(name, input);
            return { rejected: false, unchanged: snapshot() === before };
          } catch (error) {
            return { rejected: true, unchanged: snapshot() === before, message: String(error) };
          }
        },
        undo() {
          kernel.undo();
          return snapshot();
        },
        dispose() {
          root.unmount();
          host.remove();
        },
      };
    },
    { workspace, locale },
  );
  await page.locator('#report-capabilities-qa').waitFor();
}

function pass(name) {
  passes.push(name);
  console.log(JSON.stringify({ pass: name }));
}

async function run(name, input) {
  return page.evaluate(({ name, input }) => window.reportCapabilitiesQa.run(name, input), {
    name,
    input,
  });
}

async function before() {
  return page.evaluate(() => window.reportCapabilitiesQa.snapshot());
}

async function undo(snapshot) {
  assert.equal(await page.evaluate(() => window.reportCapabilitiesQa.undo()), snapshot);
}

async function assertCharts(type) {
  const host = page.locator('#report-capabilities-qa');
  const figures = type
    ? host.locator(`figure[data-chart="${type}"]`)
    : host.locator('figure[data-chart]');
  await figures.first().waitFor();
  assert.ok(await figures.count(), 'At least one chart is visible');
  for (const figure of await figures.all()) {
    const declared = await figure.getAttribute('data-chart');
    assert.ok(
      await figure.locator(`[data-chart-plot="${declared}"]`).count(),
      `Actual ${declared} plot`,
    );
    assert.ok(await figure.locator('svg').count(), `${declared} has script-free SVG output`);
    assert.ok(await figure.getByRole('img').count(), `${declared} has an accessible image`);
    assert.equal(await figure.locator('[data-chart-invalid]').count(), 0);
    assert.equal(await figure.locator('script').count(), 0);
    const bad = await figure
      .locator('svg')
      .evaluateAll((svgs) =>
        svgs.flatMap((svg) =>
          [...svg.querySelectorAll('*')].flatMap((node) =>
            [...node.attributes]
              .filter((attribute) => /NaN|Infinity/u.test(attribute.value))
              .map((attribute) => attribute.name),
          ),
        ),
      );
    assert.deepEqual(bad, [], `${declared} geometry stays finite`);
    const rect = await figure.boundingBox();
    assert.ok(rect && rect.width > 0 && rect.height > 0, `${declared} has a visible footprint`);
  }
}

async function containment(locale) {
  const bounds = await page.locator('#report-capabilities-qa').evaluate((node) => ({
    width: node.clientWidth,
    scrollWidth: node.scrollWidth,
    direction: getComputedStyle(node).direction,
  }));
  assert.equal(bounds.direction, locale === 'ar' ? 'rtl' : 'ltr');
  assert.ok(bounds.scrollWidth <= bounds.width + 1, JSON.stringify(bounds));
  return bounds;
}

async function screenshot(name) {
  const path = `/tmp/craftkit-report-capabilities-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  screenshots.push(path);
}

try {
  await page.goto(harnessUrl.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => window.reportCapabilitiesStylesReady, undefined, {
    timeout: 60_000,
  });
  await mount();
  for (const name of ['data.show', 'report.build']) {
    for (const [as, data] of Object.entries(DATA)) {
      const snapshot = await before();
      await run(name, { as, data, title: `${as} observations` });
      await assertCharts(as);
      await containment('en');
      if (name === 'report.build' && as === 'waterfall') await screenshot('waterfall-desktop');
      await undo(snapshot);
      pass(`${name}: ${as}, actual SVG, finite geometry, containment and Undo`);
    }
  }
  for (const [presentation, data] of [
    ['analytical', FINANCE],
    ['executive', FINANCE],
    ['financial', FINANCE],
    ['operational', OPERATIONS],
    ['comparison', MARKETING],
  ]) {
    const snapshot = await before();
    const nodes = await run('report.page', { presentation, data });
    await page.locator('[data-stats-content]').waitFor();
    await assertCharts();
    assert.equal(nodes.filter((node) => node.type === 'stats').length, 1);
    if (presentation === 'executive') {
      assert.equal(await page.locator('figure[data-chart]').count(), 2);
      assert.ok((await page.locator('[data-stat-change]').count()) > 0);
      assert.ok((await page.locator('[data-metric-trend]').count()) > 0);
    }
    if (presentation === 'financial')
      assert.match(await page.locator('[data-stats-content]').innerText(), /66\.7%/u);
    if (presentation === 'operational') {
      assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '98');
      await screenshot('operations-desktop');
    }
    if (presentation === 'comparison') {
      assert.equal(await page.locator('[data-metric-trend]').count(), 0);
      await screenshot('marketing-desktop');
    }
    await containment('en');
    await undo(snapshot);
    pass(`report.page: ${presentation} presentation, real cards/charts and Undo`);
  }
  const compact = await run('report.build', {
    title: 'Quarterly business overview',
    as: 'area',
    data: 'Month,Revenue\nJan,$100\nFeb,$200\nMar,$300',
    showTrends: true,
    kpis: [
      {
        column: 'Revenue',
        label: 'Median revenue',
        measure: 'median',
        comparisonValue: 100,
        target: 150,
      },
      { column: 'Revenue', label: 'Periods', measure: 'count' },
    ],
  });
  await assertCharts('area');
  const cards = page.locator('[data-report-kpis] > li');
  assert.equal(await cards.count(), 2);
  assert.equal(
    await cards.nth(1).locator('[data-report-value]').innerText(),
    '3',
    'Count is unitless',
  );
  assert.match(
    await cards.first().innerText(),
    /133\.3%/u,
    'Target attainment is not clamped in text',
  );
  assert.equal(await cards.first().getByRole('progressbar').getAttribute('aria-valuenow'), '100');
  assert.ok((await cards.first().locator('[data-report-change]').count()) > 0);
  assert.ok((await cards.first().locator('[data-metric-trend]').count()) > 0);
  await screenshot('finance-kpis-desktop');
  const id = compact.find((node) => node.type === 'report').id;
  const snapshot = await before();
  const updated = await run('report.build', {
    id,
    data: 'Month,Orders\nJan,20\nFeb,35',
    kpis: [{ column: 'Orders', measure: 'last' }],
  });
  assert.equal(updated.filter((node) => node.type === 'report').length, 1);
  assert.equal(updated.find((node) => node.type === 'report').id, id);
  await assertCharts('area');
  await page.getByRole('heading', { name: 'Quarterly business overview' }).waitFor();
  assert.doesNotMatch(
    await page.locator('[data-report-content]').innerText(),
    /\$/u,
    'Stale currency cleared',
  );
  await undo(snapshot);
  pass(
    'compact Report: median/count, comparison, true attainment, source trends, same-ID update and Undo',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await mount('ar');
  await run('report.page', {
    title: 'أداء المشاريع',
    presentation: 'operational',
    data: 'الشهر,الفعلي,الهدف\nيناير,120,100\nفبراير,140,100',
    charts: [{ as: 'bullet' }],
  });
  await assertCharts('bullet');
  await page.getByRole('heading', { name: 'أداء المشاريع' }).waitFor();
  assert.match(await page.locator('[data-stats-content]').innerText(), /١٣٠٫٠٪/u);
  assert.doesNotMatch(await page.locator('[data-stat-progress]').innerText(), /100%|١٠٠٪/u);
  assert.equal(await page.getByRole('progressbar').getAttribute('aria-valuenow'), '100');
  await containment('ar');
  await screenshot('operations-rtl-phone');
  pass('Arabic 390px operational report: bullet, trend, true 130% attainment and bounded progress');

  for (const as of ['heatmap', 'treemap', 'bubble', 'boxplot', 'candlestick']) {
    await mount('ar');
    await run('data.show', { as, data: DATA[as] });
    await assertCharts(as);
    await containment('ar');
    pass(`Arabic 390px ${as}: requested geometry and containment`);
  }
  await screenshot('candlestick-rtl-phone');
  for (const [as, data] of [
    ['boxplot', 'Team,Min,Q1,Median,Q3,Max\nA,1,5,3,7,9'],
    ['candlestick', 'Day,Open,High,Low,Close\nA,10,9,8,12'],
    ['waterfall', 'Step,Change\nA,1\nB,'],
    ['bubble', 'X,Y,Size\n1,2,-1'],
    ['sankey', 'Name,Value\nA,2'],
  ]) {
    const result = await page.evaluate(
      ({ as, data }) => window.reportCapabilitiesQa.reject('data.show', { as, data }),
      { as, data },
    );
    assert.equal(result.rejected, true, `${as} is refused`);
    assert.equal(result.unchanged, true, `${as} does not mutate the document`);
  }
  pass('Invalid specialized shapes, missing values and unsupported charts refuse before mutation');
  await mount('ar');
  await page.evaluate(() =>
    window.reportCapabilitiesQa.direct('اعمل تقرير تنفيذي:\nالشهر,المبيعات\nيناير,120\nفبراير,180'),
  );
  await page.locator('[data-stats-content]').waitFor();
  await assertCharts();
  await containment('ar');
  pass('Arabic executive request routes deterministically through the actual public tool');
  assert.deepEqual(pageErrors, []);
  const evidence = {
    result: 'passed',
    cases: passes.length,
    passes,
    screenshots,
    pageErrors,
    browser: executablePath ?? 'Playwright Chromium',
    blockedRequests,
    liveProviderCalls: 0,
  };
  writeFileSync(
    '/tmp/craftkit-report-capabilities-results.json',
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence));
} catch (error) {
  console.error(String(error));
  console.error(JSON.stringify({ pageErrors, blockedRequests, passes }));
  await screenshot('failure');
  throw error;
} finally {
  await context.close();
  await browser.close();
}
