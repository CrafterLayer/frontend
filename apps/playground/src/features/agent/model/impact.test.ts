import {
  LATEST_SCHEMA_VERSION,
  defineBlockSchema,
  type BuilderDocument,
  type JsonValue,
  type Node,
} from '@craftkit/builder';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import { t } from '../copy';
import { createPlaygroundKernel } from '../../preview/create-playground-kernel';
import * as impactModule from './impact';
import {
  IMPACT_KEYS,
  IMPACT_WORD_KEYS,
  describeImpact,
  impactLines,
  planImpact,
  schemaImpactNaming,
  textPropsOf,
  type ImpactLine,
  type ImpactWordKey,
} from './impact';
import type { ChangeLineView } from './view-types';

function doc(
  nodes: BuilderDocument['nodes'],
  meta: Partial<Pick<BuilderDocument, 'dir' | 'surface'>> = {},
): BuilderDocument {
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes,
    ...meta,
  };
}

const page = (children: string[]) => ({
  root: { id: 'root', type: 'page', props: {}, slots: { default: children } },
});

/* A free-form region the way the build writes one: a label and a tree of elements. */
const region = (id: string, label: string, heading: string, extra: JsonValue[] = []): Node => ({
  id,
  type: 'customCode',
  props: {
    label,
    tree: {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'section',
          className: 'py-16',
          children: [{ kind: 'element', tag: 'h2', text: heading }, ...extra],
        },
      ],
    },
    css: '',
  },
});

describe('planImpact (kept from v1)', () => {
  it('names what was added, in the order it reads down the page', () => {
    const impact = planImpact(
      doc({ ...page([]) }),
      doc({
        ...page(['hero', 'pricing']),
        hero: { id: 'hero', type: 'hero', props: {} },
        pricing: { id: 'pricing', type: 'pricing', props: {} },
      }),
    );
    expect(impact.added).toEqual(['hero', 'pricing']);
    expect(impact.addedTypes).toEqual(['hero', 'pricing']);
    expect(impact.empty).toBe(false);
  });

  it('reports a change and a removal, but not the parent whose slot merely lost a child', () => {
    const before = doc({
      ...page(['a', 'b']),
      a: { id: 'a', type: 'text', props: { content: 'one' } },
      b: { id: 'b', type: 'text', props: {} },
    });
    const after = doc({ ...page(['a']), a: { id: 'a', type: 'text', props: { content: 'ONE' } } });
    const impact = planImpact(before, after);
    expect(impact.changed).toEqual(['a']);
    expect(impact.removed).toEqual(['b']);
  });

  it('reports a reorder and a move, which nothing else would say', () => {
    const reorder = planImpact(
      doc({
        ...page(['a', 'b']),
        a: { id: 'a', type: 't', props: {} },
        b: { id: 'b', type: 't', props: {} },
      }),
      doc({
        ...page(['b', 'a']),
        a: { id: 'a', type: 't', props: {} },
        b: { id: 'b', type: 't', props: {} },
      }),
    );
    expect(reorder.changed).toEqual(['root']);

    const move = planImpact(
      doc({
        root: { id: 'root', type: 'page', props: {}, slots: { default: ['boxA', 'boxB'] } },
        boxA: { id: 'boxA', type: 'box', props: {}, slots: { default: ['x'] } },
        boxB: { id: 'boxB', type: 'box', props: {}, slots: { default: [] } },
        x: { id: 'x', type: 'text', props: {} },
      }),
      doc({
        root: { id: 'root', type: 'page', props: {}, slots: { default: ['boxA', 'boxB'] } },
        boxA: { id: 'boxA', type: 'box', props: {}, slots: { default: [] } },
        boxB: { id: 'boxB', type: 'box', props: {}, slots: { default: ['x'] } },
        x: { id: 'x', type: 'text', props: {} },
      }),
    );
    expect(move.changed).toEqual(['boxA', 'boxB']);
  });

  it('ignores prop order, counts a dangling removal once, and does not loop on a cycle', () => {
    expect(
      planImpact(
        doc({ ...page(['a']), a: { id: 'a', type: 't', props: { x: 1, y: 2 } } }),
        doc({ ...page(['a']), a: { id: 'a', type: 't', props: { y: 2, x: 1 } } }),
      ).empty,
    ).toBe(true);

    const dangling = planImpact(
      doc({ ...page(['a']), a: { id: 'a', type: 't', props: {} } }),
      doc({ ...page(['a']) }),
    );
    expect(dangling.removed).toEqual(['a']);
    expect(dangling.changed).not.toContain('a');

    const cyclic = doc({
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['a'] } },
      a: { id: 'a', type: 'box', props: {}, slots: { default: ['root'] } },
    });
    expect(planImpact(doc({ ...page([]) }), cyclic).added).toEqual(['a']);
  });

  it('reports a direction flip, which no node diff would mention', () => {
    const nodes = { ...page([]) };
    expect(planImpact(doc(nodes), doc(structuredClone(nodes), { dir: 'rtl' })).meta).toEqual([
      'dir',
    ]);
  });
});

