import type { AgentTool } from '../tools/agent/types';
import { pageTranslateTool } from './page-translate';

/**
 * The language agent tools (2026-10-12): `page.translate` puts a page in another language in one
 * step. Registered in tools/agent/registry.ts after DATA_AGENT_TOOLS.
 */
export const I18N_AGENT_TOOLS: readonly AgentTool[] = Object.freeze([
  pageTranslateTool,
] as readonly AgentTool[]);

export { languageIntent, type LanguageIntent, type LanguageIntentAction } from './language-intent';
export {
  foldWord,
  isLanguageTag,
  languageDirection,
  siteLanguage,
  SITE_LANGUAGES,
  type SiteLanguage,
} from './languages';
export {
  languageSwitcher,
  languageSwitcherSteps,
  relinkSteps,
  versionAddress,
  type LanguageLink,
} from './language-pages';
export {
  languageSetSteps,
  pageContext,
  type LanguageSetMember,
  type LanguageSetPage,
} from './language-set';
export { pageTexts } from './page-texts';
export { pageTranslateTool, type PageTranslateInput } from './page-translate';
