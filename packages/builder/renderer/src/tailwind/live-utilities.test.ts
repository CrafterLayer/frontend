import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  CANVAS_STATES,
  CANVAS_STATE_ATTRIBUTE,
  CUSTOM_CODE_REGION_ATTRIBUTE,
  createLiveUtilities as createWithTheme,
  type LiveUtilitiesOptions,
} from './live-utilities';

// The host supplies Tailwind's theme text; a Vite app imports it with `?raw`, the tests read the file.
const tailwindThemeCss = readFileSync(
  createRequire(import.meta.url).resolve('tailwindcss/theme.css'),
  'utf8',
);

function createLiveUtilities(options: Partial<LiveUtilitiesOptions> = {}) {
  return createWithTheme({ tailwindThemeCss, ...options });
}

/*
  jsdom has no `@scope`, and the live sheet refuses a page without it. Every
  browser the product targets has it; these suites declare it the same way.
*/
function declareScopeSupport(view: Window | null): void {
  if (view === null) return;
  // Only its presence is read; any constructor-shaped value declares it.
  Object.defineProperty(view, 'CSSScopeRule', { value: () => undefined, configurable: true });
}

function withdrawScopeSupport(view: Window | null): void {
  if (view === null) return;
  Reflect.deleteProperty(view, 'CSSScopeRule');
}

beforeAll(() => {
  declareScopeSupport(document.defaultView);
});

afterAll(() => {
  withdrawScopeSupport(document.defaultView);
});

/** The text of the block opened by the first `prelude {` in `css`, braces balanced. */
function blockBody(css: string, prelude: string): string {
  const start = css.indexOf(`${prelude} {`);
  if (start === -1) return '';
  let depth = 0;
  for (let at = css.indexOf('{', start); at < css.length; at += 1) {
    if (css[at] === '\\') at += 1;
    else if (css[at] === "'" || css[at] === '"') at = css.indexOf(css[at] ?? '', at + 1);
    else if (css[at] === '{') depth += 1;
    else if (css[at] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(css.indexOf('{', start) + 1, at);
    }
  }
  return '';
}

