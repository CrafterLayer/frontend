import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { buildManagedCatalog, compileProject } from '@craftkit/builder/code-runtime/compiler';
import { scanAccessibility } from '../accessibility/scan';
import { screenFreedomFixture } from './screen-freedom-fixture';

it.skipIf(process.env['CRAFTKIT_BROWSER_QA'] !== '1')(
  'renders distinct workspace/editorial geometries with working actions, phone grids and local table scrolling in EN/AR',
  async () => {
    const catalog = await buildManagedCatalog();
    const browser = await chromium.launch({
      headless: true,
      ...(process.env['CRAFTKIT_CHROMIUM_PATH'] === undefined
        ? {}
        : { executablePath: process.env['CRAFTKIT_CHROMIUM_PATH'] }),
    });
    try {
      for (const kind of ['workspace', 'library'] as const)
        for (const direction of ['ltr', 'rtl'] as const) {
          const input = screenFreedomFixture(kind, direction === 'rtl');
          const compiled = await compileProject(input, { catalog });
          if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
          for (const width of [390, 1280]) {
            const context = await browser.newContext({
              viewport: { width, height: 1050 },
              reducedMotion: 'reduce',
              serviceWorkers: 'block',
            });
            try {
              await context.route('**/*', (route) => route.abort('blockedbyclient'));
              const page = await context.newPage();
              const errors: string[] = [];
              page.on('pageerror', (error) => errors.push(error.message));
              await page.setContent(
                `<!doctype html><html lang='${direction === 'rtl' ? 'ar' : 'en'}' dir='${direction}'><head><title>Screen QA</title><style>${compiled.artifact.css.map((file) => file.content).join('\n')}</style></head><body><div id='root'></div></body></html>`,
              );
              for (const script of compiled.artifact.js)
                await page.addScriptTag({ type: 'module', content: script.content });
              await page.getByRole('heading', { level: 1 }).waitFor();
              await page.getByRole('button').click();
              await expect
                .poll(() => page.getByRole('button').getAttribute('aria-pressed'))
                .toBe('true');
              if (kind === 'workspace') {
                expect(await page.locator('tbody tr').count()).toBe(1);
                if (width === 390) {
                  expect(
                    await page.evaluate<boolean>(
                      "document.querySelector('.table-scroll').scrollWidth > document.querySelector('.table-scroll').clientWidth",
                    ),
                  ).toBe(true);
                  expect(
                    await page.evaluate<number>(
                      "getComputedStyle(document.querySelector('.metrics')).gridTemplateColumns.split(' ').length",
                    ),
                  ).toBe(2);
                  await page
                    .getByRole('region', {
                      name: direction === 'rtl' ? 'سجل المشاريع' : 'Project records',
                    })
                    .focus();
                  await page.keyboard.press(direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
                  await expect
                    .poll(() =>
                      page.evaluate<number>(
                        "Math.abs(document.querySelector('.table-scroll').scrollLeft)",
                      ),
                    )
                    .toBeGreaterThan(0);
                  await page.evaluate("document.querySelector('.table-scroll').scrollLeft=0");
                }
              } else expect(await page.locator('.notes article').count()).toBe(1);
              expect(
                await page.evaluate<boolean>('document.documentElement.scrollWidth > innerWidth'),
              ).toBe(false);
              const accessibility = await scanAccessibility(page);
              expect(accessibility.counts.blocking, JSON.stringify(accessibility)).toBe(0);
              if (kind === 'workspace' && width === 390) {
                // Axe cannot resolve clipped offscreen table cells. Check only that specific review
                // case, then measure every cell's actual computed foreground/background pair.
                for (const finding of accessibility.incomplete) {
                  expect(finding.rule).toBe('color-contrast');
                  expect(finding.targets.every((target) => /^(?:th|td)\[/u.test(target))).toBe(
                    true,
                  );
                }
                const ratios = await page.evaluate<number[]>(
                  `(() => { const luminance = color => color.match(/[\\d.]+/g).slice(0,3).map(Number).map(value => { const n=value/255; return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4; }).reduce((sum,value,index)=>sum+value*[0.2126,0.7152,0.0722][index],0); return Array.from(document.querySelectorAll('th,td'), cell => { const style=getComputedStyle(cell); const a=luminance(style.color),b=luminance(style.backgroundColor); return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05); }); })()`,
                );
                expect(ratios.length).toBeGreaterThan(0);
                expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
              } else
                expect(accessibility).toMatchObject({
                  status: 'passed',
                  counts: { incomplete: 0 },
                });
              expect(errors).toEqual([]);
              const directory = process.env['CRAFTKIT_SCREENSHOT_DIR'];
              if (directory !== undefined)
                await page.screenshot({
                  path: `${directory}/${kind}-${direction}-${String(width)}.png`,
                  fullPage: true,
                });
            } finally {
              await context.close();
            }
          }
        }
    } finally {
      await browser.close();
    }
  },
  90_000,
);
