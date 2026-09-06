import { blocks, checkQuality, type BuilderDocument, type QualityIssue } from '@craftkit/builder';

import {
  QUALITY_WIDTHS,
  measureLayout,
  type LayoutIssue,
  type QualityWidth,
} from './measure-layout';

export interface GateReport {
  readonly issues: readonly QualityIssue[];
  /** True when nothing here should stop a commit. */
  readonly passes: boolean;
  /** The widths that were actually measured. Empty when nothing rendered. */
  readonly measured: readonly QualityWidth[];
}

export interface GateOptions {
  /**
   * Render the document at a width and hand back the root it rendered into.
   *
   * Injected rather than built here, and that is the whole shape of this file.
   * Mounting an iframe, waiting for fonts, and knowing when layout has settled
   * are the caller's problems — they differ between the product, a story and a
   * test. What is shared, and what belongs here, is the ORDER: every width,
   * both halves, one report.
   *
   * Returning `undefined` for a width means it could not be rendered; that
   * width is reported as unmeasured rather than as passing.
   */
  readonly render: (
    document: BuilderDocument,
    width: QualityWidth,
  ) => Document | Element | undefined;
  readonly widths?: readonly QualityWidth[];
  /** Ids a link may point at that this document cannot see. */
  readonly knownAnchors?: readonly string[];
}

/**
 * Both halves of the gate, over one document.
 *
 * ## Why the same issue at four widths is four issues
 *
 * Because it is four facts. A heading that overflows only at 360 is a phone
 * problem; one that overflows at every width is a broken component. Collapsing
 * them would throw away the one piece of information that tells a person which
 * of those they have.
 *
 * ## Why an unmeasured width is not a passing width
 *
 * A gate that treated "could not render" as "nothing wrong" would go green
 * exactly when it stopped working. `measured` says which widths were actually
 * looked at, and a caller that cares can refuse to commit on a short list.
 */
export function runQualityGate(document: BuilderDocument, options: GateOptions): GateReport {
  const widths = options.widths ?? QUALITY_WIDTHS;

  const documentIssues = checkQuality(document, {
    ...(options.knownAnchors === undefined ? {} : { knownAnchors: options.knownAnchors }),
  }).issues;

  const measured: QualityWidth[] = [];
  const layoutIssues: LayoutIssue[] = [];
  for (const width of widths) {
    const rendered = options.render(document, width);
    if (rendered === undefined) continue;
    measured.push(width);
    layoutIssues.push(...measureLayout(rendered, width));
  }

  const issues = [...documentIssues, ...layoutIssues];
  return { issues, passes: blocks(issues).length === 0, measured };
}
