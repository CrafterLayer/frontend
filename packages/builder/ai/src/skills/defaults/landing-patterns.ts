import type { AiSkillDefinitionV1 } from '../types';

/**
 * Landing patterns (2026-10-12): the section orders and call-to-action placements of UI UX Pro
 * Max's `landing.csv` (Next Level Builder, MIT) that a site builder meets most, each with the
 * one conversion rule that matters, and the honesty rules the data attaches to counts, ratings
 * and scarcity. Auto on landing and conversion words.
 */

export interface LandingPattern {
  readonly name: string;
  readonly use: string;
  readonly order: string;
  readonly cta: string;
  readonly rule: string;
}

export const LANDING_PATTERNS: readonly LandingPattern[] = [
  {
    name: 'Hero + features + CTA',
    use: 'most products and services',
    order: 'hero > value line > 3-5 features > proof > CTA band',
    cta: 'hero and the closing band',
    rule: 'one primary action, repeated, never two competing',
  },
  {
    name: 'Hero + testimonials + CTA',
    use: 'services sold on trust',
    order: 'hero > problem > solution > testimonials > CTA',
    cta: 'hero and right after the testimonials',
    rule: 'proof comes before the ask',
  },
  {
    name: 'Minimal single column',
    use: 'one offer, one action',
    order: 'headline > short description > 3 benefits > CTA',
    cta: 'one large centred button',
    rule: 'no navigation clutter, lots of white space',
  },
  {
    name: 'Lead magnet + form',
    use: 'guides, consultations, quotes',
    order: 'benefit headline > preview of what they get > short form',
    cta: 'the form button',
    rule: 'ask only what is needed to deliver it',
  },
  {
    name: 'Pricing-focused',
    use: 'plans and packages',
    order: 'value hero > 3 plan cards > comparison > FAQ > CTA',
    cta: 'every card and the closing band',
    rule: 'mark the plan most people need; show real totals',
  },
  {
    name: 'Comparison',
    use: 'choosing against alternatives',
    order: 'problem hero > comparison table > deep dive > CTA',
    cta: 'under the table',
    rule: 'factual rows only; highlight your column',
  },
  {
    name: 'Waitlist / coming soon',
    use: 'before launch',
    order: 'hero with date > teaser > email form > who is waiting',
    cta: 'the email form above the fold',
    rule: 'no invented scarcity; a count only if real and dated',
  },
  {
    name: 'Event / conference',
    use: 'events, webinars, courses with dates',
    order: 'date, place and countdown > speakers > agenda > sponsors > register',
    cta: 'sticky register, after speakers, bottom',
    rule: 'write the exact date and time zone as text',
  },
  {
    name: 'Before-after',
    use: 'clinics, salons, renovation, coaching',
    order: 'problem > before/after compare > how it works > results > CTA',
    cta: 'after the reveal',
    rule: 'real results only, with consent',
  },
  {
    name: 'Portfolio grid',
    use: 'photographers, designers, agencies',
    order: 'name and role > project grid > about > contact',
    cta: 'project cards and the footer contact',
    rule: 'work first, words second',
  },
  {
    name: 'Local business',
    use: 'cafés, clinics, shops, trades',
    order: 'hero with the main action > services or menu > reviews > hours and map > contact',
    cta: 'call, WhatsApp, book or order in the hero',
    rule: 'hours, address and phone visible without searching',
  },
  {
    name: 'Trust & authority',
    use: 'law, finance, B2B, healthcare',
    order:
      'credibility hero > proof (logos, certificates, numbers) > services > clear contact path',
    cta: 'consultation or quote',
    rule: 'credentials visible; low-friction form',
  },
  {
    name: 'Storytelling',
    use: 'brands, charities, portfolios',
    order: 'hook > problem > journey > solution > closing CTA',
    cta: 'end of each chapter and the climax',
    rule: 'the story must read without any scroll effect',
  },
  {
    name: 'App landing',
    use: 'mobile apps',
    order: 'hero with device > screenshots > features > reviews > store buttons',
    cta: 'store buttons throughout',
    rule: 'real screenshots and current ratings only',
  },
];

function line(pattern: LandingPattern): string {
  return `${pattern.name} (${pattern.use}): ${pattern.order}; CTA in ${pattern.cta}; ${pattern.rule}.`;
}

const INSTRUCTIONS = `BESPOKE: honor the user's design contract and supplied content, even when this skill was explicitly selected. Patterns below are optional conversion references; never cut or reorder content to fit a recipe. Apply useful action, readability and proof guidance within the chosen composition. LEGACY/HYBRID: use a pattern only when it fits the requested structure and purpose.
${LANDING_PATTERNS.map(line).join('\n')}
CTA: a verb and the result ("Book a table", «احجز طاولة»), never "Click here" or "Submit"; the label holds 4.5:1 against its button; one primary style per page, a secondary action looks secondary. On phones the primary action stays reachable.
PROOF: testimonials with a name and role the person gave, else initials and a placeholder named in followUp. Logos, ratings, counts, "limited seats" and countdowns only when real and current; a countdown always states the date in text too.
OPENING: make the page's purpose clear; put actions where the content and audience need them. No mandatory above-the-fold sequence, section count or next-section peek.`;

export const LANDING_PATTERNS_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pro-max-landing',
  name: 'Landing patterns that convert',
  description:
    'Fourteen landing patterns from UI UX Pro Max: the section order, where the call to action goes, and the one rule that makes each convert.',
  version: '1.1.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 36,
  activation: {
    mode: 'auto',
    keywords: [
      'landing',
      'conversion',
      'convert',
      'sales page',
      'launch',
      'waitlist',
      'pricing',
      'webinar',
      'event',
      'cta',
      'هبوط',
      'تحويل',
      'مبيعات',
      'إطلاق',
      'انتظار',
      'أسعار',
      'باقات',
      'فعالية',
      'مؤتمر',
    ],
  },
  tags: ['conversion', 'landing', 'structure'],
  instructions: INSTRUCTIONS,
  references: {
    'checks/landing.md':
      'The design contract and supplied content win; patterns stay optional for bespoke work; clear useful actions, readable contrast and truthful proof; no invented logos, ratings, counts or scarcity.',
  },
};
