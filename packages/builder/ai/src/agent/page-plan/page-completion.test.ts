import { describe, expect, it } from 'vitest';

import { businessKindOf, shortBrand, withBusinessType } from './page-completion';
import { skeletonFromPlan } from './skeleton-from-plan';
import type { NodeId } from '@craftkit/builder-schema';

import { validatePagePlan, type PagePlan, type PagePlanIssue } from './index';

const CONTEXT = { parentId: 'root' as NodeId, regionType: 'customCode' };

/*
  Page completions (quality pass 2026-10-05, measure-v2): the defects the last
  live runs shipped, each decided in code so it costs no repair round.
*/

type Json = Record<string, unknown>;

const TOKENS = {
  bg: 'white',
  surface: 'slate-50',
  ink: 'slate-900',
  muted: 'slate-600',
  accent: 'blue-700',
  onAccent: 'white',
  border: '#e2e8f0',
  fontDisplay: { family: 'Space Grotesk', weights: [700] },
  fontBody: { family: 'IBM Plex Sans', weights: [400, 600] },
  radius: 'md',
  signature: 'one blue rule under every heading',
};

/** The English SaaS answer of measure-v2: no header, a title-long name, LocalBusiness. */
function saas(): Json {
  return {
    intent: 'new-page',
    locale: { lang: 'en' },
    title: 'Project management software for teams that ship',
    description: 'Organize tasks, track progress and collaborate with your team in one place.',
    tokens: TOKENS,
    primaryCta: { label: 'Start free trial', href: '#pricing' },
    sections: [
      { key: 'hero', role: 'hero', title: 'Manage projects and ship faster', anchorId: 'hero', purpose: 'Say what it is.', kit: 'hero-centered' },
      { key: 'features', role: 'band', title: 'Features', anchorId: 'features', purpose: 'What it does.', kit: 'features-bento' },
      { key: 'pricing', role: 'band', title: 'Pricing', anchorId: 'pricing', purpose: 'Three plans.', kit: 'pricing-tiers' },
      { key: 'cta', role: 'cta', title: 'Ready to ship', anchorId: 'cta', purpose: 'Start the trial.', kit: 'cta-split' },
    ],
    facts: [],
    seo: { keyword: 'project management software for teams', pageKind: 'landing', businessType: 'LocalBusiness' },
  };
}

/** The Arabic restaurant answer of measure-v2: a booking section that was a heading and a button. */
function restaurant(): Json {
  return {
    intent: 'new-page',
    locale: { lang: 'ar' },
    title: 'مشاوي عمّان — مطعم مشاوي في عمّان',
    description: 'مطعم مشاوي أردني في عمّان: منيو، توصيل وحجز طاولات.',
    tokens: { ...TOKENS, fontDisplay: { family: 'Lalezar' }, fontBody: { family: 'Almarai', weights: [400, 700] } },
    primaryCta: { label: 'احجز طاولة', href: '#booking' },
    sections: [
      { key: 'header', role: 'header', title: 'رأس الصفحة', anchorId: 'header', purpose: 'العلامة.' },
      { key: 'hero', role: 'hero', title: 'مشاوي طازة يومياً', anchorId: 'hero', purpose: 'ما هو المطعم.', kit: 'hero-overlay', images: [{ subject: 'restaurant', aspect: 'landscape', alt: 'طاولة مشاوي' }] },
      { key: 'dishes', role: 'band', title: 'أطباقنا', anchorId: 'dishes', purpose: 'الأطباق.', kit: 'features-bento', images: [{ subject: 'restaurant', aspect: 'landscape', alt: 'أطباق مشوية' }] },
      {
        key: 'booking',
        role: 'cta',
        title: 'احجز طاولتك الآن',
        anchorId: 'booking',
        purpose: 'طريقة واحدة للحجز.',
        mustSay: ['احجز قبل ساعة'],
        kit: 'cta-split',
        slots: { title: 'احجز طاولتك الآن', cta: { label: 'احجز طاولة', href: '#booking' } },
      },
      { key: 'footer', role: 'footer', title: 'التذييل', anchorId: 'footer', purpose: 'التواصل.' },
    ],
    facts: [
      { key: 'phone', sample: '+962 6 461 2750', section: 'footer' },
      { key: 'whatsapp', sample: '+962 79 461 2750', section: 'footer' },
      { key: 'hours', sample: 'يومياً من ١٢ ظهراً حتى ١٢ ليلاً', section: 'footer' },
      { key: 'address', sample: 'شارع الرينبو، جبل عمّان', section: 'footer' },
    ],
    seo: { keyword: 'مطعم مشاوي في عمّان', pageKind: 'home', businessType: 'Restaurant' },
  };
}

