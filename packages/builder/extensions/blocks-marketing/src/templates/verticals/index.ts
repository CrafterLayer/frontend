import type { TemplateDefinition } from '../types';
import { clinicTemplate } from './clinic';
import { eventsTemplate } from './events';
import { portfolioTemplate } from './portfolio';
import { realEstateTemplate } from './real-estate';
import { restaurantTemplate } from './restaurant';

/*
  The five vertical templates (agent-script DESIGN §B.3, package
  templates-verticals), each in English and Arabic. The order here is the
  Library's order after the core four; `../index.ts` spreads this list into
  TEMPLATE_DEFINITIONS, so the compositions and the catalog cards follow it.
*/
export const VERTICAL_DEFINITIONS: readonly TemplateDefinition[] = [
  restaurantTemplate,
  clinicTemplate,
  portfolioTemplate,
  realEstateTemplate,
  eventsTemplate,
];

export { clinicTemplate, eventsTemplate, portfolioTemplate, realEstateTemplate, restaurantTemplate };
