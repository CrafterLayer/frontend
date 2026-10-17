import type { IntentDocumentSummary, IntentKind, IntentRoute, IntentTarget } from './route-intent';

/*
  Confidence, as a small table rather than numbers scattered through the rules,
  so the ORDER of trust is readable in one place: a counted page ask beats a
  named one; a verb with its object beats a bare noun phrase; the same ask is
  surer on an empty page than over content it would sit beside.
*/
export const CONFIDENCE = {
  interrogative: 0.9,
  trailingQuestion: 0.75,
  greeting: 0.7,
  siteCounted: 0.9,
  siteNamed: 0.8,
  startOver: 0.85,
  /*
    Below the ~0.6 confirm line on purpose: "start over" with nothing about
    what replaces the page would wipe a page with content for a build that
    has to invent its own brief (wave-1 verifier, 2026-09-28).
  */
  startOverBare: 0.5,
  /*
    CEILINGS for a request shaped as a question (router-3, 2026-09-28). A
    suggestion ("how about adding a map?") names its change, so it is acted
    on — but as an idea weighed, never above 0.7. A capability question ("is
    it possible to change the font?") is asked of the product first, so it
    sits below the ~0.6 confirm line and the host asks "shall I?" before any
    write. Either one that would BUILD is answered in words instead.
  */
  suggestion: 0.7,
  capability: 0.5,
  /* A verbless phrase headed by a section: "a nav with links to home and blog". */
  partPhrase: 0.7,
  addSection: 0.85,
  newPage: 0.85,
  createOnEmpty: 0.9,
  createBeside: 0.75,
  phraseOnEmpty: 0.8,
  phraseBeside: 0.6,
  definiteOnEmpty: 0.7,
  briefOnEmpty: 0.6,
  editPointed: 0.85,
  editNamed: 0.85,
  editVerb: 0.8,
  editPointedOverBuild: 0.7,
  editDefinite: 0.5,
  editOnEmpty: 0.5,
  editDefault: 0.6,
  control: 0.4,
} as const;

type Canvas = 'empty' | 'placeholders' | 'content' | 'unknown';

export function canvasOf(document: IntentDocumentSummary | undefined): Canvas {
  if (document === undefined) return 'unknown';
  if (document.nodeCount <= 0) return 'empty';
  return document.placeholderOnly ? 'placeholders' : 'content';
}

/** Nothing on the page is worth keeping, so a build may own it. */
export function ownable(canvas: Canvas): boolean {
  return canvas === 'empty' || canvas === 'placeholders';
}

export function route(
  kind: IntentKind,
  confidence: number,
  reason: string,
  target?: IntentTarget,
): IntentRoute {
  return Object.freeze(
    target === undefined ? { kind, confidence, reason } : { kind, confidence, reason, target },
  );
}