describe('describeImpact: catalog keys, not sentences (SPEC §7.4)', () => {
  it('counts rather than listing ids, as keys the catalog pluralises', () => {
    const impact = planImpact(
      doc({ ...page(['a']), a: { id: 'a', type: 'text', props: { content: 'x' } } }),
      doc({
        ...page(['a', 'b', 'c']),
        a: { id: 'a', type: 'text', props: { content: 'y' } },
        b: { id: 'b', type: 'text', props: {} },
        c: { id: 'c', type: 'text', props: {} },
      }),
    );
    expect(describeImpact(impact)).toEqual([
      { key: 'impact.added', params: { n: 2 } },
      { key: 'impact.changed', params: { n: 1 } },
    ]);
  });

  it('says a plan changes nothing when it truly does', () => {
    const same = doc({ ...page(['a']), a: { id: 'a', type: 'text', props: { content: 'x' } } });
    expect(describeImpact(planImpact(same, doc(structuredClone(same.nodes))))).toEqual([
      { key: 'impact.none', params: {} },
    ]);
  });

  it('names a direction or surface change instead of counting it', () => {
    const nodes = { ...page([]) };
    expect(
      describeImpact(planImpact(doc(nodes), doc(structuredClone(nodes), { dir: 'rtl' }))),
    ).toEqual([{ key: 'impact.dir', params: {} }]);
  });

  it('only ever emits the declared keys, and the counts stay numbers for plurals', () => {
    const impact = planImpact(
      doc({ ...page(['a']), a: { id: 'a', type: 't', props: {} } }),
      doc({ ...page(['b']), b: { id: 'b', type: 't', props: {} } }, { surface: 'email' }),
    );
    for (const part of describeImpact(impact)) {
      expect(IMPACT_KEYS).toContain(part.key);
      for (const value of Object.values(part.params)) expect(typeof value).toBe('number');
    }
  });

  it('keeps cost and token estimates out of the UI model (SPEC §7.4)', () => {
    expect(Object.keys(impactModule)).not.toContain('describeCost');
    expect(Object.keys(impactModule)).not.toContain('estimateRequestTokens');
  });
});

/*
  The host's naming, built the way the controller builds it: every word from the catalog
  (`t(locale, key)`), so these tests read the copy a person sees in each locale.
*/
const english = schemaImpactNaming((key) => t('en', key));
const arabic = schemaImpactNaming((key) => t('ar', key));

/* A region's first element, for a test that restyles it in place. */
function firstElement(document: BuilderDocument, id: string): { className?: string } {
  const tree = document.nodes[id]?.props['tree'] as { children: { className?: string }[] };
  const element = tree.children[0];
  if (element === undefined) throw new Error(`region ${id} has no element`);
  return element;
}

