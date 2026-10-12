import type { AiSkillDefinitionV1 } from '../types';

/**
 * Design intelligence (2026-10-12): the decision tables of UI UX Pro Max (Next Level Builder,
 * MIT — `ui-reasoning.csv`, `products.csv`, `colors.csv`, `typography.csv`) distilled for a
 * site builder. For the kind of business a request names, one row says which page pattern to
 * use, which colours (as `theme.apply` hexes), which type mood (as verified `fonts.set`
 * families), which effects, what the page must show and what to avoid. Rendered from data so a
 * test can check every hex and every family.
 */

export interface TypeMood {
  readonly mood: string;
  readonly display: string;
  readonly body: string;
  readonly arabicDisplay: string;
  readonly arabicBody: string;
}

/** Each pairing from verified families only (verified-fonts.ts); every Arabic one carries Latin. */
export const TYPE_MOODS: readonly TypeMood[] = [
  {
    mood: 'elegant',
    display: 'Cormorant Garamond',
    body: 'DM Sans',
    arabicDisplay: 'Amiri',
    arabicBody: 'IBM Plex Sans Arabic',
  },
  {
    mood: 'professional',
    display: 'Instrument Sans',
    body: 'Manrope',
    arabicDisplay: 'Readex Pro',
    arabicBody: 'IBM Plex Sans Arabic',
  },
  {
    mood: 'friendly',
    display: 'Outfit',
    body: 'Nunito Sans',
    arabicDisplay: 'Changa',
    arabicBody: 'Tajawal',
  },
  {
    mood: 'bold',
    display: 'Archivo Black',
    body: 'Barlow',
    arabicDisplay: 'Lalezar',
    arabicBody: 'Cairo',
  },
  {
    mood: 'editorial',
    display: 'Fraunces',
    body: 'IBM Plex Sans',
    arabicDisplay: 'Markazi Text',
    arabicBody: 'Noto Naskh Arabic',
  },
  {
    mood: 'warm',
    display: 'Young Serif',
    body: 'Figtree',
    arabicDisplay: 'El Messiri',
    arabicBody: 'Almarai',
  },
  {
    mood: 'tech',
    display: 'Space Grotesk',
    body: 'DM Sans',
    arabicDisplay: 'Alexandria',
    arabicBody: 'Noto Sans Arabic',
  },
  {
    mood: 'creative',
    display: 'Syne',
    body: 'Manrope',
    arabicDisplay: 'Beiruti',
    arabicBody: 'Readex Pro',
  },
];

export interface DesignRow {
  readonly kind: string;
  readonly pattern: string;
  /** theme.apply: the accent, then the page ground. */
  readonly accent: string;
  readonly ground: string;
  readonly type: TypeMood['mood'];
  readonly effect: string;
  readonly show: string;
  readonly avoid: string;
}

