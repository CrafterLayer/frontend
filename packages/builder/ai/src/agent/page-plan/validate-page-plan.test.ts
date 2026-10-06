import { contrastRatio } from '@craftkit/builder-schema';
import { describe, expect, it } from 'vitest';

import { DEFAULT_AI_BUILD_MAX_TASKS } from '../run-build';
import {
  PAGE_PLAN_MAX_SECTIONS,
  PAGE_PLAN_MIN_SECTIONS,
  validatePagePlan,
  type PagePlan,
  type PagePlanIssue,
} from './index';

/*
  The contract four owners build against in parallel (skeleton, writers,
  checker, server prompt), so these tests pin behaviour a model or an owner's
  edit will actually hit — every refusal is asserted by its PATH and by the
  repair instruction it gives, because the message is what the model reads on
  its one repair round.
*/

interface Face {
  family: string;
  weights?: number[];
}
interface Tokens {
  bg: string;
  surface: string;
  ink?: string;
  muted: string;
  accent: string;
  onAccent: string;
  accentInk?: string;
  border: string;
  fontDisplay: Face;
  fontBody: Face;
  radius: string;
  signature: string;
  deckRowId?: string;
}
interface Section {
  key: string;
  role: string;
  title: string;
  anchorId: string;
  purpose?: string;
  mustSay?: string[];
  mustNotRepeat?: string[];
  variant?: string;
  images?: { subject: string; aspect: string; alt: string }[];
}
/** A candidate as a model writes it, typed loosely enough for a test to break it. */
interface Candidate {
  intent?: string;
  locale: { lang: string; dir?: string };
  title?: string;
  description: string;
  tokens: Tokens;
  primaryCta: { label: string; href: string };
  nav: { label: string; anchorId: string }[];
  sections: Section[];
  facts: { key: string; sample: string; section: string }[];
}

function sec(value: Candidate, index: number): Section {
  const section = value.sections[index];
  if (section === undefined) throw new Error(`no section ${String(index)}`);
  return section;
}

function pick(value: Candidate, ...indexes: number[]): Section[] {
  return indexes.map((index) => sec(value, index));
}

/** A plan a model plausibly writes for an Arabic café page, deck row `cafe`. */
function candidate(): Candidate {
  return {
    intent: 'new-page',
    locale: { lang: 'ar' },
    title: 'محمصة الهيل',
    description: 'قهوة مختصة محمصة في عمّان، تصلك طازجة.',
    tokens: {
      bg: 'lime-50',
      surface: 'white',
      ink: 'emerald-950',
      muted: 'emerald-800',
      accent: 'orange-700',
      onAccent: 'white',
      border: '#E7E5E4',
      fontDisplay: { family: 'Lalezar' },
      fontBody: { family: 'almarai', weights: [700, 400, 400] },
      radius: 'xl',
      signature: 'the brand name at text-8xl, faint behind the menu',
      deckRowId: 'cafe',
    },
    primaryCta: { label: 'اطلب الآن', href: '#Order' },
    nav: [
      { label: 'القائمة', anchorId: 'menu' },
      { label: 'اطلب', anchorId: 'order' },
    ],
    sections: [
      {
        key: 'header',
        role: 'header',
        title: 'الترويسة',
        anchorId: 'top',
        purpose: 'Brand and navigation.',
      },
      {
        key: 'Hero Section',
        role: 'hero',
        title: 'قهوة تُحمّص كل صباح',
        anchorId: 'hero',
        purpose: 'Say what the roastery is and invite the first order.',
        mustSay: ['محمصة في عمّان'],
        variant: 'split',
        images: [{ subject: 'cafe', aspect: '16:9', alt: 'حبوب قهوة محمصة' }],
      },
      {
        key: 'menu',
        role: 'band',
        title: 'القائمة',
        anchorId: 'menu',
        purpose: 'The drinks and their prices.',
        mustNotRepeat: ['محمصة في عمّان'],
        variant: 'menu',
      },
      {
        key: 'order',
        role: 'cta',
        title: 'اطلب',
        anchorId: 'order',
        purpose: 'One clear way to order.',
      },
      {
        key: 'footer',
        role: 'footer',
        title: 'التذييل',
        anchorId: 'footer',
        purpose: 'Address and hours.',
      },
    ],
    facts: [
      { key: 'phone', sample: '+962 7 9000 0000', section: 'order' },
      { key: 'price-espresso', sample: '1.5 د.أ', section: 'menu' },
    ],
  };
}

