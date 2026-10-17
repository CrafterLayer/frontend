import type { BuilderDocument, NodeId } from '@craftkit/builder-schema';

/**
 * The checks that need no browser — the half of the quality gate that can run
 * on a document, in milliseconds, anywhere.
 *
 * ## Why they live here and not in the playground
 *
 * Because they run in TWO places and must be ONE implementation. The playground
 * runs them against a draft before a commit is allowed; CI runs them over
 * generated documents with fixed seeds. Two copies would drift, and the day
 * they drifted the runtime gate would pass something CI had already refused —
 * or, worse, refuse something CI had signed off, with no way to tell which was
 * right.
 *
 * The other half — overflow and overlap — genuinely needs layout, so it lives
 * in the playground behind a hidden iframe. That split is the whole design: a
 * check goes here if a document can answer it, and there if only a browser can.
 *
 * ## What "deterministic" buys
 *
 * Every issue below is decidable from the bytes. No model is asked, nothing is
 * sampled, and the same document always produces the same list — which is what
 * makes it safe to BLOCK a commit on. A judgement call ("is this copy good?")
 * would not be, and none is made here.
 */

/**
 * Every check in the gate — BOTH halves.
 *
 * `overflow` and `overlap` are named here even though nothing in this file can
 * produce them: they are measured in a browser, in the playground. The union
 * lives with the issue type because a report mixes the two halves and a
 * consumer must be able to switch over all of it. Splitting the names would
 * mean two unions that must be kept in step by hand, and the day they drifted a
 * card would render a check it had never heard of.
 */
export type QualityCheck =
  | 'contrast'
  | 'heading-order'
  | 'internal-link'
  | 'duplicate-id'
  | 'empty-section'
  | 'placeholder-text'
  | 'direction'
  /* Measured with layout, in the playground — never by this module. */
  | 'overflow'
  | 'overlap'
  /*
    SEO (seo-agent, 2026-09-30): produced by `checkSeo` in ../seo, never by
    `checkDocumentQuality`. ADVISORY: `blocks()` ignores every `seo-*` check
    whatever its severity, because a page with a long title still works.
  */
  | 'seo-title'
  | 'seo-description'
  | 'seo-h1'
  | 'seo-img-alt'
  | 'seo-img-size'
  | 'seo-lcp'
  | 'seo-link-text'
  | 'seo-section-label'
  | 'seo-lang-dir'
  | 'seo-canonical'
  | 'seo-hreflang'
  | 'seo-jsonld'
  | 'seo-noindex-home'
  | 'seo-orphan';

/** Whether a check is one of the advisory SEO checks (`seo-*`). */
export function isSeoCheck(check: QualityCheck): boolean {
  return check.startsWith('seo-');
}

/**
 * `error` blocks a commit; `warning` is reported and does not.
 *
 * The line is drawn at "would a person call this broken". A heading level
 * skipped is broken for anyone navigating by headings. Placeholder copy left in
 * is embarrassing but the page works, so it warns — and a build that warned on
 * everything would teach people to ignore the report.
 */
export type QualitySeverity = 'error' | 'warning';

export interface QualityIssue {
  readonly check: QualityCheck;
  readonly severity: QualitySeverity;
  /** The block this is about, when it is about one. */
  readonly nodeId?: NodeId;
  /** Where inside that block's tree, as a path of child indices. */
  readonly path?: readonly number[];
  /** One sentence naming the thing and what to do. Never a code. */
  readonly message: string;
}

/** A node of a stored custom-code tree, read tolerantly. */
interface TreeNode {
  readonly kind?: unknown;
  readonly tag?: unknown;
  readonly text?: unknown;
  readonly children?: unknown;
  readonly attributes?: unknown;
}

function asRecord(value: unknown): TreeNode | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value;
}

function childrenOf(node: TreeNode): unknown[] {
  return Array.isArray(node.children) ? node.children : [];
}

function attribute(node: TreeNode, name: string): string | undefined {
  const attributes = asRecord(node.attributes);
  const value = attributes?.[name as keyof TreeNode];
  return typeof value === 'string' ? value : undefined;
}

const HEADING_LEVEL: Readonly<Record<string, number>> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