export const DESIGN_ROWS: readonly DesignRow[] = [
  {
    kind: 'SaaS, software',
    pattern: 'hero > 3-5 features > proof > pricing > FAQ > CTA',
    accent: '#2563EB',
    ground: '#F8FAFC',
    type: 'professional',
    effect: 'subtle 200ms hover',
    show: 'product shot, pricing',
    avoid: 'heavy animation, dark by default',
  },
  {
    kind: 'online store',
    pattern: 'hero > featured products > benefits > reviews > CTA',
    accent: '#059669',
    ground: '#ECFDF5',
    type: 'friendly',
    effect: 'card lift on hover',
    show: 'prices, delivery, returns',
    avoid: 'walls of text, flat cards',
  },
  {
    kind: 'luxury, boutique',
    pattern: 'story-led hero > collection > craft story > visit/buy',
    accent: '#A16207',
    ground: '#FAFAF9',
    type: 'elegant',
    effect: 'slow 400-600ms reveals',
    show: 'large imagery, few words',
    avoid: 'playful colours, badges, fast motion',
  },
  {
    kind: 'B2B, consulting',
    pattern: 'credibility hero > services > results > clients > contact',
    accent: '#0369A1',
    ground: '#F8FAFC',
    type: 'professional',
    effect: 'calm section reveals',
    show: 'case results, credentials',
    avoid: 'playful design, hidden credentials',
  },
  {
    kind: 'medical clinic',
    pattern: 'trust hero > services > doctors > booking > hours/map',
    accent: '#0891B2',
    ground: '#F0FDFA',
    type: 'professional',
    effect: 'clear booking flow',
    show: 'doctors, insurance, hours',
    avoid: 'confusing booking',
  },
  {
    kind: 'dental',
    pattern: 'hero > services > before/after > reviews > booking',
    accent: '#0EA5E9',
    ground: '#F0F9FF',
    type: 'friendly',
    effect: 'before/after compare',
    show: 'dentists, price ranges, booking',
    avoid: 'clinical coldness, no testimonials',
  },
  {
    kind: 'beauty, spa, salon',
    pattern: 'calm hero > services, prices > results > reviews > book',
    accent: '#DB2777',
    ground: '#FDF2F8',
    type: 'elegant',
    effect: 'soft shadows, gentle hover',
    show: 'service menu, booking',
    avoid: 'neon, harsh motion, dark mode',
  },
  {
    kind: 'restaurant',
    pattern: 'appetising hero > menu > story > reserve > hours/map',
    accent: '#DC2626',
    ground: '#FEF2F2',
    type: 'warm',
    effect: 'menu hover',
    show: 'menu, hours, location, order or reserve',
    avoid: 'weak food photos, outdated hours',
  },
  {
    kind: 'café, bakery',
    pattern: 'warm hero > menu > seasonal specials > visit us > order',
    accent: '#92400E',
    ground: '#FEF3C7',
    type: 'warm',
    effect: 'menu hover',
    show: 'hours, location, catering',
    avoid: 'hidden hours, weak food photos',
  },
  {
    kind: 'gym, fitness',
    pattern: 'energetic hero > programs > coaches > schedule > plans',
    accent: '#F97316',
    ground: '#1F2937',
    type: 'bold',
    effect: 'progress and counter motion',
    show: 'schedule, membership prices, results',
    avoid: 'static pages, no proof',
  },
  {
    kind: 'real estate',
    pattern: 'search hero > listings > areas/map > agent > viewing request',
    accent: '#0F766E',
    ground: '#F0FDFA',
    type: 'professional',
    effect: 'gallery and map hover',
    show: 'price, area, rooms per listing',
    avoid: 'poor photos, no map',
  },
  {
    kind: 'travel, tourism',
    pattern: 'destination hero > trips > itinerary > reviews > book',
    accent: '#0EA5E9',
    ground: '#F0F9FF',
    type: 'friendly',
    effect: 'destination imagery',
    show: 'prices, dates, inclusions',
    avoid: 'generic photos, complex booking',
  },
  {
    kind: 'hotel',
    pattern: 'hero > rooms > amenities > location > reviews > book',
    accent: '#A16207',
    ground: '#F8FAFC',
    type: 'elegant',
    effect: 'room gallery',
    show: 'rooms with prices, map, reviews',
    avoid: 'complex booking',
  },
  {
    kind: 'wedding, events',
    pattern: 'story hero > portfolio > packages > timeline > enquiry',
    accent: '#DB2777',
    ground: '#FDF2F8',
    type: 'elegant',
    effect: 'gallery reveals',
    show: 'real work, packages',
    avoid: 'generic templates',
  },
  {
    kind: 'law firm',
    pattern: 'authority hero > practice areas > lawyers > results > consultation',
    accent: '#B45309',
    ground: '#F8FAFC',
    type: 'editorial',
    effect: 'restrained reveals',
    show: 'credentials, consultation form',
    avoid: 'hidden credentials',
  },
  {
    kind: 'finance, bank',
    pattern: 'trust hero > features > security > fees > app/CTA',
    accent: '#1E3A8A',
    ground: '#F8FAFC',
    type: 'professional',
    effect: 'number counters',
    show: 'security, clear fees',
    avoid: 'playful design, unclear fees',
  },
  {
    kind: 'courses, e-learning',
    pattern: 'outcome hero > curriculum > instructor > reviews > pricing',
    accent: '#0D9488',
    ground: '#F0FDFA',
    type: 'friendly',
    effect: 'progress visuals',
    show: 'outcomes, duration',
    avoid: 'walls of text',
  },
  {
    kind: 'charity, non-profit',
    pattern: 'story hero > impact > stories > transparency > donate',
    accent: '#EA580C',
    ground: '#ECFEFF',
    type: 'editorial',
    effect: 'real impact counters',
    show: 'where money goes',
    avoid: 'no impact data, hidden finances',
  },
  {
    kind: 'construction, architecture',
    pattern: 'project hero > services > projects > process > quote',
    accent: '#EA580C',
    ground: '#F8FAFC',
    type: 'bold',
    effect: 'project timeline',
    show: 'projects, certifications',
    avoid: 'poor imagery',
  },
  {
    kind: 'car dealer',
    pattern: 'hero > models > specs, prices > financing > test drive',
    accent: '#DC2626',
    ground: '#F8FAFC',
    type: 'bold',
    effect: 'vehicle gallery',
    show: 'specs and prices',
    avoid: 'static product pages',
  },
  {
    kind: 'photography',
    pattern: 'full-bleed gallery > packages > about > booking',
    accent: '#18181B',
    ground: '#FAFAFA',
    type: 'elegant',
    effect: 'full-bleed gallery',
    show: 'work first',
    avoid: 'heavy text',
  },
  {
    kind: 'home services',
    pattern: 'call-now hero > services > prices > areas served > reviews',
    accent: '#EA580C',
    ground: '#EFF6FF',
    type: 'professional',
    effect: 'emergency contact highlight',
    show: 'phone, WhatsApp, prices',
    avoid: 'hidden contact',
  },
  {
    kind: 'kids, nursery',
    pattern: 'cheerful hero > programs > staff > safety > visit',
    accent: '#16A34A',
    ground: '#FDF2F8',
    type: 'friendly',
    effect: 'activity gallery',
    show: 'safety, schedule, staff',
    avoid: 'hidden safety info',
  },
  {
    kind: 'mosque, community centre',
    pattern: 'hero > times > events, lessons > donate > location',
    accent: '#A16207',
    ground: '#F8FAFC',
    type: 'editorial',
    effect: 'times highlight',
    show: 'prayer times, location',
    avoid: 'outdated info',
  },
  {
    kind: 'conference, event',
    pattern: 'date, place, countdown > speakers > agenda > sponsors > register',
    accent: '#A16207',
    ground: '#F8FAFC',
    type: 'professional',
    effect: 'speaker grid',
    show: 'exact date, time zone, venue',
    avoid: 'unclear schedule, fake scarcity',
  },
  {
    kind: 'portfolio, CV',
    pattern: 'name/role hero > selected work > experience > skills > contact',
    accent: '#2563EB',
    ground: '#FAFAFA',
    type: 'professional',
    effect: 'scroll reveals',
    show: 'work first, real results',
    avoid: 'generic templates',
  },
  {
    kind: 'agency',
    pattern: 'bold hero > case studies with results > services > team > contact',
    accent: '#DB2777',
    ground: '#FDF2F8',
    type: 'creative',
    effect: 'portfolio reveals',
    show: 'real client results',
    avoid: 'corporate blandness, hidden work',
  },
  {
    kind: 'AI, tech product',
    pattern: 'live demo or prompt hero > how it works > use cases > pricing',
    accent: '#0891B2',
    ground: '#FAF5FF',
    type: 'tech',
    effect: 'fade-in, typing',
    show: 'a working demo',
    avoid: 'heavy chrome',
  },
  {
    kind: 'magazine, blog',
    pattern: 'featured story > categories > latest > newsletter',
    accent: '#DB2777',
    ground: '#FAFAFA',
    type: 'editorial',
    effect: 'article transitions',
    show: 'authors, dates',
    avoid: 'weak typography',
  },
];