describe('impactLines: before → after in schema terms, never command names (SPEC §4.9)', () => {
  it('reads a changed text inside a region by the element’s role (SPEC §3.8 example)', () => {
    const before = doc({ ...page(['faq']), faq: region('faq', 'FAQ', 'FAQ') });
    const after = doc({ ...page(['faq']), faq: region('faq', 'FAQ', 'Questions patients ask') });
    expect(impactLines(before, after, english)).toEqual([
      { kind: 'changed', label: 'Heading', before: 'FAQ', after: 'Questions patients ask' },
    ]);
  });

  it('labels a block prop the way the Inspector does', () => {
    const before = doc({
      ...page(['h']),
      h: { id: 'h', type: 'hero', props: { buttonLabel: 'Book', heading: 'Hi' } },
    });
    const after = doc({
      ...page(['h']),
      h: { id: 'h', type: 'hero', props: { buttonLabel: 'Book now', heading: 'Hi' } },
    });
    expect(impactLines(before, after, english)).toEqual([
      { kind: 'changed', label: 'Button label', before: 'Book', after: 'Book now' },
    ]);
  });

  it('names an added section once, by its title, not every block inside it', () => {
    const before = doc({ ...page(['hero']), hero: region('hero', 'Hero', 'Welcome') });
    const after = doc({
      ...page(['hero', 'pricing']),
      hero: region('hero', 'Hero', 'Welcome'),
      pricing: { ...region('pricing', 'Pricing', 'Plans'), slots: { default: ['cta'] } },
      cta: { id: 'cta', type: 'button', props: { text: 'Buy' } },
    });
    expect(impactLines(before, after, english)).toEqual([
      { kind: 'added', label: 'Section', value: 'Pricing' },
    ]);
  });

  it('names a removed section by its title', () => {
    const before = doc({
      ...page(['hero', 'faq']),
      hero: region('hero', 'Hero', 'Welcome'),
      faq: region('faq', 'FAQ', 'Questions'),
    });
    const after = doc({ ...page(['hero']), hero: region('hero', 'Hero', 'Welcome') });
    expect(impactLines(before, after, english)).toEqual([
      { kind: 'removed', label: 'Section', value: 'FAQ' },
    ]);
  });

  it('names a block below the page by its type, as the layers panel does', () => {
    const before = doc({
      ...page(['s']),
      s: { id: 's', type: 'section', props: {}, slots: { default: [] } },
    });
    const after = doc({
      ...page(['s']),
      s: { id: 's', type: 'section', props: {}, slots: { default: ['c'] } },
      c: { id: 'c', type: 'pricingTable', props: {} },
    });
    expect(impactLines(before, after, english)).toEqual([
      { kind: 'added', label: 'Pricing Table', value: 'Pricing Table' },
    ]);
  });

  it('reads an added and a removed element inside a region', () => {
    const before = doc({ ...page(['r']), r: region('r', 'About', 'About us') });
    const after = doc({
      ...page(['r']),
      r: region('r', 'About', 'About us', [{ kind: 'element', tag: 'p', text: 'Since 1998' }]),
    });
    expect(impactLines(before, after, english)).toEqual([
      { kind: 'added', label: 'Text', value: 'Since 1998' },
    ]);
    expect(impactLines(after, before, english)).toEqual([
      { kind: 'removed', label: 'Text', value: 'Since 1998' },
    ]);
  });

  it('reads a direction flip as a line, in words rather than codes', () => {
    const nodes = { ...page([]) };
    expect(impactLines(doc(nodes), doc(structuredClone(nodes), { dir: 'rtl' }), english)).toEqual([
      { kind: 'changed', label: 'Page direction', before: 'Left to right', after: 'Right to left' },
    ]);
  });

  it('reads a true/false prop in the catalog’s words', () => {
    const before = doc({ ...page(['h']), h: { id: 'h', type: 'hero', props: { sticky: false } } });
    const after = doc({ ...page(['h']), h: { id: 'h', type: 'hero', props: { sticky: true } } });
    expect(impactLines(before, after, arabic)).toEqual([
      { kind: 'changed', label: 'Sticky', before: 'معطّل', after: 'مفعّل' },
    ]);
  });

  it('shortens a long value instead of pasting a paragraph', () => {
    const long = 'word '.repeat(60).trim();
    const lines = impactLines(
      doc({ ...page(['h']), h: { id: 'h', type: 'hero', props: { heading: 'Hi' } } }),
      doc({ ...page(['h']), h: { id: 'h', type: 'hero', props: { heading: long } } }),
      english,
    );
    const [line] = lines;
    expect(line?.kind === 'changed' ? line.after.length : 0).toBeLessThanOrEqual(80);
    expect(line?.kind === 'changed' ? line.after.endsWith('…') : false).toBe(true);
  });

  it('never names a command', () => {
    const before = doc({ ...page(['h']), h: { id: 'h', type: 'hero', props: { heading: 'a' } } });
    const after = doc({ ...page(['h']), h: { id: 'h', type: 'hero', props: { heading: 'b' } } });
    expect(JSON.stringify(impactLines(before, after, english))).not.toMatch(
      /setProp|insertNode|remove/u,
    );
  });
});

