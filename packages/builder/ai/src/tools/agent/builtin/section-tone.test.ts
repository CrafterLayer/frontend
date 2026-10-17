import { describe, expect, it } from 'vitest';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import type { JsonValue } from '@craftkit/builder-schema';

import { serializeTreeMarkup, parseTreeMarkup } from '../../../plan/tree-markup';
import {
  agentToolsFixtureBlocks,
  expandAndValidate,
  fixtureDocument,
  fixtureKernel,
  liveContext,
} from '../agent-tools.fixtures';
import { tryDirectTool } from '../direct-tool';
import { sectionOpsTool } from './section-ops';

/*
  section.ops {op:'tone'} and its zero-token reading (2026-10-13, ready
  scripts): one step makes a section a dark, light, surface or accent band in
  the page's tokens — what the model used to write as one editTree quote per
  class — and the door accepts every result, in English and in Arabic.
*/

/** A kernel whose story region is `markup` (and its css `css`). */
function kernelWith(
  markup: string,
  options: { locale?: 'ar' | 'en'; css?: string; kit?: boolean } = {},
): BuilderKernel {
  const document = fixtureDocument({
    locale: options.locale ?? 'en',
    ...(options.kit === false ? { kit: false } : {}),
  });
  const story = document.nodes['r-story'];
  if (story === undefined) throw new Error('r-story');
  return createBuilder({
    document: {
      ...document,
      nodes: {
        ...document.nodes,
        'r-story': {
          ...story,
          props: {
            ...story.props,
            tree: parseTreeMarkup(markup) as unknown as JsonValue,
            css: options.css ?? '',
          },
        },
      },
    },
    extensions: [agentToolsFixtureBlocks],
    ports: { clock: fixedClock(1), ids: seededIds('section-tone') },
  });
}

/** The story region's tree, as markup, after a tone step the door accepted. */
function toned(kernel: BuilderKernel, tone: string): string {
  const result = expandAndValidate(kernel, 'section.ops', { op: 'tone', id: 'r-story', tone });
  expect(result.issues).toEqual([]);
  const step = result.result?.ok === true ? result.result.plan.commands[0] : undefined;
  return serializeTreeMarkup((step?.args as { value?: unknown } | undefined)?.value) ?? '';
}

describe('section.ops tone', () => {
  it('reads the four tones and refuses any other', () => {
    for (const tone of ['dark', 'light', 'surface', 'accent']) {
      expect(sectionOpsTool.parse({ op: 'tone', id: 'r-story', tone }).ok).toBe(true);
    }
    expect(sectionOpsTool.parse({ op: 'tone', id: 'r-story' }).ok).toBe(false);
    expect(sectionOpsTool.parse({ op: 'tone', id: 'r-story', tone: 'darker' }).ok).toBe(false);
  });

  it('makes a plain band dark with the kit ground, its own text roles re-pointed by the kit', () => {
    expect(toned(fixtureKernel(), 'dark')).toBe(
      "<section class='ck-inverse py-16' id='story'><h2 class='text-3xl'>Our story</h2><p>Since 1998.</p></section>",
    );
  });

  it('moves the text colours written for the old ground onto the kit roles, and leaves cards alone', () => {
    const kernel = kernelWith(
      "<section id='story' class='bg-white text-stone-900 py-16'><h2 class='text-stone-900 text-3xl'>Our story</h2><p class='text-black/60'>Since 1998.</p><icon name='coffee' class='text-white'/><div class='ck-card p-6'><p class='text-stone-500'>Kept</p></div><a class='ck-btn' href='#menu'>Menu</a></section>",
    );
    expect(toned(kernel, 'dark')).toBe(
      "<section class='ck-inverse py-16' id='story'><h2 class='ck-ink text-3xl'>Our story</h2><p class='ck-muted'>Since 1998.</p><icon name='coffee'/><div class='ck-card p-6'><p class='text-stone-500'>Kept</p></div><a class='ck-btn' href='#menu'>Menu</a></section>",
    );
  });

  it('turns a dark band light, an accent band, or a soft surface — gradients and white text go', () => {
    const dark =
      "<section id='story' class='bg-gradient-to-b from-stone-900 to-black text-white md:py-24'><h2 class='text-white'>Our story</h2><p class='text-white/70'>Since 1998.</p></section>";
    expect(toned(kernelWith(dark), 'light')).toBe(
      "<section class='ck-ground md:py-24' id='story'><h2>Our story</h2><p class='ck-muted'>Since 1998.</p></section>",
    );
    expect(toned(kernelWith(dark), 'accent')).toContain("class='ck-accent-fill md:py-24'");
    expect(toned(kernelWith(dark), 'surface')).toContain("class='ck-surface md:py-24'");
  });

  it('keeps an Arabic band right-to-left: only its classes change', () => {
    const kernel = fixtureKernel({ locale: 'ar' });
    expect(toned(kernel, 'dark')).toBe(
      "<section class='ck-inverse py-16' id='story'><h2 class='text-3xl'>قصتنا</h2><p>منذ ١٩٩٨.</p></section>",
    );
  });

  it('writes nothing for a band that already has the tone', () => {
    const run = sectionOpsTool.run(
      { op: 'tone', id: 'r-story', tone: 'dark' },
      liveContext(
        kernelWith("<section id='story' class='ck-inverse py-16'><h2>Our story</h2></section>"),
      ),
    );
    expect(run).toEqual({ ok: true, steps: [], note: 'the section is already dark' });
  });

  it('refuses, with the fix, a page with no kit and a band whose css paints its ground', () => {
    const noKit = expandAndValidate(
      kernelWith("<section id='story'><h2>x</h2></section>", { kit: false }),
      'section.ops',
      {
        op: 'tone',
        id: 'r-story',
        tone: 'dark',
      },
    );
    expect(noKit.issues.join(' ')).toMatch(/no page kit.*theme\.apply/u);
    const painted = expandAndValidate(
      kernelWith("<section id='story' class='ck-story'><h2>x</h2></section>", {
        css: '.ck-story{background:#0b1020}',
      }),
      'section.ops',
      { op: 'tone', id: 'r-story', tone: 'light' },
    );
    expect(painted.issues.join(' ')).toMatch(
      /paints its ground in its own css \(\.ck-story\{…\}\)/u,
    );
  });
});

