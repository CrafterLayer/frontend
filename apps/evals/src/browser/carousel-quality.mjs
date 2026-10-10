// Disposable loopback driver. Exports through the app-facing facade, then serves only those files.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const target = new URL(process.argv[2] ?? 'http://127.0.0.1:5174');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Local-only QA');
const facade = fileURLToPath(
  new URL('../../../../packages/builder/editor/src/index.ts', import.meta.url),
);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
try {
  const host = await context.newPage();
  await host.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const files = await host.evaluate(async (facadePath) => {
    const { exportStaticSite, defaultBlocks, builderCustomCode, LATEST_SCHEMA_VERSION } =
      await import(`/@fs/${facadePath}`);
    const entries = [
      ...(defaultBlocks.contributes?.blocks ?? []),
      ...(builderCustomCode.contributes?.blocks ?? []),
    ];
    const registry = Object.fromEntries(entries.map((entry) => [entry.schema.type, entry]));
    const element = (tag, extra) => ({ kind: 'element', tag, ...extra });
    const tree = {
      kind: 'root',
      children: [
        element('h1', { text: 'Carousel quality' }),
        element('section', {
          attributes: {
            'data-ck-behavior': 'carousel',
            'data-ck-indicator': 'dots',
            'aria-label': 'Projects',
          },
          children: [
            element('ul', {
              className: 'qa-track',
              children: [1, 2, 3].map((at) =>
                element('li', {
                  className: 'qa-slide',
                  children: [
                    element('h2', { text: `Project ${at}` }),
                    element('p', { text: 'Sample project content.' }),
                  ],
                }),
              ),
            }),
            element('div', {
              children: [
                element('button', { text: 'Previous', attributes: { type: 'button' } }),
                element('button', { text: 'Next', attributes: { type: 'button' } }),
              ],
            }),
          ],
        }),
      ],
    };
    const document = (dir) => ({
      schemaVersion: LATEST_SCHEMA_VERSION,
      surface: 'site',
      dir,
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          type: 'page',
          props: { title: 'Carousel QA', lang: dir === 'rtl' ? 'ar' : 'en' },
          slots: { default: ['slides'] },
        },
        slides: { id: 'slides', type: 'customCode', props: { tree } },
      },
    });
    return (
      await exportStaticSite({
        pages: [
          { pageId: 'ltr', address: '/', document: document('ltr') },
          { pageId: 'rtl', address: '/rtl', document: document('rtl') },
        ],
        blocks: (type) => registry[type],
        compileCss: async () =>
          'body{margin:0;padding:16px;color:#172033;background:#fff} .qa-track{display:flex;gap:16px;list-style:none;margin:0;padding:0} .qa-slide{flex:0 0 100%;min-width:0;padding:24px;border:1px solid #64748b;box-sizing:border-box}button{padding:12px;margin:8px}',
      })
    ).files;
  }, facade);
  assert.ok(
    files.find((file) => file.path === 'assets/ck-carousel.js'),
    'Export omitted Embla',
  );
  await host.close();
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.endsWith('/')
      ? `${url.pathname.slice(1)}index.html`
      : url.pathname.slice(1);
    const file =
      url.hostname === 'craftkit-qa.invalid'
        ? files.find((candidate) => candidate.path === path)
        : undefined;
    if (!file) return route.abort();
    await route.fulfill({
      body: file.content,
      contentType: path.endsWith('.js')
        ? 'text/javascript'
        : path.endsWith('.css')
          ? 'text/css'
          : 'text/html',
    });
  });
  for (const dir of ['ltr', 'rtl']) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://craftkit-qa.invalid/${dir === 'rtl' ? 'rtl/' : ''}`);
    const carousel = page.locator('[data-ck-carousel-engine="embla"]');
    await carousel.waitFor();
    const dots = page.locator('[data-ck-carousel-dots] button');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForFunction(
      () =>
        document
          .querySelectorAll('[data-ck-carousel-dots] button')[1]
          ?.getAttribute('aria-current') === 'true',
    );
    const track = page.locator('[data-ck-track]');
    await track.focus();
    await page.keyboard.press('End');
    await page.waitForFunction(
      () =>
        document
          .querySelectorAll('[data-ck-carousel-dots] button')[2]
          ?.getAttribute('aria-current') === 'true',
    );
    await page.keyboard.press('Home');
    await page.waitForFunction(
      () =>
        document
          .querySelectorAll('[data-ck-carousel-dots] button')[0]
          ?.getAttribute('aria-current') === 'true',
    );
    await page.waitForTimeout(350);
    const box = await page.locator('[data-ck-embla-viewport]').boundingBox();
    assert.ok(box);
    const start = dir === 'rtl' ? box.x + 30 : box.x + box.width - 30;
    const end = dir === 'rtl' ? box.x + box.width - 30 : box.x + 30;
    await page.mouse.move(start, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(end, box.y + 50, { steps: 12 });
    await page.mouse.up();
    await page.waitForFunction(
      () =>
        document
          .querySelectorAll('[data-ck-carousel-dots] button')[1]
          ?.getAttribute('aria-current') === 'true',
    );
    assert.equal(await dots.count(), 3);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await carousel.waitFor();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForFunction(
      () =>
        document
          .querySelectorAll('[data-ck-carousel-dots] button')[1]
          ?.getAttribute('aria-current') === 'true',
    );
    const scan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    assert.equal(
      scan.violations.filter((rule) => ['serious', 'critical'].includes(rule.impact)).length,
      0,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    'PASS: real static export asset/locators, LTR/RTL mobile swipe, keyboard, dots, reduced motion, overflow and axe blocking gate.',
  );
} finally {
  await context.close();
  await browser.close();
}
