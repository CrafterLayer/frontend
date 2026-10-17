import type { TemplateDefinition } from '../types';
import { clinicTemplate } from './clinic';
import { educationTemplate } from './education';
import { eventsTemplate } from './events';
import { fitnessTemplate } from './fitness';
import { hotelTemplate } from './hotel';
import { lawFirmTemplate } from './law-firm';
import { nonprofitTemplate } from './nonprofit';
import { personalBrandTemplate } from './personal-brand';
import { portfolioTemplate } from './portfolio';
import { realEstateTemplate } from './real-estate';
import { restaurantTemplate } from './restaurant';

/*
  The vertical templates (agent-script DESIGN §B.3, package
  templates-verticals), each in English and Arabic: the first five, then the
  six sector templates (education, fitness, law firm, nonprofit, hotel and
  travel, personal brand). The order here is the Library's order after the
  core four; `../index.ts` spreads this list into TEMPLATE_DEFINITIONS, so the
  compositions and the catalog cards follow it.
*/
export const VERTICAL_DEFINITIONS: readonly TemplateDefinition[] = [
  restaurantTemplate,
  clinicTemplate,
  portfolioTemplate,
  realEstateTemplate,
  eventsTemplate,
  educationTemplate,
  fitnessTemplate,
  lawFirmTemplate,
  nonprofitTemplate,
  hotelTemplate,
  personalBrandTemplate,
];

export {
  clinicTemplate,
  educationTemplate,
  eventsTemplate,
  fitnessTemplate,
  hotelTemplate,
  lawFirmTemplate,
  nonprofitTemplate,
  personalBrandTemplate,
  portfolioTemplate,
  realEstateTemplate,
  restaurantTemplate,
};
