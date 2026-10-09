import { TEMPLATE_DEFINITIONS } from './index';
import type { MarketingTemplateCard } from './types';
// templates-verticals additions
// end templates-verticals additions

/*
  The Library's template cards (agent-script DESIGN §B.2, §B.5): one card per
  composition, built from the same definitions as the compositions, so a card
  can never name a template that does not exist. The shell renders these as
  `TemplateCardInfo` (structurally equal; the shell never imports this file).
*/
export type { MarketingTemplateCard } from './types';

export const marketingTemplateCatalog: readonly MarketingTemplateCard[] = [
  ...TEMPLATE_DEFINITIONS.flatMap((definition) => [definition.card('en'), definition.card('ar')]),
  // templates-verticals additions
  // The five verticals' ten cards arrive through TEMPLATE_DEFINITIONS above
  // (index.ts spreads VERTICAL_DEFINITIONS); listing them here would duplicate them.
  // end templates-verticals additions
];
