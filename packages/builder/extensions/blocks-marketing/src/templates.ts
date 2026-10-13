import type { DeclarativeExtensionManifest } from '@craftkit/builder-schema';

import { TEMPLATE_COMPOSITIONS } from './templates/index';

/**
 * Original, token-bound page templates built from the marketing pack, each in
 * English and in Arabic written for the market (agent-script DESIGN §B).
 * The compositions live one per file under `./templates/`; this manifest only
 * registers them. Every insert is detached by the kernel.
 *
 * This module is the package's `./templates` subpath, kept off the root entry
 * so a host can load it on demand (`loadMarketingTemplates()` in the root).
 */
export const marketingTemplates: DeclarativeExtensionManifest = {
  tier: 2,
  name: 'blocks-marketing-templates',
  version: '2.0.0',
  contributes: {
    compositions: TEMPLATE_COMPOSITIONS,
  },
};

export { marketingTemplateCatalog } from './templates/catalog';
export {
  TEMPLATE_COMPOSITIONS,
  TEMPLATE_DEFINITIONS,
  TEMPLATE_PHOTOS,
  type BilingualText,
  type MarketingTemplateCard,
  type TemplateCategory,
  type TemplateDefinition,
  type TemplateLang,
  type TemplatePhoto,
} from './templates/index';
