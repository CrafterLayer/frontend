import { SEO_TOOLS } from '../../seo/tools';
import { SECTION_KIT_TOOLS } from '../../section-kit/tools';
import { STYLE_AGENT_TOOLS } from '../../style-tools';
// media-motion (2026-10-06): media.add, motion.add
import { MEDIA_AGENT_TOOLS } from '../../media-tools';
// data (2026-10-12): data.show
import { DATA_AGENT_TOOLS } from '../../data-tools';
// i18n (2026-10-12): page.translate
import { I18N_AGENT_TOOLS } from '../../i18n-tools';
import { BUILTIN_AGENT_TOOLS } from './builtin';
// creative-power F (2026-10-12): scene.preset
import { scenePresetTool } from './builtin/scene-preset';
import type { AgentTool, AgentToolLane } from './types';

/**
 * Every agent tool, in catalog order: P1's own, then the section kit's
 * (`kit.section`, `kit.swap`, `kit.insert`) and SEO's (`seo.meta`,
 * `seo.business`, `seo.schema`, `seo.fix`). Names are unique (a test pins it).
 */
export const AGENT_TOOLS: readonly AgentTool[] = Object.freeze([
  ...BUILTIN_AGENT_TOOLS,
  ...(SECTION_KIT_TOOLS),
  ...(SEO_TOOLS),
  // style-manager DESIGN.md §D.3: element.*, style.*, palette.set, block.convert
  ...STYLE_AGENT_TOOLS,
  // media-motion (2026-10-06): DESIGN §F — media.add, motion.add
  ...MEDIA_AGENT_TOOLS,
  // data (2026-10-12): numbers as a chart or a table
  ...DATA_AGENT_TOOLS,
  // i18n (2026-10-12): a page in another language in one step
  ...I18N_AGENT_TOOLS,
  // creative-power F (2026-10-12): one of the 30 curated Pixi scenes, in one step
  scenePresetTool as AgentTool,
]);

const BY_NAME: ReadonlyMap<string, AgentTool> = new Map(AGENT_TOOLS.map((tool) => [tool.name, tool]));

/** The tool with this name, or undefined. */
export function agentTool(name: string): AgentTool | undefined {
  return BY_NAME.get(name);
}

/** The tools a lane lists, in catalog order. */
export function agentToolsForLane(lane: AgentToolLane): readonly AgentTool[] {
  return AGENT_TOOLS.filter((tool) => tool.lanes.includes(lane));
}
