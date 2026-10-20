import { isRecord, unknownKeys } from '../tools/agent/shared';
import type { AgentToolParse } from '../tools/agent/types';
import { CHART_TYPES, type ChartType } from './data-chart';

export const REPORT_PRESENTATIONS = [
  'analytical',
  'executive',
  'financial',
  'operational',
  'comparison',
] as const;
export type ReportPresentation = (typeof REPORT_PRESENTATIONS)[number];

export interface ReportPageChart {
  readonly as: ChartType;
  /** Ordered source columns: the first labels rows, followed by the chart's numeric roles. */
  readonly columns?: readonly string[] | undefined;
  readonly title?: string | undefined;
}

export interface ReportPageOptions {
  readonly presentation?: ReportPresentation | undefined;
  readonly charts?: readonly ReportPageChart[] | undefined;
  readonly includeData?: boolean | undefined;
}

/** New options are additive; absent options retain the original analytical report. */
export function reportPageOptions(
  input: Record<string, unknown>,
): AgentToolParse<ReportPageOptions> {
  const presentation = input['presentation'];
  if (
    presentation !== undefined &&
    !REPORT_PRESENTATIONS.includes(presentation as ReportPresentation)
  )
    return { ok: false, error: `"presentation" is ${REPORT_PRESENTATIONS.join(' | ')}.` };
  const includeData = input['includeData'];
  if (includeData !== undefined && typeof includeData !== 'boolean')
    return { ok: false, error: '"includeData" must be true or false.' };
  const requested = input['charts'];
  if (requested !== undefined && (!Array.isArray(requested) || requested.length > 6))
    return { ok: false, error: '"charts" is a list of at most six chart selections.' };
  const charts: ReportPageChart[] = [];
  for (const [index, value] of ((requested as unknown[] | undefined) ?? []).entries()) {
    const at = `"charts[${String(index)}]"`;
    if (!isRecord(value) || unknownKeys(value, ['as', 'columns', 'title']).length > 0)
      return { ok: false, error: `${at} must be {as,columns?:[heading],title?}.` };
    const as = value['as'];
    if (!CHART_TYPES.includes(as as ChartType))
      return { ok: false, error: `${at}.as is ${CHART_TYPES.join(' | ')}.` };
    const columns = value['columns'];
    if (
      columns !== undefined &&
      (!Array.isArray(columns) ||
        columns.length < 1 ||
        columns.length > 7 ||
        !columns.every((column) => typeof column === 'string' && column.trim() !== ''))
    )
      return {
        ok: false,
        error: `${at}.columns must name 1 to 7 source headings in chart-role order.`,
      };
    const title = value['title'];
    if (
      title !== undefined &&
      (typeof title !== 'string' || title.trim() === '' || title.trim().length > 90)
    )
      return { ok: false, error: `${at}.title must be nonempty and at most 90 characters.` };
    charts.push({
      as: as as ChartType,
      ...(columns === undefined
        ? {}
        : { columns: (columns as string[]).map((name) => name.trim()) }),
      ...(title === undefined ? {} : { title: title.trim() }),
    });
  }
  return {
    ok: true,
    value: {
      ...(presentation === undefined ? {} : { presentation: presentation as ReportPresentation }),
      ...(includeData === undefined ? {} : { includeData }),
      ...(requested === undefined ? {} : { charts }),
    },
  };
}
