import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createLiveUtilities,
  setUtilityClassOracle,
  unknownUtilityClasses,
} from '@craftkit/builder';

/*
  tailwind-plugins (2026-10-13): typography (prose), forms (form-*) and tw-animate-css (animate-in
  fade-in slide-in-from-*) reach a custom-code region through Tailwind's own compiler running in
  the page — the live utilities the canvas, the preview, the export and the AI door's oracle use.
  (The static sheet carries only the animate layer; prose and form-* are generated per page.)

  The renderer's live compiler is bundled for the browser exactly as an app bundles it (the CJS
  plugins included), started in Chromium, and asked to style one region. Every claim is read back
  from computed style: the plugin rules apply inside the region and not beside it; their colours,
  radius and slide distance follow the --t-* tokens and move when a token is re-pointed; the
  entrance plays, and under reduced motion it does not; a right-to-left select mirrors its
  chevron; the export's one-shot compile styles a published page that has no region scope.
*/

const QA = process.env['CRAFTKIT_BROWSER_QA'] === '1';

const LIVE_UTILITIES = fileURLToPath(
  new URL('../../../../packages/builder/renderer/src/tailwind/live-utilities.ts', import.meta.url),
);
const THEME_CSS = readFileSync(
  createRequire(LIVE_UTILITIES).resolve('tailwindcss/theme.css'),
  'utf8',
);

const TOKENS = `html{--t-text:rgb(20, 40, 60);--t-text-muted:rgb(90, 100, 110);--t-accent:rgb(200, 30, 90);--t-surface:rgb(250, 248, 240);--t-radius-sm:6px;--t-space-unit:5px;font:16px/1.5 system-ui}body{margin:0;color:var(--t-text);background:var(--t-surface)}`;

const REGION = `<article class="prose" id="prose"><h2>Our story</h2><p>A paragraph with <a href="#a" id="link">a link</a> and <strong>bold</strong>.</p><blockquote id="quote"><p>A quote.</p></blockquote></article>
<form><label>Email <input id="field" type="email" class="form-input mt-1 block w-full" placeholder="you@example.com"></label>
<select id="select" class="form-select"><option>One</option></select>
<label><input id="check" type="checkbox" class="form-checkbox" checked> Agree</label></form>
<div id="enter" class="animate-in fade-in slide-in-from-bottom-4 duration-1000">Hello</div>`;

const OUTSIDE = `<article class="prose" id="outside-prose"><p>Beside the region.</p></article><input id="outside-field" class="form-input">`;

function page(dir: 'ltr' | 'rtl', body: string): string {
  return `<!doctype html><html lang="${dir === 'rtl' ? 'ar' : 'en'}" dir="${dir}"><head><title>Plugin QA</title><style>${TOKENS}</style></head><body><main>${body}</main></body></html>`;
}

