import { describe, expect, it } from 'vitest';

import { seoSlug } from '@craftkit/builder-schema';

import { validatePagePlan, type PagePlan, type PagePlanIssue } from './index';

/*
  The section kit and SEO on a page plan (2026-09-30, DESIGN §B/D.1). A kit
  only saves a writer work, so the validator NORMALISES a kit rather than
  refusing it — a refusal costs a whole repair round — and says what it did
  as a warning. SEO fields are the plan's own and are held to their limits.
*/

type Json = Record<string, unknown>;

function candidate(): Json {
  return {
    intent: 'new-page',
    locale: { lang: 'ar' },
    title: 'محمصة الهيل — قهوة مختصة في عمّان',
    description: 'قهوة مختصة محمصة في عمّان، تصلك طازجة.',
    tokens: {
      bg: 'lime-50',
      surface: 'white',
      ink: 'emerald-950',
      muted: 'emerald-800',
      accent: 'orange-700',
      onAccent: 'white',
      border: '#e7e5e4',
      fontDisplay: { family: 'Lalezar' },
      fontBody: { family: 'Almarai', weights: [400, 700] },
      radius: 'xl',
      signature: 'the brand name at text-8xl, faint behind the menu',
    },
    primaryCta: { label: 'اطلب الآن', href: '#order' },
    nav: [{ label: 'القائمة', anchorId: 'menu' }],
    sections: [
      { key: 'header', role: 'header', title: 'الترويسة', anchorId: 'top', purpose: 'العلامة.' },
      {
        key: 'hero',
        role: 'hero',
        title: 'قهوة تُحمّص كل صباح',
        anchorId: 'hero',
        purpose: 'ما هي المحمصة.',
        variant: 'split',
      },
      {
        key: 'menu',
        role: 'band',
        title: 'القائمة',
        anchorId: 'menu',
        purpose: 'المشروبات وأسعارها.',
        kit: 'menu-list',
      },
      {
        key: 'order',
        role: 'cta',
        title: 'اطلب',
        anchorId: 'order',
        purpose: 'طريقة واحدة للطلب.',
        kit: 'cta-split',
        slots: { title: 'حبوب طازجة تصلك في عمّان', cta: { label: 'اطلب الآن', href: '#order' } },
      },
      { key: 'footer', role: 'footer', title: 'التذييل', anchorId: 'footer', purpose: 'العنوان.' },
    ],
    facts: [{ key: 'phone', sample: '+962 7 9646 1275', section: 'order' }],
    seo: {
      keyword: 'قهوة مختصة في عمّان',
      pageKind: 'home',
      businessType: 'cafeorcoffeeshop',
      slug: 'قَهْوَة مُختصّة — عمّان',
    },
  };
}

function sections(value: Json): Json[] {
  return value['sections'] as Json[];
}

function accepted(value: unknown): { plan: PagePlan; warnings: readonly PagePlanIssue[] } {
  const result = validatePagePlan(value);
  if (!result.ok) {
    throw new Error(result.issues.map(({ path, message }) => `${path}: ${message}`).join('\n'));
  }
  return { plan: result.plan, warnings: result.warnings ?? [] };
}

function refused(value: unknown): readonly PagePlanIssue[] {
  const result = validatePagePlan(value);
  if (result.ok) throw new Error('expected the plan to be refused');
  return result.issues;
}

