import { describe, expect, it } from 'vitest';

import type { JsonValue } from '@craftkit/builder-schema';

import type { AiPlan } from '../../types';
import { checkSection } from './check-section';
import {
  BUILDER_PLAN,
  CAFE_PLAN,
  builderBand,
  builderHero,
  contractOf,
  h,
  tree,
  writerSteps,
  written,
} from './tidy.fixtures';
import { tidySection, type TidySectionOptions } from './tidy-section';
import type { PagePlan, SectionCheckCode } from './types';

/*
  The code repairs before the check (2026-10-13): each row writes a section
  the way writers slip, shows the check finds it, then shows what tidy wrote
  and that the check finds NOTHING after it — the slip never reaches the
  repair round. The rows at the end pin what tidy must never do: guess a
  photo, a word or a place, or write what the region's schema refuses.
*/

function options(
  plan: PagePlan,
  key: string,
  extra: Partial<TidySectionOptions> = {},
): TidySectionOptions {
  return { plan, contract: contractOf(plan, key), ...extra };
}

function codes(plan: PagePlan, key: string, commands: AiPlan['commands']): SectionCheckCode[] {
  const section = {
    tree: written(commands, 'tree') as JsonValue,
    ...(typeof written(commands, 'css') === 'string'
      ? { css: written(commands, 'css') as string }
      : {}),
  };
  return checkSection(plan, contractOf(plan, key), section).map(({ code }) => code);
}

/** Tidies, and asserts the check found `code` before and nothing after. */
function repaired(
  plan: PagePlan,
  key: string,
  commands: AiPlan['commands'],
  code: SectionCheckCode,
) {
  expect(codes(plan, key, commands)).toContain(code);
  const report = tidySection(commands, options(plan, key));
  expect(codes(plan, key, report.commands)).toEqual([]);
  return {
    report,
    tree: JSON.stringify(written(report.commands, 'tree')),
    css: written(report.commands, 'css'),
  };
}

describe('tidySection — heading-level', () => {
  it('makes a band’s h1 an h2', () => {
    const band = builderBand();
    const slipped = JSON.parse(JSON.stringify(band).replace('"h2"', '"h1"')) as JsonValue;
    const { report, tree: after } = repaired(
      BUILDER_PLAN,
      'projects',
      writerSteps(slipped),
      'heading-level',
    );
    expect(after).toContain('"tag":"h2"');
    expect(after).not.toContain('"tag":"h1"');
    expect(report.fixed).toEqual(['heading-level']);
  });

  it('keeps the hero’s first h1 and makes the second an h2', () => {
    const hero = builderHero([h('h1', 'text-2xl', 'Family-run')]);
    const { tree: after } = repaired(BUILDER_PLAN, 'hero', writerSteps(hero), 'heading-level');
    expect(after.match(/"tag":"h1"/gu)).toHaveLength(1);
    expect(after).toContain('"tag":"h2","className":"text-2xl"');
  });

  it('heads a hero with no h1 with its first heading when that is an h2', () => {
    const hero = JSON.parse(JSON.stringify(builderHero()).replace('"h1"', '"h2"')) as JsonValue;
    const { tree: after } = repaired(BUILDER_PLAN, 'hero', writerSteps(hero), 'heading-level');
    expect(after).toContain('"tag":"h1","className":"text-6xl"');
  });

  it('leaves the headings alone when the region css reads them by tag', () => {
    const band = JSON.parse(JSON.stringify(builderBand()).replace('"h2"', '"h1"')) as JsonValue;
    const commands = writerSteps(band, { css: '.ck-x h1{letter-spacing:-0.02em}' });
    expect(tidySection(commands, options(BUILDER_PLAN, 'projects')).commands).toBe(commands);
  });
});