function refused(value: unknown, options?: Parameters<typeof validatePagePlan>[1]) {
  const result = validatePagePlan(value, options);
  if (result.ok) throw new Error('expected the plan to be refused');
  return result.issues;
}

function accepted(value: unknown, options?: Parameters<typeof validatePagePlan>[1]): PagePlan {
  const result = validatePagePlan(value, options);
  if (!result.ok) {
    throw new Error(
      `expected the plan to pass, got:\n${result.issues.map((i) => `${i.path}: ${i.message}`).join('\n')}`,
    );
  }
  return result.plan;
}

function at(issues: readonly PagePlanIssue[], path: string): PagePlanIssue | undefined {
  return issues.find((issue) => issue.path === path);
}

describe('validatePagePlan — a plan a model wrote becomes the one the build uses', () => {
  it('accepts a sound plan and normalises it: hex colours, derived dir, font imports, slug keys', () => {
    const plan = accepted(candidate());

    expect(plan.locale).toEqual({ lang: 'ar', dir: 'rtl' });
    expect(plan.tokens.bg).toBe('#f7fee7');
    expect(plan.tokens.surface).toBe('#ffffff');
    expect(plan.tokens.border).toBe('#e7e5e4');
    // Accent text absent, and orange-700 reads on both grounds (5.00 / 5.18): the accent is its own ink.
    expect(plan.tokens.accentInk).toBe(plan.tokens.accent);
    // A one-weight face imports bare (the deck's verified URL form); weights are the shipped set.
    expect(plan.tokens.fontDisplay).toEqual({
      family: 'Lalezar',
      weights: [400],
      url: 'https://fonts.googleapis.com/css2?family=Lalezar&display=swap',
    });
    // Case-folded to the verified name, de-duplicated and sorted.
    expect(plan.tokens.fontBody).toEqual({
      family: 'Almarai',
      weights: [400, 700],
      url: 'https://fonts.googleapis.com/css2?family=Almarai:wght@400;700&display=swap',
    });
    expect(plan.sections[1]?.key).toBe('hero-section');
    expect(plan.sections[1]?.images).toEqual([
      { subject: 'cafe', aspect: 'landscape', alt: 'حبوب قهوة محمصة' },
    ]);
    expect(plan.sections[0]?.mustSay).toEqual([]);
    expect(plan.primaryCta.href).toBe('#order');
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.sections[1])).toBe(true);
  });

  it('keeps the section limit equal to the build’s own task ceiling', () => {
    expect(PAGE_PLAN_MIN_SECTIONS).toBe(2);
    expect(PAGE_PLAN_MAX_SECTIONS).toBe(DEFAULT_AI_BUILD_MAX_TASKS);
  });

  it('refuses something that is not an object, at the root path', () => {
    const issues = refused('here is your plan: …');
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('');
    expect(issues[0]?.message).toMatch(/JSON object/u);
  });

  it('names every missing field with the fix, not just "invalid"', () => {
    const value = candidate();
    delete value.title;
    // Without a deck row nothing fills a missing token (with one, the row does: compact-plan).
    delete value.tokens.deckRowId;
    delete value.tokens.ink;
    delete sec(value, 2).purpose;
    const issues = refused(value);
    expect(at(issues, 'title')?.message).toMatch(/Write/u);
    expect(at(issues, 'tokens.ink')?.message).toMatch(/#rrggbb|palette/u);
    // 2026-10-05 (fast-build DESIGN §3): a missing purpose is the title plus a warning, never an issue.
    expect(at(issues, 'sections[2].purpose')).toBeUndefined();
  });

  describe('sections', () => {
    it('refuses fewer than two and more than the ceiling', () => {
      const one = candidate();
      one.sections = pick(one, 1);
      one.nav = [];
      one.facts = [];
      one.primaryCta.href = '#hero';
      expect(at(refused(one), 'sections')?.message).toMatch(/2/u);

      const many = candidate();
      many.sections = Array.from({ length: 13 }, (_, n) => ({
        key: `s${String(n)}`,
        role: n === 0 ? 'hero' : 'band',
        title: `Section ${String(n)}`,
        anchorId: `s${String(n)}`,
        purpose: 'Something.',
      }));
      many.nav = [];
      many.facts = [];
      many.primaryCta.href = '#s1';
      expect(at(refused(many), 'sections')?.message).toMatch(/12/u);
      expect(at(refused(candidate(), { maxSections: 4 }), 'sections')?.message).toMatch(/4/u);
    });

    it('refuses duplicate keys and anchors, naming the second one', () => {
      const value = candidate();
      sec(value, 3).key = 'menu';
      sec(value, 3).anchorId = 'menu';
      const issues = refused(value);
      expect(at(issues, 'sections[3].key')?.message).toMatch(/unique/u);
      expect(at(issues, 'sections[3].anchorId')?.message).toMatch(/unique/u);
    });

    it('renames a key that cannot become a slug in code, with a warning, never a repair round', () => {
      // Live run 2026-10-05: Arabic section keys cost a 15.7 s plan repair round.
      const value = candidate();
      sec(value, 2).key = 'القائمة';
      const facts = (value as { facts?: { section?: string }[] }).facts ?? [];
      for (const fact of facts) if (fact.section === 'menu') fact.section = 'القائمة';
      const result = validatePagePlan(value);
      if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
      expect(result.plan.sections[2]?.key).toMatch(/^[a-z][a-z0-9-]*$/u);
      expect(result.warnings?.some(({ path }) => path === 'sections[2].key')).toBe(true);
    });

    it('still refuses a section with no key', () => {
      const value = candidate();
      sec(value, 2).key = '';
      expect(at(refused(value), 'sections[2].key')?.message).toMatch(/a-z/u);
    });

    it('holds the page’s shape: header first, footer last, exactly one hero', () => {
      const late = candidate();
      late.sections = pick(late, 1, 0, 2, 3, 4);
      expect(at(refused(late), 'sections[1].role')?.message).toMatch(/first/u);

      const heroes = candidate();
      sec(heroes, 2).role = 'hero';
      expect(at(refused(heroes), 'sections[2].role')?.message).toMatch(/one hero/u);

      const footer = candidate();
      footer.sections = pick(footer, 0, 1, 2, 4, 3);
      expect(at(refused(footer), 'sections[3].role')?.message).toMatch(/last/u);

      const noHero = candidate();
      sec(noHero, 1).role = 'band';
      expect(at(refused(noHero), 'sections')?.message).toMatch(/hero/u);
    });

    it('lets an appended plan add bands but not a second header or hero', () => {
      const value = candidate();
      value.intent = 'append';
      const issues = refused(value);
      expect(at(issues, 'sections[0].role')?.message).toMatch(/append/u);
      expect(at(issues, 'sections[1].role')?.message).toMatch(/append/u);

      const bands = candidate();
      bands.intent = 'append';
      bands.sections = bands.sections.slice(2, 4);
      bands.nav = [];
      bands.facts = [];
      expect(accepted(bands).sections.map((s) => s.role)).toEqual(['band', 'cta']);
    });

    it('checks variants, photo subjects and aspects against the libraries the writers use', () => {
      const value = candidate();
      sec(value, 2).variant = 'carousel';
      sec(value, 1).images = [{ subject: 'spaceship', aspect: 'wide', alt: '' }];
      const issues = refused(value);
      // 2026-10-05 (R-variant): an unknown variant is dropped with a warning, never refused.
      expect(at(issues, 'sections[2].variant')).toBeUndefined();
      expect(at(issues, 'sections[1].images[0].subject')?.message).toMatch(/cafe/u);
      expect(at(issues, 'sections[1].images[0].aspect')?.message).toMatch(/landscape/u);
      expect(at(issues, 'sections[1].images[0].alt')?.message).toMatch(/Write/u);
    });
  });

  describe('links and facts', () => {
    it('refuses nav and CTA anchors that no section has', () => {
      const value = candidate();
      value.nav = [
        { label: 'القائمة', anchorId: 'menu' },
        { label: 'اطلب', anchorId: 'contact' },
      ];
      value.primaryCta.href = '#reserve';
      const issues = refused(value);
      expect(at(issues, 'nav[1].anchorId')?.message).toMatch(/order/u);
      expect(at(issues, 'primaryCta.href')?.message).toMatch(/#order/u);
    });

    it('accepts an external CTA and refuses a script URL', () => {
      const external = candidate();
      external.primaryCta.href = 'https://wa.me/962796481253';
      expect(accepted(external).primaryCta.href).toBe('https://wa.me/962796481253');

      const script = candidate();
      script.primaryCta.href = 'javascript:alert(1)';
      expect(at(refused(script), 'primaryCta.href')).toBeDefined();
    });

    it('ties every fact to a real section, each key once', () => {
      const value = candidate();
      value.facts.push({ key: 'phone', sample: 'x', section: 'order' });
      value.facts.push({ key: 'hours', sample: '8–10', section: 'contact' });
      const issues = refused(value);
      expect(at(issues, 'facts[2].key')?.message).toMatch(/unique/u);
      expect(at(issues, 'facts[3].section')?.message).toMatch(/footer/u);
    });

    it('renames a fact key in another script in code — one name per written key, twins still dropped', () => {
      // Live run 2026-10-05: «سعر_شيش_لحم» as a fact key cost a 16 s plan repair round.
      const value = candidate();
      value.facts.push({ key: 'سعر_شيش_لحم', sample: '6.50 د.ا', section: 'order' });
      value.facts.push({ key: 'سعر_شيش_لحم', sample: '6.50 د.ا', section: 'order' });
      value.facts.push({ key: 'سعر الكباب', sample: '5.50 د.ا', section: 'order' });
      const result = validatePagePlan(value);
      if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
      expect(result.plan.facts.slice(-2)).toEqual([
        { key: 'fact-1', sample: '6.50 د.ا', section: 'order' },
        { key: 'fact-2', sample: '5.50 د.ا', section: 'order' },
      ]);
      expect(result.warnings?.some(({ message }) => message.includes('"fact-1"'))).toBe(true);
    });
  });

  describe('tokens: every text pair is measured, never hoped for', () => {
    it('refuses yellow-400 accent text on white — the pair wave 1 measured at 1.53:1', () => {
      const value = candidate();
      value.tokens.bg = 'white';
      value.tokens.surface = 'zinc-100';
      value.tokens.ink = 'zinc-900';
      value.tokens.muted = 'zinc-600';
      value.tokens.accent = 'yellow-400';
      value.tokens.onAccent = 'zinc-900';
      value.tokens.accentInk = 'yellow-400';
      const issue = at(refused(value), 'tokens.accentInk');
      expect(issue?.message).toMatch(/1\.5\d:1/u);
      expect(issue?.message).toMatch(/4\.5:1/u);
      expect(issue?.message).toMatch(/darker/u);
    });

    it('falls back to ink when accent text is absent and the accent cannot be read as text', () => {
      const value = candidate();
      value.tokens.bg = 'white';
      value.tokens.surface = 'zinc-100';
      value.tokens.ink = 'zinc-900';
      value.tokens.muted = 'zinc-600';
      value.tokens.accent = 'yellow-400';
      value.tokens.onAccent = 'zinc-900';
      const plan = accepted(value);
      expect(plan.tokens.accentInk).toBe('#18181b');
    });

    it('refuses a button label lost on its fill — and repairs faint muted text in code', () => {
      const value = candidate();
      value.tokens.bg = 'white';
      value.tokens.muted = 'stone-400';
      value.tokens.onAccent = 'amber-300';
      value.tokens.accent = 'amber-400';
      const issues = refused(value);
      // R-contrast (2026-10-05): muted is moved in code, never refused.
      expect(at(issues, 'tokens.muted')).toBeUndefined();
      expect(at(issues, 'tokens.onAccent')?.message).toMatch(/4\.5:1/u);
    });

    it('moves a faint muted towards the ink until it reads on bg and surface, with a warning', () => {
      // The 2026-10-05 Arabic head: muted red-600 on a red-50 surface, 4.41:1.
      const value = candidate();
      value.tokens.bg = 'white';
      value.tokens.surface = 'red-50';
      value.tokens.ink = 'red-950';
      value.tokens.muted = 'red-600';
      value.tokens.accent = 'red-700';
      value.tokens.onAccent = 'white';
      value.tokens.border = 'red-200';
      const result = validatePagePlan(value);
      if (!result.ok) throw new Error(result.issues.map(({ path }) => path).join(', '));
      const { muted, bg, surface, ink } = result.plan.tokens;
      expect(muted).not.toBe('#dc2626');
      expect(contrastRatio(muted, bg) ?? 0).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(muted, surface) ?? 0).toBeGreaterThanOrEqual(4.5);
      // The least move: still clearly lighter than the ink it leans on.
      expect(muted).not.toBe(ink);
      const warning = result.warnings?.find(({ path }) => path === 'tokens.muted');
      expect(warning?.message).toMatch(/#dc2626/u);
      expect(warning?.message).toMatch(/4\.4\d:1/u);
      // Deterministic: a provisional and a final plan agree.
      const again = validatePagePlan(value);
      expect(again.ok && again.plan.tokens.muted).toBe(muted);
    });

    it('lightens an ink lost on a dark ground, and keeps refusing when told not to repair', () => {
      const value = candidate();
      value.tokens.bg = '#111827';
      value.tokens.surface = '#1f2937';
      value.tokens.ink = '#4b5563';
      value.tokens.muted = '#9ca3af';
      value.tokens.accent = '#f59e0b';
      value.tokens.onAccent = '#111827';
      value.tokens.border = '#374151';
      const result = validatePagePlan(value);
      if (!result.ok) throw new Error(result.issues.map(({ path }) => path).join(', '));
      expect(contrastRatio(result.plan.tokens.ink, '#1f2937') ?? 0).toBeGreaterThanOrEqual(4.5);
      expect(result.warnings?.map(({ path }) => path)).toContain('tokens.ink');

      const asked = validatePagePlan(value, { repairContrast: false });
      expect(asked.ok).toBe(false);
      expect(asked.ok ? [] : asked.issues.map(({ path }) => path)).toContain('tokens.ink');
    });

    it('refuses a colour it cannot measure, and says which forms it can', () => {
      const value = candidate();
      value.tokens.accent = 'sunset orange';
      expect(at(refused(value), 'tokens.accent')?.message).toMatch(/#rrggbb/u);
    });

    it('accepts #rgb hex and expands it', () => {
      const value = candidate();
      value.tokens.surface = '#FFF';
      expect(accepted(value).tokens.surface).toBe('#ffffff');
    });

    it('refuses an unverified font, a weight the face does not ship, and a Latin face on an Arabic page', () => {
      const value = candidate();
      value.tokens.fontDisplay = { family: 'Comic Sans MS' };
      value.tokens.fontBody = { family: 'DM Sans', weights: [400] };
      let issues = refused(value);
      expect(at(issues, 'tokens.fontDisplay.family')?.message).toMatch(/Almarai/u);
      expect(at(issues, 'tokens.fontBody.family')?.message).toMatch(/Arabic/u);

      const weight = candidate();
      weight.tokens.fontDisplay = { family: 'El Messiri', weights: [900] };
      issues = refused(weight);
      expect(at(issues, 'tokens.fontDisplay.weights[0]')?.message).toMatch(/400, 500, 600, 700/u);
    });

    it('lets an English page use a Latin face', () => {
      const value = candidate();
      value.locale = { lang: 'en' };
      value.tokens.fontDisplay = { family: 'Fraunces', weights: [600, 700] };
      value.tokens.fontBody = { family: 'Instrument Sans', weights: [400, 500] };
      const plan = accepted(value);
      expect(plan.locale.dir).toBe('ltr');
      expect(plan.tokens.fontDisplay.url).toBe(
        'https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&display=swap',
      );
    });

    it('refuses a direction-deck row that does not exist', () => {
      const value = candidate();
      value.tokens.deckRowId = 'spaceport';
      expect(at(refused(value), 'tokens.deckRowId')?.message).toMatch(/cafe/u);
    });
  });

  describe('intent and locale', () => {
    it('lets the host decide where the page lands, whatever the model wrote', () => {
      const value = candidate();
      value.intent = 'replace';
      expect(accepted(value, { intent: 'new-page' }).intent).toBe('new-page');
      delete value.intent;
      expect(accepted(value, { intent: 'replace' }).intent).toBe('replace');
      expect(at(refused(value), 'intent')?.message).toMatch(/new-page/u);
    });

    it('writes Arabic right-to-left even when the model said otherwise', () => {
      const value = candidate();
      value.locale = { lang: 'AR', dir: 'ltr' };
      expect(accepted(value).locale).toEqual({ lang: 'ar', dir: 'rtl' });
    });
  });

  describe('code repairs: what code can fix never costs a repair round (DESIGN §4)', () => {
    function warned(value: unknown) {
      const result = validatePagePlan(value);
      if (!result.ok) {
        throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join('\n'));
      }
      return { plan: result.plan, warnings: result.warnings ?? [] };
    }

    it('drops an unknown variant with a warning — variant "bar" on the header, the baseline’s only repair', () => {
      const value = candidate();
      sec(value, 0).variant = 'bar';
      const { plan, warnings } = warned(value);
      expect(plan.sections[0]?.variant).toBeUndefined();
      const warning = at(warnings, 'sections[0].variant');
      expect(warning?.message).toMatch(/"bar"/u);
      expect(warning?.message).toMatch(/dropped/u);
    });

    it('fills masked digits in place, the same way in the CTA, the facts and the slots', () => {
      const value = candidate();
      value.primaryCta.href = 'https://wa.me/962791234567';
      value.facts = [
        { key: 'phone', sample: '+962 79 123 4567', section: 'order' },
        { key: 'landline', sample: '+962 7 9000 0000', section: 'footer' },
        { key: 'price-espresso', sample: '1.5 د.أ', section: 'menu' },
      ];
      const { plan, warnings } = warned(value);
      expect(plan.primaryCta.href).toBe('https://wa.me/962794612750');
      expect(plan.facts[0]?.sample).toBe('+962 79 461 2750');
      expect(plan.facts[1]?.sample).toBe('+962 7 9461 2750');
      // Not a phone run: left exactly as written.
      expect(plan.facts[2]?.sample).toBe('1.5 د.أ');
      // The CTA's number and the fact's are still one number.
      expect(plan.primaryCta.href.replace(/[^0-9]/gu, '')).toBe(
        plan.facts[0]?.sample.replace(/[^0-9]/gu, ''),
      );
      expect(at(warnings, 'primaryCta.href')?.message).toContain('→');
      expect(at(warnings, 'facts[0].sample')?.message).toContain('"+962 79 461 2750"');
      expect(at(warnings, 'facts[2].sample')).toBeUndefined();
    });

    it('leaves a real number alone', () => {
      const value = candidate();
      value.primaryCta.href = 'tel:+962 6 461 2750';
      value.facts = [{ key: 'phone', sample: '+962 6 512 3456', section: 'order' }];
      const { plan, warnings } = warned(value);
      expect(plan.primaryCta.href).toBe('tel:+962 6 461 2750');
      expect(plan.facts[0]?.sample).toBe('+962 6 512 3456');
      expect(
        warnings.filter(({ path }) => path.startsWith('facts') || path === 'primaryCta.href'),
      ).toEqual([]);
    });

    /*
      R-xrun parity: the SAME fixture table as apps/ai-server/src/plan-shape.test.ts
      (fillPlaceholderSample). The client restates the server's repair so a
      provisional contract equals the final one; if one side changes, both change.
    */
    it.each([
      ['+971 4 XXX XXXX', '+971 4 234 5678'],
      ['$XX.XX', '$23.45'],
      ['info@xxxx.com', 'info@example.com'],
      ['www.xxxx.ae', 'www.example.ae'],
      ['xxxx@site.com', 'info@site.com'],
    ])('fills the placeholder sample %s as %s, exactly as the server does', (sample, filled) => {
      const value = candidate();
      value.facts = [{ key: 'contact', sample, section: 'footer' }];
      const { plan, warnings } = warned(value);
      expect(plan.facts[0]?.sample).toBe(filled);
      expect(at(warnings, 'facts[0].sample')?.message).toContain(`"${sample}" → "${filled}"`);
    });

    it('leaves values that only look like a mask alone', () => {
      const value = candidate();
      value.facts = [
        { key: 'sizes', sample: 'S to XXL', section: 'menu' },
        { key: 'king', sample: 'Louis XIV', section: 'menu' },
      ];
      const { plan } = warned(value);
      expect(plan.facts.map(({ sample }) => sample)).toEqual(['S to XXL', 'Louis XIV']);
    });
  });

  it('phrases every issue as an instruction with a path', () => {
    const value = candidate();
    value.tokens.muted = 'stone-300';
    sec(value, 2).variant = 'nope';
    value.nav = [{ label: 'القائمة', anchorId: 'nowhere' }];
    for (const issue of refused(value)) {
      expect(issue.path).not.toBe('');
      expect(issue.message.length).toBeGreaterThan(20);
    }
  });
});