/** The live compiler as a browser module that exposes `createLiveUtilities` on window. */
async function liveUtilitiesBundle(): Promise<string> {
  const result = await build({
    stdin: {
      contents: `import { createLiveUtilities } from ${JSON.stringify(LIVE_UTILITIES)};\nwindow.ckCreateLiveUtilities = createLiveUtilities;`,
      resolveDir: fileURLToPath(new URL('.', import.meta.url)),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  });
  const code = result.outputFiles[0]?.text;
  if (code === undefined) throw new Error('The live compiler did not bundle.');
  return code;
}

/** Start the live compiler in the page and wait until the region's classes have CSS. */
async function startLiveUtilities(target: Page, bundle: string): Promise<void> {
  await target.addScriptTag({ type: 'module', content: bundle });
  await target.waitForFunction('typeof window.ckCreateLiveUtilities === "function"');
  await target.evaluate(`(async () => {
    const live = await window.ckCreateLiveUtilities({ document, tailwindThemeCss: ${JSON.stringify(THEME_CSS)} });
    window.ckLive = live;
    live.watch(document);
  })()`);
  await target.waitForFunction(
    "getComputedStyle(document.getElementById('prose')).maxWidth !== 'none'",
  );
}

/** Computed values for the ids asked for, read in the page. */
async function computed(
  target: Page,
  reads: Readonly<Record<string, readonly [id: string, property: string]>>,
): Promise<Record<string, string>> {
  return target.evaluate<Record<string, string>>(
    `Object.fromEntries(Object.entries(${JSON.stringify(reads)}).map(([key, [id, property]]) => [key, getComputedStyle(document.getElementById(id)).getPropertyValue(property)]))`,
  );
}

describe.skipIf(!QA)('Tailwind plugins in a custom-code region, in Chromium', () => {
  let browser: Browser;
  let bundle = '';

  beforeAll(async () => {
    [browser, bundle] = await Promise.all([
      chromium.launch({ headless: true }),
      liveUtilitiesBundle(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await browser.close();
  });

  it('styles prose, forms and the entrance inside the region only, through the tokens', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    try {
      const target = await context.newPage();
      const errors: string[] = [];
      target.on('pageerror', (error) => errors.push(error.message));
      await target.setContent(
        page('ltr', `<div data-ck-custom-code id="region">${REGION}</div>${OUTSIDE}`),
      );
      await startLiveUtilities(target, bundle);

      const values = await computed(target, {
        proseWidth: ['prose', 'max-width'],
        proseColour: ['prose', 'color'],
        link: ['link', 'color'],
        quoteBorder: ['quote', 'border-inline-start-color'],
        outsideProse: ['outside-prose', 'max-width'],
        fieldAppearance: ['field', 'appearance'],
        fieldRadius: ['field', 'border-top-left-radius'],
        fieldBackground: ['field', 'background-color'],
        fieldBorder: ['field', 'border-top-color'],
        outsideField: ['outside-field', 'appearance'],
        check: ['check', 'background-color'],
        animation: ['enter', 'animation-name'],
        duration: ['enter', 'animation-duration'],
      });
      expect(values).toMatchObject({
        proseColour: 'rgb(20, 40, 60)',
        link: 'rgb(200, 30, 90)',
        quoteBorder: 'rgb(200, 30, 90)',
        outsideProse: 'none',
        fieldAppearance: 'none',
        fieldRadius: '6px',
        fieldBackground: 'rgba(0, 0, 0, 0)',
        outsideField: 'auto',
        check: 'rgb(200, 30, 90)',
        animation: 'enter',
        duration: '1s',
      });
      expect(values['proseWidth']).toMatch(/px$/u);
      // The border is the inherited text colour at 30%, whatever form Chromium prints it in.
      expect(values['fieldBorder']).toMatch(/0\.3\)$/u);

      // Focus draws the accent token.
      await target.focus('#field');
      expect(await computed(target, { border: ['field', 'border-top-color'] })).toEqual({
        border: 'rgb(200, 30, 90)',
      });

      // Re-pointing a token re-themes what is already rendered, with no new compile.
      await target.evaluate(
        "document.documentElement.style.setProperty('--t-accent', 'rgb(10, 120, 60)')",
      );
      expect(
        await computed(target, { link: ['link', 'color'], check: ['check', 'background-color'] }),
      ).toEqual({
        link: 'rgb(10, 120, 60)',
        check: 'rgb(10, 120, 60)',
      });

      // The entrance starts transparent and 4 steps of the site's spacing (4 × 5px) below.
      const start = await target.evaluate<{ opacity: string; transform: string }>(`(() => {
        const element = document.getElementById('enter');
        const [animation] = element.getAnimations();
        animation.pause();
        animation.currentTime = 0;
        const style = getComputedStyle(element);
        return { opacity: style.opacity, transform: style.transform };
      })()`);
      expect(start).toEqual({ opacity: '0', transform: 'matrix(1, 0, 0, 1, 0, 20)' });
      const end = await target.evaluate<{ opacity: string; transform: string }>(`(() => {
        const element = document.getElementById('enter');
        element.getAnimations()[0].finish();
        const style = getComputedStyle(element);
        return { opacity: style.opacity, transform: style.transform };
      })()`);
      expect(end).toEqual({ opacity: '1', transform: 'none' });

      // The door's oracle is this same compiler.
      expect(
        await target.evaluate<boolean[]>(
          "['prose', 'prose-invert', 'form-input', 'animate-in', 'fade-in', 'slide-in-from-bottom-4', 'prose-bogus'].map((name) => window.ckLive.isUtilityClass(name))",
        ),
      ).toEqual([true, true, true, true, true, true, false]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  }, 60_000);

  it('is calm under reduced motion: no entrance, content at rest, styling intact', async () => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 900 },
      reducedMotion: 'reduce',
    });
    try {
      const target = await context.newPage();
      await target.setContent(page('ltr', `<div data-ck-custom-code>${REGION}</div>`));
      await startLiveUtilities(target, bundle);
      expect(
        await computed(target, {
          animation: ['enter', 'animation-name'],
          opacity: ['enter', 'opacity'],
          transform: ['enter', 'transform'],
          link: ['link', 'color'],
          field: ['field', 'appearance'],
        }),
      ).toEqual({
        animation: 'none',
        opacity: '1',
        transform: 'none',
        link: 'rgb(200, 30, 90)',
        field: 'none',
      });
      expect(
        await target.evaluate<number>("document.getElementById('enter').getAnimations().length"),
      ).toBe(0);
    } finally {
      await context.close();
    }
  }, 60_000);

  it('mirrors the select chevron on an Arabic page', async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    try {
      const reads = {
        position: ['select', 'background-position-x'],
        start: ['select', 'padding-left'],
        end: ['select', 'padding-right'],
      } as const;
      const ltr = await context.newPage();
      await ltr.setContent(page('ltr', `<div data-ck-custom-code>${REGION}</div>`));
      await startLiveUtilities(ltr, bundle);
      const rtl = await context.newPage();
      await rtl.setContent(page('rtl', `<div data-ck-custom-code>${REGION}</div>`));
      await startLiveUtilities(rtl, bundle);
      expect(await computed(ltr, reads)).toEqual({
        position: 'calc(100% - 8px)',
        start: '12px',
        end: '40px',
      });
      expect(await computed(rtl, reads)).toEqual({ position: '8px', start: '40px', end: '12px' });
    } finally {
      await context.close();
    }
  }, 60_000);

  it("styles a published page from the export's one-shot compile, which has no region scope", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    try {
      const editor = await context.newPage();
      await editor.setContent(page('ltr', `<div data-ck-custom-code>${REGION}</div>`));
      await startLiveUtilities(editor, bundle);
      const css = await editor.evaluate<string>(
        "window.ckLive.compileFor(['prose', 'form-input', 'form-checkbox', 'animate-in', 'fade-in', 'slide-in-from-bottom-4', 'duration-1000', 'mt-1', 'block', 'w-full'])",
      );
      expect(css).not.toContain('@scope');

      const published = await context.newPage();
      await published.setContent(
        page('ltr', REGION).replace('</style>', `</style><style>${css}</style>`),
      );
      expect(
        await computed(published, {
          link: ['link', 'color'],
          field: ['field', 'appearance'],
          radius: ['field', 'border-top-left-radius'],
          animation: ['enter', 'animation-name'],
        }),
      ).toEqual({ link: 'rgb(200, 30, 90)', field: 'none', radius: '6px', animation: 'enter' });
    } finally {
      await context.close();
    }
  }, 60_000);

  it('the AI door: entrances with no compiler running, prose and form-* once it answers', async () => {
    const taught =
      'prose md:prose-lg prose-invert form-input form-select form-checkbox animate-in fade-in zoom-in-95 slide-in-from-bottom-4 motion-reduce:animate-none';
    // The static sheet carries the animate layer only, so the static vocabulary admits only it.
    setUtilityClassOracle(undefined);
    expect(unknownUtilityClasses(taught)).toEqual([
      'prose',
      'md:prose-lg',
      'prose-invert',
      'form-input',
      'form-select',
      'form-checkbox',
    ]);
    // The compiler that generates the content layer is the oracle that admits it.
    const live = await createLiveUtilities({ tailwindThemeCss: THEME_CSS });
    setUtilityClassOracle(live.isUtilityClass);
    try {
      expect(unknownUtilityClasses(taught)).toEqual([]);
      expect(unknownUtilityClasses('prose-bogus form-bogus')).toEqual([
        'prose-bogus',
        'form-bogus',
      ]);
    } finally {
      setUtilityClassOracle(undefined);
    }
  });
});