describe('impactLines speaks the host’s language (SPEC §4.0: no strings outside the catalog)', () => {
  it('ships no English naming: the host passes its catalog’s words, always', () => {
    expect(Object.keys(impactModule)).not.toContain('DEFAULT_IMPACT_NAMING');
    // Every word is a catalog key both locales author (`catalog.test.ts` pins the Arabic).
    for (const key of IMPACT_WORD_KEYS) {
      expect(t('ar', key)).not.toBe('');
      expect(t('en', key)).not.toBe('');
    }
  });

  it('hands its lines to a view as they are: one type, no conversion (SPEC §4.9, §4.13)', () => {
    expectTypeOf<ImpactLine>().toEqualTypeOf<ChangeLineView>();
    const lines: readonly ChangeLineView[] = impactLines(
      doc({ ...page([]) }),
      doc({ ...page([]) }, { dir: 'rtl' }),
      english,
    );
    expect(lines).toHaveLength(1);
  });

  it('labels an RTL Arabic page entirely in Arabic', () => {
    const before = doc(
      { ...page(['services']), services: region('services', 'الخدمات', 'خدماتنا') },
      { dir: 'rtl' },
    );
    const after = doc(
      {
        ...page(['services', 'pricing']),
        services: region('services', 'الخدمات', 'ما نقدّمه لك'),
        pricing: region('pricing', 'الأسعار', 'باقاتنا'),
      },
      { dir: 'ltr' },
    );
    const lines = impactLines(before, after, arabic);
    expect(lines).toEqual([
      {
        kind: 'changed',
        label: 'اتجاه الصفحة',
        before: 'من اليمين إلى اليسار',
        after: 'من اليسار إلى اليمين',
      },
      { kind: 'changed', label: 'العنوان', before: 'خدماتنا', after: 'ما نقدّمه لك' },
      { kind: 'added', label: 'القسم', value: 'الأسعار' },
    ]);
    // Every string a person reads; `kind` is a discriminant, never rendered.
    const read = lines.flatMap(({ kind: _kind, ...shownText }) => Object.values(shownText));
    for (const text of read) expect(text).not.toMatch(/[A-Za-z]/u);
  });

  it('takes every label word from the host: none is the module’s own', () => {
    const marked = {
      word: (key: ImpactWordKey) => `⟨${key}⟩`,
      blockType: (type: string) => `⟨type:${type}⟩`,
      property: (_type: string, key: string) => `⟨prop:${key}⟩`,
      surface: (surface: string) => `⟨surface:${surface}⟩`,
    };
    const before = doc({
      ...page(['r', 'h']),
      r: region('r', 'About', 'About us'),
      h: { id: 'h', type: 'hero', props: { heading: 'Hi', live: false } },
    });
    const after = doc(
      {
        ...page(['h', 'r', 'x']),
        r: region('r', 'About', 'Who we are', [{ kind: 'element', tag: 'a', text: 'Call' }]),
        h: { id: 'h', type: 'hero', props: { heading: 'Hello', live: true } },
        x: { id: 'x', type: 'faq', props: {} },
      },
      { dir: 'rtl', surface: 'email' },
    );
    const lines = impactLines(before, after, marked);
    for (const line of lines) expect(line.label).toMatch(/^⟨.+⟩$/u);
    expect(lines).toEqual(
      expect.arrayContaining([
        {
          kind: 'changed',
          label: '⟨change.label.pageDirection⟩',
          before: '⟨change.value.ltr⟩',
          after: '⟨change.value.rtl⟩',
        },
        {
          kind: 'changed',
          label: '⟨change.label.pageSurface⟩',
          before: '⟨surface:site⟩',
          after: '⟨surface:email⟩',
        },
        {
          kind: 'changed',
          label: '⟨prop:live⟩',
          before: '⟨change.value.off⟩',
          after: '⟨change.value.on⟩',
        },
        { kind: 'added', label: '⟨change.label.link⟩', value: 'Call' },
        { kind: 'added', label: '⟨change.label.section⟩', value: '⟨type:faq⟩' },
      ]),
    );
  });
});

