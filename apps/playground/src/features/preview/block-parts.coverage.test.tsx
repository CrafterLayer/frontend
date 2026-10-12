import { render } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import type {
  BlockRenderProps,
  BlockSchema,
  Node,
  TrustedExtensionManifest,
} from '@craftkit/builder';

import { playgroundExtensions } from './create-playground-kernel';

/**
 * THE BLOCK-PARTS COVERAGE GATE (block-parts DESIGN §2.9).
 *
 * The owner's request: every inner element of every registered block is
 * selectable and editable on the canvas. This gate checks it mechanically for
 * every block the playground registers, over its defaults and every example:
 *
 * 1. Sentinel render (canvas): each free string leaf is replaced by a unique
 *    sentinel; every TEXT node showing one must sit inside an element whose
 *    `data-ck-bind` is that leaf's path, owned by this block. A sentinel seen
 *    only in attributes is allowed (a11y-only props, audit §6).
 * 2. Swap render: each text/rich/link bind is replaced by a React element, as
 *    the inline editor does. No throw, no `[object Object]` in any attribute,
 *    and each swapped element renders exactly once.
 * 3. Published render: no `data-ck-part`, `data-ck-part-index`, `data-ck-bind`.
 * 4. Part styles: `partStyles[name] = { className: 'ps-4', dir: 'ltr' }` lands
 *    on exactly that part's elements, and every declared part renders
 *    somewhere.
 * 5. Completeness: a block showing any string leaf as text declares `parts`.
 *
 * Do not weaken it to make it pass: a failure names the block, the case and
 * the path, which is the migration's to-do list.
 */

/* Blocks that legitimately declare no parts, one reason each. */
const EXEMPT: Readonly<Record<string, string>> = {
  page: 'the document root; its text is edited in the page and SEO panels',
  customCode: 'already element-addressable through data-ck-path and elementFocus',
  customCodeSymbol: 'already element-addressable through its symbol tree overrides',
  auroraBackground: 'container: slots only, no text of its own',
  cloudShader: 'container: slots only, no text of its own',
  spotlightSurface: 'container: slots only, no text of its own',
  grid: 'container: slots only, no text of its own',
  pageFooter: 'container: slots only, no text of its own',
  pageHeader: 'container: slots only, no text of its own',
  stack: 'container: slots only, no text of its own',
  dotPatternSurface: 'container: slots only, no text of its own',
  shineBorder: 'container: slots only, no text of its own',
  accordion: 'container: slots only, no text of its own',
  card: 'container: slots only, no text of its own',
  tabs: 'container: slots only, no text of its own',
};

// ── block-parts (2026-10-06, fix pass) ──
/*
  Blocks that only render inside a parent's React context (Radix): the gate
  renders them as the parent's slot child, with the parent's document
  metadata, the way the canvas and the export do.
*/
const PARENT_CONTEXT: Readonly<Record<string, string>> = {
  accordionItem: 'accordion',
  tabPanel: 'tabs',
};

/* Gate-local cases for parts no default or example reaches (kept out of the AI examples). */
const EXTRA_CASES: Readonly<Record<string, readonly GateCaseInput[]>> = {
  chart: [
    {
      // Past eight slices a pie folds the smallest into `otherLabel`.
      label: 'folded pie',
      props: {
        chartType: 'pie',
        categories: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
        series: [{ name: 'Share', values: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] }],
        showValues: true,
        valuePrefix: '$',
        valueSuffix: 'k',
      },
    },
  ],
  menuSection: [
    {
      label: 'photo',
      props: {
        heading: 'Menu',
        currency: 'SAR',
        categories: [
          {
            name: 'Mains',
            items: [{ name: 'Kabsa', price: '45', imageSrc: '/assets/menu/kabsa.jpg', imageAlt: 'Kabsa' }],
          },
        ],
      },
    },
  ],
  team: [
    {
      label: 'portrait',
      props: {
        heading: 'Team',
        members: [
          { name: 'Maya Chen', role: 'CEO', imageSrc: '/assets/team/portrait.jpg', imageAlt: 'Maya Chen' },
        ],
      },
    },
  ],
};

interface GateCaseInput {
  readonly label: string;
  readonly props: Props;
}
// ── /block-parts ──

const MARKER_SELECTOR = '[data-ck-part],[data-ck-part-index],[data-ck-bind],[data-ck-part-owner]';
const PARENT_ID = 'gate-parent';
const SENTINEL = /ZQ(\d+)QZ/gi;
const WRAPPER_ID = 'gate-node';

