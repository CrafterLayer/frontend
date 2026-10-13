import { PAGE_PLAN_PALETTE_HEX } from './palette';
import { accentTextInCss, tidyCssColours } from './tidy-css';
import {
  attributesOf,
  baseOf,
  classesOf,
  issuesOf,
  mapElements,
  nodeAt,
  nodesOf,
  rootOf,
  tagOf,
  treeIndices,
  updateAt,
  withAttribute,
  withClasses,
  withRoot,
  type JsonRecord,
  type TidyContext,
  type TidyFixer,
} from './tidy-shared';
import type { LandedSection, PagePlanTokens } from './types';

/*
  Code repairs on a written section's TREE and css (tidy-section.ts,
  2026-10-13): each one does exactly what the checker's own instruction says,
  where that instruction has one reading — "make this h1 an h2", "put
  id="menu" on the outer element", "make the page's action a link", "remove
  font-sans", "colour accent text with ck-accent-ink". Where the instruction
  leaves a choice (which photo, which words, where a missing button goes, a
  label or a link that disagree) nothing is touched: the writer decides in
  its repair round.
*/

const ESCAPE = /[.*+?^${}()|[\]\\]/gu;

function cssOf(section: LandedSection): string {
  return typeof section.css === 'string' ? section.css : '';
}

function jsOf(section: LandedSection): string {
  return typeof section.js === 'string' ? section.js : '';
}

function idOf(node: JsonRecord): string | undefined {
  const id = attributesOf(node)['id'];
  return typeof id === 'string' && id.trim() !== '' ? id : undefined;
}

/** The section's css or code names this id (`#menu .x`, `getElementById('menu')`). */
function codeNamesId(section: LandedSection, id: string): boolean {
  const escaped = id.replace(ESCAPE, '\\$&');
  return (
    new RegExp(`#${escaped}(?![\\w-])`, 'u').test(cssOf(section)) || jsOf(section).includes(id)
  );
}

/** The section's css or code reads elements by this tag (`.x h1{…}`, `querySelector('h1')`). */
function codeNamesTag(section: LandedSection, tag: string): boolean {
  const pattern = new RegExp(`(?<![\\w-])${tag}(?![\\w-])`, 'u');
  return pattern.test(cssOf(section).replace(/\{[^{}]*\}/gu, '{}')) || pattern.test(jsOf(section));
}

const ID_LISTS = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for', 'popovertarget'];

/** Every reference to `from` inside the tree (a `#from` link, an aria list) renamed to `to`. */
function renameReferences(root: JsonRecord, from: string, to: string): JsonRecord {
  return mapElements(root, (node) => {
    let next = node;
    const attributes = attributesOf(node);
    if (attributes['href'] === `#${from}`) next = withAttribute(next, 'href', `#${to}`);
    for (const name of ID_LISTS) {
      const value = attributes[name];
      if (typeof value !== 'string' || !value.split(/\s+/u).includes(from)) continue;
      next = withAttribute(
        next,
        name,
        value
          .split(/\s+/u)
          .map((part) => (part === from ? to : part))
          .join(' '),
      );
    }
    return next;
  });
}

// ── missing-anchor ────────────────────────────────────────────────────────────

/**
 * The outer element carries the section's own anchor (moved there from an
 * inner element, or in place of an id nothing else names); an inner element
 * drops another section's anchor; a link whose target differs from a real one
 * only by case, or names a section by its key, is respelled.
 */