describe('impactLines has a line for every change it counts (SPEC §4.9, §4.13)', () => {
  it('reads a style-only change as the block restyled, by its title', () => {
    // "Make the hero darker": the commonest edit, and a className/css change only.
    const before = doc({ ...page(['r']), r: region('r', 'About', 'About us') });
    const restyled = structuredClone(before);
    firstElement(restyled, 'r').className = 'py-24 bg-slate-900';
    expect(planImpact(before, restyled).changed).toEqual(['r']);
    expect(impactLines(before, restyled, english)).toEqual([
      { kind: 'restyled', label: 'Section', value: 'About' },
    ]);
  });

  it('reads a region’s own CSS or a block’s className the same way', () => {
    const before = doc({ ...page(['r']), r: region('r', 'About', 'About us') });
    const css = structuredClone(before);
    const node = css.nodes['r'];
    if (node !== undefined) node.props['css'] = '.r { color: #fff; }';
    expect(impactLines(before, css, english)).toEqual([
      { kind: 'restyled', label: 'Section', value: 'About' },
    ]);

    const plain = doc({ ...page(['h']), h: { id: 'h', type: 'hero', props: { heading: 'Hi' } } });
    const dark = doc({
      ...page(['h']),
      h: { id: 'h', type: 'hero', props: { heading: 'Hi', className: 'bg-slate-900' } },
    });
    expect(impactLines(plain, dark, english)).toEqual([
      { kind: 'restyled', label: 'Section', value: 'Hi' },
    ]);
  });

  it('reads a change with no words at all (an icon) as restyled, not as nothing', () => {
    const icon = (name: string): Node => ({
      id: 'f',
      type: 'feature',
      props: { title: 'Fast', icon: { kind: 'icon', name } },
    });
    expect(
      impactLines(
        doc({ ...page(['f']), f: icon('bolt') }),
        doc({ ...page(['f']), f: icon('star') }),
        english,
      ),
    ).toEqual([{ kind: 'restyled', label: 'Section', value: 'Fast' }]);
  });

  it('gives both lines when the words AND the look changed', () => {
    const before = doc({ ...page(['r']), r: region('r', 'About', 'About us') });
    const after = doc({ ...page(['r']), r: region('r', 'About', 'Who we are') });
    firstElement(after, 'r').className = 'py-24 bg-slate-900';
    expect(impactLines(before, after, english)).toEqual([
      { kind: 'changed', label: 'Heading', before: 'About us', after: 'Who we are' },
      { kind: 'restyled', label: 'Section', value: 'About' },
    ]);
  });

  it('does not call a region restyled when an element arrives with its own classes', () => {
    // The paragraph's classes come WITH it: an addition, on its own line. Nor does the
    // heading below it shift into a false restyle, as an index-keyed comparison would.
    const before = doc({ ...page(['r']), r: region('r', 'About', 'About us') });
    const after = doc({
      ...page(['r']),
      r: region('r', 'About', 'About us', [
        { kind: 'element', tag: 'p', className: 'text-lg text-slate-600', text: 'Since 1998' },
      ]),
    });
    expect(impactLines(before, after, english)).toEqual([
      { kind: 'added', label: 'Text', value: 'Since 1998' },
    ]);
  });

  it('reads a section reorder as the section that moved, not as the page changed', () => {
    const sections = {
      hero: region('hero', 'Hero', 'Welcome'),
      services: region('services', 'Services', 'What we do'),
      faq: region('faq', 'FAQ', 'Questions'),
      pricing: region('pricing', 'Pricing', 'Plans'),
    };
    const before = doc({ ...page(['hero', 'services', 'faq', 'pricing']), ...sections });
    const after = doc({
      ...page(['hero', 'pricing', 'services', 'faq']),
      ...structuredClone(sections),
    });
    expect(planImpact(before, after).changed).toEqual(['root']);
    expect(impactLines(before, after, english)).toEqual([
      { kind: 'moved', label: 'Section', value: 'Pricing' },
    ]);
  });

  it('reads a block moved into another parent once, by its own name', () => {
    const before = doc({
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['boxA', 'boxB'] } },
      boxA: { id: 'boxA', type: 'box', props: {}, slots: { default: ['x'] } },
      boxB: { id: 'boxB', type: 'box', props: {}, slots: { default: [] } },
      x: { id: 'x', type: 'text', props: { content: 'Open daily' } },
    });
    const after = doc({
      root: { id: 'root', type: 'page', props: {}, slots: { default: ['boxA', 'boxB'] } },
      boxA: { id: 'boxA', type: 'box', props: {}, slots: { default: [] } },
      boxB: { id: 'boxB', type: 'box', props: {}, slots: { default: ['x'] } },
      x: { id: 'x', type: 'text', props: { content: 'Open daily' } },
    });
    expect(planImpact(before, after).changed).toEqual(['boxA', 'boxB']);
    expect(impactLines(before, after, english)).toEqual([
      { kind: 'moved', label: 'Text', value: 'Open daily' },
    ]);
  });

  it('does not call a block moved when only a sibling was added or removed around it', () => {
    const before = doc({
      ...page(['hero', 'faq']),
      hero: region('hero', 'Hero', 'Welcome'),
      faq: region('faq', 'FAQ', 'Questions'),
    });
    const after = doc({
      ...page(['pricing', 'hero']),
      hero: region('hero', 'Hero', 'Welcome'),
      pricing: region('pricing', 'Pricing', 'Plans'),
    });
    expect(impactLines(before, after, english)).toEqual([
      { kind: 'added', label: 'Section', value: 'Pricing' },
      { kind: 'removed', label: 'Section', value: 'FAQ' },
    ]);
  });

  it('never leaves a counted change without a line', () => {
    const before = doc({
      ...page(['hero', 'about', 'faq']),
      hero: region('hero', 'Hero', 'Welcome'),
      about: region('about', 'About', 'About us'),
      faq: region('faq', 'FAQ', 'Questions'),
    });
    const after = structuredClone(before);
    const root = after.nodes['root'];
    if (root?.slots !== undefined) root.slots['default'] = ['hero', 'faq', 'about'];
    firstElement(after, 'hero').className = 'bg-slate-900';
    const impact = planImpact(before, after);
    const [changed] = describeImpact(impact);
    expect(changed).toEqual({ key: 'impact.changed', params: { n: 2 } });
    expect(impactLines(before, after, english)).toEqual([
      { kind: 'restyled', label: 'Section', value: 'Hero' },
      { kind: 'moved', label: 'Section', value: 'FAQ' },
    ]);
  });
});