type Props = Record<string, unknown>;
type BlockContribution = NonNullable<
  NonNullable<TrustedExtensionManifest['contributes']>['blocks']
>[number];
type BlockRenderComponent = NonNullable<BlockContribution['render']>;
type Path = (string | number)[];

interface GateBlock {
  readonly schema: BlockSchema;
  readonly render: BlockRenderComponent;
}

interface GateCase {
  readonly label: string;
  readonly props: Props;
}

// ── Collecting the registered blocks ────────────────────────────────────────

function registeredBlocks(): GateBlock[] {
  const byType = new Map<string, GateBlock>();
  for (const manifest of playgroundExtensions('landing')) {
    for (const contribution of manifest.contributes?.blocks ?? []) {
      if (byType.has(contribution.schema.type)) continue;
      byType.set(contribution.schema.type, { schema: contribution.schema, render: contribution.render });
    }
  }
  return [...byType.values()];
}

// ── Zod introspection, local so the gate needs no internal export ──────────

interface DefLike {
  readonly type: string;
  readonly innerType?: unknown;
  readonly shape?: Record<string, unknown>;
  readonly element?: unknown;
}

const WRAPPERS = new Set(['optional', 'default', 'nullable', 'prefault', 'readonly', 'catch']);

function defOf(schema: unknown): DefLike | undefined {
  const zod = (schema as { _zod?: { def?: DefLike } } | null)?._zod;
  return zod?.def;
}

function unwrapDef(schema: unknown): DefLike | undefined {
  let def = defOf(schema);
  while (def !== undefined && WRAPPERS.has(def.type) && def.innerType !== undefined) {
    def = defOf(def.innerType);
  }
  return def;
}

