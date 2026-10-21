import { describe, expect, it } from 'vitest';
import { BUILDER_PLAN } from './tidy.fixtures';
import { requestedPageDesign } from './design';
import { validatePagePlan } from './validate-page-plan';
import { reconcilePlans, sectionFingerprint } from './plan-draft';
import { skeletonFromPlan } from './skeleton-from-plan';
import { checkSection } from './check-section';
import { tidySection } from './tidy-section';
import type { PagePlan, PagePlanDesign } from './types';

const design: PagePlanDesign = {
  kind: 'website',
  composition: 'bespoke',
  chrome: 'none',
  concept: 'An editorial index beside a full-height feature story.',
};
function candidate() {
  return {
    ...BUILDER_PLAN,
    design,
    primaryCta: { label: 'Read', href: '#hero' },
    nav: [],
    sections: [
      {
        key: 'hero',
        role: 'hero',
        title: 'Field notes',
        purpose: 'A complete editorial page.',
        variant: 'split',
        kit: 'hero-split',
        layout: 'Narrow index beside a large typographic article; stack on mobile.',
      },
    ],
  };
}
function accepted(value: unknown, options = {}): PagePlan {
  const result = validatePagePlan(value, options);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.plan;
}

describe('free page design contract', () => {
  it.each([
    'Build a bakery website',
    'أنشئ تقريرًا بصريًا احترافيًا',
    'Design an editorial page',
    'Create a portfolio',
  ])('defaults any new design to authored composition: %s', (request) => {
    expect(requestedPageDesign(request).composition).toBe('bespoke');
  });
  it('keeps templates opt-in, distinguishing negative requests', () => {
    expect(requestedPageDesign('Build a site using existing templates').composition).toBe('hybrid');
    expect(requestedPageDesign('Build without templates').composition).toBe('bespoke');
    expect(requestedPageDesign('Do not use templates').composition).toBe('bespoke');
    expect(requestedPageDesign('لا استعمل القوالب').composition).toBe('bespoke');
    expect(requestedPageDesign('استخدم القوالب لإنشاء صفحة').composition).toBe('hybrid');
  });
  it('distinguishes a resume, portfolio and CVS business', () => {
    expect(requestedPageDesign('اصنع cv احترافية').kind).toBe('resume');
    expect(requestedPageDesign('Create my portfolio').kind).toBe('portfolio');
    expect(requestedPageDesign('Create a CVS pharmacy website').kind).toBe('website');
  });
  it('admits a complete one-region page and removes kit fallback without adding chrome/photos', () => {
    const plan = accepted(candidate(), { completePage: true });
    expect(plan.sections).toHaveLength(1);
    expect(plan.sections[0]).toMatchObject({ layout: candidate().sections[0]?.layout });
    expect(plan.sections[0]).not.toHaveProperty('kit');
    expect(plan.sections[0]).not.toHaveProperty('variant');
    expect(plan.sections[0]).not.toHaveProperty('images');
    expect(plan.design).toEqual(design);
  });
  it('does not impose header/hero/footer visual ordering on authored pages', () => {
    const page = candidate();
    const plan = accepted({
      ...page,
      sections: [
        { key: 'index', role: 'band', title: 'Contents', purpose: 'A small editorial index.' },
        ...page.sections,
        {
          key: 'header',
          role: 'header',
          title: 'Navigation',
          purpose: 'A rail beside the content.',
        },
      ],
    });
    expect(plan.sections.map(({ key }) => key)).toEqual(['index', 'hero', 'header']);
    expect(validatePagePlan({ ...page, sections: [] }).ok).toBe(false);
    expect(
      validatePagePlan({
        ...page,
        sections: [page.sections[0], { ...page.sections[0], key: 'again' }],
      }).ok,
    ).toBe(false);
  });
  it('retains old kit inference when reading legacy plans, with no saved-page rewrite', () => {
    const legacy = {
      ...BUILDER_PLAN,
      sections: BUILDER_PLAN.sections.map((section) =>
        section.role === 'hero' ? { ...section, variant: 'split' } : section,
      ),
    };
    expect(accepted(legacy).sections[0]?.kit).toBe('hero-split');
    expect(accepted(legacy)).not.toHaveProperty('design');
    const fresh = accepted(legacy, { request: 'Build a professional website', completePage: true });
    expect(fresh.design?.composition).toBe('bespoke');
    expect(fresh.sections.every((section) => section.kit === undefined)).toBe(true);
  });
  it('preserves variant-based templates when a plan explicitly chooses hybrid composition', () => {
    const page = candidate();
    const plan = accepted({
      ...page,
      design: { ...design, composition: 'hybrid' },
      sections: [
        { ...page.sections[0], kit: undefined },
        { key: 'body', role: 'band', title: 'Story', purpose: 'Details.' },
      ],
    });
    expect(plan.sections[0]?.kit).toBe('hero-split');
  });
  it('bounds concepts/layout and rejects malformed design objects', () => {
    expect(
      validatePagePlan({ ...candidate(), design: { ...design, concept: 'x'.repeat(241) } }).ok,
    ).toBe(false);
    expect(
      validatePagePlan({ ...candidate(), design: { ...design, composition: 'anything' } }).ok,
    ).toBe(false);
    expect(
      validatePagePlan({
        ...candidate(),
        sections: [{ ...candidate().sections[0], layout: 'x'.repeat(241) }],
      }).ok,
    ).toBe(false);
  });
  it('keeps compact layout fields and invalidates speculative writers on design changes', () => {
    const first = accepted({
      ...candidate(),
      briefs: [
        { key: 'hero', purpose: 'An article.', layout: 'A narrow index and broad feature.' },
      ],
    });
    const second = accepted({
      ...first,
      design: { ...design, concept: 'A quiet single column with marginal annotations.' },
    });
    expect(first.sections[0]?.layout).toBe('A narrow index and broad feature.');
    expect(sectionFingerprint(first, 'hero')).not.toBe(sectionFingerprint(second, 'hero'));
    expect(reconcilePlans(first, second)).toMatchObject({
      sameOutline: true,
      headChanged: true,
      changedKeys: ['hero'],
    });
  });
  it('does not fabricate personal masked facts in a resume or portfolio', () => {
    const plan = accepted({
      ...candidate(),
      design: { ...design, kind: 'resume' },
      facts: [{ key: 'phone', sample: '0000000000', section: 'hero' }],
    });
    expect(plan.facts[0]?.sample).toBe('0000000000');
  });
  it('treats layout as a writer brief rather than a new outline', () => {
    const first = accepted(candidate());
    const second = accepted({
      ...first,
      sections: first.sections.map((section) => ({
        ...section,
        layout: 'A poster with marginal annotations.',
      })),
    });
    expect(reconcilePlans(first, second)).toMatchObject({
      sameOutline: true,
      headChanged: false,
      changedKeys: ['hero'],
    });
  });
  it('preserves legacy content without retaining template geometry, bounding reference data', () => {
    const page = candidate();
    const slots = { items: [{ question: 'When does the garden open?', answer: 'At sunrise.' }] };
    const plan = accepted({ ...page, sections: [{ ...page.sections[0], slots }] });
    expect(plan.sections[0]?.slots).toEqual(slots);
    expect(plan.sections[0]?.kit).toBeUndefined();
    expect(
      validatePagePlan({
        ...page,
        sections: [{ ...page.sections[0], slots: { body: 'x'.repeat(16_001) } }],
      }).ok,
    ).toBe(false);
  });
  it('does not mark authored header/footer placeholders as completed sections', () => {
    const plan = accepted({
      ...candidate(),
      sections: [
        { key: 'header', role: 'header', title: 'Index', purpose: 'A custom navigation rail.' },
        ...candidate().sections,
        { key: 'footer', role: 'footer', title: 'Credits', purpose: 'An authored colophon.' },
      ],
    });
    const skeleton = skeletonFromPlan(plan, { parentId: 'root', regionType: 'customCode' });
    expect(skeleton.regions.every((region) => !region.complete)).toBe(true);
  });
  it('accepts a bespoke article with its own CSS and no sales CTA without recoloring it', () => {
    const plan = accepted(candidate());
    const contract = plan.sections[0];
    if (contract === undefined) throw new Error('missing contract');
    const tree = {
      kind: 'root',
      children: [
        {
          kind: 'element',
          tag: 'article',
          attributes: { id: 'hero' },
          className: 'ck-editorial',
          children: [{ kind: 'element', tag: 'h1', text: 'Field notes', children: [] }],
        },
      ],
    };
    const css =
      '.ck-editorial{display:grid;grid-template-columns:1fr 3fr;border-top:4px solid #345ab9;color:var(--ck-ink);background:var(--ck-bg)}';
    expect(checkSection(plan, contract, { tree, css })).toEqual([]);
    const commands = [
      { command: 'setProp', args: { id: 'region', key: 'tree', value: tree } },
      { command: 'setProp', args: { id: 'region', key: 'css', value: css } },
    ];
    expect(tidySection(commands, { plan, contract }).commands).toEqual(commands);
  });
});
