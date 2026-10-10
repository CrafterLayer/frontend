// Local disposable QA: real panel components, deterministic controller, no provider calls.
// node apps/evals/src/browser/agent-chat.mjs [http://127.0.0.1:5174]
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const target = new URL(process.argv[2] ?? 'http://127.0.0.1:5174');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Local QA only');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('requestfailed', (request) => {
  if (
    request.url().includes('/src/features/agent/') ||
    request.url().includes('/node_modules/.vite/')
  ) {
    console.error(
      'Fixture module failed:',
      new URL(request.url()).pathname,
      request.failure()?.errorText,
    );
  }
});
// No real AI endpoint is ever reached, including background provider discovery.
await page.route(
  /^https?:\/\/[^/]+\/(?:plan|authored-run|v1\/(?:models|authored-runs))(?:[/?]|$)/u,
  (route) => route.abort(),
);
try {
  await page.goto(target.href, { waitUntil: 'networkidle' });
  const cases = [
    { width: 320, height: 720, locale: 'ar', theme: 'dark', scenario: 'long' },
    { width: 288, height: 400, locale: 'en', theme: 'light', scenario: 'long' },
    { width: 480, height: 720, locale: 'en', theme: 'dark', scenario: 'long' },
    { width: 320, height: 480, locale: 'ar', theme: 'light', scenario: 'clarifyAsking' },
    { width: 320, height: 720, locale: 'ar', theme: 'dark', scenario: 'editRunning' },
    { width: 288, height: 400, locale: 'ar', theme: 'dark', scenario: 'building' },
    { width: 320, height: 400, locale: 'en', theme: 'light', scenario: 'queuePaused' },
    { width: 320, height: 720, locale: 'en', theme: 'light', scenario: 'composing' },
    {
      width: 288,
      height: 400,
      locale: 'ar',
      theme: 'dark',
      scenario: 'building',
      fullControls: true,
    },
  ];
  for (const fixture of cases) {
    await page.evaluate(async (options) => {
      window.agentQa?.dispose();
      const { mountAgentBrowserFixture } =
        await import('/src/features/agent/testing/browser-fixture.ts');
      window.agentQa = mountAgentBrowserFixture(options);
    }, fixture);
    const scroller = page.locator('[data-agent-browser-fixture] .ck-agent-thread__scroller');
    const composer = page.locator('[data-agent-browser-fixture] .ck-agent-composer');
    const pool = composer.getByRole('combobox', {
      name: fixture.locale === 'ar' ? 'عدد عمال البناء' : 'Build workers',
    });
    await scroller.waitFor();
    await page.waitForTimeout(180);
    if (fixture.fullControls === true) {
      assert.ok(
        await composer
          .getByRole('button', { name: /Professional design and code model 550B/u })
          .isVisible(),
      );
      assert.ok(await composer.locator('.ck-agent-effort').isVisible());
      assert.equal(await composer.locator('button[aria-pressed]').count(), 1);
    }
    if (fixture.scenario === 'composing') {
      await pool.selectOption('6');
      assert.equal(await pool.inputValue(), '6');
    }
    if (fixture.scenario === 'building') {
      assert.equal(await pool.inputValue(), '6');
      assert.ok(await pool.isDisabled(), 'Running worker choice must be locked');
      await page.locator('[data-agent-browser-fixture] .ck-agent-tasks').waitFor();
    }
    const geometry = await scroller.evaluate((element) => {
      const panel = element.closest('.ck-agent-panel');
      const dock = panel.querySelector('.ck-agent-panel__dock');
      return {
        panel: panel.getBoundingClientRect().toJSON(),
        thread: element.getBoundingClientRect().toJSON(),
        dock: dock.getBoundingClientRect().toJSON(),
        width: element.clientWidth,
        scrollWidth: element.scrollWidth,
      };
    });
    assert.ok(geometry.thread.height > 80, 'Conversation lost its scrollable space');
    assert.ok(
      geometry.dock.bottom <= geometry.panel.bottom + 1,
      'Composer clipped below the panel',
    );
    assert.ok(geometry.scrollWidth <= geometry.width + 1, 'Horizontal thread overflow');
    if (fixture.height === 720)
      assert.ok(
        geometry.thread.height / 720 >= 0.6,
        `Conversation share: ${geometry.thread.height}`,
      );
    if (fixture.scenario === 'long') {
      // Leave the live bottom using a real upward gesture, then append stream content.
      await scroller.hover();
      await page.mouse.wheel(0, -300);
      await page.waitForTimeout(100);
      const top = await scroller.evaluate((node) => node.scrollTop);
      assert.ok(top > 0, 'Reading-position fixture must test a nonzero offset');
      await page.evaluate(() => {
        window.agentQa.append();
      });
      await page.waitForTimeout(150);
      assert.ok(
        Math.abs((await scroller.evaluate((node) => node.scrollTop)) - top) < 2,
        'Stream pulled a reader to the bottom',
      );
      await page.evaluate(() => {
        window.agentQa.show(false);
      });
      await page.waitForTimeout(60);
      await page.evaluate(() => {
        window.agentQa.show(true);
      });
      await page.waitForTimeout(120);
      assert.ok(
        Math.abs((await scroller.evaluate((node) => node.scrollTop)) - top) < 2,
        'Reopening reset the reading position',
      );
      const jump = page.locator('[data-agent-browser-fixture] .ck-agent-jump');
      await jump.click();
      await page.waitForTimeout(180);
      await page.evaluate(() => {
        window.agentQa.resize(350);
      });
      await page.waitForTimeout(150);
      const gap = await scroller.evaluate(
        (node) => node.scrollHeight - node.clientHeight - node.scrollTop,
      );
      assert.ok(gap < 3, `Pinned viewport resize left a gap: ${gap}`);
    }
    const field = composer.locator('textarea');
    await field.fill('One\nTwo\nThree\nFour\nFive\nSix\nSeven\nEight\nNine');
    const size = await field.evaluate((node) => ({
      height: node.clientHeight,
      lines: Number.parseFloat(getComputedStyle(node).lineHeight),
      scroll: node.scrollHeight,
    }));
    assert.ok(size.height <= 6 * size.lines + 2, 'Composer grows past six lines');
    assert.ok(size.scroll > size.height, 'Long input is not independently scrollable');
    await page.waitForTimeout(150);
    const remaining = await scroller.evaluate((node) => node.clientHeight);
    assert.ok(remaining > 80, `Long input consumed the conversation: ${remaining}`);
    if (fixture.scenario === 'long') {
      const gap = await scroller.evaluate(
        (node) => node.scrollHeight - node.clientHeight - node.scrollTop,
      );
      assert.ok(gap < 3, `Pinned composer growth left a gap: ${gap}`);
    }
    const overflowing = await composer.evaluate((node) => {
      const box = node.getBoundingClientRect();
      return [...node.querySelectorAll('button, select')]
        .filter((control) => {
          const bounds = control.getBoundingClientRect();
          return bounds.width > 0 && (bounds.left < box.left - 1 || bounds.right > box.right + 1);
        })
        .map((control) => control.getAttribute('aria-label') ?? control.textContent);
    });
    assert.deepEqual(overflowing, [], 'Composer controls overflow the panel');
    console.log(JSON.stringify({ fixture, geometry, input: size }));
  }
  await page.screenshot({ path: '/tmp/craftkit-chat-after.png' });
  assert.deepEqual(errors, []);
  console.log('Agent chat browser checks passed; no model/provider calls.');
} finally {
  await context.close();
  await browser.close();
}
