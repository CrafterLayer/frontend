// Real runAiBuild -> validated kernel -> DocumentView, using scripted answers only.
// node apps/evals/src/browser/free-design.mjs [http://127.0.0.1:5174]
import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { freeDesignFixture } from './free-design.fixtures.mjs';

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
  viewport: { width: 1280, height: 1000 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const harness = new URL('/__free-design-qa', target);
const pageErrors = [];
const blockedRequests = [];
const passes = [];
const screenshots = [];
const builds = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.href === harness.href)
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};
      window.$RefreshSig$=()=>(type)=>type; window.__vite_plugin_react_preamble_installed__=true;
      await import('/src/tailwind.css');
      await import(${JSON.stringify(`/@fs/${workspace}/packages/builder/editor/src/chrome.css`)});
      await Promise.all([['ibm-plex-sans','latin'],['ibm-plex-sans-arabic','arabic']].flatMap(([family,subset])=>[400,600].map(weight=>import(${JSON.stringify(`/@fs/${workspace}/apps/playground/node_modules/@fontsource/`)}+family+'/'+subset+'-'+weight+'.css'))));
      window.freeDesignStylesReady=true;
    </script></body></html>`,
    });
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

function pass(name) {
  passes.push(name);
  console.log(JSON.stringify({ pass: name }));
}

async function mount(fixture) {
  return page.evaluate(
    async ({ fixture, workspace }) => {
      window.freeDesignQa?.dispose();
      const reactModule = await import('/node_modules/.vite/deps/react.js');
      const react = reactModule.default ?? reactModule;
      const domModule = await import('/node_modules/.vite/deps/react-dom_client.js');
      const { createRoot } = domModule.default ?? domModule;
      const {
        createBuilder,
        defaultBlocks,
        builderCustomCode,
        emptyDocument,
        DocumentView,
        runAiBuild,
        runAiAgent,
        createCraftkitAiSkillRegistry,
        CRAFTKIT_DEFAULT_SKILLS,
      } = await import(`/@fs/${workspace}/packages/builder/editor/src/index.ts`);
      let sequence = 0;
      const ports = { clock: { now: () => 1000 }, ids: { newId: () => `qa-free-${++sequence}` } };
      const kernel = createBuilder({
        document: emptyDocument('site', fixture.lang === 'ar' ? 'rtl' : 'ltr'),
        extensions: [defaultBlocks, builderCustomCode],
        ports,
      });
      const host = document.createElement('main');
      host.id = 'free-design-qa';
      host.dir = fixture.lang === 'ar' ? 'rtl' : 'ltr';
      host.lang = fixture.lang;
      document.body.style.margin = '0';
      document.body.append(host);
      const root = createRoot(host);
      root.render(react.createElement(DocumentView, { kernel, isCanvas: false }));
      const snapshot = () => JSON.stringify(kernel.getDocument());
      const calls = [];
      const steps = [];
      const options = {
        runId: `free-design-${fixture.name}-${fixture.lang}`,
        clock: ports.clock,
        kernel,
        request: fixture.request,
        validationPorts: { clock: ports.clock, ids: { newId: () => `qa-validate-${++sequence}` } },
        skillRegistry: createCraftkitAiSkillRegistry(CRAFTKIT_DEFAULT_SKILLS),
        freeCode: Boolean(fixture.js),
        apply: 'auto',
        target: 'replace',
        onEvent: (event) => {
          if (event.type.startsWith('task.') || event.type === 'build.scaffolding')
            steps.push(event);
        },
      };
      const record = (lane, request, context, live) =>
        calls.push({
          lane,
          request,
          skills: (context.skills ?? []).map(({ id }) => id),
          freeCode: live?.freeCode,
        });
      const provider = {
        async proposePagePlan(request, context, live) {
          record('planner', request, context, live);
          return { pagePlan: fixture.plan, rationale: fixture.concept };
        },
        async propose(request, context, live) {
          record('writer', request, context, live);
          const id = /REGION ID: (\S+)/u.exec(request)?.[1];
          if (!id) throw new Error('Expected a section writer, not a fallback scaffold.');
          return {
            rationale: fixture.concept,
            commands: Object.entries({
              tree: fixture.tree,
              css: fixture.css,
              ...(fixture.js ? { js: fixture.js } : {}),
            }).map(([key, value]) => ({ command: 'setProp', args: { id, key, value } })),
          };
        },
      };
      const result = await runAiBuild({ ...options, provider });
      const doc = kernel.getDocument();
      const ids = doc.nodes[doc.rootId].slots.default;
      const id = ids[0];
      const props = doc.nodes[id]?.props;
      window.freeDesignQa = {
        snapshot,
        async followUp() {
          const before = snapshot();
          const nextCss = props.css + '\n.ck-fd h1{letter-spacing:0.01em}';
          const edit = await runAiAgent({
            ...options,
            runId: options.runId + '-followup',
            request:
              'Refine the selected composition by increasing the headline letter spacing, preserving everything else.',
            selection: [id],
            provider: {
              async propose() {
                return {
                  rationale: 'Refine the same composition.',
                  commands: [{ command: 'setProp', args: { id, key: 'css', value: nextCss } }],
                };
              },
            },
          });
          const changed = kernel.getDocument();
          return {
            status: edit.status,
            before,
            id,
            ids: changed.nodes[changed.rootId].slots.default,
            sameTree: JSON.stringify(changed.nodes[id].props.tree) === JSON.stringify(props.tree),
            css: changed.nodes[id].props.css,
          };
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
      return {
        outcome: result.outcome,
        tasks: result.tasks.map(({ status, check, attempts }) => ({ status, check, attempts })),
        plan: result.pagePlan,
        ids,
        type: doc.nodes[id]?.type,
        calls,
        steps,
        tree: props?.tree,
        css: props?.css,
        js: props?.js,
        issues: kernel.validate(),
      };
    },
    { fixture, workspace },
  );
}

async function geometry(fixture, mobile) {
  const result = await page.locator('#free-design-qa').evaluate((host, selector) => {
    const grid = host.querySelector(selector);
    const style = getComputedStyle(grid);
    const rootStyle = getComputedStyle(host);
    const heading = host.querySelector('h1');
    const rectangle = heading.getBoundingClientRect();
    return {
      width: host.clientWidth,
      scrollWidth: host.scrollWidth,
      pageWidth: document.documentElement.clientWidth,
      pageScrollWidth: document.documentElement.scrollWidth,
      direction: rootStyle.direction,
      columns: style.gridTemplateColumns.split(' ').length,
      heading: {
        width: rectangle.width,
        height: rectangle.height,
        fontSize: getComputedStyle(heading).fontSize,
      },
    };
  }, fixture.grid);
  assert.equal(result.direction, fixture.lang === 'ar' ? 'rtl' : 'ltr');
  assert.ok(result.scrollWidth <= result.width + 1, JSON.stringify(result));
  assert.ok(result.pageScrollWidth <= result.pageWidth + 1, JSON.stringify(result));
  assert.equal(result.columns, mobile ? 1 : fixture.desktopColumns);
  assert.ok(result.heading.width > 0 && result.heading.height > 0);
  assert.ok(parseFloat(result.heading.fontSize) >= 36);
  return result;
}

async function screenshot(name) {
  const path = `/tmp/craftkit-free-design-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  screenshots.push(path);
}

