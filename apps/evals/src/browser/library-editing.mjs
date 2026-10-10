// Local, disposable browser regression: no provider calls or user browser storage.
// Run: node apps/evals/src/browser/library-editing.mjs [http://localhost:5174]
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const target = new URL(process.argv[2] ?? 'http://localhost:5174');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'This mutating QA scenario is local-only');
const browser = await chromium.launch({ headless: true });
const failures = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const canvas = page.frameLocator('iframe[title="Editor canvas"]');
  await page.getByRole('tab', { name: 'Elements', exact: true }).click();
  await page.getByRole('combobox', { name: 'Element category' }).selectOption('layout');
  assert.equal(await page.getByRole('button', { name: 'Insert Heading', exact: true }).count(), 0);
  await page.getByRole('combobox', { name: 'Element category' }).selectOption('all');
  const tabHeight = await page
    .locator('.bldr-library__tablist')
    .evaluate((node) => node.getBoundingClientRect().height);
  assert.ok(tabHeight >= 32, `Clipped tab strip: ${tabHeight}`);

  async function drag(tile, x, y) {
    await tile.scrollIntoViewIfNeeded();
    const box = await tile.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + box.width / 2, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 24 });
    await page.mouse.up();
  }

  const frameBox = await page.locator('iframe[title="Editor canvas"]').boundingBox();
  assert.ok(frameBox);
  const headingTile = page.getByRole('button', { name: 'Insert Heading', exact: true });
  await drag(headingTile, frameBox.x + 10, frameBox.y + 60);
  const heading = canvas.getByRole('heading', { name: 'A clear heading', exact: true });
  await heading.waitFor();
  const position = await heading.evaluate((node) => {
    const region = node.closest('[data-bldr-node]');
    const slot = region?.parentElement;
    return {
      index: Array.from(slot?.children ?? []).indexOf(region),
      count: slot?.children.length ?? 0,
    };
  });
  assert.ok(
    position.index >= 0 && position.index < position.count - 1,
    'Library drag appended instead of using the pointer seat',
  );

  // A second element drops into the existing region after the heading.
  const headingBox = await heading.boundingBox();
  assert.ok(headingBox);
  await drag(
    page.getByRole('button', { name: 'Insert Text', exact: true }),
    headingBox.x + 30,
    headingBox.y + headingBox.height - 2,
  );
  const region = heading.locator('xpath=ancestor::*[@data-ck-custom-code][1]');
  await region
    .getByText('Write a sentence or two that says what this part of the page is for.', {
      exact: true,
    })
    .waitFor();
  await heading.click();
  assert.ok(
    (await page.locator('.bldr-inspector').innerText()).includes('Heading'),
    'Selection did not reach the Inspector',
  );
  await page.waitForTimeout(100);
  const outlineBox = await page.locator('.bldr-outline--selection').boundingBox();
  const selectedBox = await heading.boundingBox();
  assert.ok(outlineBox && selectedBox);
  assert.ok(
    Math.abs(outlineBox.x - selectedBox.x) < 2 &&
      Math.abs(outlineBox.width - selectedBox.width) < 2,
    'Selection outline does not match the selected element at canvas zoom',
  );
  await heading.dblclick();
  assert.equal(await heading.getAttribute('contenteditable'), 'plaintext-only');
  await heading.click();
  assert.equal(
    await heading.getAttribute('contenteditable'),
    'plaintext-only',
    'Caret click ended text editing',
  );
  await heading.press('Escape');

  await page.getByRole('tab', { name: 'Templates', exact: true }).click();
  await drag(
    page.getByRole('button', { name: 'Insert template Dental clinic', exact: true }).last(),
    frameBox.x + 10,
    frameBox.y + 20,
  );
  const clinic = canvas.getByRole('heading', {
    name: 'رعاية لطيفة لأسنان العائلة كلها',
    exact: true,
  });
  await clinic.waitFor();
  const width = await clinic.evaluate((node) => node.getBoundingClientRect().width);
  assert.ok(width > 300, `Collapsed template heading: ${width}`);
  const zeroWidthStacks = await canvas
    .locator('[data-bldr-stack]')
    .evaluateAll((nodes) => nodes.filter((node) => node.getBoundingClientRect().width < 1).length);
  assert.equal(zeroWidthStacks, 0, 'Template has zero-width containers');

  // Canvas wrappers must also preserve a row Stack's flex sizing (not full-width wrapping).
  const stackId = await clinic.evaluate((node) =>
    node.closest('[data-bldr-stack]')?.getAttribute('data-bldr-stack'),
  );
  assert.ok(stackId);
  const direction = page
    .locator('select')
    .filter({ has: page.locator('option[value="column"]') })
    .first();
  await direction.selectOption('row');
  const row = canvas.locator(
    `[data-bldr-stack="${stackId}"] > div > [data-bldr-slot] > [data-bldr-node]`,
  );
  await page.waitForTimeout(100);
  const rowRects = await row.evaluateAll((nodes) =>
    nodes.slice(0, 2).map((node) => node.getBoundingClientRect().toJSON()),
  );
  assert.equal(rowRects.length, 2);
  assert.ok(
    Math.abs(rowRects[0].top - rowRects[1].top) < 1,
    'Canvas row children wrapped into a column',
  );
  assert.ok(rowRects[0].width > 0 && rowRects[1].width > 0);
  await direction.selectOption('column');

  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    assert.equal(overflow, false, `Editor overflow at ${width}px`);
  }
  assert.deepEqual(failures, []);
  console.log(
    'PASS: library categories, tab geometry, pointer-based block/tree insertion, selection, text caret, RTL template width, canvas row layout, editor overflow at 1440/768/390px.',
  );
} finally {
  await browser.close();
}
