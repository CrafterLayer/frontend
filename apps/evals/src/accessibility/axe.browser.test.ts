import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { scanAccessibility } from './scan';

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'runs real axe against accessible, broken and closed browser pages',
  async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.setContent(
        '<!doctype html><html lang="en"><head><title>Quality fixture</title></head><body><main><h1>Contact us</h1><label for="email">Email</label><input id="email" type="email"><button type="button">Continue</button></main></body></html>',
      );
      expect(await scanAccessibility(page)).toMatchObject({
        status: 'passed',
        counts: { blocking: 0, incomplete: 0 },
      });
      await page.setContent(
        '<!doctype html><html lang="en"><head><title>Broken fixture</title></head><body><main><h1>Contact us</h1><input type="email"><button type="button"></button><img src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="></main></body></html>',
      );
      const report = await scanAccessibility(page);
      expect(report.status).toBe('failed');
      expect(report.violations.map(({ rule }) => rule)).toEqual(
        expect.arrayContaining(['button-name', 'image-alt', 'label']),
      );
      await page.setContent(
        '<!doctype html><html lang="en"><head><title>Empty fixture</title></head><body><main></main></body></html>',
      );
      expect((await scanAccessibility(page)).status).toBe('needs-review');
      await page.close();
      expect((await scanAccessibility(page)).status).toBe('execution-failed');
    } finally {
      await context.close();
      await browser.close();
    }
  },
  60_000,
);
