import { SEO_TOOLS } from '../../seo/tools';
import { SECTION_KIT_TOOLS } from '../../section-kit/tools';
import { STYLE_AGENT_TOOLS } from '../../style-tools';
import { BUILTIN_AGENT_TOOLS } from './builtin';
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
