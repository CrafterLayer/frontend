import { describe, expect, it } from 'vitest';

import { findCssRejection, type JsonValue } from '@craftkit/builder-schema';

import { checkSection } from './check-section';
import { BUILDER_PLAN, CAFE_PLAN } from './tidy.fixtures';
import type { PagePlan } from './types';

function bespoke(plan: PagePlan): PagePlan {
  return {
    ...plan,
    design: {
      kind: 'website',
      composition: 'bespoke',
      chrome: 'none',
      concept: 'A readable workspace with role-led typography.',
    },
  };
}

function fontIssues(css: string, className = '', plan = bespoke(BUILDER_PLAN)) {
  const contract = {
    key: 'screen',
    role: 'band' as const,
    title: 'Screen',
    anchorId: 'screen',
    purpose: 'A screen.',
    mustSay: [],
    mustNotRepeat: [],
  };
  const tree: JsonValue = {
    kind: 'root',
    children: [
      {
        kind: 'element',
        tag: 'section',
        attributes: { id: 'screen' },
        children: [
          {
            kind: 'element',
            tag: 'p',
            className,
            text: plan.locale.lang === 'ar' ? 'المؤشر' : 'Metric',
            children: [],
          },
        ],
      },
    ],
  };
  return checkSection(plan, contract, { tree, css }).filter(
    (issue) => issue.code === 'foreign-font',
  );
}

const google = (value: string) =>
  `@import url('https://fonts.googleapis.com/css2?family=${value}&display=swap');`;

describe('bespoke verified additional fonts through the actual section checker', () => {
  it.each([
    [google('Geist:wght@400;700'), '.metric{font-family:Geist;font-weight:700}'],
    [google('Geist'), '.metric{font-family:Geist!important;font-weight:400!important}'],
    [google('Space+Grotesk:wght@400%3B700'), ".metric{font-family:'Space Grotesk'}"],
    [
      "@import 'https://fonts.googleapis.com/css?family=Geist:400,700&display=swap';",
      '.metric{font-family:Geist;font-weight:700}',
    ],
    [
      "@import url('https://fonts.bunny.net/css?family=space-grotesk:400,700&display=swap');",
      ".metric{font-family:'Space Grotesk';font-weight:700}",
    ],
  ])('admits correctly loaded verified faces: %s', (declaration, rule) => {
    expect(findCssRejection(declaration + rule)).toBeUndefined();
    expect(fontIssues(declaration + rule)).toEqual([]);
  });

  it('admits multiple extra faces and arbitrary classes without a two-font ceiling', () => {
    const css = google('Geist:wght@400;700&family=Space+Grotesk:wght@400;700');
    expect(fontIssues(css, "md:font-['Space_Grotesk',sans-serif] font-bold")).toEqual([]);
    expect(fontIssues(css + '.other{font-family:Geist;font-weight:400}')).toEqual([]);
  });

  it('follows renderer import hoisting, including imports after a rule', () => {
    expect(fontIssues('.metric{font-family:Geist}' + google('Geist'))).toEqual([]);
  });

  it('admits an Arabic-capable third face on Arabic pages', () => {
    expect(
      fontIssues(google('Cairo:wght@400;700'), 'font-[Cairo] font-bold', bespoke(CAFE_PLAN)),
    ).toEqual([]);
  });

  it.each([
    ['unloaded', '.metric{font-family:Geist}', ''],
    ['unknown', google('Imaginary+Font'), 'font-[Imaginary_Font]'],
    ['unverified real face', google('Inter'), 'font-[Inter]'],
    [
      'escaped import renderer cannot lift',
      google('Geist').replace('@import', '@\\69mport'),
      'font-[Geist]',
    ],
    ['insecure', "@import url('http://fonts.googleapis.com/css2?family=Geist');", 'font-[Geist]'],
    ['foreign host', "@import url('https://example.org/css2?family=Geist');", 'font-[Geist]'],
    [
      'host suffix',
      "@import url('https://fonts.googleapis.com.evil.org/css2?family=Geist');",
      'font-[Geist]',
    ],
    [
      'wrong API path',
      "@import url('https://fonts.googleapis.com/other?family=Geist');",
      'font-[Geist]',
    ],
    [
      'invalid display mode',
      google('Geist').replace('display=swap', 'display=garbage'),
      'font-[Geist]',
    ],
    ['wrong css2 syntax', google('Geist:400,700'), 'font-[Geist]'],
    ['unsorted weights', google('Geist:wght@700;400'), 'font-[Geist]'],
    ['unshipped imported weight', google('Lalezar:wght@700'), 'font-[Lalezar]'],
    ['unloaded class weight', google('Geist:wght@400'), 'font-[Geist] font-bold'],
    [
      'unloaded CSS weight',
      google('Geist:wght@400') + '.metric{font-family:Geist;font-weight:700}',
      '',
    ],
    ['unloaded arbitrary weight', google('Geist:wght@400'), 'font-[Geist] [font-weight:700]'],
    ['italic axis not verified', google('Geist:ital,wght@1,400'), 'font-[Geist]'],
    ['conditional import', google('Geist').replace(');', ') print;'), 'font-[Geist]'],
  ])('rejects %s', (_name, css, className) => {
    expect(fontIssues(css, className).length).toBeGreaterThan(0);
  });

  it('rejects Latin-only faces on an Arabic page', () => {
    expect(fontIssues(google('Geist'), 'font-[Geist]', bespoke(CAFE_PLAN)).length).toBeGreaterThan(
      0,
    );
  });

  it('does not admit site-owned font utilities or change legacy/hybrid loading rules', () => {
    expect(fontIssues('', 'font-serif').length).toBeGreaterThan(0);
    expect(fontIssues(google('Geist'), 'font-[Geist]', BUILDER_PLAN).length).toBeGreaterThan(0);
    const hybrid: PagePlan = {
      ...BUILDER_PLAN,
      design: {
        kind: 'website',
        composition: 'hybrid',
        chrome: 'none',
        concept: 'A readable workspace.',
      },
    };
    expect(fontIssues(google('Geist'), 'font-[Geist]', hybrid).length).toBeGreaterThan(0);
    expect(fontIssues(".metric{font-family:'Archivo Black',sans-serif}", '', BUILDER_PLAN)).toEqual(
      [],
    );
  });

  it('never throws for malformed percent encoding in a legacy font URL', () => {
    expect(() => fontIssues(google('%ZZ'), '', BUILDER_PLAN)).not.toThrow();
  });
});