/**
 * Copy nobody meant to ship.
 *
 * Latin lorem, the English fillers a model reaches for when it has nothing to
 * say, and their Arabic equivalents — the panel's default locale is Arabic and
 * a check that only knew English would pass the exact page it exists to catch.
 */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /lorem\s+ipsum/iu,
  /\bdolor\s+sit\s+amet\b/iu,
  /\blipsum\b/iu,
  /\bplaceholder\b/iu,
  /\bTODO\b/u,
  /\bTBD\b/u,
  /\bcoming\s+soon\b/iu,
  /\byour\s+(?:text|content|headline|copy)\s+here\b/iu,
  /\bsection\s+title\b/iu,
  /نصّ?\s+تجريبي/u,
  /هنا\s+نصّ?ك/u,
  /عنوان\s+القسم/u,
  /قريبًا|قريباً/u,
];

/** Walk every element of every custom-code tree in the document, in order. */
function walkTrees(
  document: BuilderDocument,
  visit: (nodeId: NodeId, node: TreeNode, path: readonly number[]) => void,
): void {
  const seen = new Set<NodeId>();
  const order: NodeId[] = [];
  const collect = (id: NodeId): void => {
    if (seen.has(id)) return;
    seen.add(id);
    order.push(id);
    const slots = document.nodes[id]?.slots;
    if (slots === undefined) return;
    for (const children of Object.values(slots)) {
      for (const child of children) collect(child);
    }
  };
  collect(document.rootId);
  /* Anything the walk did not reach is still in the document, and a check that
     ignored it would pass a page with an unreachable broken region on it. */
  for (const id of Object.keys(document.nodes)) collect(id);

  for (const nodeId of order) {
    const tree = asRecord(document.nodes[nodeId]?.props['tree']);
    if (tree === undefined) continue;
    const descend = (node: TreeNode, path: readonly number[]): void => {
      visit(nodeId, node, path);
      childrenOf(node).forEach((child, index) => {
        const record = asRecord(child);
        if (record !== undefined) descend(record, [...path, index]);
      });
    };
    descend(tree, []);
  }
}

export interface CheckDocumentOptions {
  /**
   * Ids a link may point at even though no element declares them.
   *
   * A page is not always alone: a header rendered from a shared region, or a
   * target on another page, is a real destination this document cannot see. The
   * caller knows; this file must not guess, and must not silently pass every
   * dangling link because SOME of them might be legitimate.
   */
  readonly knownAnchors?: readonly string[];
}

/**
 * Every deterministic issue in a document, in reading order.
 *
 * Reading order matters: a person fixing a page works down it, and a list
 * sorted by check type would send them up and down the page seven times.
 */
export function checkDocumentQuality(
  document: BuilderDocument,
  options: CheckDocumentOptions = {},
): readonly QualityIssue[] {
  const issues: QualityIssue[] = [];

  /* ---- collected in one walk, judged after ---------------------------- */
  const declaredIds = new Map<string, number>();
  const links: { nodeId: NodeId; path: readonly number[]; href: string }[] = [];
  let lastHeading = 0;

  walkTrees(document, (nodeId, node, path) => {
    const tag = typeof node.tag === 'string' ? node.tag : undefined;

    const id = attribute(node, 'id');
    if (id !== undefined && id !== '') {
      declaredIds.set(id, (declaredIds.get(id) ?? 0) + 1);
    }

    const href = attribute(node, 'href');
    if (href?.startsWith('#') === true) {
      links.push({ nodeId, path, href });
    }

    const level = tag === undefined ? undefined : HEADING_LEVEL[tag];
    if (level !== undefined) {
      /*
        A LEVEL SKIPPED, not a level repeated. Two `h2`s in a row are a page
        with two sections; an `h2` followed by an `h4` is a page whose outline
        has a hole in it, and a screen reader navigating by heading falls
        straight through it.
      */
      if (lastHeading !== 0 && level > lastHeading + 1) {
        issues.push({
          check: 'heading-order',
          severity: 'error',
          nodeId,
          path,
          message: `A heading jumps from h${String(lastHeading)} to h${String(level)}; use h${String(lastHeading + 1)} so the outline has no hole in it.`,
        });
      }
      lastHeading = level;
    }

    const text = typeof node.text === 'string' ? node.text : '';
    const placeholder = PLACEHOLDER_PATTERNS.find((pattern) => pattern.test(text));
    if (placeholder !== undefined) {
      issues.push({
        check: 'placeholder-text',
        severity: 'warning',
        nodeId,
        path,
        message: `This still reads as placeholder copy: "${text.trim().slice(0, 60)}".`,
      });
    }
  });

  /* ---- duplicate ids ---------------------------------------------------- */
  for (const [id, count] of declaredIds) {
    if (count < 2) continue;
    issues.push({
      check: 'duplicate-id',
      severity: 'error',
      message: `The id "${id}" is used ${String(count)} times; a link to it reaches only the first.`,
    });
  }

  /* ---- internal links --------------------------------------------------- */
  const known = new Set(options.knownAnchors ?? []);
  for (const link of links) {
    const target = link.href.slice(1);
    if (target === '') continue;
    if (declaredIds.has(target) || known.has(target)) continue;
    issues.push({
      check: 'internal-link',
      severity: 'error',
      nodeId: link.nodeId,
      path: link.path,
      message: `"${link.href}" points at nothing on this page.`,
    });
  }

  /* ---- empty sections --------------------------------------------------- */
  for (const [nodeId, node] of Object.entries(document.nodes)) {
    const tree = asRecord(node.props['tree']);
    if (tree === undefined) continue;
    if (hasVisibleContent(tree)) continue;
    issues.push({
      check: 'empty-section',
      severity: 'error',
      nodeId,
      /*
        An empty region is the shell a build leaves when a fill never landed.
        It is an ERROR rather than a warning because it is not a flaw in the
        page — it is a section that was promised and is not there.
      */
      message: 'This section has a heading and nothing else; it was never written.',
    });
  }

  /* ---- direction -------------------------------------------------------- */
  if (document.dir === 'ltr' && readsAsArabic(document)) {
    issues.push({
      check: 'direction',
      severity: 'error',
      message: 'The page is written in Arabic but set to read left to right.',
    });
  }

  return issues;
}

