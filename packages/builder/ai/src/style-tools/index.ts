import type { AgentTool } from '../tools/agent/types';
import { blockConvertTool } from './block-convert';
import { elementAnimateTool } from './element-animate';
import { elementAttrTool, elementEffectTool } from './element-attr';
import { elementInsertTool } from './element-insert';
import { elementStyleTool } from './element-style';
import {
  elementDuplicateTool,
  elementMoveTool,
  elementRemoveTool,
  elementWrapTool,
} from './element-structure';
import { paletteSetTool, styleApplyTool, styleDefineTool } from './library-tools';
// P7-agent-part-tools additions (block-parts DESIGN §2.12)
import { partImageTool, partLinkTool, partListTool, partStyleTool, partTextTool } from './part-tools';
// end P7-agent-part-tools additions

/**
 * The agent's "build and edit anything" tools (style-manager DESIGN.md §D.3):
 * every element edit the style panel can make, by name, through the same P1
 * engine and the same tree / library commands — so the agent and the panel
 * read and write one vocabulary, and every change is one labelled Undo.
 *
 * Registration (P11, after messaging the colour-target agent, because
 * tools/* is theirs) is ONE line in tools/agent/registry.ts:
 *
 *   ...STYLE_AGENT_TOOLS,            // import { STYLE_AGENT_TOOLS } from '../../style-tools';
 *
 * and, so a later tool in the same plan reads the trees an earlier tree
 * command left, ONE line in expand.ts `remember(step)` (see tree-steps.ts):
 *
 *   for (const [id, tree] of treeWritesOf(step, (id) => readProp(id, 'tree'))) written.set(slot(id, 'tree'), tree);
 *
 * Library tools (style.define, palette.set) emit SITE commands
 * (setNamedStyle, setPaletteColor); validate-plan looks commands up in the
 * page registry, so the plan door must also accept `isSiteCommandName`
 * steps when the kernel is a site page lens (P11).
 */
export const STYLE_AGENT_TOOLS: readonly AgentTool[] = Object.freeze([
  elementStyleTool,
  elementAnimateTool,
  elementInsertTool,
  elementRemoveTool,
  elementMoveTool,
  elementDuplicateTool,
  elementWrapTool,
  elementAttrTool,
  elementEffectTool,
  styleDefineTool,
  styleApplyTool,
  paletteSetTool,
  blockConvertTool,
  // P7-agent-part-tools additions: the parts of registered blocks (block-parts DESIGN §2.12)
  partTextTool,
  partStyleTool,
  partLinkTool,
  partImageTool,
  partListTool,
  // end P7-agent-part-tools additions
] as readonly AgentTool[]);

export {
  blockConvertTool,
  elementAnimateTool,
  elementAttrTool,
  elementDuplicateTool,
  elementEffectTool,
  elementInsertTool,
  elementMoveTool,
  elementRemoveTool,
  elementStyleTool,
  elementWrapTool,
  paletteSetTool,
  styleApplyTool,
  styleDefineTool,
};
export { libraryIdFor } from './library-ids';
// P7-agent-part-tools additions
export {
  blockDisplayName,
  matchPartNames,
  partBlockOf,
  partBlocks,
  partInstanceText,
  partWordKey,
  resolvePartAddress,
  resolvePartName,
  type PartAddressInput,
  type PartBlock,
  type ResolvedPart,
} from './part-address';
export {
  chainPartPlans,
  PART_AGENT_TOOLS,
  partImageTool,
  partLinkTool,
  partListTool,
  partStyleTool,
  partTextTool,
  richTextFromPlain,
  safePartHref,
} from './part-tools';
// end P7-agent-part-tools additions
export { clampToSrgb, oklchRamp, oklchToHex, parseColour, RAMP_STEPS, type Oklch, type RampStep } from './oklch';
export { liveToolContext, runStyleTool, type StyleToolResult } from './run-direct';
export { readStyleValue } from './style-value';
export {
  applyTreeStep,
  isTreeCommand,
  simulateTreeSteps,
  TREE_COMMANDS,
  treeDoorProblem,
  treeWritesOf,
  type TreeCommand,
} from './tree-steps';