function isRecord(value: unknown): value is Props {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/* Every free-string leaf present in `value` (enums and literals are not text). */
function stringLeaves(schema: unknown, value: unknown, path: Path, out: Path[]): void {
  const def = unwrapDef(schema);
  if (def === undefined) return;
  if (def.type === 'string' && typeof value === 'string') {
    out.push(path);
    return;
  }
  if (def.type === 'object' && def.shape !== undefined && isRecord(value)) {
    for (const [key, child] of Object.entries(def.shape)) {
      if (Object.hasOwn(value, key)) stringLeaves(child, value[key], [...path, key], out);
    }
    return;
  }
  if (def.type === 'array' && def.element !== undefined && Array.isArray(value)) {
    value.forEach((entry, index) => {
      stringLeaves(def.element, entry, [...path, index], out);
    });
  }
}

// ── Values at paths ─────────────────────────────────────────────────────────

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getAt(value: unknown, path: Path): unknown {
  let current = value;
  for (const segment of path) {
    if (typeof segment === 'number') current = Array.isArray(current) ? current[segment] : undefined;
    else current = isRecord(current) ? current[segment] : undefined;
  }
  return current;
}

/* Mutating set on a clone the caller owns. */
function setAt(target: Props, path: Path, next: unknown): void {
  let current: unknown = target;
  path.forEach((segment, depth) => {
    const last = depth === path.length - 1;
    if (Array.isArray(current) && typeof segment === 'number') {
      if (last) current[segment] = next;
      else current = current[segment];
    } else if (isRecord(current) && typeof segment === 'string') {
      if (last) current[segment] = next;
      else current = current[segment];
    }
  });
}

/* Expand a bind pattern (`items.*.title`) over the arrays present in `props`. */
function expand(pattern: string, props: Props): Path[] {
  let frontier: Path[] = [[]];
  for (const segment of pattern.split('.')) {
    if (segment !== '*') {
      frontier = frontier.map((path) => [...path, segment]);
      continue;
    }
    frontier = frontier.flatMap((path) => {
      const array = getAt(props, path);
      return Array.isArray(array) ? array.map((_, index) => [...path, index]) : [];
    });
  }
  return frontier.filter((path) => getAt(props, path) !== undefined);
}

function textPatternOf(decl: NonNullable<BlockSchema['parts']>[string]): string | undefined {
  if (decl.kind !== 'text' && decl.kind !== 'rich' && decl.kind !== 'link') return undefined;
  const bind = decl.bind;
  if (typeof bind === 'string') return bind;
  if (bind !== undefined && 'text' in bind) return bind.text;
  return undefined;
}

// ── Rendering ───────────────────────────────────────────────────────────────

function caseProps(schema: BlockSchema, stored: unknown): Props {
  const raw = isRecord(stored) ? stored : {};
  const parsed = schema.props.safeParse(raw);
  return isRecord(parsed.data) ? clone(parsed.data) : clone(raw);
}

function casesOf(schema: BlockSchema): GateCase[] {
  const cases: GateCase[] = [{ label: 'defaults', props: caseProps(schema, {}) }];
  schema.examples.forEach((example, index) => {
    const node = example.node;
    const props = isRecord(node) ? node['props'] : undefined;
    cases.push({ label: `example ${String(index + 1)}`, props: caseProps(schema, props) });
  });
  for (const extra of EXTRA_CASES[schema.type] ?? []) {
    cases.push({ label: extra.label, props: caseProps(schema, extra.props) });
  }
  return cases;
}

function renderBlock(block: GateBlock, props: Props, isCanvas: boolean, documentProps: Props = props) {
  const Block = block.render as unknown as ComponentType<BlockRenderProps>;
  const node: Node = { id: WRAPPER_ID, type: block.schema.type, props: props as Node['props'] };
  const slots: Record<string, ReactNode> = {};
  for (const name of Object.keys(block.schema.slots ?? {})) slots[name] = null;
  const own = (
    <div data-bldr-node={WRAPPER_ID}>
      <Block node={node} props={props} slots={slots} data={{}} isCanvas={isCanvas} />
    </div>
  );
  // A block that needs its parent's context renders as that parent's slot child.
  const parent = parentOf(block.schema.type);
  const tree =
    parent === undefined ? (
      own
    ) : (
      <div data-bldr-node={PARENT_ID}>
        <parent.Render
          node={{ id: PARENT_ID, type: parent.schema.type, props: parent.props as Node['props'], slots: { default: [WRAPPER_ID] } }}
          props={parent.props}
          slots={{ default: own }}
          slotChildren={{ default: [{ id: WRAPPER_ID, type: block.schema.type, props: documentProps }] }}
          data={{}}
          isCanvas={isCanvas}
        />
      </div>
    );
  const view = render(tree);
  const wrapper = view.container.querySelector(`[data-bldr-node="${WRAPPER_ID}"]`);
  if (wrapper === null) throw new Error('the gate wrapper did not render');
  return { wrapper, root: view.container, unmount: view.unmount };
}

/* The parent a context-bound block renders inside, with its default props. */
function parentOf(type: string) {
  const parentType = PARENT_CONTEXT[type];
  if (parentType === undefined) return undefined;
  const found = registeredBlocks().find((candidate) => candidate.schema.type === parentType);
  if (found === undefined) throw new Error(`the gate parent "${parentType}" is not registered`);
  return {
    schema: found.schema,
    Render: found.render as unknown as ComponentType<BlockRenderProps>,
    props: caseProps(found.schema, {}),
  };
}

/* True when `element` is a part of the gated node: its own, or one a parent draws for it. */
function ownedByGate(element: Element, wrapper: Element): boolean {
  if (element.getAttribute('data-ck-part-owner') === WRAPPER_ID) return true;
  return element.closest('[data-bldr-node]') === wrapper;
}

function textNodes(root: Element): Text[] {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let current = walker.nextNode(); current !== null; current = walker.nextNode()) {
    nodes.push(current as Text);
  }
  return nodes;
}

function attributeValues(root: Element): string[] {
  const values: string[] = [];
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attribute of element.attributes) values.push(`${element.tagName.toLowerCase()}[${attribute.name}]=${attribute.value}`);
  }
  return values;
}

function hasBindAncestor(text: Text, wrapper: Element, path: string): boolean {
  for (let element = text.parentElement; element !== null; element = element.parentElement) {
    if (element.getAttribute('data-ck-bind') === path) {
      return ownedByGate(element, wrapper);
    }
  }
  return false;
}