/**
 * Does this tree say anything at all?
 *
 * A heading alone does not count, and that is the point: the scaffold's
 * placeholder is exactly a section wrapper and an `h2`. Text anywhere below a
 * heading, an image, or a referenced component all count as content.
 */
function hasVisibleContent(tree: TreeNode): boolean {
  let found = false;
  const visit = (node: TreeNode): void => {
    if (found) return;
    if (node.kind === 'component' || node.kind === 'icon') {
      found = true;
      return;
    }
    const tag = typeof node.tag === 'string' ? node.tag : '';
    if (tag === 'img') {
      found = true;
      return;
    }
    const text = typeof node.text === 'string' ? node.text.trim() : '';
    if (text !== '' && HEADING_LEVEL[tag] === undefined) {
      found = true;
      return;
    }
    for (const child of childrenOf(node)) {
      const record = asRecord(child);
      if (record !== undefined) visit(record);
    }
  };
  visit(tree);
  return found;
}

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿ]/u;
const LATIN_SCRIPT = /[A-Za-z]/u;

/**
 * Is this page WRITTEN in Arabic — not merely does it contain an Arabic word?
 *
 * The first version asked the cruder question, and it was wrong on the very
 * first real page it met: the playground's own English landing fixture carries
 * one Arabic string, and the check declared the whole page misconfigured. A
 * bilingual page, a quoted name, an Arabic font sample — all of them would have
 * fired it.
 *
 * So the rule is about the BULK. Count letters of each script across the
 * document's own text and ask which one a reader would say the page is in. A
 * page whose Arabic outweighs its Latin and is set to read left to right is
 * genuinely wrong; anything closer than that is a judgement call, and this
 * gate does not make judgement calls — it blocks commits.
 */
function readsAsArabic(document: BuilderDocument): boolean {
  let arabic = 0;
  let latin = 0;
  const count = (value: string): void => {
    for (const character of value) {
      if (ARABIC_SCRIPT.test(character)) arabic += 1;
      else if (LATIN_SCRIPT.test(character)) latin += 1;
    }
  };

  /*
    Only the words a READER sees. An earlier version counted every string in
    every prop, which meant tag names, `kind` discriminants and Tailwind class
    names — all Latin, all invisible — outweighed the Arabic copy on a page
    written entirely in Arabic. The check then passed the exact document it
    exists to catch.
  */
  walkTrees(document, (_nodeId, node) => {
    if (typeof node.text === 'string') count(node.text);
  });
  for (const node of Object.values(document.nodes)) {
    /* A block with a tree was counted above; counting its props too would count
       its class names. */
    if (asRecord(node.props['tree']) !== undefined) continue;
    for (const value of Object.values(node.props)) {
      if (typeof value === 'string') count(value);
    }
  }
  return arabic > latin;
}
