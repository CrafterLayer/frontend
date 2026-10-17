import type { AiSkillDefinitionV1 } from '../types';
import { INDUSTRY_LOCAL_ACTIONS, INDUSTRY_SHELL, PAGE_INTENTS, industryConflicts } from './shared';

/**
 * Real estate: listings scanned for three numbers, and one agent to call.
 *
 * Keywords avoid the words that mean something else as often: "property" is
 * a CSS property, "brokerage" a stock brokerage, and "for rent" / "للإيجار"
 * is as often a car. A licence or registration number is treated like a
 * person's own fact — an invented one is a false claim, not a sample.
 */
export const PROPERTY_PAGE_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.property-page',
  name: 'Real estate listings page',
  description:
    'A real estate page scanned for price, rooms and area: listing cards with a spec row, amenities, proof numbers and a WhatsApp line to the agent.',
  version: '1.0.1',
  source: 'builtin',
  trust: 'builtin',
  priority: 87,
  activation: {
    mode: 'auto',
    intents: PAGE_INTENTS,
    keywords: [
      'real estate',
      'realestate',
      'realty',
      'realtor',
      'property listing',
      'properties for',
      'property developer',
      'property management',
      'apartments',
      'apartment for',
      'villas',
      'luxury villa',
      'villa for',
      'condos',
      'penthouse',
      'homes for sale',
      'houses for sale',
      // Not a bare 'brokerage': "stock brokerage firm" loaded this page (wave-1 verifier).
      'property brokerage',
      'real estate brokerage',
      'estate agent',
      'estate agency',
      'عقار',
      'عقارات',
      'شقق',
      'شقة',
      'شقه',
      'فلل',
      'فيلا',
      'فيلات',
      'أراضي',
      'اراضي',
      'مشروع سكني',
      'وحدات سكنية',
    ],
  },
  tags: ['composition', 'industry', 'listings', 'real-estate'],
  dependencies: ['craftkit.copywriting', 'craftkit.visual-direction'],
  conflicts: industryConflicts('craftkit.property-page'),
  instructions: `A property page is scanned for three numbers — price, rooms, area — and one action: talk to the agent. One region per section, in this order, skipping what the request gives no material for:
1 HERO[overlay]: h1 the area or the project, the price range in the lead p, WhatsApp the agent; no search box or filters that do nothing.
2 LISTINGS[listing]: three to six cards — the price first, then the title and district, then a spec row with icons bed-double / bath / ruler / square-parking size 16 and their numbers (3 غرف · 2 حمام · 180 م² · 1 موقف).
3 AMENITIES[list]: pool, parking, security, schools nearby — each with its distance or detail.
4 PROOF[stats]: units sold, years, on-time handovers.
5 AGENT[contact]: WhatsApp with the listing named in the text, tel:, office hours, the map link.
${INDUSTRY_SHELL}
${INDUSTRY_LOCAL_ACTIONS}
FACTS: prices, areas and units are realistic samples listed in followUp. A brokerage licence or registration number is, like a person's own facts, never invented: it stays "[رقم الترخيص]", listed in followUp.`,
  references: {
    'checks/property.md':
      'Listings lead with price, then rooms, bathrooms, area and parking with their icons; no dead filters; WhatsApp names the listing; licence numbers never invented; sample figures listed in followUp.',
  },
};
