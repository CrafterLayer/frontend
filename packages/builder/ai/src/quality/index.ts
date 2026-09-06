/*
  The quality gate's DOM-FREE half.

  One implementation, two callers: the playground runs these against a draft
  before a commit is allowed, and CI runs them over generated documents with
  fixed seeds. Two copies would drift, and the day they drifted the runtime gate
  would pass something CI had already refused — with no way to tell which was
  right.

  Overflow and overlap are NOT here. They need layout, so they live in the
  playground behind a hidden iframe at four widths. That is the whole split: a
  check belongs here if a document can answer it, and there if only a browser
  can.
*/

export {
  checkDocumentQuality,
  type CheckDocumentOptions,
  type QualityCheck,
  type QualityIssue,
  type QualitySeverity,
} from './check-document';
export { checkDocumentContrast } from './check-contrast';
export { briefTerms, measureBriefRelevance, type BriefRelevance } from './brief-relevance';
export { checkQuality, blocks, type QualityReport } from './report';