function accepted(value: unknown, completePage = true): { plan: PagePlan; warnings: readonly PagePlanIssue[] } {
  const result = validatePagePlan(value, { completePage });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return { plan: result.plan, warnings: result.warnings ?? [] };
}

describe('shortBrand — a name, never a truncated sentence', () => {
  it('cuts a title with no separator to its first words, before a joining word', () => {
    expect(shortBrand({ title: 'Project management software for teams that ship' })).toBe(
      'Project management software',
    );
    expect(shortBrand({ title: 'Fresh bread for the whole neighbourhood' })).toBe('Fresh bread');
  });

  it('prefers the plan brand, then a fact naming the business, then a name-length title part', () => {
    expect(shortBrand({ brand: 'ShipFlow', title: 'Ship faster' })).toBe('ShipFlow');
    expect(
      shortBrand({ title: 'Project management software for teams', facts: [{ key: 'company-name', sample: 'ShipFlow' }] }),
    ).toBe('ShipFlow');
    expect(shortBrand({ title: 'مشاوي عمّان — مطعم مشاوي أردني أصيل في قلب عمّان' })).toBe('مشاوي عمّان');
    expect(shortBrand({ title: 'Invoice freelance clients in seconds — Invoicy' })).toBe('Invoicy');
  });

  it('the footer and header of a brandless SaaS plan show the short name, with no ellipsis', () => {
    const { plan } = accepted(saas());
    const skeleton = skeletonFromPlan(plan, CONTEXT);
    const text = JSON.stringify(skeleton.plan.commands);
    expect(text).toContain('© Project management software. All rights reserved.');
    expect(text).not.toContain('teams…');
  });
});

describe('the SEO business type follows what the page is', () => {
  it('a SaaS page the planner called LocalBusiness is an Organization', () => {
    const { plan, warnings } = accepted(saas());
    expect(plan.seo?.businessType).toBe('Organization');
    expect(warnings.some(({ path }) => path === 'seo.businessType')).toBe(true);
  });

  it('a restaurant keeps Restaurant; a generic LocalBusiness with a trade becomes that trade', () => {
    expect(accepted(restaurant()).plan.seo?.businessType).toBe('Restaurant');
    const generic = restaurant();
    generic['seo'] = { keyword: 'مشاوي عمّان', pageKind: 'home', businessType: 'LocalBusiness' };
    expect(accepted(generic).plan.seo?.businessType).toBe('Restaurant');
  });

  it('reads trades and software from the words, strong software words winning', () => {
    expect(businessKindOf('Bright Smile dental clinic in Amman')).toBe('Dentist');
    expect(businessKindOf('Restaurant booking software for busy owners')).toBe('Organization');
    expect(businessKindOf('A grill you can order from in our app')).toBe('Restaurant');
    expect(businessKindOf('عيادة أسنان في عمّان')).toBe('Dentist');
    expect(withBusinessType(undefined, 'saas', [])).toBeUndefined();
  });
});

