import { chromium, type Locator, type Page } from 'playwright';
import { expect, it } from 'vitest';
import { buildManagedCatalog, compileProject } from '@craftkit/builder/code-runtime/compiler';
import { exportSite } from '@craftkit/builder/code-runtime/export';
import { scanAccessibility } from '../accessibility/scan';
import { baseUiFixture } from './base-ui-fixture';

// Node-only eval types omit DOM globals; this callback runs in the browser.
function focused(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) =>
    (element as unknown as { matches(selector: string): boolean }).matches(':focus'),
  );
}

async function exercise(page: Page, direction: 'ltr' | 'rtl'): Promise<void> {
  const arabic = direction === 'rtl';
  const tabs = page.getByRole('tab');
  await tabs.first().focus();
  await page.keyboard.press(arabic ? 'ArrowLeft' : 'ArrowRight');
  await expect.poll(() => focused(tabs.nth(1))).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(() => tabs.nth(1).getAttribute('aria-selected')).toBe('true');
  await expect.poll(() => page.getByRole('tabpanel').textContent()).toContain('2026');
  const question = page.getByRole('button', { name: arabic ? 'كيف يعمل؟' : 'How does it work?' });
  await question.click();
  await expect.poll(() => question.getAttribute('aria-expanded')).toBe('true');
  const trigger = page.getByRole('button', { name: arabic ? 'فتح التفاصيل' : 'Open details' });
  await trigger.click();
  await page.getByRole('dialog', { name: arabic ? 'تفاصيل المشروع' : 'Project details' }).waitFor();
  await page.keyboard.press('Tab');
  await expect
    .poll(() => focused(page.getByRole('button', { name: arabic ? 'إغلاق' : 'Close' })))
    .toBe(true);
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate<string[]>(
      `(() => { const ids = Array.from(document.querySelectorAll('[id]'), element => element.id); return ids.filter((id,index) => ids.indexOf(id) !== index); })()`,
    ),
  ).toEqual([]);
  await expect.poll(() => focused(trigger)).toBe(true);
  await page.getByRole('button', { name: arabic ? 'الإجراءات' : 'Actions' }).click();
  await page.getByRole('menuitem', { name: arabic ? 'اختيار' : 'Select' }).click();
  await expect
    .poll(() => page.getByRole('status').textContent())
    .toBe(arabic ? 'اختيار' : 'Select');
  await expect.poll(() => page.getByRole('menu').count()).toBe(0);
  await expect
    .poll(() => focused(page.getByRole('button', { name: arabic ? 'الإجراءات' : 'Actions' })))
    .toBe(true);
  await page.getByRole('button', { name: arabic ? 'مساعدة' : 'Help' }).click();
  try {
    await page.getByRole('dialog', { name: arabic ? 'مساعدة' : 'Help' }).waitFor();
  } catch (error) {
    const popups = await Promise.all(
      (await page.getByRole('dialog').all()).map(async (popup) => ({
        html: await popup.innerHTML(),
        labelled: await popup.getAttribute('aria-labelledby'),
      })),
    );
    throw new Error(`${String(error)}; popups=${JSON.stringify(popups)}`);
  }
  await page.keyboard.press('Escape');
  expect(await page.evaluate<boolean>('document.documentElement.scrollWidth > innerWidth')).toBe(
    false,
  );
  expect(await scanAccessibility(page)).toMatchObject({
    status: 'passed',
    counts: { blocking: 0, incomplete: 0 },
  });
}

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'runs seven admitted Base UI namespaces in compiled preview and independently reactivated export, EN/AR phone/desktop',
  async () => {
    const catalog = await buildManagedCatalog();
    const browser = await chromium.launch({
      headless: true,
      ...(process.env['CRAFTKIT_CHROMIUM_PATH'] === undefined
        ? {}
        : { executablePath: process.env['CRAFTKIT_CHROMIUM_PATH'] }),
    });
    try {
      for (const direction of ['ltr', 'rtl'] as const) {
        const input = baseUiFixture(direction);
        const compiled = await compileProject(input, { catalog });
        if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
        const artifact = compiled.artifact;
        const exported = await exportSite([input], {
          catalog,
          artifacts: new Map([[input.pageId, artifact]]),
          prerender: async () => {
            const renderPage = await browser.newPage();
            const failures: string[] = [];
            renderPage.on('pageerror', (error) => failures.push(error.message));
            try {
              await renderPage.setContent(
                `<html dir='${direction}'><body><div id='root'></div></body></html>`,
              );
              for (const script of artifact.js)
                await renderPage.addScriptTag({ type: 'module', content: script.content });
              try {
                await renderPage.getByRole('heading', { level: 1 }).waitFor({ timeout: 3000 });
              } catch (error) {
                throw new Error(`Prerender failed: ${failures.join('; ')}; ${String(error)}`);
              }
              return {
                html: await renderPage.locator('#root').innerHTML(),
                hasPrimaryContent: true,
                renderMode: 'client',
              };
            } finally {
              await renderPage.close();
            }
          },
        });
        if (!exported.ok) throw new Error(JSON.stringify(exported.diagnostics));
        const staticContext = await browser.newContext({ javaScriptEnabled: false });
        try {
          await staticContext.route('**/*', (route) => route.abort('blockedbyclient'));
          const staticPage = await staticContext.newPage();
          await staticPage.setContent(
            exported.files.find((file) => file.path === 'index.html')!.content,
          );
          expect(await staticPage.getByRole('heading', { level: 1 }).textContent()).toBe(
            input.title,
          );
        } finally {
          await staticContext.close();
        }
        for (const width of [390, 1280]) {
          for (const mode of ['preview', 'export']) {
            const context = await browser.newContext({
              viewport: { width, height: 900 },
              reducedMotion: 'reduce',
              serviceWorkers: 'block',
            });
            context.setDefaultTimeout(5000);
            try {
              const page = await context.newPage();
              const errors: string[] = [];
              page.on('pageerror', (error) => errors.push(error.message));
              if (mode === 'preview') {
                await page.setContent(
                  `<!doctype html><html lang='${input.language ?? 'en'}' dir='${direction}'><head><title>${input.title}</title><style>${artifact.css.map((file) => file.content).join('\n')}</style></head><body><div id='root'></div></body></html>`,
                );
                for (const script of artifact.js)
                  await page.addScriptTag({ type: 'module', content: script.content });
              } else {
                await context.route('**/*', async (route) => {
                  const pathname = new URL(route.request().url()).pathname;
                  const path = pathname === '/' ? 'index.html' : pathname.slice(1);
                  const file = exported.files.find((candidate) => candidate.path === path);
                  if (file === undefined) return route.abort('blockedbyclient');
                  await route.fulfill({
                    body: file.content,
                    contentType: path.endsWith('.js')
                      ? 'text/javascript'
                      : path.endsWith('.css')
                        ? 'text/css'
                        : 'text/html',
                  });
                });
                await page.goto('https://design-qa.invalid/');
              }
              await page.getByRole('heading', { level: 1 }).waitFor();
              await exercise(page, direction);
              if (process.env['CRAFTKIT_SCREENSHOT_DIR'] !== undefined)
                await page.screenshot({
                  path: `${process.env['CRAFTKIT_SCREENSHOT_DIR']}/${direction}-${String(width)}-${mode}.png`,
                  fullPage: true,
                });
              expect(errors).toEqual([]);
            } catch (error) {
              throw new Error(`${direction}/${String(width)}/${mode}: ${String(error)}`);
            } finally {
              await context.close();
            }
          }
        }
      }
    } finally {
      await browser.close();
    }
  },
  90_000,
);
