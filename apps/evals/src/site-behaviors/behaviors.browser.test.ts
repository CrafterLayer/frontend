import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { scanAccessibility } from '../accessibility/scan';
import { SITE_CSS, siteCopy, siteRegions, type Dir } from './site-fixture';

/*
  everyday site behaviours (2026-10-13): back-to-top, typed-words, read-more, scroll-spy, filter
  and dismiss, proven on a PUBLISHED page. The site is exported by the real exporter
  (`exportStaticSite`: the rendered markup, `assets/ck-behaviors.js` holding only the packs the
  markup names, `assets/ck-behaviors.css`), served from a loopback-free fake origin under a strict
  CSP (no inline script, no eval), and driven in Chromium by keyboard, in English (LTR) and Arabic
  (RTL), with and without reduced motion. Every claim is read back from the page: attributes,
  computed style, scroll position, focus and storage; console errors and CSP violations fail it.
*/

const QA = process.env['CRAFTKIT_BROWSER_QA'] === '1';
const ORIGIN = 'http://craftkit-qa.invalid';
/** No inline script, no eval, nothing from elsewhere: the packs must run as served files. */
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'";

interface ExportedFile {
  readonly path: string;
  readonly content: string;
}

interface BlockEntry {
  readonly schema: { readonly type: string };
}

interface BuilderFacade {
  readonly exportStaticSite: (
    options: unknown,
  ) => Promise<{ readonly files: readonly ExportedFile[] }>;
  readonly defaultBlocks: { readonly contributes?: { readonly blocks?: readonly BlockEntry[] } };
  readonly builderCustomCode: {
    readonly contributes?: { readonly blocks?: readonly BlockEntry[] };
  };
  readonly LATEST_SCHEMA_VERSION: number;
}

/*
  The facade is imported by a computed name: its React/DOM types are not this app's headless
  tsconfig's business (the same reason the Tailwind plugin test keeps its own tsconfig); the
  exporter runs in Node either way.
*/
const FACADE = '@craftkit/builder';

async function exportSite(): Promise<readonly ExportedFile[]> {
  const facade = (await import(FACADE)) as BuilderFacade;
  const entries = [
    ...(facade.defaultBlocks.contributes?.blocks ?? []),
    ...(facade.builderCustomCode.contributes?.blocks ?? []),
  ];
  const registry = new Map(entries.map((entry) => [entry.schema.type, entry]));
  const document = (dir: Dir) => {
    const regions = siteRegions(dir);
    return {
      schemaVersion: facade.LATEST_SCHEMA_VERSION,
      surface: 'site',
      dir,
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          type: 'page',
          props: { title: 'Site behaviours QA', lang: siteCopy(dir).lang },
          slots: { default: regions.map(([id]) => id) },
        },
        ...Object.fromEntries(
          regions.map(([id, tree]) => [id, { id, type: 'customCode', props: { tree } }]),
        ),
      },
    };
  };
  const result = await facade.exportStaticSite({
    pages: [
      { pageId: 'ltr', address: '/', document: document('ltr') },
      { pageId: 'rtl', address: '/ar', document: document('rtl') },
    ],
    blocks: (type: string) => registry.get(type),
    compileCss: () => Promise.resolve(SITE_CSS),
  });
  return result.files;
}

async function serve(context: BrowserContext, files: readonly ExportedFile[]): Promise<void> {
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) return route.abort();
    const path = url.pathname.endsWith('/')
      ? `${decodeURIComponent(url.pathname.slice(1))}index.html`
      : decodeURIComponent(url.pathname.slice(1));
    const file = files.find((candidate) => candidate.path === path);
    if (file === undefined) return route.fulfill({ status: 404, body: 'missing' });
    const type = path.endsWith('.js')
      ? 'text/javascript'
      : path.endsWith('.css')
        ? 'text/css'
        : path.endsWith('.html')
          ? 'text/html'
          : 'text/plain';
    return route.fulfill({
      body: file.content,
      contentType: type,
      headers: type === 'text/html' ? { 'content-security-policy': CSP } : {},
    });
  });
}

/** A page with every console error, page error and CSP violation collected. */
async function open(context: BrowserContext, dir: Dir): Promise<{ page: Page; errors: string[] }> {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto(`${ORIGIN}/${dir === 'rtl' ? 'ar/' : ''}`);
  await mounted(page);
  return { page, errors };
}

/*
  Read through the DevTools protocol (`page.evaluate`), which the page's CSP does not govern;
  `waitForFunction` with a string polls through `eval` inside the page, which the CSP refuses.
  Expressions are strings: this app's tsconfig has no DOM library.
*/
const read = <T>(page: Page, expression: string): Promise<T> => page.evaluate<T>(expression);

const query = (selector: string) => `document.querySelector(${JSON.stringify(selector)})`;

/** One computed style property of the first element matching `selector`. */
const style = (page: Page, selector: string, property: string) =>
  read<string>(page, `getComputedStyle(${query(selector)}).${property}`);

