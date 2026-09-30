import { parseTreeMarkup, type MarkupTreeNode } from '../plan/tree-markup';

/**
 * A kit's markup, compiled once into a template tree, filled from slot
 * values, and read back from a filled tree.
 *
 * ## Why a tree template rather than string substitution
 *
 * Filling `{{title}}` into the markup STRING and parsing the result would
 * parse the person's words as markup: a title holding `<b>` or `&lt;` would
 * become an element or change its spelling. So the markup is parsed ONCE,
 * with its placeholders still in it, and the values are written into the
 * tree's `text` and attribute fields — which the renderer draws as text and
 * never parses. Nothing a slot holds can become a tag.
 *
 * ## The syntax
 *
 * - `{{title}}`, `{{cta.href}}`, `{{item.title}}` inside text or an attribute
 *   value. `item` is the current list item (the innermost one when lists nest).
 * - `{{#path}}…{{/path}}` around elements: a list slot repeats them once per
 *   item; any other slot keeps them only when it holds a value (an optional
 *   block). Read here as `<ck-each path='…'>`, which never reaches a tree.
 * - `data-kit-heading` marks the section's heading: `instantiateKit` gives it
 *   its id and level and strips the marker.
 */

export type TemplateNode =
  | {
      readonly kind: 'element';
      readonly tag: string;
      readonly className: string | undefined;
      readonly text: string | undefined;
      readonly attributes: Readonly<Record<string, string>>;
      readonly children: readonly TemplateNode[];
    }
  | {
      readonly kind: 'icon';
      readonly name: string;
      readonly className: string | undefined;
      readonly size: number | undefined;
      readonly strokeWidth: number | undefined;
      readonly label: string | undefined;
    }
  | {
      readonly kind: 'component';
      readonly component: string;
      readonly props: unknown;
      readonly children: readonly TemplateNode[];
    }
  | { readonly kind: 'each'; readonly path: string; readonly children: readonly TemplateNode[] };

export const HEADING_MARKER = 'data-kit-heading';
const EACH_TAG = 'ck-each';

export const PLACEHOLDER = /\{\{\s*([A-Za-z][\w]*(?:\.[A-Za-z][\w]*)*)\s*\}\}/gu;

/** Whether a string holds a `{{…}}` placeholder. */
export function hasPlaceholder(value: string): boolean {
  PLACEHOLDER.lastIndex = 0;
  const found = PLACEHOLDER.test(value);
  PLACEHOLDER.lastIndex = 0;
  return found;
}

