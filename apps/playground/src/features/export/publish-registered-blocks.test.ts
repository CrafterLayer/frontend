// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';
import {
  LATEST_SITE_VERSION,
  createLiveUtilities,
  defaultDesignSystem,
  type BuilderSite,
} from '@craftkit/builder';

import { createPlaygroundKernel } from '../preview/create-playground-kernel';

import { exportCompilers } from './export-compilers';
import { publishStaticSite } from './publish-static-site';

/*
  Fix pass 2026-10-06 (D03-export-top.png): the published site lost every
  registered block's styling — assets/site.css held the base reset and the
  scoped custom-code classes only, so 262 of the 289 classes in index.html had
  no rule and the hero's h1 rendered 16px black. This publishes the landing
  fixture (registered blocks only) through the REAL Tailwind compiler and
  proves every utility the page renders has a rule in the stylesheet it links.
*/

const tailwindThemeCss = readFileSync(
  createRequire(import.meta.url).resolve('tailwindcss/theme.css'),
  'utf8',
);

/** A class as Tailwind writes it in a selector: `md:p-4` → `md\:p-4`. */
function selectorOf(name: string): string {
  return `.${name.replace(/[^\w-]/gu, (char) => `\\${char}`)}`;
}

describe('publishing registered blocks', () => {
  it('ships a rule for every utility class the published page renders', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    const site: BuilderSite = {
      siteVersion: LATEST_SITE_VERSION,
      dir: kernel.getDocument().dir,
      pages: [
        { id: 'home', address: '/', title: 'Home', purpose: '', audience: '', document: kernel.getDocument(), regions: [] },
      ],
      sharedRegions: {},
      designSystem: defaultDesignSystem(),
      assets: {},
    };
    const compiler = await createLiveUtilities({ tailwindThemeCss });
    const { compileCss, compileClasses } = exportCompilers({ site, liveSheet: '', compiler });
    const files = await publishStaticSite(site, {
      blocks: kernel.context.registry.block,
      compileCss,
      ...(compileClasses === undefined ? {} : { compileClasses }),
    });
    const html = files.find(({ path }) => path === 'index.html')?.content ?? '';
    const sheet = /href="([^"]+\.css)"/u.exec(html)?.[1]?.replace(/^\.\//u, '') ?? '';
    const css = files.find(({ path }) => path === sheet)?.content ?? '';
    const body = html.slice(html.indexOf('<body'));
    const classes = new Set(
      [...body.matchAll(/class="([^"]*)"/gu)].flatMap((match) => (match[1] ?? '').split(/\s+/u)),
    );
    const utilities = [...classes].filter((name) => name !== '' && compiler.isUtilityClass(name));
    expect(utilities.length).toBeGreaterThan(20);
    const missing = utilities.filter((name) => !css.includes(selectorOf(name)));
    expect(missing).toEqual([]);
    // The token bridge resolves block colours through the theme, with its fallbacks.
    expect(css).toMatch(/var\(--t-/u);
  }, 60_000);
});