/* True when the bind element of `text` is one a parent draws for the gated node. */
function isForwarded(text: Text): boolean {
  return text.parentElement?.closest('[data-ck-part-owner]')?.getAttribute('data-ck-part-owner') === WRAPPER_ID;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// ── The checks ──────────────────────────────────────────────────────────────

interface SentinelResult {
  readonly violations: string[];
  readonly visible: boolean;
  /** The leaf paths that showed as text in this case. */
  readonly seen: ReadonlySet<string>;
  /** The leaf paths a parent draws for the gated node (a tab trigger). */
  readonly forwarded: ReadonlySet<string>;
}

/* Returns the violations, whether any string leaf showed as text, and which ones did. */
function sentinelCheck(block: GateBlock, gateCase: GateCase): SentinelResult {
  const props = clone(gateCase.props);
  const leaves: Path[] = [];
  const groups = block.schema.propertyGroups ?? {};
  for (const [key, child] of Object.entries(unwrapDef(block.schema.props)?.shape ?? {})) {
    const kind = (groups as Record<string, { kind?: string } | undefined>)[key]?.kind;
    if (kind === 'utility-classes' || kind === 'part-styles') continue;
    if (Object.hasOwn(props, key)) stringLeaves(child, props[key], [key], leaves);
  }
  const pathOf = new Map<string, string>();
  leaves.forEach((path, index) => {
    const sentinel = `ZQ${String(index)}QZ`;
    pathOf.set(String(index), path.map(String).join('.'));
    setAt(props, path, sentinel);
  });

  const violations: string[] = [];
  const seen = new Set<string>();
  const forwarded = new Set<string>();
  let visible = false;
  let view: ReturnType<typeof renderBlock>;
  try {
    view = renderBlock(block, props, true);
  } catch (error) {
    return { violations: [`${gateCase.label}: the sentinel render threw: ${messageOf(error)}`], visible, seen, forwarded };
  }
  for (const text of textNodes(view.root)) {
    for (const match of text.data.matchAll(SENTINEL)) {
      const path = pathOf.get(match[1] ?? '');
      if (path === undefined) continue;
      visible = true;
      seen.add(path);
      if (isForwarded(text)) forwarded.add(path);
      if (!hasBindAncestor(text, view.wrapper, path)) {
        violations.push(`${gateCase.label}: "${path}" shows as text outside an element with data-ck-bind="${path}"`);
      }
    }
  }
  view.unmount();
  return { violations: [...new Set(violations)], visible, seen, forwarded };
}

function swapCheck(block: GateBlock, gateCase: GateCase): string[] {
  const parts = block.schema.parts ?? {};
  const props = clone(gateCase.props);
  // Which binds showed in this case's sentinel pass: one the block hides here
  // (a pause label while autoplay is off, people beyond maxVisible) may render 0 times.
  const sentinel = sentinelCheck(block, gateCase);
  const swapped: string[] = [];
  for (const decl of Object.values(parts)) {
    const pattern = textPatternOf(decl);
    if (pattern === undefined) continue;
    for (const path of expand(pattern, props)) {
      const key = path.map(String).join('.');
      swapped.push(key);
      setAt(props, path, <span data-swap={key} />);
    }
  }
  if (swapped.length === 0) return [];
  const violations: string[] = [];
  let view: ReturnType<typeof renderBlock>;
  try {
    // The parent's metadata is the DOCUMENT's (unswapped), as on the canvas.
    view = renderBlock(block, props, true, gateCase.props);
  } catch (error) {
    return [`${gateCase.label}: the swap render threw: ${messageOf(error)}`];
  }
  for (const value of attributeValues(view.root)) {
    if (value.includes('[object Object]')) violations.push(`${gateCase.label}: ${value} — a bound value reached an attribute`);
  }
  for (const key of swapped) {
    // A part the parent draws from document metadata takes no in-place editor (the canvas refuses it).
    if (sentinel.forwarded.has(key)) continue;
    const count = withAttribute(view.root, 'data-swap', key).length;
    if (count === 0 && !sentinel.seen.has(key)) continue;
    if (count !== 1) violations.push(`${gateCase.label}: swapped "${key}" rendered ${String(count)} times, not once`);
  }
  view.unmount();
  return violations;
}

function publishedCheck(block: GateBlock, gateCase: GateCase): string[] {
  let view: ReturnType<typeof renderBlock>;
  try {
    view = renderBlock(block, gateCase.props, false);
  } catch (error) {
    return [`${gateCase.label}: the published render threw: ${messageOf(error)}`];
  }
  const markers = view.root.querySelectorAll(MARKER_SELECTOR).length;
  view.unmount();
  return markers === 0 ? [] : [`${gateCase.label}: ${String(markers)} canvas marker(s) in the published render`];
}

/* Elements whose attribute equals `value` exactly (no selector escaping needed). */
function withAttribute(root: Element, name: string, value: string): Element[] {
  return [...root.querySelectorAll(`[${name}]`)].filter((element) => element.getAttribute(name) === value);
}

/* The gated node's elements for one part: its own, and any a parent draws for it. */
function ownedParts(view: ReturnType<typeof renderBlock>, name: string): Element[] {
  return withAttribute(view.root, 'data-ck-part', name).filter((element) => ownedByGate(element, view.wrapper));
}

function hasPs4(element: Element): boolean {
  return element.classList.contains('ps-4');
}

/* Returns violations and the part names that rendered at least one element. */
function partStylesCheck(block: GateBlock, gateCase: GateCase): { violations: string[]; rendered: Set<string> } {
  const parts = block.schema.parts ?? {};
  const violations: string[] = [];
  const rendered = new Set<string>();
  let baseline: ReturnType<typeof renderBlock>;
  try {
    baseline = renderBlock(block, gateCase.props, true);
  } catch (error) {
    return { violations: [`${gateCase.label}: the part-styles baseline threw: ${messageOf(error)}`], rendered };
  }
  const baselineNames = new Map<string, number>();
  for (const name of Object.keys(parts)) {
    const elements = ownedParts(baseline, name);
    baselineNames.set(name, [...baseline.root.querySelectorAll('.ps-4')].filter((element) => element.getAttribute('data-ck-part') !== name).length);
    if (elements.length > 0) rendered.add(name);
  }
  baseline.unmount();

  for (const name of rendered) {
    const props = { ...clone(gateCase.props), partStyles: { [name]: { className: 'ps-4', dir: 'ltr' } } };
    let view: ReturnType<typeof renderBlock>;
    try {
      view = renderBlock(block, props, true, props);
    } catch (error) {
      violations.push(`${gateCase.label}: styling "${name}" threw: ${messageOf(error)}`);
      continue;
    }
    const targets = ownedParts(view, name);
    for (const target of targets) {
      if (!hasPs4(target) || target.getAttribute('dir') !== 'ltr') {
        violations.push(`${gateCase.label}: partStyles["${name}"] did not land on its element (<${target.tagName.toLowerCase()}>)`);
        break;
      }
    }
    const styled = view.root.querySelectorAll('.ps-4').length;
    const expected = targets.length + (baselineNames.get(name) ?? 0);
    if (styled !== expected) {
      violations.push(`${gateCase.label}: partStyles["${name}"] reached ${String(styled - (baselineNames.get(name) ?? 0))} element(s), its part has ${String(targets.length)}`);
    }
    view.unmount();
  }
  return { violations, rendered };
}

// ── The gate ────────────────────────────────────────────────────────────────

const blocks = registeredBlocks();
const gated = blocks.filter((block) => !Object.hasOwn(EXEMPT, block.schema.type));

describe('block-parts coverage gate — registry', () => {
  it('every exemption names a block the playground registers', () => {
    const types = new Set(blocks.map((block) => block.schema.type));
    expect(Object.keys(EXEMPT).filter((type) => !types.has(type))).toEqual([]);
  });

  it('gates the text-bearing blocks', () => {
    expect(gated.length).toBeGreaterThan(30);
  });
});

describe.each(gated.map((block) => [block.schema.type, block] as const))('block-parts coverage gate — %s', (_type, block) => {
  const cases = casesOf(block.schema);

  it('1. sentinel render: every visible string leaf sits inside its data-ck-bind element', () => {
    const violations = cases.flatMap((gateCase) => sentinelCheck(block, gateCase).violations);
    expect(violations).toEqual([]);
  });

  it('2. swap render: bound values render only as children, exactly once', () => {
    const violations = cases.flatMap((gateCase) => swapCheck(block, gateCase));
    expect(violations).toEqual([]);
  });

  it('3. published render: no canvas markers', () => {
    const violations = cases.flatMap((gateCase) => publishedCheck(block, gateCase));
    expect(violations).toEqual([]);
  });

  it('4. part styles: partStyles lands on exactly its part, and every declared part renders', () => {
    const violations: string[] = [];
    const rendered = new Set<string>();
    for (const gateCase of cases) {
      const result = partStylesCheck(block, gateCase);
      violations.push(...result.violations);
      for (const name of result.rendered) rendered.add(name);
    }
    for (const name of Object.keys(block.schema.parts ?? {})) {
      if (!rendered.has(name)) violations.push(`part "${name}" is declared but no case renders an element for it`);
    }
    expect(violations).toEqual([]);
  });

  it('5. completeness: a block that shows text declares parts', () => {
    const visible = cases.some((gateCase) => sentinelCheck(block, gateCase).visible);
    const declared = Object.keys(block.schema.parts ?? {}).length > 0;
    expect({ visible, declared }).not.toEqual({ visible: true, declared: false });
  });
});