describe('the zero-token tone reading', () => {
  it.each([
    ['make the story section dark', 'en', 'ck-inverse', 'Make “Story” a dark band'],
    ['Make the story light', 'en', 'ck-ground', 'Make “Story” a light band'],
    [
      'give the story section an accent background',
      'en',
      'ck-accent-fill',
      'Make “Story” an accent band',
    ],
    ['خلّي قسم قصتنا داكن', 'ar', 'ck-inverse', 'قسم «قصتنا» بخلفية داكنة'],
    ['اجعل خلفية قصتنا فاتحة', 'ar', 'ck-ground', 'قسم «قصتنا» بخلفية فاتحة'],
    ['خلي قصتنا بلون الهوية', 'ar', 'ck-accent-fill', 'قسم «قصتنا» بلون الهوية'],
    // The evals' own request (corpus 24): the text and the reason say nothing the kit does not do.
    [
      'Make the story section dark with light text so it stands out from the rest of the page.',
      'en',
      'ck-inverse',
      'Make “Story” a dark band',
    ],
    ['خلي قسم قصتنا غامق بنص أبيض', 'ar', 'ck-inverse', 'قسم «قصتنا» بخلفية داكنة'],
  ])('reads %s with no model', (request, locale, ground, label) => {
    const direct = tryDirectTool(request, fixtureKernel({ locale: locale as 'ar' | 'en' }));
    expect(direct?.label).toBe(label);
    expect(direct?.plan.commands).toHaveLength(1);
    expect(
      serializeTreeMarkup((direct?.plan.commands[0]?.args as { value?: unknown }).value),
    ).toContain(`class='${ground} py-16'`);
  });

  it('reads a section by its role: the hero', () => {
    const direct = tryDirectTool('make the hero dark', fixtureKernel());
    expect(direct?.plan.commands[0]).toMatchObject({
      command: 'setProp',
      args: { id: 'r-hero', key: 'tree' },
    });
  });

  it('leaves a shade, the whole page, a second request and an unknown section to the model', () => {
    const kernel = fixtureKernel();
    for (const request of [
      'make the story darker',
      'make the page dark',
      'make the story dark and add a button',
      'make the gallery section dark',
      'make the story dark with dark text',
    ]) {
      expect(tryDirectTool(request, kernel)).toBeUndefined();
    }
  });
});