describe('validatePagePlan — section kits', () => {
  it('resolves a variant to its default kit, keeps a named kit and keeps slots that fill it', () => {
    const { plan, warnings } = accepted(candidate());
    const [header, hero, menu, order, footer] = plan.sections;
    expect(hero?.kit).toBe('hero-split');
    expect(menu?.kit).toBe('menu-list');
    expect(order?.kit).toBe('cta-split');
    expect(order?.slots).toEqual({
      title: 'حبوب طازجة تصلك في عمّان',
      cta: { label: 'اطلب الآن', href: '#order' },
    });
    // Code writes the header and footer from the plan: no kit is ever resolved for them.
    expect(header?.kit).toBeUndefined();
    expect(footer?.kit).toBeUndefined();
    expect(warnings).toEqual([]);
  });

  it('drops a kit that does not fit the role, for the variant default, and says so', () => {
    const value = candidate();
    const hero = sections(value)[1]!;
    hero['kit'] = 'pricing-tiers';
    const { plan, warnings } = accepted(value);
    expect(plan.sections[1]?.kit).toBe('hero-split');
    expect(warnings.map(({ path }) => path)).toEqual(['sections[1].kit']);
    expect(warnings[0]?.message).toContain('"pricing-tiers" is not a hero kit');
  });

  it('drops an unknown kit, and a kit named on the header, without refusing the plan', () => {
    const value = candidate();
    (sections(value)[2]!)['kit'] = 'no-such-kit';
    (sections(value)[0]!)['kit'] = 'header-bar';
    const { plan, warnings } = accepted(value);
    expect(plan.sections[2]?.kit).toBeUndefined();
    expect(plan.sections[0]?.kit).toBeUndefined();
    expect(warnings.map(({ path }) => path).sort()).toEqual(['sections[0].kit', 'sections[2].kit']);
  });

  it('drops slots that do not fill the kit, keeps the kit, and records why', () => {
    const value = candidate();
    // menu-list needs its items, which nothing in the contract can write.
    (sections(value)[2]!)['slots'] = { title: 'القائمة' };
    const { plan, warnings } = accepted(value);
    expect(plan.sections[2]?.kit).toBe('menu-list');
    expect(plan.sections[2]?.slots).toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.path).toBe('sections[2].slots');
    expect(warnings[0]?.message).toContain('menu-list');
  });

  it("gives a cta's broken required link the page's action instead of dropping the planned slots", () => {
    // Quality pass 2026-10-05: a link without an href cost the section a writer.
    const value = candidate();
    (sections(value)[3]!)['slots'] = { title: 'اطلب', cta: { label: 'اطلب الآن' } };
    const { plan, warnings } = accepted(value);
    expect(plan.sections[3]?.kit).toBe('cta-split');
    expect(plan.sections[3]?.slots).toMatchObject({ cta: { label: 'اطلب الآن', href: '#order' } });
    expect(warnings.map(({ path }) => path)).toEqual(['sections[3].slots']);
  });

  it('fills a missing required title from the section title and keeps the planned slots', () => {
    // Fix pass 2026-10-05: pricing and faq slots without a title were dropped whole.
    const value = candidate();
    (sections(value)[3]!)['slots'] = { cta: { label: 'اطلب الآن', href: '#order' } };
    const { plan, warnings } = accepted(value);
    expect(plan.sections[3]?.slots).toMatchObject({ title: 'اطلب' });
    expect(warnings.map(({ path }) => path)).toEqual(['sections[3].slots.title']);
  });

  it('fills a missing caption from the image alt (no claim) and the image from the section’s first image', () => {
    const value = candidate();
    sections(value)[2] = {
      key: 'menu',
      role: 'band',
      title: 'القائمة',
      anchorId: 'menu',
      purpose: 'المشروبات وأسعارها.',
      kit: 'features-bento',
      images: [{ subject: 'cafe', aspect: 'landscape', alt: 'فنجان قهوة على طاولة خشبية' }],
      slots: {
        title: 'قهوة تستحق الزيارة',
        items: [
          { icon: 'coffee', title: 'تحميص يومي' },
          { icon: 'leaf', title: 'حبوب مختارة' },
        ],
      },
    };
    const { plan, warnings } = accepted(value);
    expect(plan.sections[2]?.slots).toMatchObject({
      caption: 'فنجان قهوة على طاولة خشبية',
      image: { subject: 'cafe', alt: 'فنجان قهوة على طاولة خشبية' },
    });
    expect(warnings.map(({ path }) => path).sort()).toEqual([
      'sections[2].slots.caption',
      'sections[2].slots.image',
    ]);
  });

  it('reads a kit id written as a variant as the kit, with its layout word', () => {
    // Both 2026-10-05 T1 answers wrote "hero-centered", "features-bento" as variants.
    const value = candidate();
    (sections(value)[1]!)['variant'] = 'hero-centered';
    const { plan, warnings } = accepted(value);
    expect(plan.sections[1]?.kit).toBe('hero-centered');
    expect(plan.sections[1]?.variant).toBe('centered');
    expect(warnings.map(({ path }) => path)).toEqual(['sections[1].variant']);
  });

  it('passes a plan it already normalised, unchanged (the build re-validates a given plan)', () => {
    const first = accepted(candidate()).plan;
    const again = accepted(first);
    expect(again.plan).toEqual(first);
    expect(again.warnings).toEqual([]);
  });
});

describe('validatePagePlan — seo', () => {
  it('keeps the keyword and kind, folds the business type and slugs an Arabic slug in Arabic', () => {
    const { plan } = accepted(candidate());
    expect(plan.seo).toEqual({
      keyword: 'قهوة مختصة في عمّان',
      pageKind: 'home',
      businessType: 'CafeOrCoffeeShop',
      slug: seoSlug('قَهْوَة مُختصّة — عمّان', 'ar'),
    });
    // Arabic letters and hyphens only: no harakat, no dash, no Latin transliteration.
    expect(plan.seo?.slug).toMatch(/^[\u0621-\u064a]+(?:-[\u0621-\u064a]+)+$/u);
  });

  it('builds without seo, exactly as before', () => {
    const value = candidate();
    delete value['seo'];
    expect(accepted(value).plan.seo).toBeUndefined();
  });

  it('refuses a keyword over 80 characters and a page kind outside the list', () => {
    const value = candidate();
    value['seo'] = { keyword: 'ق'.repeat(81), pageKind: 'blog' };
    const issues = refused(value);
    expect(issues.map(({ path }) => path)).toEqual(['seo.keyword', 'seo.pageKind']);
    expect(issues[1]?.message).toContain('home, menu, product');
  });
});