describe('tidySection — missing-anchor', () => {
  it('puts the section’s anchor on its outer element', () => {
    const { tree: after } = repaired(
      BUILDER_PLAN,
      'projects',
      writerSteps(builderBand([], {})),
      'missing-anchor',
    );
    expect(after).toContain('"attributes":{"id":"projects"}');
  });

  it('moves the anchor from an inner wrapper to the outer element', () => {
    const slipped = tree(
      h('section', 'ck-surface py-24', [
        h(
          'div',
          'mx-auto max-w-6xl',
          [h('h2', '', 'Projects'), h('p', '', '120 homes delivered.')],
          {
            id: 'projects',
          },
        ),
      ]),
    );
    const { tree: after } = repaired(
      BUILDER_PLAN,
      'projects',
      writerSteps(slipped),
      'missing-anchor',
    );
    const section = (
      JSON.parse(after) as {
        children: { attributes?: unknown; children: { attributes?: unknown }[] }[];
      }
    ).children[0];
    expect(section?.attributes).toEqual({ id: 'projects' });
    expect(section?.children[0]?.attributes).toBeUndefined();
  });

  it('replaces another section’s anchor on the outer element, and renames its own links', () => {
    const slipped = builderBand([h('a', 'ck-link', 'Top', { href: '#work' })], { id: 'work' });
    const { tree: after } = repaired(
      BUILDER_PLAN,
      'projects',
      writerSteps(slipped),
      'missing-anchor',
    );
    expect(after).toContain('"id":"projects"');
    expect(after).toContain('"href":"#projects"');
    const foreign = builderBand([], { id: 'quote' });
    expect(
      repaired(BUILDER_PLAN, 'projects', writerSteps(foreign), 'missing-anchor').tree,
    ).not.toContain('"id":"quote"');
  });

  it('drops another section’s anchor from an inner element, and respells a link by case', () => {
    const slipped = builderBand([
      h('div', '', 'x', { id: 'quote' }),
      h('a', 'ck-link', 'Ask', { href: '#Quote' }),
    ]);
    const { tree: after } = repaired(
      BUILDER_PLAN,
      'projects',
      writerSteps(slipped),
      'missing-anchor',
    );
    expect(after).not.toContain('"id":"quote"');
    expect(after).toContain('"href":"#quote"');
  });

  it('leaves a link to a section that does not exist to the writer', () => {
    const commands = writerSteps(builderBand([h('a', 'ck-link', 'Team', { href: '#team' })]));
    expect(tidySection(commands, options(BUILDER_PLAN, 'projects')).commands).toBe(commands);
  });
});

describe('tidySection — cta-label', () => {
  it('points a link that says the action at the action', () => {
    const hero = builderHero([
      h('a', 'ck-btn ck-btn--ghost', 'Get a quote', { href: '#projects' }),
    ]);
    const { tree: after } = repaired(BUILDER_PLAN, 'hero', writerSteps(hero), 'cta-label');
    expect(after).not.toContain('"href":"#projects"');
  });

  it('makes a button that carries the action the action’s link, keeping its classes', () => {
    const quote = tree(
      h(
        'section',
        'ck-accent-fill py-16',
        [h('h2', '', 'Quote'), h('button', 'ck-btn px-8', 'Get a quote', { type: 'button' })],
        {
          id: 'quote',
        },
      ),
    );
    const { tree: after } = repaired(BUILDER_PLAN, 'quote', writerSteps(quote), 'cta-label');
    expect(after).toContain(
      '"tag":"a","className":"ck-btn px-8","text":"Get a quote","attributes":{"href":"#quote"}',
    );
  });

  it('leaves a wrong label, and a hero with no action, to the writer', () => {
    const relabelled = writerSteps(builderHero());
    const wrong = JSON.parse(
      JSON.stringify(relabelled).replace('"Get a quote"', '"Call us"'),
    ) as AiPlan['commands'];
    // "label it exactly …" and "add the page's action": which words, and where, are the writer's.
    expect(codes(BUILDER_PLAN, 'hero', wrong)).toEqual(['cta-label', 'cta-label']);
    expect(tidySection(wrong, options(BUILDER_PLAN, 'hero')).commands).toBe(wrong);
  });
});