/** Let a MutationObserver deliver. */
function settle(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/*
  Every class below was either refused by the static vocabulary or silently
  stripped on 2026-09-27 — ordinary Tailwind a section plan was sent back for.
*/
describe('live utilities', () => {
  it('judges class names by what Tailwind actually generates', async () => {
    const live = await createLiveUtilities();

    for (const name of [
      'md:flex-row',
      'backdrop-blur',
      'border-emerald-900/20',
      'min-h-[80vh]',
      'group-hover:text-white',
      'bg-accent',
    ]) {
      expect(live.isUtilityClass(name), name).toBe(true);
    }
    expect(live.isUtilityClass('totally-made-up')).toBe(false);
    expect(live.isUtilityClass('ck-hero-glow')).toBe(false);
    expect(live.isUtilityClass('')).toBe(false);
  });

  it('admits the group and peer markers that generate no CSS of their own', async () => {
    const live = await createLiveUtilities();

    expect(live.isUtilityClass('group')).toBe(true);
    expect(live.isUtilityClass('peer/card')).toBe(true);
    expect(live.isUtilityClass('group-x')).toBe(false);
  });

  it('writes CSS for exactly the classes asked for into the document', async () => {
    const live = await createLiveUtilities({ document });

    live.ensure(['md:flex-row', 'totally-made-up', 'group']);

    const sheets = document.head.querySelectorAll('style[data-ck-live-utilities]');
    expect(sheets).toHaveLength(1);
    const css = sheets[0]?.textContent ?? '';
    expect(css).toContain('.md\\:flex-row');
    expect(css).not.toContain('totally-made-up');
    live.dispose();
    expect(document.head.querySelectorAll('style[data-ck-live-utilities]')).toHaveLength(0);
  });

  it('replaces the sheet node on growth so the canvas iframe mirrors the new one', async () => {
    const live = await createLiveUtilities({ document });

    live.ensure(['p-[17px]']);
    const first = document.head.querySelector('style[data-ck-live-utilities]');
    live.ensure(['p-[17px]']);
    expect(document.head.querySelector('style[data-ck-live-utilities]')).toBe(first);

    live.ensure(['bg-emerald-900/20']);
    const second = document.head.querySelectorAll('style[data-ck-live-utilities]');
    expect(second).toHaveLength(1);
    expect(second[0]).not.toBe(first);
    expect(live.css()).toContain('.p-\\[17px\\]');
    expect(live.css()).toContain('.bg-emerald-900\\/20');
    live.dispose();
  });

  it('resolves design-system utilities through the site tokens', async () => {
    const live = await createLiveUtilities();

    live.ensure(['bg-accent']);

    expect(live.css()).toContain('var(--t-accent');
  });
});

describe('live utilities without a real theme', () => {
  it('refuses to start rather than judge every breakpoint class unknown', async () => {
    await expect(createWithTheme({ tailwindThemeCss: '' })).rejects.toThrow(/no breakpoints/u);
  });
});

/*
  The static sheet carries `grid-cols-1` and `@sm:grid-cols-2` for the built-in
  Testimonials, in the same utilities layer. An unscoped live copy of
  `grid-cols-1`, written after it, won the tie and held Testimonials at one
  column site-wide (measured in Chromium). The scope is what prevents that.
*/
describe('live utilities are scoped to custom-code regions', () => {
  const region = `[${CUSTOM_CODE_REGION_ATTRIBUTE}]`;

  it('emits every utility inside @scope of the region root, in Tailwind order', async () => {
    const live = await createLiveUtilities();

    live.ensure(['@sm:grid-cols-2', 'grid-cols-1', 'motion-reduce:transition-none', 'transition']);

    const css = live.css();
    const layer = blockBody(css, '@layer utilities');
    const scoped = blockBody(layer, `@scope (${region})`);
    // The layer holds the scope and nothing else: no rule escapes it.
    expect(layer.trim()).toBe(`@scope (${region}) {${scoped}}`);
    for (const selector of [
      '.grid-cols-1',
      '.\\@sm\\:grid-cols-2',
      '.transition',
      '.motion-reduce\\:transition-none',
    ]) {
      expect(scoped, selector).toContain(selector);
    }
    // Base before variant, as Tailwind orders them — the order the scope keeps.
    expect(scoped.indexOf('.grid-cols-1')).toBeLessThan(scoped.indexOf('.\\@sm\\:grid-cols-2'));
    expect(scoped.indexOf('.transition {')).toBeLessThan(
      scoped.indexOf('.motion-reduce\\:transition-none'),
    );
  });

  it('leaves theme variables and @property global, where they must stay to resolve', async () => {
    const live = await createLiveUtilities();

    live.ensure(['shadow-lg', 'bg-accent']);

    const css = live.css();
    const scoped = blockBody(blockBody(css, '@layer utilities'), `@scope (${region})`);
    expect(scoped).toContain('.shadow-lg');
    expect(scoped).not.toContain('@property');
    expect(css).toMatch(/^@property --tw-shadow /mu);
    expect(css.indexOf('@layer theme')).toBeLessThan(css.indexOf('@scope'));
  });

  it('keeps a brace inside a selector or a string from closing the scope early', async () => {
    const live = await createLiveUtilities();

    // Emits `.before\:content-\[\'\{\'\]::before` and `--tw-content: '{'`.
    live.ensure(["before:content-['{']", 'p-[17px]', 'md:p-[19px]']);

    const layer = blockBody(live.css(), '@layer utilities');
    const scoped = blockBody(layer, `@scope (${region})`);
    expect(layer.trim()).toBe(`@scope (${region}) {${scoped}}`);
    expect(scoped).toContain("--tw-content: '{'");
    expect(scoped).toContain('.p-\\[17px\\]');
    expect(scoped).toContain('.md\\:p-\\[19px\\]');
  });

  it('refuses to write into a page without @scope, so the static vocabulary keeps answering', async () => {
    withdrawScopeSupport(document.defaultView);
    try {
      await expect(createLiveUtilities({ document })).rejects.toThrow(/@scope/u);
    } finally {
      declareScopeSupport(document.defaultView);
    }
  });
});

/*
  A Plan/Ask proposal renders a scratch document the site store never sees.
  Before the watch, its classes — admitted by the oracle as real Tailwind —
  had no CSS in the preview and then rendered differently after Apply.
*/
describe('live utilities watch what renders in AI regions', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  function regionWith(markup: string, owner: Document = document): HTMLElement {
    const root = owner.createElement('div');
    root.setAttribute(CUSTOM_CODE_REGION_ATTRIBUTE, '');
    root.innerHTML = markup;
    return root;
  }

  it('generates CSS for a proposal rendered outside the site store', async () => {
    const live = await createLiveUtilities({ document });
    const stop = live.watch(document);

    const dialog = document.createElement('div');
    dialog.append(regionWith('<section class="flex flex-col md:flex-row-reverse min-h-[72vh]">'));
    document.body.append(dialog);
    await settle();

    expect(live.css()).toContain('.md\\:flex-row-reverse');
    expect(live.css()).toContain('.min-h-\\[72vh\\]');
    stop();
    live.dispose();
  });

  it('ignores classes outside every region, so chrome never enters the sheet', async () => {
    const live = await createLiveUtilities({ document });
    const stop = live.watch(document);

    const chrome = document.createElement('div');
    chrome.className = 'bg-[#0b1220]';
    document.body.append(chrome);
    await settle();

    expect(live.css()).not.toContain('0b1220');
    stop();
    live.dispose();
  });

  it('reads regions already on the page and class changes inside them', async () => {
    const tree = regionWith('<p class="text-[13px]">Hi</p>');
    document.body.append(tree);
    const live = await createLiveUtilities({ document });
    const stop = live.watch(document);

    expect(live.css()).toContain('.text-\\[13px\\]');

    tree.querySelector('p')?.setAttribute('class', 'tracking-[0.3em]');
    await settle();

    expect(live.css()).toContain('.tracking-\\[0\\.3em\\]');
    stop();
    live.dispose();
  });

  it('follows a same-origin frame, where the canvas renders', async () => {
    const live = await createLiveUtilities({ document });
    const stop = live.watch(document);
    const frame = document.createElement('iframe');
    document.body.append(frame);
    await settle();

    const inner = frame.contentDocument;
    expect(inner).not.toBeNull();
    inner?.body.append(regionWith('<div class="grid-cols-[2fr_1fr]"></div>', inner));
    await settle();

    expect(live.css()).toContain('.grid-cols-\\[2fr_1fr\\]');

    // A removed frame is let go: its document no longer feeds the sheet.
    frame.remove();
    await settle();
    inner?.body.append(regionWith('<div class="grid-rows-[3fr_1fr]"></div>', inner));
    await settle();

    expect(live.css()).not.toContain('grid-rows-');
    stop();
    live.dispose();
  });

  it('stops reading once stopped, and dispose stops every watch', async () => {
    const live = await createLiveUtilities({ document });
    const stop = live.watch(document);
    stop();

    document.body.append(regionWith('<p class="leading-[1.1]"></p>'));
    await settle();
    expect(live.css()).not.toContain('leading-');

    live.watch(document);
    live.dispose();
    document.body.append(regionWith('<p class="indent-[3px]"></p>'));
    await settle();
    expect(live.css()).not.toContain('indent-');
  });
});