describe('every full page has a header and a footer', () => {
  it('adds both to a SaaS plan that had neither, with a menu from the middle sections', () => {
    const { plan, warnings } = accepted(saas());
    expect(plan.sections.map(({ role }) => role)).toEqual(['header', 'hero', 'band', 'band', 'cta', 'footer']);
    expect(plan.sections[0]).toMatchObject({ key: 'header', anchorId: 'header', title: 'Header' });
    expect(plan.nav).toEqual([
      { label: 'Features', anchorId: 'features' },
      { label: 'Pricing', anchorId: 'pricing' },
      { label: 'Ready to ship', anchorId: 'cta' },
    ]);
    expect(warnings.some(({ message }) => message.includes('no header'))).toBe(true);
    const header = JSON.stringify(skeletonFromPlan(plan, CONTEXT).plan.commands);
    expect(header).toContain('Start free trial');
    expect(header).toContain('#features');
  });

  it('leaves a person-edited plan (no completePage) and an appended plan as written', () => {
    expect(accepted(saas(), false).plan.sections.map(({ role }) => role)).toEqual(['hero', 'band', 'band', 'cta']);
    const appended = saas();
    appended['intent'] = 'append';
    appended['sections'] = (appended['sections'] as Json[]).slice(1);
    const result = validatePagePlan(appended, { completePage: true });
    expect(result.ok && result.plan.sections.map(({ role }) => role)).toEqual(['band', 'band', 'cta']);
  });

  it('adds nothing past the section ceiling', () => {
    const result = validatePagePlan(saas(), { completePage: true, maxSections: 4 });
    expect(result.ok && result.plan.sections.length).toBe(4);
  });
});

describe('the hero shows the catalog photo the page matches', () => {
  it('a type-only SaaS hero gets a tech photo and a hero kit that shows it', () => {
    const { plan } = accepted(saas());
    const hero = plan.sections.find(({ role }) => role === 'hero');
    expect(hero?.images?.[0]?.subject).toBe('tech');
    expect(hero?.kit).toBe('hero-split');
  });

  it("moves a hero whose brief has a photo but whose kit shows none to a photo kit, keeping the brief's photo", () => {
    const value = saas();
    const hero = (value['sections'] as Json[])[0] ?? {};
    hero['images'] = [{ subject: 'tech', aspect: 'landscape', alt: 'Team on a dashboard' }];
    const done = accepted(value).plan.sections.find(({ role }) => role === 'hero');
    expect(done?.kit).toBe('hero-split');
    expect(done?.images).toEqual([{ subject: 'tech', aspect: 'landscape', alt: 'Team on a dashboard' }]);
  });

  it('a hero that already has a photo keeps it and its kit', () => {
    const hero = accepted(restaurant()).plan.sections.find(({ role }) => role === 'hero');
    expect(hero?.kit).toBe('hero-overlay');
    expect(hero?.images).toHaveLength(1);
  });
});

describe("a local business's booking section says how to book", () => {
  it('moves the bare cta to the contact kit with phone, WhatsApp, hours and address from the facts', () => {
    const { plan } = accepted(restaurant());
    const booking = plan.sections.find(({ key }) => key === 'booking');
    expect(booking?.kit).toBe('contact-split');
    expect(booking?.slots).toMatchObject({
      title: 'احجز طاولتك الآن',
      lead: 'احجز قبل ساعة',
      channels: [
        { icon: 'calendar', label: 'احجز طاولة', href: '#booking' },
        { icon: 'phone', label: '+962 6 461 2750', href: 'tel:+96264612750' },
        { icon: 'message-circle', label: 'واتساب', href: 'https://wa.me/962794612750' },
      ],
      hours: [{ day: 'ساعات العمل', time: 'يومياً من ١٢ ظهراً حتى ١٢ ليلاً' }],
      address: 'شارع الرينبو، جبل عمّان',
    });
    // Filled whole: the skeleton writes it and no writer runs.
    const region = skeletonFromPlan(plan, CONTEXT).regions.find(({ title }) => title === 'احجز طاولتك الآن');
    expect(region?.complete).toBe(true);
  });

  it('leaves a SaaS closing call to action alone', () => {
    const cta = accepted(saas()).plan.sections.find(({ key }) => key === 'cta');
    expect(cta?.kit).toBe('cta-split');
  });
});

describe("the page's action is never a claim to avoid", () => {
  it('drops the CTA label from mustNotRepeat (measure-v3: the pricing tiers were refused for it)', () => {
    const value = saas();
    const pricing = (value['sections'] as Json[]).find(({ key }) => key === 'pricing') ?? {};
    pricing['mustNotRepeat'] = ['Start free trial', 'No credit card'];
    const { plan, warnings } = accepted(value, false);
    expect(plan.sections.find(({ key }) => key === 'pricing')?.mustNotRepeat).toEqual(['No credit card']);
    expect(warnings.some(({ path }) => path.endsWith('mustNotRepeat'))).toBe(true);
  });
});
