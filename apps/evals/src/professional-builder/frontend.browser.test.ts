import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { buildManagedCatalog, compileProject } from '@craftkit/builder/code-runtime/compiler';
import { scanAccessibility } from '../accessibility/scan';
import { frontendFixture } from './frontend-fixture';

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'compiles and runs dashboard filters and a validated workflow in mobile/desktop LTR/RTL',
  async () => {
    const compiled = await compileProject(frontendFixture(), {
      catalog: await buildManagedCatalog(),
    });
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
    const browser = await chromium.launch({ headless: true });
    try {
      for (const dir of ['ltr', 'rtl'])
        for (const width of [390, 1280]) {
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion: 'reduce',
          });
          try {
            const page = await context.newPage();
            const errors: string[] = [];
            page.on('pageerror', (error) => errors.push(error.message));
            await page.setContent(
              `<!doctype html><html lang="en" dir="${dir}"><head><title>Frontend QA</title><style>${compiled.artifact.css.map((file) => file.content).join('\n')}body{color:#172033;background:#fff}input,select,button{margin:.5rem;padding:.75rem;border:1px solid #64748b}table{width:100%;text-align:start}th,td{padding:.75rem}section{margin-block:2rem}</style></head><body><div id="root"></div></body></html>`,
            );
            await page.addScriptTag({
              type: 'module',
              content: compiled.artifact.js.map((file) => file.content).join('\n'),
            });
            await page.getByRole('heading', { name: 'Project workspace' }).waitFor();
            await page.getByRole('combobox', { name: 'Status' }).selectOption('Active');
            expect(await page.locator('tbody tr').count()).toBe(1);
            await page.getByRole('searchbox', { name: 'Search' }).fill('not present');
            expect(await page.getByRole('status').textContent()).toBe('No matching projects');
            await page.getByRole('searchbox', { name: 'Search' }).fill('launch');
            expect(await page.locator('tbody tr').count()).toBe(1);
            await page.getByRole('button', { name: 'Next', exact: true }).click();
            await page.getByRole('alert').waitFor();
            await page.getByRole('textbox', { name: 'Email' }).fill('demo@example.com');
            await page.getByRole('button', { name: 'Next', exact: true }).click();
            await page.getByText('Review: demo@example.com', { exact: true }).waitFor();
            await page.getByRole('button', { name: 'Back', exact: true }).click();
            expect(await page.getByRole('textbox', { name: 'Email' }).inputValue()).toBe(
              'demo@example.com',
            );
            expect(
              await page.evaluate<boolean>(
                'document.documentElement.scrollWidth > window.innerWidth',
              ),
            ).toBe(false);
            expect(await scanAccessibility(page)).toMatchObject({
              status: 'passed',
              counts: { blocking: 0, incomplete: 0 },
            });
            expect(errors).toEqual([]);
          } finally {
            await context.close();
          }
        }
    } finally {
      await browser.close();
    }
  },
  60_000,
);
