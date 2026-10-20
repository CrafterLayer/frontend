// Actual controller + kernel + document rendering, with scripted provider responses.
// node apps/evals/src/browser/agent-continuation-reports.mjs [http://127.0.0.1:5174]
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const target = new URL(process.argv[2] ?? 'http://127.0.0.1:5174');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Local QA only');
const workspace = fileURLToPath(new URL('../../../../', import.meta.url));
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = existsSync(chromium.executablePath())
  ? undefined
  : existsSync(chrome)
    ? chrome
    : undefined;
const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const failures = [];
const blocked = [];
page.on('pageerror', (error) => failures.push(error.message));
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    (url.origin !== target.origin ||
      /^\/(?:plan|authored-run|v1\/(?:models|authored-runs))(?:[/?]|$)/u.test(url.pathname))
  ) {
    blocked.push(url.origin + url.pathname);
    return route.abort();
  }
  return route.continue();
});

async function mount(locale = 'en') {
  await page.evaluate(
    async ({ workspace, locale }) => {
      window.continuationQa?.dispose();
      const reactModule = await import('/node_modules/.vite/deps/react.js');
      const react = reactModule.default ?? reactModule;
      const domModule = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { createRoot } = domModule.default ?? domModule;
      const { DocumentView, tryDirectTool } = await import(
        `/@fs/${workspace}/packages/builder/editor/src/index.ts`
      );
      const { createPlaygroundKernel } =
        await import('/src/features/preview/create-playground-kernel.ts');
      const { useAgentController } =
        await import('/src/features/agent/hooks/use-agent-controller.ts');
      const kernel = createPlaygroundKernel({
        fixture: 'empty',
        dir: locale === 'ar' ? 'rtl' : 'ltr',
      });
      const tree = (text) => ({
        kind: 'root',
        children: [
          {
            kind: 'element',
            tag: 'section',
            children: [
              { kind: 'element', tag: 'h2', text, children: [] },
              { kind: 'element', tag: 'p', text: 'Preserved scene content.', children: [] },
            ],
          },
        ],
      });
      const ids = {};
      for (const [alias, label] of [
        ['qa-ocean', 'Ocean Mural'],
        ['qa-space', 'Space Mural'],
      ]) {
        kernel.dispatch('insertNode', {
          type: 'customCode',
          parentId: kernel.getDocument().rootId,
          props: { label, tree: tree(label), css: ':scope{padding:24px;min-height:180px}' },
        });
        ids[alias] = Object.values(kernel.getDocument().nodes).find(
          (node) => node.props.label === label,
        ).id;
      }
      const seen = [];
      let controller;
      let pending;
      let hold = false;
      const provider = {
        propose: async (request, assembled) => {
          const id = assembled.selection.ids[0];
          if (!id) throw new Error('QA requires an owned target.');
          const call = seen.length + 1;
          seen.push({ id: Object.keys(ids).find((alias) => ids[alias] === id), request, call });
          if (hold) {
            hold = false;
            await new Promise((resolve) => {
              pending = resolve;
            });
          }
          return {
            version: 1,
            rationale: 'Refine this existing mural.',
            commands: [
              {
                command: 'setProp',
                args: { id, key: 'tree', value: tree(`Visible revision ${call}`) },
              },
            ],
          };
        },
      };
      const host = document.createElement('main');
      host.id = 'continuation-qa';
      host.dir = locale === 'ar' ? 'rtl' : 'ltr';
      host.style.cssText =
        'position:relative;z-index:9999;background:white;color:#161616;min-height:100vh';
      document.querySelector('#root').style.display = 'none';
      document.body.append(host);
      const root = createRoot(host);
      function Harness() {
        controller = useAgentController({
          kernel,
          provider,
          locale,
          storage: null,
          enhancer: null,
        });
        return react.createElement(DocumentView, { kernel, isCanvas: false });
      }
      root.render(react.createElement(Harness));
      window.continuationQa = {
        kernel,
        seen,
        get controller() {
          return controller;
        },
        hold() {
          hold = true;
        },
        release() {
          pending?.();
          pending = undefined;
        },
        select(aliases) {
          kernel.setSelection(aliases.map((alias) => ids[alias]));
        },
        send(text) {
          controller.setDraft(text);
          controller.send();
        },
        report(text) {
          for (const id of Object.values(ids)) kernel.dispatch('removeNode', { id });
          const direct = tryDirectTool(text, kernel);
          if (!direct) throw new Error('Report request did not match a direct tool.');
          kernel.dispatchGroup(
            direct.plan.commands.map(({ command, args }) => ({ command, args })),
          );
          const issues = kernel.validate();
          if (issues.length) throw new Error(JSON.stringify(issues));
        },
        dispose() {
          root.unmount();
          host.remove();
        },
      };
    },
    { workspace: resolve(workspace), locale },
  );
  await page.waitForFunction(() => window.continuationQa?.controller !== undefined);
}

async function idle() {
  await page.waitForFunction(() => window.continuationQa.controller.state.run === null, undefined, {
    timeout: 15_000,
  });
}

