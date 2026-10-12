import type { AgentTool } from '../tools/agent/types';
import { dataShowTool } from './data-show';

/**
 * The data agent tools (2026-10-12): `data.show` puts rows of numbers on the page as a chart or a
 * table. Registered in tools/agent/registry.ts after MEDIA_AGENT_TOOLS.
 */
export const DATA_AGENT_TOOLS: readonly AgentTool[] = Object.freeze([
  dataShowTool,
] as readonly AgentTool[]);

export { DATA_SHOW_AS, dataShowTool, type DataShowAs, type DataShowInput } from './data-show';
export {
  isNumericColumn,
  isTimeLabel,
  isTimeline,
  normalizeDigits,
  readDataRows,
  readDataText,
  readNumber,
  type DataAlign,
  type DataGrid,
  type DataGridRead,
  type DataNumber,
} from './data-text';
