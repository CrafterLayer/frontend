import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';

const endpoint = process.env['CRAFTKIT_M0_URL'];

/** Opt-in real product test. No mocked compiler, React runtime or persistence ports. */
it.skipIf(endpoint === undefined)('edits, undoes, reloads and exports an interactive TSX page in the product', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const evidence = '/tmp/craftkit-m0-evidence';
  await mkdir(evidence, { recursive: true });
  try {
    await page.goto(endpoint ?? '', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByLabel('Fixture', { exact: true }).selectOption('code-page');
    const frame = page.frameLocator('iframe[title="Code page preview"]');
    const headline = 'Turn ambitious ideas into a site people remember.';
    await frame.getByRole('heading', { name: headline, exact: true }).waitFor({ timeout: 60_000 });
    // Interaction runs inside the authored React module.
    await frame.getByRole('button', { name: 'Start brief · 12' }).click();
    await frame.getByRole('button', { name: 'Start brief · 13' }).waitFor();
    await frame.getByRole('heading', { name: headline, exact: true }).click();
    await page.getByLabel('Text', { exact: true }).fill('Build a site your audience remembers.');
    await page.getByRole('button', { name: 'Apply as one change' }).click();
    await frame.getByRole('heading', { name: 'Build a site your audience remembers.', exact: true }).waitFor({ timeout: 60_000 });
    await page.getByRole('button', { name: 'Undo source' }).click();
    await frame.getByRole('heading', { name: headline, exact: true }).waitFor();
    await page.getByRole('button', { name: 'Save now', exact: true }).click();
    await page.getByText('Saved to this device', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'networkidle' });
    await frame.getByRole('heading', { name: headline, exact: true }).waitFor({ timeout: 60_000 });
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export files', exact: true }).click();
    await (await downloaded).saveAs(`${evidence}/craftkit-site.zip`);
    await page.screenshot({ path: `${evidence}/workspace.png`, fullPage: true });
    expect(errors).toEqual([]);
  } catch (error) {
    await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nProduct errors: ${errors.join('\n')}`);
  } finally { await context.close(); await browser.close(); }
}, 180_000);