function fixAnchors({ plan, contract, section, issues }: TidyContext): LandedSection | undefined {
  if (issuesOf(issues, 'missing-anchor').length === 0) return undefined;
  let root = rootOf(section);
  if (root === undefined) return undefined;
  const owners = new Map(plan.sections.map(({ anchorId, key }) => [anchorId, key] as const));
  const foreign = (id: string | undefined): boolean =>
    id !== undefined && owners.has(id) && owners.get(id) !== contract.key;
  const own = contract.anchorId;
  const outer = nodesOf(root).filter(
    ({ node, at }) => at.length === 1 && node['kind'] === 'element',
  );
  const first = outer[0];
  if (outer.length === 1 && first !== undefined && idOf(first.node) !== own) {
    const current = idOf(first.node);
    const held = nodesOf(root).some(({ node, at }) => at.length > 1 && idOf(node) === own);
    if (
      (current === undefined || !codeNamesId(section, current)) &&
      !(held && codeNamesId(section, own))
    ) {
      // An inner element holding the anchor gives it up: the outer element is where links land.
      root = mapElements(root, (node, at) =>
        at.length > 1 && idOf(node) === own ? withAttribute(node, 'id', undefined) : node,
      );
      root = updateAt(root, first.at, (node) => withAttribute(node, 'id', own));
      if (current !== undefined && !foreign(current)) root = renameReferences(root, current, own);
    }
  }
  const listed = new Set<string>();
  for (const { node } of nodesOf(root)) {
    for (const name of ID_LISTS) {
      const value = attributesOf(node)[name];
      if (typeof value === 'string') for (const id of value.split(/\s+/u)) listed.add(id);
    }
  }
  root = mapElements(root, (node, at) => {
    const id = idOf(node);
    if (at.length === 1 || id === undefined || !foreign(id)) return node;
    return listed.has(id) || codeNamesId(section, id) ? node : withAttribute(node, 'id', undefined);
  });
  const known = new Set<string>(owners.keys());
  for (const { node } of nodesOf(root)) {
    const id = idOf(node);
    if (id !== undefined) known.add(id);
  }
  const byKey = new Map(plan.sections.map(({ key, anchorId }) => [key, anchorId] as const));
  root = mapElements(root, (node) => {
    const href = attributesOf(node)['href'];
    if (typeof href !== 'string' || !href.startsWith('#')) return node;
    const target = href.slice(1);
    if (target === '' || known.has(target)) return node;
    const matches = [...known].filter((id) => id.toLowerCase() === target.toLowerCase());
    const respelled = matches.length === 1 ? matches[0] : byKey.get(target);
    return respelled === undefined ? node : withAttribute(node, 'href', `#${respelled}`);
  });
  return withRoot(section, root);
}

// ── heading-level ─────────────────────────────────────────────────────────────

const HEADING = /^h[1-6]$/u;

function retag(root: JsonRecord, at: readonly number[], tag: string): JsonRecord {
  return updateAt(root, at, (node) => ({ ...node, tag }));
}

/**
 * The page's one h1 is the hero's: another section's h1 becomes an h2, a
 * second h1 in the hero an h2, and a hero with no h1 heads with its first
 * heading when that is an h2. Not when the region's css or code reads
 * headings by tag: a retag would restyle them.
 */
function fixHeadings({ contract, section, issues }: TidyContext): LandedSection | undefined {
  if (issuesOf(issues, 'heading-level').length === 0) return undefined;
  if (codeNamesTag(section, 'h1') || codeNamesTag(section, 'h2')) return undefined;
  let root = rootOf(section);
  if (root === undefined) return undefined;
  const elements = nodesOf(root).filter(({ node }) => node['kind'] === 'element');
  const ones = elements.filter(({ node }) => tagOf(node) === 'h1');
  if (contract.role !== 'hero') {
    for (const { at } of ones) root = retag(root, at, 'h2');
  } else if (ones.length > 1) {
    for (const { at } of ones.slice(1)) root = retag(root, at, 'h2');
  } else if (ones.length === 0) {
    const first = elements.find(({ node }) => HEADING.test(tagOf(node)));
    if (first === undefined || tagOf(first.node) !== 'h2') return undefined;
    root = retag(root, first.at, 'h1');
  }
  return withRoot(section, root);
}

// ── cta-label ─────────────────────────────────────────────────────────────────