/** Layout whitespace between tags and around placeholders, which the kits' multi-line markup carries. */
function compact(markup: string): string {
  return markup
    .replace(/>\s+</gu, '><')
    .replace(/>\s+\{\{/gu, '>{{')
    .replace(/\}\}\s+</gu, '}}<')
    .replace(/\}\}\s+\{\{(?=[#/^])/gu, '}}{{')
    .trim();
}

/*
  `{{^path}}…{{/path}}` is the inverse block (mustache's): kept only when the
  slot is EMPTY — the initials a team card shows when it has no photo.
*/
function toSections(markup: string): string {
  return markup
    .replace(/\{\{#\s*([\w.]+)\s*\}\}/gu, `<${EACH_TAG} path='$1'>`)
    .replace(/\{\{\^\s*([\w.]+)\s*\}\}/gu, `<${EACH_TAG} path='!$1'>`)
    .replace(/\{\{\/\s*([\w.]+)\s*\}\}/gu, `</${EACH_TAG}>`);
}

function fromMarkupNode(node: MarkupTreeNode): TemplateNode {
  if (node.kind === 'icon') {
    return {
      kind: 'icon',
      name: typeof node['name'] === 'string' ? node['name'] : '',
      className: typeof node['className'] === 'string' ? node['className'] : undefined,
      size: typeof node['size'] === 'number' ? node['size'] : undefined,
      strokeWidth: typeof node['strokeWidth'] === 'number' ? node['strokeWidth'] : undefined,
      label: typeof node['label'] === 'string' ? node['label'] : undefined,
    };
  }
  const children = Array.isArray(node['children'])
    ? (node['children'] as MarkupTreeNode[]).map(fromMarkupNode)
    : [];
  if (node.kind === 'component') {
    return {
      kind: 'component',
      component: typeof node['component'] === 'string' ? node['component'] : '',
      props: node['props'],
      children,
    };
  }
  const attributes = (node['attributes'] ?? {}) as Record<string, string>;
  if (node['tag'] === EACH_TAG) {
    if (typeof node['text'] === 'string' && node['text'].trim() !== '') {
      throw new Error(`A {{#${attributes['path'] ?? ''}}} block holds elements, not bare text.`);
    }
    return { kind: 'each', path: attributes['path'] ?? '', children };
  }
  return {
    kind: 'element',
    tag: typeof node['tag'] === 'string' ? node['tag'] : 'div',
    className: typeof node['className'] === 'string' ? node['className'] : undefined,
    text: typeof node['text'] === 'string' ? node['text'] : undefined,
    attributes,
    children,
  };
}

const compiled = new Map<string, readonly TemplateNode[]>();

/** A kit's markup as a template tree (cached by markup). Throws on a malformed template. */
export function compileKitMarkup(markup: string): readonly TemplateNode[] {
  const cached = compiled.get(markup);
  if (cached !== undefined) return cached;
  const root = parseTreeMarkup(toSections(compact(markup)));
  const nodes = Object.freeze(root.children.map(fromMarkupNode));
  compiled.set(markup, nodes);
  return nodes;
}

// ── Scopes ────────────────────────────────────────────────────────────────────

/** The slot values, and the list items entered on the way down (innermost last). */
export interface TemplateScope {
  readonly root: Readonly<Record<string, unknown>>;
  readonly items: readonly Readonly<Record<string, unknown>>[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The value a placeholder path names in a scope, or undefined. */
export function resolvePath(path: string, scope: TemplateScope): unknown {
  const segments = path.split('.');
  let value: unknown;
  if (segments[0] === 'item') {
    value = scope.items[scope.items.length - 1];
    segments.shift();
  } else {
    value = scope.root;
  }
  for (const segment of segments) {
    if (!isRecord(value)) return undefined;
    value = value[segment];
  }
  return value;
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** A template string with every placeholder filled; `filled` says whether it had any. */
export function fillString(template: string, scope: TemplateScope): { value: string; filled: boolean } {
  let filled = false;
  const value = template.replace(PLACEHOLDER, (_match, path: string) => {
    filled = true;
    return asText(resolvePath(path, scope));
  });
  return { value, filled };
}

/** Whether an optional block's slot holds something to show. */
export function isPresent(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.values(value).some(isPresent);
  return true;
}

// ── Filling ───────────────────────────────────────────────────────────────────

export interface FilledElement {
  kind: 'element';
  tag: string;
  className?: string;
  text?: string;
  attributes?: Record<string, string>;
  children?: FilledNode[];
}

export interface FilledIcon {
  kind: 'icon';
  name: string;
  className?: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export interface FilledComponent {
  kind: 'component';
  component: string;
  props?: unknown;
  children?: FilledNode[];
}

export type FilledNode = FilledElement | FilledIcon | FilledComponent;

/** Fills a template's nodes from a scope. Lists are expected already cut to their `max`. */
export function fillNodes(nodes: readonly TemplateNode[], scope: TemplateScope): FilledNode[] {
  const out: FilledNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'each') {
      if (node.path.startsWith('!')) {
        if (!isPresent(resolvePath(node.path.slice(1), scope))) {
          out.push(...fillNodes(node.children, scope));
        }
        continue;
      }
      const value = resolvePath(node.path, scope);
      if (Array.isArray(value)) {
        for (const item of value) {
          const frame = isRecord(item) ? item : {};
          out.push(...fillNodes(node.children, { root: scope.root, items: [...scope.items, frame] }));
        }
      } else if (isPresent(value)) {
        out.push(...fillNodes(node.children, scope));
      }
      continue;
    }
    if (node.kind === 'icon') {
      const name = fillString(node.name, scope).value.trim();
      if (name === '') continue;
      const icon: FilledIcon = { kind: 'icon', name };
      if (node.className !== undefined) icon.className = node.className;
      if (node.size !== undefined) icon.size = node.size;
      if (node.strokeWidth !== undefined) icon.strokeWidth = node.strokeWidth;
      if (node.label !== undefined) {
        const label = fillString(node.label, scope).value.trim();
        if (label !== '') icon.label = label;
      }
      out.push(icon);
      continue;
    }
    if (node.kind === 'component') {
      const component: FilledComponent = { kind: 'component', component: node.component };
      if (node.props !== undefined) component.props = node.props;
      const children = fillNodes(node.children, scope);
      if (children.length > 0) component.children = children;
      out.push(component);
      continue;
    }
    const element: FilledElement = { kind: 'element', tag: node.tag };
    if (node.className !== undefined) element.className = node.className;
    const attributes: Record<string, string> = {};
    for (const [name, raw] of Object.entries(node.attributes)) {
      const { value, filled } = fillString(raw, scope);
      if (filled && value.trim() === '') continue;
      attributes[name] = value;
    }
    if (Object.keys(attributes).length > 0) element.attributes = attributes;
    let textWasSlot = false;
    if (node.text !== undefined) {
      const { value, filled } = fillString(node.text, scope);
      textWasSlot = filled;
      if (!(filled && value.trim() === '')) element.text = value;
    }
    const children = fillNodes(node.children, scope);
    if (children.length > 0) element.children = children;
    // A text-only element whose slot came out empty would be an empty box: dropped.
    if (textWasSlot && element.text === undefined && children.length === 0) continue;
    out.push(element);
  }
  return out;
}

// ── Reading back ─────────────────────────────────────────────────────────────

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** The placeholder values a filled string holds, or undefined when it does not fit the template. */
export function captureString(
  template: string,
  actual: string,
): readonly { readonly path: string; readonly value: string }[] | undefined {
  const paths: string[] = [];
  let pattern = '';
  let last = 0;
  PLACEHOLDER.lastIndex = 0;
  for (const match of template.matchAll(PLACEHOLDER)) {
    pattern += escapeRegExp(template.slice(last, match.index));
    pattern += '([\\s\\S]*?)';
    paths.push(match[1] ?? '');
    last = match.index + match[0].length;
  }
  pattern += escapeRegExp(template.slice(last));
  const found = new RegExp(`^${pattern}$`, 'u').exec(actual);
  if (found === null) return undefined;
  return paths.map((path, index) => ({ path, value: found[index + 1] ?? '' }));
}