try {
  await page.goto(harness.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForFunction(() => window.freeDesignStylesReady, undefined, { timeout: 60_000 });
  for (const lang of ['en', 'ar']) {
    for (const name of ['editorial', 'resume', 'portfolio']) {
      await page.setViewportSize({ width: 1280, height: 1000 });
      const fixture = freeDesignFixture(name, lang);
      const result = await mount(fixture);
      assert.equal(result.outcome, 'completed', JSON.stringify(result));
      assert.equal(result.plan.design.composition, 'bespoke');
      assert.equal(result.plan.design.chrome, 'none');
      assert.equal(result.plan.design.kind, fixture.kind);
      assert.equal(result.plan.sections.length, 1, 'One whole-page composition remains one region');
      assert.equal(result.plan.sections[0].kit, undefined);
      assert.equal(result.ids.length, 1, 'No automatic header or footer');
      assert.equal(result.type, 'customCode');
      assert.deepEqual(
        result.tree,
        fixture.tree,
        'The actual authored semantic tree survives application',
      );
      assert.deepEqual(result.issues, []);
      assert.equal(result.tasks.length, 1, 'The single authored region has one checked task');
      assert.equal(result.tasks[0].status, 'applied');
      assert.deepEqual(
        result.tasks[0].check,
        { issues: [], repaired: false },
        'The authored region passes the section checker without repairs or warnings',
      );
      assert.ok(result.css.includes(fixture.grid), 'Authored layout CSS lands in the same region');
      assert.equal(result.calls.filter(({ lane }) => lane === 'planner').length, 1);
      const writers = result.calls.filter(({ lane }) => lane === 'writer');
      assert.equal(writers.length, 1, JSON.stringify(result.tasks));
      for (const call of result.calls)
        assert.ok(call.skills.includes('craftkit.pro-max-design'), JSON.stringify(call.skills));
      assert.ok(
        writers[0].request.includes(fixture.concept),
        'The writer receives the design concept',
      );
      assert.ok(writers[0].request.includes(fixture.layout), 'The writer receives custom geometry');
      assert.ok(!writers[0].request.includes('"kit":'), 'No kit-slot-only writer request');
      await page.getByRole('heading', { name: fixture.title, exact: true }).waitFor();
      assert.equal(await page.locator('#free-design-qa h1').count(), 1);
      const desktop = await geometry(fixture, false);
      await screenshot(`${name}-${lang}-desktop`);
      pass(
        `${name}/${lang}: bespoke planner, explicit skill, authored tree/CSS and distinct desktop geometry`,
      );

      if (fixture.js) {
        assert.equal(result.js, fixture.js);
        assert.equal(writers[0].freeCode, true);
        const button = page.getByRole('button', { name: fixture.action });
        await button.click();
        await page.waitForFunction(
          () => document.querySelector('.ck-fd-toggle')?.getAttribute('aria-pressed') === 'true',
        );
        await page.getByText(fixture.compact, { exact: true }).waitFor();
        const columns = await page
          .locator(fixture.grid)
          .evaluate((node) =>
            getComputedStyle(node).gridTemplateColumns.split(' ').map(parseFloat),
          );
        assert.ok(
          Math.max(...columns) - Math.min(...columns) < 1,
          'JavaScript changes unequal columns into equal columns',
        );
        await button.press('Enter');
        assert.equal(await button.getAttribute('aria-pressed'), 'false');
        pass(`portfolio/${lang}: real stored JavaScript changes geometry by mouse and keyboard`);
      }

      const edit = await page.evaluate(() => window.freeDesignQa.followUp());
      assert.equal(edit.status, 'applied');
      assert.deepEqual(edit.ids, result.ids);
      assert.equal(edit.sameTree, true);
      assert.ok(edit.css.endsWith('letter-spacing:0.01em}'));
      await page.waitForFunction(
        () =>
          parseFloat(getComputedStyle(document.querySelector('#free-design-qa h1')).letterSpacing) >
          0,
      );
      assert.equal(await page.evaluate(() => window.freeDesignQa.undo()), edit.before);
      pass(
        `${name}/${lang}: follow-up updates the same region visibly; one Undo restores it exactly`,
      );

      await page.setViewportSize({ width: 390, height: 844 });
      const mobile = await geometry(fixture, true);
      await screenshot(`${name}-${lang}-phone`);
      pass(`${name}/${lang}: mobile single-column layout and no horizontal overflow`);
      builds.push({
        name,
        lang,
        calls: result.calls.map(({ lane, skills, freeCode }) => ({ lane, skills, freeCode })),
        tasks: result.tasks,
        desktop,
        mobile,
      });
    }
  }
  assert.deepEqual(pageErrors, []);
  const evidence = {
    result: 'passed',
    cases: passes.length,
    passes,
    builds,
    screenshots,
    pageErrors,
    blockedRequests,
    liveProviderCalls: 0,
    browser: executablePath ?? 'Playwright Chromium',
    limits:
      'Scripted answers establish build, skill, layout, interaction and follow-up mechanics; they do not measure live model creativity, speed or cost.',
  };
  writeFileSync('/tmp/craftkit-free-design-results.json', JSON.stringify(evidence, null, 2));
  console.log(
    JSON.stringify({
      result: evidence.result,
      cases: evidence.cases,
      screenshots,
      pageErrors,
      blockedRequests,
    }),
  );
} catch (error) {
  console.error(String(error));
  console.error(JSON.stringify({ passes, pageErrors, blockedRequests }));
  await screenshot('failure');
  throw error;
} finally {
  await context.close();
  await browser.close();
}
