import { describe, expect, it } from 'vitest';

import { createBuilder, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import type { JsonValue } from '@craftkit/builder-schema';

import { parseTreeMarkup, serializeTreeMarkup } from '../../../plan/tree-markup';
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
  section.ops {op:'space'} and its zero-token reading (2026-10-13, ready
  scripts): the page's rhythm one step roomier or tighter, band by band, in
  classes the vocabulary generates — what the model used to write as one
  editTree per region.
*/

function kernelWith(markup: string, locale: 'ar' | 'en' = 'en'): BuilderKernel {
  const document = fixtureDocument({ locale });
  const story = document.nodes['r-story'];
  if (story === undefined) throw new Error('r-story');
  return createBuilder({
    document: {
      ...document,
      nodes: {
        ...document.nodes,
        'r-story': {
          ...story,
          props: { ...story.props, tree: parseTreeMarkup(markup) as unknown as JsonValue },
        },
      },
    },
    extensions: [agentToolsFixtureBlocks],
    ports: { clock: fixedClock(1), ids: seededIds('section-space') },
  });
}

function spaced(kernel: BuilderKernel, step: 1 | -1): string {
  const result = expandAndValidate(kernel, 'section.ops', { op: 'space', id: 'r-story', step });
  expect(result.issues).toEqual([]);
  const first = result.result?.ok === true ? result.result.plan.commands[0] : undefined;
  return serializeTreeMarkup((first?.args as { value?: unknown } | undefined)?.value) ?? '';
}

describe('section.ops space', () => {
  it('reads a step of 1 or -1 and refuses any other', () => {
    expect(sectionOpsTool.parse({ op: 'space', id: 'r-story', step: 1 }).ok).toBe(true);
    expect(sectionOpsTool.parse({ op: 'space', id: 'r-story', step: -1 }).ok).toBe(true);
    expect(sectionOpsTool.parse({ op: 'space', id: 'r-story', step: 2 }).ok).toBe(false);
    expect(sectionOpsTool.parse({ op: 'space', id: 'r-story' }).ok).toBe(false);
  });

  it('steps every breakpoint of the band’s vertical padding along the scale, and nothing else', () => {
    const kernel = kernelWith(
      "<section id='story' class='px-4 py-16 md:py-24 lg:pt-28'><h2>Our story</h2></section>",
    );
    expect(spaced(kernel, 1)).toBe(
      "<section class='px-4 py-20 md:py-32 lg:pt-32' id='story'><h2>Our story</h2></section>",
    );
    expect(spaced(kernel, -1)).toBe(
      "<section class='px-4 py-12 md:py-20 lg:pt-24' id='story'><h2>Our story</h2></section>",
    );
  });

  it('steps the one wrapper when the outer element carries no vertical padding', () => {
    const kernel = kernelWith(
      "<section id='story' class='ck-surface'><div class='mx-auto max-w-6xl py-16'><h2>Our story</h2></div></section>",
    );
    expect(spaced(kernel, 1)).toContain("<div class='mx-auto max-w-6xl py-20'>");
  });

  it('writes nothing for a band with no vertical padding, and stops at the ends of the scale', () => {
    expect(
      sectionOpsTool.run(
        { op: 'space', id: 'r-story', step: 1 },
        liveContext(kernelWith("<section id='story'><h2>x</h2></section>")),
      ),
    ).toEqual({
      ok: true,
      steps: [],
      note: 'the section has no vertical padding to step',
    });
    expect(
      spaced(kernelWith("<section id='story' class='py-64 pb-0'><h2>x</h2></section>"), 1),
    ).toBe("<section class='py-64 pb-2' id='story'><h2>x</h2></section>");
  });
});

describe('the zero-token rhythm reading', () => {
  it.each([
    ['more space between the sections', 'en', 'py-20', 'More space between the sections'],
    ['Tighten the spacing between sections', 'en', 'py-12', 'Less space between the sections'],
    ['زوّد المسافات بين الأقسام', 'ar', 'py-20', 'مسافات أكبر بين الأقسام'],
    ['خلي المسافات بين الأقسام أقل', 'ar', 'py-12', 'مسافات أقل بين الأقسام'],
  ])(
    'reads %s as one step per band, the header and footer kept',
    (request, locale, padding, label) => {
      const kernel = fixtureKernel({ locale: locale as 'ar' | 'en' });
      const direct = tryDirectTool(request, kernel);
      expect(direct?.label).toBe(label);
      const ids = direct?.plan.commands.map(({ args }) => (args as { id?: string }).id);
      expect(ids).toEqual(['r-hero', 'r-menu', 'r-story']);
      expect(
        serializeTreeMarkup((direct?.plan.commands[2]?.args as { value?: unknown }).value),
      ).toContain(`class='${padding}'`);
    },
  );

  it('leaves anything more to the model', () => {
    const kernel = fixtureKernel();
    for (const request of [
      'more space between the sections and a bigger hero',
      'more space in the hero',
      'make it airy',
    ]) {
      expect(tryDirectTool(request, kernel)).toBeUndefined();
    }
  });
});
