import { checkContrast, type BuilderDocument, type NodeId } from '@craftkit/builder-schema';

import type { QualityIssue } from './check-document';

/**
 * The contrast a page declares about ITSELF, before a browser is involved.
 *
 * ## What this can and cannot see
 *
 * It reads the literal colour pairs a page's own stylesheet sets on one
 * selector — `.ck-card { color: #6b7280; background: #f9fafb }` — and measures
 * them. That is a real class of failure and the commonest one an agent
 * produces: it picks two colours it likes and never computes the ratio.
 *
 * It cannot see inheritance, cascade, or a colour that arrives from a token at
 * render time. Those need layout, and layout needs a browser — which is the
 * playground's half of the gate, at four widths in a hidden iframe. This half
 * is the one that can run in CI over a generated document with no DOM at all,
 * and it is deliberately conservative: a pair it cannot resolve is not
 * reported, because a false failure that blocks a commit costs more than a
 * missed one that the runtime pass will catch anyway.
 */

/** One rule's colours, as written. */
interface Pair {
  readonly selector: string;
  readonly color: string;
  readonly background: string;
}

const HEX_OR_NAMED = /^(?:#[0-9a-f]{3,8}|[a-z]+)$/iu;

/**
 * Pull `color` and `background(-color)` out of each rule that sets BOTH.
 *
 * A rule setting only one is skipped, and that is not laziness: the other half
 * comes from the cascade, and guessing it — assuming white, assuming the
 * theme's surface — would produce confident numbers about a pairing that never
 * happens on the page.
 */
function pairsIn(css: string): readonly Pair[] {
  const pairs: Pair[] = [];
  const rule = /([^{}]+)\{([^{}]*)\}/gu;
  for (const match of css.matchAll(rule)) {
    const selector = (match[1] ?? '').trim();
    const body = match[2] ?? '';
    if (selector.startsWith('@')) continue;
    const color = declaration(body, 'color');
    const background = declaration(body, 'background-color') ?? declaration(body, 'background');
    if (color === undefined || background === undefined) continue;
    if (!HEX_OR_NAMED.test(color) || !HEX_OR_NAMED.test(background)) continue;
    pairs.push({ selector, color, background });
  }
  return pairs;
}

function declaration(body: string, property: string): string | undefined {
  /*
    Anchored to a declaration boundary so `background-color` is not matched by a
    search for `color`, and so `--brand-color` is not matched at all. Custom
    properties are deliberately out of scope: their value is resolved at render.
  */
  const pattern = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'iu');
  const value = pattern.exec(body)?.[1]?.trim();
  if (value === undefined) return undefined;
  /* A shorthand `background: #fff url(...)` is a colour plus other things; only
     the bare colour is safe to measure. */
  const first = value.split(/\s+/u)[0];
  return first === undefined || first === '' ? undefined : first;
}

/** Text this size is held to the lower ratio. Headings, in practice. */
const LARGE_TEXT = /\b(?:h1|h2|h3|display|title|hero|heading)\b/iu;

/**
 * Every measurable pairing on the page that does not clear its minimum.
 *
 * `page` first, then each region, so the report reads down the page like every
 * other check here.
 */
export function checkDocumentContrast(document: BuilderDocument): readonly QualityIssue[] {
  const issues: QualityIssue[] = [];

  const consider = (css: unknown, nodeId: NodeId | undefined): void => {
    if (typeof css !== 'string' || css.trim() === '') return;
    for (const pair of pairsIn(css)) {
      const size = LARGE_TEXT.test(pair.selector) ? 'large' : 'normal';
      const result = checkContrast(pair.color, pair.background, size);
      /*
        `undefined` means a colour this file cannot parse — a gradient, a
        function, a name the parser does not know. Not reported: a check that
        guessed would block commits on its own ignorance.
      */
      if (result === undefined || result.passes) continue;
      issues.push({
        check: 'contrast',
        severity: 'error',
        ...(nodeId === undefined ? {} : { nodeId }),
        message: `"${pair.selector}" puts ${pair.color} on ${pair.background} — ${result.ratio.toFixed(2)}:1, below the ${String(result.required)}:1 this text size needs.`,
      });
    }
  };

  const root = document.nodes[document.rootId];
  consider(root?.props['pageCss'], undefined);
  for (const [nodeId, node] of Object.entries(document.nodes)) {
    consider(node.props['css'], nodeId);
  }

  return issues;
}