describe('tidySection — contrast and colour', () => {
  it('colours accent text with ck-accent-ink when the accent does not read as text', () => {
    const hero = builderHero([h('p', 'text-yellow-400 text-4xl', '120')]);
    const { tree: after } = repaired(BUILDER_PLAN, 'hero', writerSteps(hero), 'contrast');
    expect(after).toContain('"className":"ck-accent-ink text-4xl"');
  });

  it('moves accent text in the css to the accent’s text token', () => {
    const css = '.ck-stat{color:var(--ck-accent);background:var(--ck-accent)}';
    const { css: after } = repaired(
      BUILDER_PLAN,
      'hero',
      writerSteps(builderHero(), { css }),
      'contrast',
    );
    expect(after).toBe('.ck-stat{color:var(--ck-accent-ink);background:var(--ck-accent)}');
  });

  it('gives text on a plan-coloured ground the ground’s own ink', () => {
    const hero = builderHero([
      h('div', 'bg-yellow-400 p-6', [h('p', 'text-white', 'Free site visit')]),
    ]);
    const { tree: after } = repaired(BUILDER_PLAN, 'hero', writerSteps(hero), 'contrast');
    expect(after).toContain('"className":"ck-accent-fill p-6"');
    expect(after).not.toContain('text-white');
  });

  it('moves the css’s exact colour literals onto the page, all or none', () => {
    const css =
      '.ck-card{box-shadow:0 4px 12px rgba(15,23,42,.08);border:1px solid #e4e4e7;color:rgb(24,24,27)}.ck-veil{background:#fafafa}';
    const { css: after } = repaired(
      BUILDER_PLAN,
      'hero',
      writerSteps(builderHero(), { css }),
      'raw-colour',
    );
    expect(after).toBe(
      '.ck-card{box-shadow:0 4px 12px rgb(0 0 0 / 0.08);border:1px solid var(--ck-border);color:#18181b}.ck-veil{background:#ffffff}',
    );
    const glow = writerSteps(builderHero(), { css: `${css}.ck-glow{background:hsl(280 80% 60%)}` });
    expect(tidySection(glow, options(BUILDER_PLAN, 'hero')).commands).toBe(glow);
  });

  it('removes the site-face classes', () => {
    const hero = builderHero([h('p', 'font-serif md:font-sans text-lg', 'Since 2004')]);
    const { tree: after } = repaired(BUILDER_PLAN, 'hero', writerSteps(hero), 'foreign-font');
    expect(after).toContain('"className":"text-lg"');
  });
});

describe('tidySection — what it never does', () => {
  it('returns the same commands when the check finds nothing, or nothing it can fix exactly', () => {
    const clean = writerSteps(builderHero());
    expect(tidySection(clean, options(BUILDER_PLAN, 'hero'))).toEqual({
      commands: clean,
      fixed: [],
    });
    const placeholder = writerSteps(builderHero([h('p', '', 'Call [phone]')]));
    expect(tidySection(placeholder, options(BUILDER_PLAN, 'hero')).commands).toBe(placeholder);
    const photo = writerSteps(
      builderHero([h('img', '', [], { src: 'https://example.com/a.jpg', alt: 'site' })]),
    );
    expect(tidySection(photo, options(BUILDER_PLAN, 'hero')).commands).toBe(photo);
  });

  it('repairs what it can and leaves the rest of the section’s findings for the repair round', () => {
    const band = JSON.parse(
      JSON.stringify(builderBand([h('p', '', 'Lorem ipsum dolor')])).replace('"h2"', '"h1"'),
    ) as JsonValue;
    const report = tidySection(writerSteps(band), options(BUILDER_PLAN, 'projects'));
    expect(report.fixed).toEqual(['heading-level']);
    expect(codes(BUILDER_PLAN, 'projects', report.commands)).toEqual(['placeholder-left']);
  });

  it('writes nothing the region’s schema refuses', () => {
    const css = '.ck-card{box-shadow:0 4px 12px rgba(15,23,42,.08)}';
    const commands = writerSteps(builderHero(), { css });
    const refused = tidySection(
      commands,
      options(BUILDER_PLAN, 'hero', { accepts: (key) => key !== 'css' }),
    );
    expect(refused.commands).toBe(commands);
  });

  it('tidies an Arabic section the same way, palette classes first', () => {
    const band = tree(
      h(
        'section',
        'bg-white py-16',
        [h('h1', 'text-sky-900 text-4xl', 'القائمة'), h('p', 'ck-muted', 'إسبريسو')],
        {
          id: 'menu',
        },
      ),
    );
    const report = tidySection(writerSteps(band), options(CAFE_PLAN, 'menu'));
    expect(report.fixed).toEqual(['palette-classes', 'heading-level']);
    expect(codes(CAFE_PLAN, 'menu', report.commands)).toEqual([]);
  });

  it('reads a tree written as markup, and writes the repaired tree back in place', () => {
    const markup =
      "<section class='ck-surface py-24'><h1>Projects</h1><p>120 homes delivered.</p></section>";
    const commands = writerSteps(markup);
    const report = tidySection(commands, options(BUILDER_PLAN, 'projects'));
    expect(report.fixed).toEqual(['missing-anchor', 'heading-level']);
    expect(report.commands).toHaveLength(1);
    expect(codes(BUILDER_PLAN, 'projects', report.commands)).toEqual([]);
  });
});
