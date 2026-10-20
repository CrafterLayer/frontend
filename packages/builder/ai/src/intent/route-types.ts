import type { IntentKind, IntentTarget } from './route-intent';

/** The three facts about a page the router reads (see `summarizeDocumentForIntent`). */
export interface IntentDocumentSummary {
  /** Nodes under the root, the root itself excluded. Zero is an empty page. */
  readonly nodeCount: number;
  /** Every node is an unfilled build placeholder: nothing a person would keep. */
  readonly placeholderOnly: boolean;
  /** The top-level sections' names, in page order. */
  readonly sectionLabels: readonly string[];
}

export interface RouteIntentInput {
  /** What the person typed, as typed. */
  readonly request: string;
  /**
   * The page the request is about. Absent means UNKNOWN, and unknown is read
   * as a page with content — the reading that never turns an edit into a build.
   */
  readonly document?: IntentDocumentSummary;
  /** Blocks the person pointed at (canvas selection or @mentions), the page root excluded. */
  readonly selection?: readonly string[];
}

export interface IntentRoute {
  readonly kind: IntentKind;
  /** 0–1: how explicitly the words asked for this. Below ~0.6, confirm before acting. */
  readonly confidence: number;
  /** Which rule decided, in words, for logs and tests. Not written for the person. */
  readonly reason: string;
  /** Present for a build or a section; absent for an edit or a question. */
  readonly target?: IntentTarget;
}