/*
  Named by what the page SAYS (SPEC §4.9, §6.5 honesty), on the real landing page with the
  registry's own schemas. v1's first-string-of-any-prop rule read these same removals as
  "Section «dark»" (a tone), "Section «dual»" (a variant), "Section «doc»" (ProseMirror's
  root type) and a photo's URL (found by the wave-1 verifier, 2026-09-28).
*/
describe('impactLines names a block by its words, never by a token, an enum or an address', () => {
  const landing = () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    const naming = schemaImpactNaming(
      (key) => t('en', key),
      (type) => kernel.context.registry.block(type)?.schema,
    );
    return { kernel, naming };
  };

  it('reads removed landing sections by their heading, else by their type', () => {
    const { kernel, naming } = landing();
    const before = kernel.getDocument();
    for (const id of ['aurora', 'rich-story', 'showcase', 'spotlight-promo']) {
      kernel.dispatch('removeNode', { id });
    }
    expect(impactLines(before, kernel.getDocument(), naming)).toEqual([
      { kind: 'removed', label: 'Section', value: 'Aurora Background' },
      { kind: 'removed', label: 'Section', value: 'Why it holds' },
      { kind: 'removed', label: 'Section', value: 'Image' },
      { kind: 'removed', label: 'Section', value: 'Spotlight Surface' },
    ]);
  });

  it('reads a paragraph added to rich text as ONE line of its words, not its node types', () => {
    const { kernel, naming } = landing();
    const before = kernel.getDocument();
    const content = before.nodes['rich-story']?.props['content'] as unknown as {
      readonly type: string;
      readonly content: readonly JsonValue[];
    };
    kernel.dispatch('setProp', {
      id: 'rich-story',
      key: 'content',
      value: {
        ...content,
        content: [
          ...content.content,
          { type: 'paragraph', content: [{ type: 'text', text: 'A new closing line.' }] },
        ],
      },
    });
    expect(impactLines(before, kernel.getDocument(), naming)).toEqual([
      { kind: 'added', label: 'Content', value: 'A new closing line.' },
    ]);
  });

  it('reads a list item added to rich text by its words, never by its node types', () => {
    const richText = (items: readonly string[]): Node => ({
      id: 'r',
      type: 'richText',
      props: {
        content: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'What is included' }] },
            {
              type: 'bulletList',
              content: items.map((item) => ({
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
              })),
            },
          ],
        },
      },
    });
    expect(
      impactLines(
        doc({ ...page(['r']), r: richText(['Free parking']) }),
        doc({ ...page(['r']), r: richText(['Free parking', 'A bottle of water']) }),
        english,
      ),
    ).toEqual([{ kind: 'added', label: 'Content', value: 'A bottle of water' }]);
  });

  it('reads a rich-text paragraph split by marks as the one sentence it is', () => {
    const paragraph = (bold: string): JsonValue => ({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Every edit is ' },
            { type: 'text', text: bold, marks: [{ type: 'bold' }] },
            { type: 'text', text: ' through one door.' },
          ],
        },
      ],
    });
    const node = (bold: string): Node => ({
      id: 'r',
      type: 'richText',
      props: { content: paragraph(bold) },
    });
    expect(
      impactLines(
        doc({ ...page(['r']), r: node('one transaction') }),
        doc({ ...page(['r']), r: node('a single transaction') }),
        english,
      ),
    ).toEqual([
      {
        kind: 'changed',
        label: 'Content',
        before: 'Every edit is one transaction through one door.',
        after: 'Every edit is a single transaction through one door.',
      },
    ]);
  });

  it('lists only a schema’s words: no enum, no URL-shaped string, no style', () => {
    const schema = defineBlockSchema({
      type: 'promo',
      description: 'A promo band.',
      props: z.object({
        tone: z.enum(['dark', 'light']),
        eyebrow: z.string().optional(),
        heading: z.string(),
        href: z.string(),
        website: z.url().optional(),
        className: z.string().optional(),
        count: z.number(),
      }),
      examples: [],
    });
    expect(textPropsOf(schema)).toEqual(['eyebrow', 'heading']);
  });

  it('never names a block by a value it cannot vouch is words', () => {
    // No schema to ask: only the title props every block writes its words in are read.
    const lines = impactLines(
      doc({ ...page(['b']), b: { id: 'b', type: 'spotlightBand', props: { tone: 'dark' } } }),
      doc({ ...page([]) }),
      english,
    );
    expect(lines).toEqual([{ kind: 'removed', label: 'Section', value: 'Spotlight Band' }]);
    const linked = impactLines(
      doc({
        ...page(['c']),
        c: { id: 'c', type: 'cta', props: { title: 'https://example.com/book' } },
      }),
      doc({ ...page([]) }),
      english,
    );
    expect(linked).toEqual([{ kind: 'removed', label: 'Section', value: 'CTA' }]);
  });

  it('prefers the host’s own name for a block when it has one', () => {
    const naming = {
      ...english,
      instanceName: (node: Node) => (node.id === 'h' ? 'Welcome band' : undefined),
    };
    expect(
      impactLines(
        doc({ ...page(['h']), h: { id: 'h', type: 'hero', props: { heading: 'Hi' } } }),
        doc({ ...page([]) }),
        naming,
      ),
    ).toEqual([{ kind: 'removed', label: 'Section', value: 'Welcome band' }]);
  });
});