const DEAD_BUTTON = "Make the page's action a link";
const MISDIRECTED = "This link says the page's action";
/** What a button may carry and a link may not. */
const BUTTON_ONLY = new Set([
  'type',
  'disabled',
  'form',
  'formaction',
  'formmethod',
  'formtarget',
  'formnovalidate',
  'formenctype',
  'name',
  'value',
  'popovertarget',
  'popovertargetaction',
  'autofocus',
]);

/**
 * A link that says the page's action exactly leads to the action; a button
 * that carries the action (which can go nowhere) becomes the action's link,
 * its classes kept (`ck-btn` when it had none). A wrong label, or a hero with
 * no action, is the writer's: which words, and where, are choices.
 */
function fixAction({ plan, section, issues }: TidyContext): LandedSection | undefined {
  const misdirected = issuesOf(issues, 'cta-label', MISDIRECTED);
  const dead = issuesOf(issues, 'cta-label', DEAD_BUTTON);
  if (misdirected.length === 0 && dead.length === 0) return undefined;
  let root = rootOf(section);
  if (root === undefined) return undefined;
  const href = plan.primaryCta.href;
  for (const issue of misdirected) {
    const at = treeIndices(issue.path);
    const node = at === undefined ? undefined : nodeAt(root, at);
    if (at === undefined || node === undefined || tagOf(node) !== 'a') continue;
    root = updateAt(root, at, (link) => withAttribute(link, 'href', href));
  }
  if (!codeNamesTag(section, 'button')) {
    for (const issue of dead) {
      const at = treeIndices(issue.path);
      const node = at === undefined ? undefined : nodeAt(root, at);
      if (at === undefined || node === undefined || tagOf(node) !== 'button') continue;
      root = updateAt(root, at, (button) => {
        const attributes = Object.fromEntries(
          Object.entries(attributesOf(button)).filter(([name]) => !BUTTON_ONLY.has(name)),
        );
        const link = { ...button, tag: 'a', attributes: { ...attributes, href } };
        return classesOf(link).length === 0 ? withClasses(link, ['ck-btn']) : link;
      });
    }
  }
  return withRoot(section, root);
}

// ── contrast ──────────────────────────────────────────────────────────────────

