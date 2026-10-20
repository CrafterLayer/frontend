import { chromium, type Browser, type Frame } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  mountScrollMural,
  readScrollMural,
  wheelTo,
  type ScrollMuralState,
} from './scroll-mural.browser.fixture';

const QA = process.env['CRAFTKIT_BROWSER_QA'] === '1';

function expectFullyVisible(state: ScrollMuralState): void {
  expect(state.canvasHeight).toBeGreaterThan(250);
  expect(state.canvasTop).toBeGreaterThanOrEqual(state.viewportTop - 2);
  expect(state.canvasBottom).toBeLessThanOrEqual(state.viewportBottom + 2);
}

async function removeScript(frame: Frame, changedStyle = false): Promise<void> {
  await frame.locator('#scroll-mural').evaluate((root, changed) => {
    if (changed) (root as HTMLElement).style.minHeight = '173px';
    root.removeAttribute('data-ck-js');
  }, changedStyle);
  await frame.waitForFunction('window.__scrollStage.destroyed===true');
  expect(await frame.locator('canvas').count()).toBe(0);
  expect(await frame.locator('#authored-copy').count()).toBe(1);
  expect(
    await frame.locator('#scroll-mural').evaluate((root) => (root as HTMLElement).style.minHeight),
  ).toBe(changedStyle ? '173px' : '160px');
}