// colour-target-fix additions
describe('a page css change reads in words, never as raw CSS (colour-target fix, 2026-10-05)', () => {
  const KIT = (accent: string, imports: string) =>
    `.ck-page-plan{--ck-page-plan:1}\n${imports}\n> *{--ck-ink:#1c1917;--ck-accent:${accent}}\n.ck-btn{background-color:var(--ck-accent)}\n.ck-page-plan-end{--ck-page-plan:0}`;
  const SPLIT =
    "@import url('https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400%3B700&display=swap');\n@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400%3B700&display=swap');";
  const MERGED =
    "@import url('https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400%3B700&family=IBM+Plex+Sans+Arabic:wght@400%3B700&display=swap');";
  const withCss = (pageCss: string) =>
    doc({ root: { id: 'root', type: 'page', props: { title: 'سارة الحلبي', pageCss }, slots: { default: [] } } });

  it('a recoloured kit is «ألوان الصفحة» / "Page colours", with the page’s name', () => {
    const before = withCss(KIT('#0f766e', SPLIT));
    const after = withCss(KIT('#b91c1c', SPLIT));
    expect(impactLines(before, after, arabic)).toEqual([
      { kind: 'restyled', label: 'ألوان الصفحة', value: 'سارة الحلبي' },
    ]);
    expect(impactLines(before, after, english)).toEqual([
      { kind: 'restyled', label: 'Page colours', value: 'سارة الحلبي' },
    ]);
  });

  it('any other page css change is «تنسيق الصفحة» / "Page styling" — the owner’s regrouped imports included', () => {
    const before = withCss(KIT('#0f766e', SPLIT));
    const regrouped = withCss(KIT('#0f766e', MERGED));
    expect(impactLines(before, regrouped, arabic)).toEqual([
      { kind: 'restyled', label: 'تنسيق الصفحة', value: 'سارة الحلبي' },
    ]);
    const added = withCss(`${KIT('#0f766e', SPLIT)}\nh1{letter-spacing:0}`);
    expect(impactLines(before, added, english)).toEqual([
      { kind: 'restyled', label: 'Page styling', value: 'سارة الحلبي' },
    ]);
    expect(JSON.stringify(impactLines(before, added, english))).not.toMatch(/@import|ck-page-plan|letter-spacing/u);
  });
});
// end colour-target-fix additions
