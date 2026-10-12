import type { AgentTool } from '../tools/agent/types';
import { dataShowTool } from './data-show';
import { reportBuildTool } from './report-build';

/**
 * The data agent tools (2026-10-12): `data.show` puts rows of numbers on the page as a chart or a
 * table; `report.build` puts them on the page as a whole report (KPI cards, a chart and the
 * table). Registered in tools/agent/registry.ts after MEDIA_AGENT_TOOLS.
 */
export const DATA_AGENT_TOOLS: readonly AgentTool[] = Object.freeze([
  dataShowTool,
  reportBuildTool,
] as readonly AgentTool[]);

export { CHART_TYPES, type ChartType } from './data-chart';
export { DATA_SHOW_AS, dataShowTool, type DataShowAs, type DataShowInput } from './data-show';
export {
  REPORT_AS,
  REPORT_CHART_TYPES,
  reportBuildTool,
  type ReportAs,
  type ReportBuildInput,
} from './report-build';
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
