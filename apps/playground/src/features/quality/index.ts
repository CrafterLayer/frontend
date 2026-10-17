/*
  The quality gate, as the playground runs it.

  Two halves, one report. The DOM-free checks come from `@craftkit/builder` and
  are the SAME implementation CI runs; the layout checks are measured here,
  because only a browser can answer them.
*/

export {
  QUALITY_WIDTHS,
  measureLayout,
  type LayoutIssue,
  type QualityWidth,
} from './measure-layout';
export { runQualityGate, type GateOptions, type GateReport } from './gate';
export { GeneratedSites, type GeneratedSitesProps } from './GeneratedSites';
