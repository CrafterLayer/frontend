import type { BuilderDocument } from '@craftkit/builder-schema';
import { describe, expect, it } from 'vitest';

import { checkQuality, blocks, type QualityCheck } from './index';

/** A page whose regions carry custom-code trees, the way a build leaves them. */
function pageWith(
  regions: readonly { id: string; tree: unknown; css?: string }[],
  extra: { dir?: 'ltr' | 'rtl'; pageCss?: string } = {},
): BuilderDocument {
  const document: BuilderDocument = {
    schemaVersion: 1,
    surface: 'site',
    dir: extra.dir ?? 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: extra.pageCss === undefined ? {} : { pageCss: extra.pageCss },
        slots: { default: regions.map((region) => region.id) },
      },
      ...Object.fromEntries(
        regions.map((region) => [
          region.id,
          {
            id: region.id,
            type: 'customCode',
            props: {
              tree: region.tree,
              ...(region.css === undefined ? {} : { css: region.css }),
            },
          },
        ]),
      ),
    },
  };
  return document;
}

const element = (tag: string, extra: Record<string, unknown> = {}) => ({
  kind: 'element',
  tag,
  ...extra,
});

const tree = (...children: unknown[]) => ({ kind: 'root', children });

/** A real section: a heading and a paragraph under it. */
const section = (title: string, body = 'Real copy that says something.') =>
  element('section', {
    children: [element('h2', { text: title }), element('p', { text: body })],
  });

const checksIn = (document: BuilderDocument): QualityCheck[] =>
  checkQuality(document).issues.map((issue) => issue.check);