describe.skipIf(!QA)('native scrolling through a mural in the sandboxed preview', () => {
  let browser: Browser | undefined;
  beforeAll(async () => {
    browser = await chromium.launch({
      headless: true,
      ...(process.env['CRAFTKIT_BROWSER_CHANNEL'] === 'chrome' ? { channel: 'chrome' } : {}),
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
  }, 30_000);
  afterAll(async () => {
    await browser?.close();
  });

  it.each([
    { nested: false, autoHeightClip: false, dir: 'ltr' as const, width: 1280, height: 720 },
    { nested: true, autoHeightClip: false, dir: 'rtl' as const, width: 390, height: 780 },
    { nested: false, autoHeightClip: true, dir: 'ltr' as const, width: 1280, height: 720 },
  ])(
    'keeps every frame visible and reverses ($dir, nested=$nested, auto-height clip=$autoHeightClip)',
    async ({ nested, autoHeightClip, dir, width, height }) => {
      if (browser === undefined) throw new Error('Browser setup did not complete.');
      const context = await browser.newContext({ viewport: { width, height } });
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.route(/^https?:/u, (route) => route.abort());
        const frame = await mountScrollMural(page, { nested, autoHeightClip, dir });
        expect(await frame.locator('canvas').getAttribute('data-ck-scroll-pinned')).toBe('true');
        const initial = await readScrollMural(frame);
        expect(initial.offset).toBe(0);
        expect(initial.progress).toBe(0);
        expect(initial.span).toBeGreaterThan(initial.viewportHeight * 2);
        await wheelTo(page, frame, initial.start);
        const first = await readScrollMural(frame);
        expectFullyVisible(first);
        expect(first.progress).toBeCloseTo(0, 2);
        await wheelTo(page, frame, first.start + first.span / 2);
        await expect
          .poll(() => frame.evaluate<number>('window.__scrollMural.timeline.progress()'))
          .toBeGreaterThan(0.45);
        const middle = await readScrollMural(frame);
        expectFullyVisible(middle);
        expect(middle.progress).toBeGreaterThan(0.45);
        expect(middle.progress).toBeLessThan(0.6);
        await wheelTo(page, frame, first.start + first.span * 0.98);
        await expect.poll(async () => (await readScrollMural(frame)).progress).toBe(1);
        await expect
          .poll(() => frame.evaluate<number>('window.__scrollMural.timeline.progress()'))
          .toBe(1);
        const final = await readScrollMural(frame);
        expectFullyVisible(final);
        expect(new Set([first.signature, middle.signature, final.signature]).size).toBe(3);
        expect(final.pageOffset).toBe(nested ? 0 : final.offset);
        if (autoHeightClip) {
          expect(
            await frame.locator('#auto-height-clip').evaluate((wrapper) => ({
              offset: wrapper.scrollTop,
              overflow: wrapper.scrollHeight - wrapper.clientHeight,
            })),
          ).toEqual({ offset: 0, overflow: 0 });
        }
        expect(await frame.evaluate('window.__scrollMural.warnings')).toEqual([]);
        // Native forward scrolling leaves the final hold and reaches ordinary content.
        await wheelTo(page, frame, first.start + first.span + first.canvasHeight * 0.6);
        const after = await frame.locator('#after').boundingBox();
        expect(after?.y).toBeLessThan(final.viewportBottom);
        expect((after?.y ?? 0) + (after?.height ?? 0)).toBeGreaterThan(final.viewportTop);
        expect((await readScrollMural(frame)).canvasTop).toBeLessThan(final.canvasTop);
        // Returning through the same scroll range returns to earlier story beats.
        await wheelTo(page, frame, first.start + first.span / 2);
        await expect
          .poll(() => frame.evaluate<number>('window.__scrollMural.timeline.progress()'))
          .toBeLessThan(0.6);
        expectFullyVisible(await readScrollMural(frame));
        await wheelTo(page, frame, 0);
        expect((await readScrollMural(frame)).progress).toBe(0);
        expect(await frame.getByText('Before the mural', { exact: true }).isVisible()).toBe(true);
        // A changed viewport recalculates both scene dimensions and its runway.
        await page.setViewportSize({ width: width === 390 ? 460 : 1100, height: height - 100 });
        await expect
          .poll(async () => (await readScrollMural(frame)).viewportHeight)
          .toBeLessThan(initial.viewportHeight);
        await expect
          .poll(async () => (await readScrollMural(frame)).span)
          .toBeLessThan(initial.span);
        const resized = await readScrollMural(frame);
        await wheelTo(page, frame, resized.start + resized.span * 0.98);
        await expect.poll(async () => (await readScrollMural(frame)).progress).toBe(1);
        expectFullyVisible(await readScrollMural(frame));
        await removeScript(frame, nested);
        expect(errors).toEqual([]);
        expect(await page.evaluate('window.__previewErrors')).toEqual([]);
      } finally {
        await context.close();
      }
    },
    90_000,
  );

  it('pins legacy scrub params and restores the authored layout when the script is removed', async () => {
    if (browser === undefined) throw new Error('Browser setup did not complete.');
    const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
    try {
      const page = await context.newPage();
      await page.route(/^https?:/u, (route) => route.abort());
      const frame = await mountScrollMural(page, { legacy: true, dir: 'rtl' });
      expect(await frame.locator('canvas').getAttribute('data-ck-scroll-pinned')).toBe('true');
      const first = await readScrollMural(frame);
      expect(first.span).toBeGreaterThan(first.viewportHeight * 2);
      await wheelTo(page, frame, first.start + first.span * 0.98);
      await expect.poll(async () => (await readScrollMural(frame)).progress).toBe(1);
      const final = await readScrollMural(frame);
      expectFullyVisible(final);
      expect(final.signature).not.toBe(first.signature);
      await removeScript(frame);
      expect(await page.evaluate('window.__previewErrors')).toEqual([]);
    } finally {
      await context.close();
    }
  }, 60_000);

  it('keeps the reduced-motion still readable without creating an empty scroll runway', async () => {
    if (browser === undefined) throw new Error('Browser setup did not complete.');
    const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
    try {
      const page = await context.newPage();
      await page.route(/^https?:/u, (route) => route.abort());
      const frame = await mountScrollMural(page, {
        reducedMotion: true,
        dir: 'rtl',
        nested: true,
      });
      expect(await frame.locator('canvas').getAttribute('data-ck-scroll-pinned')).toBeNull();
      const first = await readScrollMural(frame);
      expect(first.rootHeight).toBeLessThanOrEqual(first.viewportHeight + 4);
      expect(first.span).toBeLessThanOrEqual(4);
      expect(await frame.evaluate('window.__scrollScene.app.ticker.started')).toBe(false);
      await wheelTo(page, frame, first.start);
      const visible = await readScrollMural(frame);
      expect(visible.canvasTop).toBeGreaterThanOrEqual(visible.viewportTop - 2);
      expect(visible.canvasBottom).toBeLessThanOrEqual(visible.viewportBottom + 4);
      expect(visible.signature).toBe(first.signature);
      await removeScript(frame);
      expect(await page.evaluate('window.__previewErrors')).toEqual([]);
    } finally {
      await context.close();
    }
  }, 60_000);
});
