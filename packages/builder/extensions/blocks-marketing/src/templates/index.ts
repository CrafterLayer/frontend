import type { CompositionDef } from '@craftkit/builder-schema';

import { agencyTemplate } from './agency';
import { saasTemplate } from './saas';
import { servicesTemplate } from './services';
import { storeTemplate } from './store';
import type { TemplateDefinition } from './types';
// templates-verticals additions
import { VERTICAL_DEFINITIONS } from './verticals';
// end templates-verticals additions

/*
  The template library (agent-script DESIGN §B.2). Every definition yields an
  English and an Arabic composition; the order here is the Library's order.
  The English ids are the historical ones (saas-launch, creative-agency,
  commerce-launch, professional-services); Arabic ids append `-ar`.
*/
export const TEMPLATE_DEFINITIONS: readonly TemplateDefinition[] = [
  saasTemplate,
  agencyTemplate,
  storeTemplate,
  servicesTemplate,
  // templates-verticals additions
  ...VERTICAL_DEFINITIONS,
  // end templates-verticals additions
];

// Each language's page declares its direction, so the agent is offered only the matching ones.
export const TEMPLATE_COMPOSITIONS: CompositionDef[] = TEMPLATE_DEFINITIONS.flatMap(
  (definition) => [
    { ...definition.build('en'), dir: 'ltr' as const },
    { ...definition.build('ar'), dir: 'rtl' as const },
  ],
);

export { agencyTemplate, saasTemplate, servicesTemplate, storeTemplate };
export { TEMPLATE_PHOTOS, TEMPLATE_PHOTOS_VERIFIED_AT, type TemplatePhoto } from './photos';
export type {
  BilingualText,
  MarketingTemplateCard,
  TemplateCategory,
  TemplateDefinition,
  TemplateLang,
} from './types';
export { TEMPLATE_LANGS } from './types';