function moodLine(mood: TypeMood): string {
  return `${mood.mood} ${mood.display}/${mood.body} (ar ${mood.arabicDisplay}/${mood.arabicBody})`;
}

/** One row: kind: pattern | accent/ground mood | effect | show … | avoid …  */
function row(entry: DesignRow): string {
  return `${entry.kind}: ${entry.pattern.replaceAll(' > ', '>')} | ${entry.accent}/${entry.ground} ${entry.type} | ${entry.effect} | ${entry.show} | no ${entry.avoid}`;
}

const INSTRUCTIONS = `DESIGN SYSTEM FIRST: before any section, settle once: the nearest kind of business below, its pattern (section order), accent and ground via theme.apply {"accent":"#hex","bg":"#hex"}, a type pairing via fonts.set {"display":"…","body":"…"}, one family of effects; every section follows it. The person's own brand, colours, fonts or order win.
TYPE (display/body, ar = Arabic): ${TYPE_MOODS.map(moodLine).join('; ')}.
ROWS: kind: pattern | accent/ground type | effect | must show | no
${DESIGN_ROWS.map(row).join('\n')}
EVERYWHERE: one accent at about 10% on neutrals; purple-pink gradients only for AI products; icons, never emoji; motion only from an action or a scroll; no rating, count, price or statistic the person did not give: a clear placeholder, named in followUp.`;

export const DESIGN_INTELLIGENCE_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pro-max-design',
  name: 'Design intelligence (UI UX Pro Max)',
  description:
    'Pattern, colours, type, effects and must-haves for 29 kinds of business, distilled from UI UX Pro Max: one design system per page before any section.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 37,
  activation: {
    mode: 'auto',
    keywords: [
      'website',
      'site',
      'landing',
      'page',
      'homepage',
      'redesign',
      'design',
      'موقع',
      'صفحة',
      'صفحه',
      'هبوط',
      'صمم',
      'تصميم',
      'رئيسية',
    ],
  },
  tags: ['design', 'design-system', 'industry'],
  instructions: INSTRUCTIONS,
  references: {
    'checks/design-system.md':
      'One design system decided before the sections (pattern, one accent and ground, one type pairing, one effect family), from the nearest kind of business; the person’s own brand wins; no invented ratings, counts or prices.',
  },
};