const ACCENT_TEXT = 'Colour accent text with ck-accent-ink';
const LOW_PAIR = 'Text ';
const KIT_GROUNDS = new Set([
  'ck-ground',
  'ck-surface',
  'ck-card',
  'ck-inverse',
  'ck-accent-fill',
  'ck-btn',
]);
/** The kit class that paints each plan colour as a GROUND, with its own inks. */
const GROUND_CLASS: readonly (readonly [keyof PagePlanTokens, string])[] = [
  ['bg', 'ck-ground'],
  ['surface', 'ck-surface'],
  ['ink', 'ck-inverse'],
  ['accent', 'ck-accent-fill'],
];
/** The kit class that paints each plan colour as TEXT, re-pointed on every ground. */
const TEXT_CLASS: readonly (readonly [keyof PagePlanTokens, string])[] = [
  ['ink', 'ck-ink'],
  ['muted', 'ck-muted'],
  ['accentInk', 'ck-accent-ink'],
  ['accent', 'ck-accent-ink'],
];
const COLOUR_VALUE =
  /^(?:\[(?:color:)?(#[0-9a-f]{3,8})\]|([a-z]+-(?:50|[1-9]00|950)|white|black))$/iu;

/** The hex a plain `bg-`/`text-` colour utility paints with, when this table knows it. */
function utilityHex(name: string, property: 'bg' | 'text'): string | undefined {
  const { base, variants } = baseOf(name);
  if (variants || !base.startsWith(`${property}-`)) return undefined;
  const value = COLOUR_VALUE.exec(base.slice(property.length + 1));
  if (value === null) return undefined;
  const hex = value[1] ?? PAGE_PLAN_PALETTE_HEX[value[2] ?? ''];
  if (hex === undefined) return undefined;
  const body = hex.slice(1).toLowerCase();
  return body.length <= 4 ? `#${body.slice(0, 3).replace(/./gu, '$&$&')}` : `#${body.slice(0, 6)}`;
}

function tokenOf(
  hex: string,
  tokens: PagePlanTokens,
  table: readonly (readonly [keyof PagePlanTokens, string])[],
): string | undefined {
  return table.find(([token]) => (tokens[token] as string).toLowerCase() === hex)?.[1];
}

/** A plain text-colour utility (palette, white/black, an arbitrary colour), not a size like `text-lg`. */
function isTextColour(name: string): boolean {
  return utilityHex(name, 'text') !== undefined;
}

function groundOf(node: JsonRecord): 'kit' | 'utility' | undefined {
  const classes = classesOf(node);
  if (classes.some((name) => KIT_GROUNDS.has(name))) return 'kit';
  return classes.some((name) => utilityHex(name, 'bg') !== undefined) ? 'utility' : undefined;
}

/**
 * Text on a ground it does not read on takes the ground's own ink: the ground
 * painted with a plan colour becomes that colour's kit ground (the same
 * colour, with inks that read on it), and the text's own colour utilities
 * between the ground and the text become the kit's text roles (a plan colour)
 * or go (white, black, another colour) — "use the ground's own text colour".
 * Not when the ground holds a ground of its own, whose colours would move.
 */
function lowPair(
  root: JsonRecord,
  at: readonly number[],
  tokens: PagePlanTokens,
): JsonRecord | undefined {
  let ground: readonly number[] | undefined;
  for (let depth = at.length; depth >= 1; depth -= 1) {
    const node = nodeAt(root, at.slice(0, depth));
    if (node !== undefined && groundOf(node) !== undefined) {
      ground = at.slice(0, depth);
      break;
    }
  }
  const groundNode = ground === undefined ? undefined : nodeAt(root, ground);
  if (ground === undefined || groundNode === undefined) return undefined;
  let next = root;
  if (groundOf(groundNode) === 'utility') {
    const nested = nodesOf(groundNode).some(({ node }) =>
      classesOf(node).some((name) => KIT_GROUNDS.has(name) && name !== 'ck-btn'),
    );
    const swaps = classesOf(groundNode).map((name) => {
      const hex = utilityHex(name, 'bg');
      return hex === undefined ? name : (tokenOf(hex, tokens, GROUND_CLASS) ?? name);
    });
    if (!nested && swaps.some((name, index) => name !== classesOf(groundNode)[index])) {
      next = updateAt(next, ground, (node) => withClasses(node, [...new Set(swaps)]));
    }
  }
  for (let depth = ground.length; depth <= at.length; depth += 1) {
    next = updateAt(next, at.slice(0, depth), (node) => {
      const classes = classesOf(node);
      const kept = classes.flatMap((name) => {
        if (!isTextColour(name)) return [name];
        const role = tokenOf(utilityHex(name, 'text') ?? '', tokens, TEXT_CLASS);
        return role === undefined || classes.includes(role) ? [] : [role];
      });
      return kept.length === classes.length && kept.every((name, index) => name === classes[index])
        ? node
        : withClasses(node, kept);
    });
  }
  return next === root ? undefined : next;
}

function fixContrast({ plan, section, issues }: TidyContext): LandedSection | undefined {
  const accent = issuesOf(issues, 'contrast', ACCENT_TEXT);
  const pairs = issuesOf(issues, 'contrast', LOW_PAIR);
  if (accent.length === 0 && pairs.length === 0) return undefined;
  let root = rootOf(section);
  if (root === undefined) return undefined;
  let css = cssOf(section);
  for (const issue of accent) {
    const named = /, not (.+?): the accent /u.exec(issue.message)?.[1];
    if (named === undefined) continue;
    if (named.startsWith('the accent as a css color')) {
      css = accentTextInCss(css, plan.tokens);
      continue;
    }
    root = mapElements(root, (node) => {
      const classes = classesOf(node);
      if (!classes.includes(named)) return node;
      const swapped = classes.map((name) => (name === named ? 'ck-accent-ink' : name));
      return withClasses(node, [...new Set(swapped)]);
    });
  }
  for (const issue of pairs) {
    const at = treeIndices(issue.path);
    if (at === undefined || at.length === 0) continue;
    root = lowPair(root, at, plan.tokens) ?? root;
  }
  const next = withRoot(section, root);
  return css === cssOf(section) ? next : { ...next, css };
}

// ── raw-colour in the css, foreign-font, scene-height ─────────────────────────

/** Colour literals in the region css moved onto the page (tidy-css.ts); classes are tidied before. */
function fixCssColours({ plan, section, issues }: TidyContext): LandedSection | undefined {
  if (issuesOf(issues, 'raw-colour').length === 0) return undefined;
  const css = cssOf(section);
  const next = tidyCssColours(css, plan.tokens);
  return next === css ? undefined : { ...section, css: next };
}

const SITE_FACES = new Set(['font-sans', 'font-serif']);

/** "Remove font-sans": the site-face classes go; the page's faces are inherited. */
function fixSiteFaces({ section, issues }: TidyContext): LandedSection | undefined {
  if (issuesOf(issues, 'foreign-font', 'Remove ').length === 0) return undefined;
  const root = rootOf(section);
  if (root === undefined) return undefined;
  return withRoot(
    section,
    mapElements(root, (node) => {
      const classes = classesOf(node);
      const kept = classes.filter((name) => !SITE_FACES.has(baseOf(name).base));
      return kept.length === classes.length ? node : withClasses(node, kept);
    }),
  );
}

const STAGE = 'ck-scene';
/** The free-code card's LAYOUT rule, for a stage with nothing else in it. */
const EMPTY_STAGE_CSS = `.${STAGE}{width:100%;aspect-ratio:16/9;min-height:320px}`;
/** A region with content already has a height; it only needs a floor for the canvas. */
const FILLED_STAGE_CSS = `.${STAGE}{min-height:320px}`;

/**
 * A scene region with no height gets the one the free-code card teaches, on
 * its outer element: the canvas fills the region, and a region with none
 * draws nothing. A region with text keeps its own height and gains only the
 * floor, so nothing it shows can overflow.
 */
function fixStageHeight({ section, issues }: TidyContext): LandedSection | undefined {
  if (issuesOf(issues, 'scene-height', 'Give the region a height').length === 0) return undefined;
  const root = rootOf(section);
  if (root === undefined) return undefined;
  const outer = nodesOf(root).filter(
    ({ node, at }) => at.length === 1 && node['kind'] === 'element',
  );
  const first = outer[0];
  if (outer.length !== 1 || first === undefined) return undefined;
  const filled = nodesOf(root).some(
    ({ node }) => typeof node['text'] === 'string' && node['text'].trim() !== '',
  );
  const classes = classesOf(first.node);
  const next = classes.includes(STAGE)
    ? root
    : updateAt(root, first.at, (node) => withClasses(node, [...classes, STAGE]));
  const css = cssOf(section);
  const rule = filled ? FILLED_STAGE_CSS : EMPTY_STAGE_CSS;
  return { ...withRoot(section, next), css: css.trim() === '' ? rule : `${css}\n${rule}` };
}

/** The tree and css repairs, in the order the build runs them. */
export const TREE_FIXERS: readonly TidyFixer[] = Object.freeze([
  { name: 'missing-anchor', codes: ['missing-anchor'], fix: fixAnchors },
  { name: 'heading-level', codes: ['heading-level'], fix: fixHeadings },
  { name: 'cta-link', codes: ['cta-label'], fix: fixAction },
  { name: 'raw-colour-css', codes: ['raw-colour'], fix: fixCssColours },
  { name: 'contrast', codes: ['contrast'], fix: fixContrast },
  { name: 'site-faces', codes: ['foreign-font'], fix: fixSiteFaces },
  { name: 'scene-height', codes: ['scene-height'], fix: fixStageHeight },
]);