/*
  style-manager DESIGN §A.7 (2026-10-05): the canvas previews a state without
  the pointer being there. Its live instance lets hover:/focus-visible:/
  active:/open: also match [data-ck-state~="<state>"]; nothing else does.
*/
describe('canvas state variants', () => {
  it('compiles hover, focus-visible, active and open to also match the forced-state attribute', async () => {
    const live = await createLiveUtilities({ canvasStateVariants: true });
    live.ensure([
      'hover:bg-red-500',
      'focus-visible:ring-2',
      'active:scale-95',
      'open:block',
      'max-md:hover:p-4',
    ]);
    const css = live.css();
    expect(css).toContain(`.hover\\:bg-red-500[${CANVAS_STATE_ATTRIBUTE}~="hover"]`);
    expect(css).toContain('.hover\\:bg-red-500:hover');
    expect(css).toContain(`.focus-visible\\:ring-2[${CANVAS_STATE_ATTRIBUTE}~="focus-visible"]`);
    expect(css).toContain(`.active\\:scale-95[${CANVAS_STATE_ATTRIBUTE}~="active"]`);
    expect(css).toContain(`.open\\:block[${CANVAS_STATE_ATTRIBUTE}~="open"]`);
    // Buckets and states combine: the mobile hover rule previews too.
    expect(css).toContain(`.max-md\\:hover\\:p-4[${CANVAS_STATE_ATTRIBUTE}~="hover"]`);
    expect(CANVAS_STATES).toEqual(['hover', 'focus-visible', 'active', 'open']);
  });

  it('is off by default, so a published sheet never carries the attribute', async () => {
    const live = await createLiveUtilities();
    live.ensure(['hover:bg-red-500']);
    expect(live.css()).not.toContain(CANVAS_STATE_ATTRIBUTE);
    expect(live.css()).toContain('.hover\\:bg-red-500:hover');
  });
});

describe('compileFor, the export fallback', () => {
  it('compiles exactly the classes asked for, unscoped, without touching the live sheet', async () => {
    const live = await createLiveUtilities({ canvasStateVariants: true });
    live.ensure(['p-2']);
    const before = live.css();
    const css = await live.compileFor(['p-[17px]', 'hover:bg-red-500', 'not-a-utility', 'group']);
    expect(css).toContain('.p-\\[17px\\]');
    expect(css).toContain('.hover\\:bg-red-500:hover');
    // Canvas-only state variants and the region scope stay out of an export sheet.
    expect(css).not.toContain(CANVAS_STATE_ATTRIBUTE);
    expect(css).not.toContain('@scope');
    expect(css).not.toContain('not-a-utility');
    expect(live.css()).toBe(before);
    // A second compile does not inherit the first one's classes.
    const next = await live.compileFor(['m-1']);
    expect(next).not.toContain('17px');
    expect(await live.compileFor([])).toBe('');
  });
});
