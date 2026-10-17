// Disposable, loopback-only QA. No model calls or user browser storage.
// Run: node apps/evals/src/browser/element-patterns.mjs [http://127.0.0.1:5174]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const target = new URL(process.argv[2] ?? 'http://127.0.0.1:5174');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'Local-only QA');
const repository = fileURLToPath(new URL('../../../../', import.meta.url));
const facadePath = `${repository}packages/builder/editor/src/index.ts`;
const themeCss = readFileSync(createRequire(facadePath).resolve('tailwindcss/theme.css'), 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByRole('tab', { name: 'Elements', exact: true }).click();
  await page.getByRole('combobox', { name: 'Element category' }).selectOption('professional');
  assert.equal(await page.getByRole('button', { name: /^Insert / }).count(), 8);
  await page.getByRole('button', { name: 'Insert Feature card', exact: true }).click();
  const canvas = page.frameLocator('iframe[title="Editor canvas"]');
  await canvas.getByRole('heading', { name: 'A useful feature', exact: true }).waitFor();

  // Actual renderer + actual generated page kit, not a hand-written palette stand-in.
  const document = await page.evaluate(async ({ repository, themeCss }) => {
    const api = await import(`/@fs/${repository}packages/builder/editor/src/index.ts`);
    const preview = await import(`/@fs/${repository}packages/builder/shell/src/components/LibraryPanel/library-preview.ts`);
    const kernel = api.createBuilder({ document: api.emptyDocument(), extensions: [api.defaultBlocks, api.builderCustomCode] });
    const { state } = api.readPageKit('', true);
    const pageCss = api.writePageKit('', state, { lang: 'ar', dir: 'rtl' });
    const trees = api.ELEMENT_RECIPE_IDS.map((id) => ({ kind: 'root', children: [api.buildElementRecipe(id, 'ar', {}, 'page')] }));
    const compiler = await api.createLiveUtilities({ tailwindThemeCss: themeCss });
    const css = await compiler.compileFor(trees.flatMap(preview.treeClassNames));
    const markup = trees.map((tree) => preview.previewMarkup(kernel, tree, undefined, 'rtl', pageCss)).join('');
    compiler.dispose();
    return { srcdoc: preview.previewSrcdoc({ markup, css, dir: 'rtl', lang: 'ar' }), surface: state.colours.surface, accent: state.colours.accentInk };
  }, { repository, themeCss });

  // Inspect sandboxed thumbnail contents through browser automation, never lift its sandbox.
  const inspection = await browser.newPage();
  await inspection.setContent('<iframe title="Pattern QA" sandbox="" style="border:0;height:6000px"></iframe>');
  await inspection.locator('iframe').evaluate((frame, srcdoc) => { frame.srcdoc = srcdoc; }, document.srcdoc);
  const patterns = inspection.frameLocator('iframe');
  await patterns.locator('.ck-card').first().waitFor();
  for (const width of [1440, 768, 390]) {
    await inspection.locator('iframe').evaluate((frame, value) => { frame.style.width = `${value}px`; }, width);
    // The geometry/style reads below synchronously flush the resized frame's layout.
    const geometry = await patterns.locator('body').evaluate((body, expected) => {
      // Page-kit CSS uses OKLCH; compare painted sRGB, not serialization formats.
      const canvas = body.ownerDocument.createElement('canvas');
      const context = canvas.getContext('2d');
      const rgba = (color) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data);
      };
      return {
        overflow: body.scrollWidth > body.clientWidth,
        columns: Array.from(body.querySelectorAll('ol.grid,div.grid')).map((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length),
        surface: rgba(getComputedStyle(body.querySelector('.ck-card')).backgroundColor),
        accent: rgba(getComputedStyle(body.querySelector('.ck-accent-ink')).color),
        expectedSurface: rgba(expected.surface),
        expectedAccent: rgba(expected.accent),
        radius: parseFloat(getComputedStyle(body.querySelector('.ck-card')).borderRadius),
      };
    }, { surface: document.surface, accent: document.accent });
    assert.equal(geometry.overflow, false, `Overflow at ${width}`);
    assert.ok(geometry.surface.every((channel, index) => Math.abs(channel - geometry.expectedSurface[index]) <= 1), 'Page-kit surface missing in preview');
    assert.ok(geometry.accent.every((channel, index) => Math.abs(channel - geometry.expectedAccent[index]) <= 1), 'Page-kit accent missing in preview');
    assert.ok(geometry.radius > 0, 'Page-kit radius missing in preview');
    if (width === 390) assert.deepEqual(geometry.columns, [1, 1]);
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 8 library patterns, real insertion, scoped generated palette, RTL and 1440/768/390 layouts.');
} finally {
  await browser.close();
}
