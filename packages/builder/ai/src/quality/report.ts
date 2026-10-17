import type { BuilderDocument } from '@craftkit/builder-schema';

import { checkDocumentContrast } from './check-contrast';
import {
  checkDocumentQuality,
  isSeoCheck,
  type CheckDocumentOptions,
  type QualityIssue,
} from './check-document';

export interface QualityReport {
  readonly issues: readonly QualityIssue[];
  /** True when nothing here should stop a commit. */
  readonly passes: boolean;
}

/**
 * Every deterministic check, in one call.
 *
 * A caller that ran them individually would have to remember which ones exist,
 * and would silently stop running the next one somebody adds. This is the door.
 */
export function checkQuality(
  document: BuilderDocument,
  options: CheckDocumentOptions = {},
): QualityReport {
  const issues = [...checkDocumentQuality(document, options), ...checkDocumentContrast(document)];
  return { issues, passes: blocks(issues).length === 0 };
}

/**
 * The issues that stop a commit — errors only.
 *
 * Warnings are reported and do not block, deliberately. A gate that refused a
 * page for placeholder copy would be refusing a page that works, and a build
 * that refused everything would teach people to bypass it.
 */
export function blocks(issues: readonly QualityIssue[]): readonly QualityIssue[] {
  /* SEO issues are advisory whatever their severity: a page with a long title
     or an unlabelled section still works, and must still commit. */
  return issues.filter((issue) => issue.severity === 'error' && !isSeoCheck(issue.check));
}