/** Box metrics of the first element matching `selector`. */
const metrics = (page: Page, selector: string) =>
  read<{ top: number; height: number; client: number; scroll: number; line: number }>(
    page,
    `(() => { const el = ${query(selector)}; const box = el.getBoundingClientRect(); return { top: box.top, height: box.height, client: el.clientHeight, scroll: el.scrollHeight, line: parseFloat(getComputedStyle(el).lineHeight) }; })()`,
  );

/** Until the deferred runtime has run (the filter's first button is pressed). */
async function mounted(page: Page): Promise<void> {
  await expect
    .poll(() =>
      read<string | null>(
        page,
        `${query('[data-ck-behavior="filter"] button')}?.getAttribute('aria-pressed') ?? null`,
      ),
    )
    .toBe('true');
}

const TOP = '[data-ck-behavior="back-to-top"]';
const TYPED = '[data-ck-behavior="typed-words"]';
const MORE_TEXT = '[data-ck-behavior="read-more"] > p';

describe.skipIf(!QA)('everyday site behaviours on a published page, in Chromium', () => {
  let browser: Browser;
  let files: readonly ExportedFile[] = [];

  beforeAll(async () => {
    [browser, files] = await Promise.all([chromium.launch({ headless: true }), exportSite()]);
  }, 120_000);

  afterAll(async () => {
    await browser.close();
  });

  it('exports only the packs the pages name, as files a strict CSP admits', () => {
    const script = files.find((file) => file.path === 'assets/ck-behaviors.js')?.content ?? '';
    for (const name of [
      'mountBackToTop',
      'mountTypedWords',
      'mountReadMore',
      'mountScrollSpy',
      'mountFilter',
      'mountDismiss',
    ])
      expect(script, name).toContain(name);
    for (const name of ['mountCarousel', 'mountGallery', 'mountScripts', 'mountTableTools'])
      expect(script, name).not.toContain(name);
    expect(script).not.toMatch(/\beval\(|new Function\(/u);
    const html = files.find((file) => file.path === 'index.html')?.content ?? '';
    expect(html).toContain('assets/ck-behaviors.js');
    expect(html).not.toMatch(/\son[a-z]+=/u);
  });

  it.each(['ltr', 'rtl'] as const)(
    'every hook behaves by keyboard, %s, with motion',
    async (dir) => {
      const copy = siteCopy(dir);
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        reducedMotion: 'no-preference',
      });
      try {
        await serve(context, files);
        const { page, errors } = await open(context, dir);

        // back-to-top: out of sight (and out of the tab order) at the top; at the inline end.
        const top = page.locator(TOP);
        expect(await style(page, TOP, 'visibility')).toBe('hidden');
        const box = await top.boundingBox();
        expect(box).not.toBeNull();
        if (dir === 'ltr') expect(box!.x).toBeGreaterThan(640);
        else expect(box!.x).toBeLessThan(640);

        // typed-words: the list is read once; the visible word is typed, erased and replaced.
        const typed = page.locator(TYPED);
        expect(await typed.locator(':scope > span').last().textContent()).toBe(
          copy.words.join(', '),
        );
        expect(await page.locator('h1').textContent()).toContain(copy.words.join(', '));
        await expect
          .poll(() => typed.locator('[aria-hidden="true"]').textContent(), { timeout: 8_000 })
          .toMatch(new RegExp(`^${copy.words[1].slice(0, 2)}`, 'u'));

        // read-more: clamped to four lines, opened and closed from the keyboard.
        const more = page.locator('[data-ck-behavior="read-more"]');
        const moreButton = more.locator('button');
        await expect.poll(() => moreButton.isVisible()).toBe(true);
        expect(await moreButton.getAttribute('aria-expanded')).toBe('false');
        const clamped = await metrics(page, MORE_TEXT);
        expect(clamped.client).toBeLessThanOrEqual(Math.round(4 * clamped.line) + 1);
        expect(clamped.scroll).toBeGreaterThan(clamped.client * 1.5);
        await moreButton.focus();
        await page.keyboard.press('Enter');
        expect(await moreButton.getAttribute('aria-expanded')).toBe('true');
        expect((await moreButton.textContent())?.trim()).toBe(copy.less);
        const opened = await metrics(page, MORE_TEXT);
        expect(opened.client).toBe(opened.scroll);
        await page.keyboard.press('Space');
        expect(await moreButton.getAttribute('aria-expanded')).toBe('false');
        expect((await moreButton.textContent())?.trim()).toBe(copy.more);

        // filter: the first button starts pressed; Web hides the print item; All brings it back.
        const filter = page.locator('[data-ck-behavior="filter"]');
        const shown = () => filter.locator('li:not([hidden])').allTextContents();
        expect(await shown()).toEqual([...copy.items]);
        await filter.getByRole('button', { name: copy.web, exact: true }).focus();
        await page.keyboard.press('Enter');
        expect(await shown()).toEqual([copy.items[0], copy.items[2]]);
        expect(
          await filter
            .getByRole('button', { name: copy.web, exact: true })
            .getAttribute('aria-pressed'),
        ).toBe('true');
        expect(
          await filter
            .getByRole('button', { name: copy.all, exact: true })
            .getAttribute('aria-pressed'),
        ).toBe('false');
        await filter.getByRole('button', { name: copy.print, exact: true }).focus();
        await page.keyboard.press('Space');
        expect(await shown()).toEqual([copy.items[1]]);
        await filter.getByRole('button', { name: copy.all, exact: true }).click();
        expect(await shown()).toEqual([...copy.items]);

        // scroll-spy: anchors land below the sticky header, smoothly; the link in view is current.
        const header = (await metrics(page, 'header')).height;
        expect(await read<string>(page, 'document.documentElement.style.scrollPaddingTop')).toBe(
          `${String(Math.round(header) + 8)}px`,
        );
        const nav = page.locator('[data-ck-behavior="scroll-spy"]');
        await nav.getByRole('link', { name: copy.nav[1] }).focus();
        await page.keyboard.press('Enter');
        expect(await read<string>(page, 'document.documentElement.style.scrollBehavior')).toBe(
          'smooth',
        );
        await expect
          .poll(
            () =>
              read<number>(
                page,
                `Math.abs(document.getElementById('work').getBoundingClientRect().top - ${String(Math.round(header) + 8)})`,
              ),
            { timeout: 5_000 },
          )
          .toBeLessThan(2);
        expect(await read<string>(page, 'location.hash')).toBe('#work');
        await expect
          .poll(() => nav.locator('[aria-current="true"]').textContent())
          .toBe(copy.nav[1]);
        expect(await nav.locator('[aria-current]').count()).toBe(1);
        // The header really sticks, so the target is not under it.
        expect((await metrics(page, 'header')).top).toBe(0);

        // back-to-top: shown a screen down; Enter scrolls smoothly home and moves focus to the h1.
        await expect.poll(() => style(page, TOP, 'visibility')).toBe('visible');
        await top.focus();
        await page.keyboard.press('Enter');
        await expect.poll(() => read<number>(page, 'window.scrollY'), { timeout: 5_000 }).toBe(0);
        expect(await read<string>(page, 'document.activeElement.tagName')).toBe('H1');
        expect(await read<string>(page, 'location.hash')).toBe('#work');
        await expect.poll(() => style(page, TOP, 'visibility')).toBe('hidden');

        // dismiss: the close button appears; a press hides the notice, and a reload keeps it shut.
        const notice = page.locator('[data-ck-behavior="dismiss"]');
        const close = notice.getByRole('button', { name: copy.close });
        expect(await close.isVisible()).toBe(true);
        await close.focus();
        await page.keyboard.press('Enter');
        expect(await notice.isHidden()).toBe(true);
        expect(await read<string>(page, 'document.activeElement.tagName')).not.toBe('BODY');
        await page.reload();
        await mounted(page);
        expect(await page.locator('[data-ck-behavior="dismiss"]').isHidden()).toBe(true);

        expect(
          await read<boolean>(page, 'document.documentElement.scrollWidth > window.innerWidth'),
        ).toBe(false);
        expect(await scanAccessibility(page)).toMatchObject({ counts: { blocking: 0 } });
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
    60_000,
  );

  it.each(['ltr', 'rtl'] as const)(
    'stays still under reduced motion, %s',
    async (dir) => {
      const copy = siteCopy(dir);
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
      });
      try {
        await serve(context, files);
        const { page, errors } = await open(context, dir);

        // typed-words: the first word, as written; nothing types, nothing is added.
        const typed = page.locator(TYPED);
        await page.waitForTimeout(2_500);
        expect(await typed.locator(':scope > span:not([hidden])').allTextContents()).toEqual([
          copy.words[0],
        ]);
        expect(await typed.locator('[aria-hidden="true"]').count()).toBe(0);

        // back-to-top: no fade; the jump home is instant.
        const top = page.locator(TOP);
        await page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
        await expect.poll(() => style(page, TOP, 'visibility')).toBe('visible');
        expect(await style(page, TOP, 'transitionDuration')).toBe('0s');
        await top.focus();
        await page.keyboard.press('Enter');
        expect(await read<number>(page, 'window.scrollY')).toBe(0);

        // scroll-spy: the jump stays instant.
        await page
          .locator('[data-ck-behavior="scroll-spy"]')
          .getByRole('link', { name: copy.nav[2] })
          .focus();
        await page.keyboard.press('Enter');
        expect(await read<string>(page, 'document.documentElement.style.scrollBehavior')).toBe('');
        await expect
          .poll(() =>
            page.locator('[data-ck-behavior="scroll-spy"] [aria-current="true"]').textContent(),
          )
          .toBe(copy.nav[2]);

        expect(
          await read<boolean>(page, 'document.documentElement.scrollWidth > window.innerWidth'),
        ).toBe(false);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    },
    60_000,
  );
});