describe('checkQuality', () => {
  it('passes a page with nothing wrong with it', () => {
    const report = checkQuality(pageWith([{ id: 's1', tree: tree(section('Hero')) }]));
    expect(report.issues).toEqual([]);
    expect(report.passes).toBe(true);
  });

  describe('heading order', () => {
    it('refuses a level SKIPPED, which puts a hole in the outline', () => {
      const document = pageWith([
        { id: 's1', tree: tree(element('h2', { text: 'Hero' }), element('p', { text: 'x' })) },
        { id: 's2', tree: tree(element('h4', { text: 'Deep' }), element('p', { text: 'x' })) },
      ]);
      expect(checksIn(document)).toContain('heading-order');
    });

    it('allows a level REPEATED — that is two sections, not a hole', () => {
      const document = pageWith([
        { id: 's1', tree: tree(section('Hero')) },
        { id: 's2', tree: tree(section('Work')) },
      ]);
      expect(checksIn(document)).not.toContain('heading-order');
    });

    it('allows going back UP: h2, h3, h2 is an outline, not a gap', () => {
      const document = pageWith([
        { id: 's1', tree: tree(section('Hero')) },
        { id: 's2', tree: tree(element('h3', { text: 'Sub' }), element('p', { text: 'x' })) },
        { id: 's3', tree: tree(section('Work')) },
      ]);
      expect(checksIn(document)).not.toContain('heading-order');
    });

    it('says which levels, so a person knows what to change it to', () => {
      const document = pageWith([
        { id: 's1', tree: tree(element('h1', { text: 'Page' }), element('p', { text: 'x' })) },
        { id: 's2', tree: tree(element('h4', { text: 'Deep' }), element('p', { text: 'x' })) },
      ]);
      const issue = checkQuality(document).issues.find((one) => one.check === 'heading-order');
      expect(issue?.message).toContain('h1 to h4');
      expect(issue?.message).toContain('h2');
    });
  });

  describe('internal links', () => {
    it('refuses one that points at nothing on the page', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(
            element('h2', { text: 'Hero' }),
            element('a', { text: 'Pricing', attributes: { href: '#pricing' } }),
          ),
        },
      ]);
      expect(checksIn(document)).toContain('internal-link');
    });

    it('allows one whose target is declared', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(
            element('h2', { text: 'Hero' }),
            element('a', { text: 'Pricing', attributes: { href: '#pricing' } }),
          ),
        },
        {
          id: 's2',
          tree: tree(
            element('h2', { text: 'Pricing', attributes: { id: 'pricing' } }),
            element('p', { text: 'x' }),
          ),
        },
      ]);
      expect(checksIn(document)).not.toContain('internal-link');
    });

    it('allows one the CALLER says exists elsewhere, and does not guess', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(
            element('h2', { text: 'Hero' }),
            element('a', { text: 'Contact', attributes: { href: '#contact' } }),
          ),
        },
      ]);
      expect(checkQuality(document).issues.map((one) => one.check)).toContain('internal-link');
      expect(
        checkQuality(document, { knownAnchors: ['contact'] }).issues.map((one) => one.check),
      ).not.toContain('internal-link');
    });

    it('ignores an external link entirely — it is not this check’s business', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(
            element('h2', { text: 'Hero' }),
            element('a', { text: 'Out', attributes: { href: 'https://example.com' } }),
          ),
        },
      ]);
      expect(checksIn(document)).not.toContain('internal-link');
    });
  });

  it('refuses a duplicate id, because a link to it reaches only the first', () => {
    const document = pageWith([
      {
        id: 's1',
        tree: tree(
          element('h2', { text: 'A', attributes: { id: 'x' } }),
          element('p', { text: 'y' }),
        ),
      },
      {
        id: 's2',
        tree: tree(
          element('h2', { text: 'B', attributes: { id: 'x' } }),
          element('p', { text: 'y' }),
        ),
      },
    ]);
    expect(checksIn(document)).toContain('duplicate-id');
  });

  describe('empty sections', () => {
    it('refuses the shell a build leaves when a fill never landed', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(element('section', { children: [element('h2', { text: 'Proof' })] })),
        },
      ]);
      const issue = checkQuality(document).issues.find((one) => one.check === 'empty-section');
      expect(issue?.severity).toBe('error');
      expect(issue?.nodeId).toBe('s1');
    });

    it('accepts a section whose only content is an image', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(
            element('h2', { text: 'Gallery' }),
            element('img', { attributes: { src: '/a.png' } }),
          ),
        },
      ]);
      expect(checksIn(document)).not.toContain('empty-section');
    });

    it('accepts a section that references a real block', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(element('h2', { text: 'Prices' }), {
            kind: 'component',
            component: 'pricing',
          }),
        },
      ]);
      expect(checksIn(document)).not.toContain('empty-section');
    });
  });

  describe('placeholder copy', () => {
    it('WARNS rather than blocking — the page works, it is just embarrassing', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(
            element('h2', { text: 'Hero' }),
            element('p', { text: 'Lorem ipsum dolor sit amet' }),
          ),
        },
      ]);
      const report = checkQuality(document);
      expect(report.issues.some((one) => one.check === 'placeholder-text')).toBe(true);
      expect(report.passes).toBe(true);
      expect(blocks(report.issues)).toEqual([]);
    });

    it('knows the Arabic fillers too — the default locale is Arabic', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(element('h2', { text: 'البطل' }), element('p', { text: 'نص تجريبي هنا' })),
        },
      ]);
      expect(checksIn(document)).toContain('placeholder-text');
    });

    it('quotes what it found, so a person can search for it', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(element('h2', { text: 'Hero' }), element('p', { text: 'TODO write this' })),
        },
      ]);
      const issue = checkQuality(document).issues.find((one) => one.check === 'placeholder-text');
      expect(issue?.message).toContain('TODO write this');
    });
  });

  describe('direction', () => {
    it('refuses an Arabic page set to read left to right', () => {
      const document = pageWith([
        { id: 's1', tree: tree(section('البطل', 'نصّ حقيقي عن الاستوديو.')) },
      ]);
      expect(checksIn(document)).toContain('direction');
    });

    it('does NOT fire on an English page carrying one Arabic word', () => {
      /*
        The first version asked "is there any Arabic here", and the playground's
        own English landing fixture — which carries one Arabic string — tripped
        it. A bilingual page, a quoted name or a font sample would have too.
      */
      const document = pageWith([
        { id: 's1', tree: tree(section('Our studio', 'We make things. Our name is استوديو.')) },
      ]);
      expect(checksIn(document)).not.toContain('direction');
    });

    it('is not confused by tag names and class names, which are always Latin', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(
            element('section', {
              className: 'py-12 md:py-16 mx-auto max-w-6xl',
              children: [
                element('h2', { className: 'text-3xl font-semibold', text: 'استوديو الخزف' }),
                element('p', { className: 'opacity-80', text: 'نصنع كل قطعة بأيدينا.' }),
              ],
            }),
          ),
        },
      ]);
      expect(checksIn(document)).toContain('direction');
    });

    it('says nothing when the same page reads right to left', () => {
      const document = pageWith(
        [{ id: 's1', tree: tree(section('البطل', 'نصّ حقيقي عن الاستوديو.')) }],
        {
          dir: 'rtl',
        },
      );
      expect(checksIn(document)).not.toContain('direction');
    });
  });

  describe('contrast', () => {
    it('refuses a pairing that misses the ratio its text size needs', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(section('Hero')),
          css: '.ck-a { color: #cccccc; background: #ffffff }',
        },
      ]);
      const issue = checkQuality(document).issues.find((one) => one.check === 'contrast');
      expect(issue?.severity).toBe('error');
      expect(issue?.nodeId).toBe('s1');
      expect(issue?.message).toMatch(/:1/u);
    });

    it('accepts a pairing that clears it', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(section('Hero')),
          css: '.ck-a { color: #111111; background: #ffffff }',
        },
      ]);
      expect(checksIn(document)).not.toContain('contrast');
    });

    it('measures the page’s own stylesheet too', () => {
      const document = pageWith([{ id: 's1', tree: tree(section('Hero')) }], {
        pageCss: '.ck-page { color: #dddddd; background: #eeeeee }',
      });
      expect(checksIn(document)).toContain('contrast');
    });

    it('holds a HEADING to the lower ratio, as the standard does', () => {
      // 3.9:1 — fails normal text, passes large.
      const pair = 'color: #949494; background: #ffffff';
      const heading = pageWith([
        { id: 's1', tree: tree(section('Hero')), css: `.ck-h2-title { ${pair} }` },
      ]);
      const body = pageWith([
        { id: 's1', tree: tree(section('Hero')), css: `.ck-body { ${pair} }` },
      ]);
      expect(checksIn(heading)).not.toContain('contrast');
      expect(checksIn(body)).toContain('contrast');
    });

    it('says NOTHING about a rule it cannot resolve, rather than guessing', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(section('Hero')),
          // Only one half declared: the other comes from the cascade.
          css: '.ck-a { color: #cccccc } .ck-b { background: linear-gradient(#000, #fff); color: #fff }',
        },
      ]);
      expect(checksIn(document)).not.toContain('contrast');
    });

    it('is not fooled by a custom property that merely ends in "color"', () => {
      const document = pageWith([
        {
          id: 's1',
          tree: tree(section('Hero')),
          css: '.ck-a { --brand-color: #ccc; background: #fff }',
        },
      ]);
      expect(checksIn(document)).not.toContain('contrast');
    });
  });

  it('reports in READING order, so a person fixing the page works down it', () => {
    const document = pageWith([
      {
        id: 's1',
        tree: tree(element('h2', { text: 'Hero' }), element('p', { text: 'Lorem ipsum here' })),
      },
      {
        id: 's2',
        tree: tree(element('section', { children: [element('h2', { text: 'Empty' })] })),
      },
    ]);
    const nodes = checkQuality(document).issues.map((issue) => issue.nodeId);
    expect(nodes.indexOf('s1')).toBeLessThan(nodes.indexOf('s2'));
  });

  it('separates what blocks a commit from what merely reports', () => {
    const document = pageWith([
      { id: 's1', tree: tree(element('h2', { text: 'Hero' }), element('p', { text: 'TODO' })) },
      {
        id: 's2',
        tree: tree(element('section', { children: [element('h2', { text: 'Empty' })] })),
      },
    ]);
    const report = checkQuality(document);
    expect(report.passes).toBe(false);
    expect(blocks(report.issues).map((issue) => issue.check)).toEqual(['empty-section']);
  });
});