try {
  await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await mount();
  await page.evaluate(() => window.continuationQa.select(['qa-ocean']));
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.evaluate(() => window.continuationQa.send('Make this mural darker'));
  await page.getByRole('heading', { name: 'Visible revision 1', exact: true }).waitFor();
  await idle();
  await page.evaluate(() => window.continuationQa.select([]));
  await page.evaluate(() => window.continuationQa.send('Make it calmer'));
  await page.getByRole('heading', { name: 'Visible revision 2', exact: true }).waitFor();
  await idle();
  assert.deepEqual(await page.evaluate(() => window.continuationQa.seen.map(({ id }) => id)), [
    'qa-ocean',
    'qa-ocean',
  ]);
  assert.ok(await page.getByRole('heading', { name: 'Space Mural', exact: true }).isVisible());
  console.log(
    'PASS completed first edit -> deselected second prompt changes the same visible artifact',
  );
  await page.evaluate(() => window.continuationQa.select(['qa-space']));
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.evaluate(() => {
    window.continuationQa.hold();
    window.continuationQa.send('Make this mural lighter');
  });
  await page.waitForFunction(() => window.continuationQa.seen.length === 3);
  await page.evaluate(() => window.continuationQa.select([]));
  await page.evaluate(() => window.continuationQa.send('Make it calmer'));
  await page.waitForFunction(() => window.continuationQa.controller.state.queue !== null);
  assert.equal(await page.getByRole('heading', { name: 'Space Mural', exact: true }).count(), 1);
  await page.evaluate(() => window.continuationQa.release());
  await page.getByRole('heading', { name: 'Visible revision 4', exact: true }).waitFor();
  await idle();
  assert.deepEqual(await page.evaluate(() => window.continuationQa.seen.map(({ id }) => id)), [
    'qa-ocean',
    'qa-ocean',
    'qa-space',
    'qa-space',
  ]);
  assert.ok(
    await page.getByRole('heading', { name: 'Visible revision 2', exact: true }).isVisible(),
  );
  assert.equal(await page.locator('#continuation-qa h2').count(), 2);
  await page.screenshot({ path: '/tmp/craftkit-continuation-browser.png', fullPage: true });
  console.log(
    'PASS queued second prompt follows its active predecessor, preserving the previous artifact',
  );
  for (const locale of ['en', 'ar']) {
    await page.setViewportSize(
      locale === 'ar' ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    );
    await mount(locale);
    const reportRows = Array.from({ length: 4 }, () =>
      locale === 'en'
        ? 'Mar,$300,$120\nJan,$100,$40\nFeb,$200,'
        : 'مارس,$300,$120\nيناير,$100,$40\nفبراير,$200,',
    ).join('\n');
    const request =
      locale === 'en'
        ? `Make a detailed report from this:\nMonth,Revenue,Costs\n${reportRows}`
        : `اعمل تقرير مفصل من هذه البيانات:\nالشهر,المبيعات,التكاليف\n${reportRows}`;
    await page.evaluate((text) => window.continuationQa.report(text), request);
    const report = page.locator('#continuation-qa');
    await report
      .getByText(locale === 'en' ? /missing numeric cells/u : /خلية رقمية مفقودة/u)
      .first()
      .waitFor();
    assert.ok(
      await report
        .getByText(locale === 'en' ? 'Jan → Mar' : 'يناير ← مارس', { exact: true })
        .isVisible(),
      'Visible report chronology',
    );
    assert.ok(
      await report
        .getByText(
          locale === 'en'
            ? 'Profit margin: 60.0% overall (profit $960 on Revenue $1,600).'
            : 'هامش الربح: ٦٠٫٠٪ إجمالًا (ربح $٩٦٠ من المبيعات $١٬٦٠٠).',
          { exact: true },
        )
        .isVisible(),
      'Visible derived margin uses paired observations',
    );
    const tables = report.getByRole('table');
    assert.ok((await tables.count()) >= 2, 'Rendered report tables');
    const source = tables.last();
    const rowsBefore = await source.getByRole('row').allTextContents();
    assert.ok(
      rowsBefore[1]?.includes(locale === 'en' ? 'Mar' : 'مارس'),
      'Source rows preserve original order',
    );
    const search = report.getByRole('searchbox').last();
    await search.fill(locale === 'en' ? 'Jan' : 'يناير');
    await page.waitForTimeout(100);
    assert.equal(await source.getByRole('row').count(), 5, 'Interactive source filtering');
    await search.fill('');
    await source.getByRole('button').nth(1).click();
    assert.ok(
      (await source.locator('th[aria-sort="ascending"]').count()) > 0,
      'Interactive column sorting',
    );
    assert.ok(
      (await source.getByRole('row').nth(1).innerText()).includes(
        locale === 'en' ? 'Jan' : 'يناير',
      ),
    );
    await report
      .getByRole('button', { name: locale === 'en' ? 'Next' : 'التالي', exact: true })
      .click();
    assert.equal(
      await source.getByRole('row').count(),
      3,
      'Pagination shows remaining two source rows',
    );
    const bounds = await report.evaluate((node) => ({
      width: node.clientWidth,
      scrollWidth: node.scrollWidth,
      direction: getComputedStyle(node).direction,
    }));
    assert.equal(bounds.direction, locale === 'ar' ? 'rtl' : 'ltr');
    assert.ok(bounds.scrollWidth <= bounds.width + 1, 'Report page horizontal containment');
    await page.screenshot({ path: `/tmp/craftkit-report-${locale}-browser.png`, fullPage: true });
    assert.equal(
      await page.evaluate(() => window.continuationQa.seen.length),
      0,
      'Deterministic reports call no provider',
    );
    console.log(
      JSON.stringify({
        pass: 'report chronology, visible quality caveat, filter, sort, containment',
        locale,
        bounds,
      }),
    );
  }
  assert.deepEqual(failures, []);
  console.log(
    JSON.stringify({
      result: 'passed',
      browser: executablePath ?? 'Playwright Chromium',
      blockedRequests: blocked.length,
      liveProviderCalls: 0,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      await page.evaluate(() => ({
        seen: window.continuationQa?.seen,
        state: window.continuationQa?.controller?.state,
        text: document.querySelector('#continuation-qa')?.textContent,
      })),
    ),
  );
  console.error(JSON.stringify({ failures, blocked }));
  await page.screenshot({ path: '/tmp/craftkit-continuation-failure.png', fullPage: true });
  throw error;
} finally {
  await context.close();
  await browser.close();
}
