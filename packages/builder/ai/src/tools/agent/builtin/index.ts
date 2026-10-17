import type { AgentTool } from '../types';
import { behaviorAttachTool } from './behavior-attach';
import { copySetTool } from './copy-set';
import { directionSetTool } from './direction-set';
import { fontsSetTool } from './fonts-set';
import { iconSetTool } from './icon-set';
import { imageSetTool } from './image-set';
import { navPagesTool } from './nav-pages';
import { navSyncTool } from './nav-sync';
import { sectionOpsTool } from './section-ops';
import { themeApplyTool } from './theme-apply';

/** The tools P1 owns (DESIGN.md §A.2, rows 4–12). */
export const BUILTIN_AGENT_TOOLS: readonly AgentTool[] = Object.freeze([
  themeApplyTool,
  fontsSetTool,
  copySetTool,
  directionSetTool,
  imageSetTool,
  iconSetTool,
  sectionOpsTool,
  navSyncTool,
  // T230b (2026-10-12): a built site's pages, linked from every page's menus.
  navPagesTool,
  behaviorAttachTool,
] as readonly AgentTool[]);

export {
  behaviorAttachTool,
  copySetTool,
  directionSetTool,
  fontsSetTool,
  iconSetTool,
  imageSetTool,
  navPagesTool,
  navSyncTool,
  sectionOpsTool,
  themeApplyTool,
};
