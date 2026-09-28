import { createElement, type ComponentType, type ReactNode, type SyntheticEvent } from 'react';

import {
  CUSTOM_CODE_ATTRIBUTES,
  CUSTOM_CODE_MAX_DEPTH,
  blockPropDefaults,
  customCodeAttributeProblem,
  isCustomCodeSvgTag,
  isCustomCodeTag,
  safeCustomCodeUrl,
  withBlockPropDefaults,
  type BlockRenderProps,
  type Node,
  type NodeId,
  type RegisteredBlock,
  type SlotName,
} from '@craftkit/builder-schema';

import { CUSTOM_CODE_REGION_ATTRIBUTE } from '../../tailwind/live-utilities';
import { safeHref } from '../RichText/safe-href';
import { UnknownBlock } from '../UnknownBlock';

import { lucideIconNode } from './lucide-icon-node';
import { useCustomCodeBlockLookup, type CustomCodeBlockLookup } from './registry-context';

/**
 * The custom-code renderer: a tolerant READ over a tree the door validated
 * strictly on write.
 *
 * The asymmetry is the same one `RichText` documents and is deliberate. A
 * document is validated when it is WRITTEN; it is then read again after
 * upgrades, after an extension is disposed, and after a hand edit through the
 * code view. So this path never assumes its input is well-formed: an unknown
 * tag is skipped, a missing child list is empty, an over-deep branch degrades
 * to its text, and nothing here can throw into a canvas that has no error
 * boundary.
 *
 * There is no `dangerouslySetInnerHTML` in this file, and there is no code path
 * that could introduce one — `createElement` is called with a tag that
 * `isCustomCodeTag` has already admitted, and children are React nodes built by
 * this same walk. Text is passed as a child, which React escapes.
 */

/** Tags rendered without children, so a malformed tree cannot nest into them. */
const VOID_TAGS: ReadonlySet<string> = new Set(['br', 'hr', 'img', 'source']);

const ATTRIBUTE_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_ATTRIBUTES);

/*
  The vocabulary spells attributes as HTML and SVG do; React wants its own
  prop names for these, and passing the markup spelling through sets an
  unknown attribute with a console warning (`stroke-width`, `srcset`) — or,
  for `autoplay` and `playsinline`, never reaches the element's property at
  all. Everything not listed passes under its own name (`viewBox`, `aria-*`,
  `lang`, `popover`, `cx`…), which React already reads as written.
*/
const REACT_PROP: Readonly<Record<string, string>> = {
  datetime: 'dateTime',
  srcset: 'srcSet',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  popovertarget: 'popoverTarget',
  popovertargetaction: 'popoverTargetAction',
  autoplay: 'autoPlay',
  playsinline: 'playsInline',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
};

/** Attributes whose presence is the value; stored bare (`''`), rendered as `true`. */
const BOOLEAN_ATTRIBUTES: ReadonlySet<string> = new Set([
  'open',
  'autoplay',
  'muted',
  'loop',
  'playsinline',
  'controls',
]);

/**
 * `src` and `poster` reach the network, so they pass the schema's one address
 * policy (`safeCustomCodeUrl`): a relative path, an https URL, or an inline
 * data image. `javascript:` never renders, and neither does a scheme the
 * policy has not considered.
 */
const safeSrc = safeCustomCodeUrl;

/**
 * An in-page link inside an open popover closes it as it jumps: the menu a
 * phone opened has done its job once the section is on screen. HTML has no
 * attribute for this — `popovertargetaction` works on a button only — so the
 * renderer does it, the one behaviour it adds, fixed here and never authored.
 * (A static page with no script still closes the menu by light dismiss: a tap
 * outside it, or Escape.)
 */
function closeOwningPopover(event: { currentTarget: EventTarget | null }): void {
  const link = event.currentTarget;
  if (!(link instanceof Element)) return;
  const popover = link.closest('[popover]') as (Element & { hidePopover?: () => void }) | null;
  try {
    popover?.hidePopover?.();
  } catch {
    // Already closed, or a browser without the Popover API: nothing to undo.
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function childrenOf(node: Record<string, unknown>): unknown[] {
  return Array.isArray(node['children']) ? (node['children'] as unknown[]) : [];
}

/** Readable text of any subtree — the terminal degradation for depth and junk. */
function plainText(value: unknown): string {
  const out: string[] = [];
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = asRecord(stack.pop());
    if (node === null) continue;
    if (typeof node['text'] === 'string') out.push(node['text']);
    const children = childrenOf(node);
    for (let at = children.length - 1; at >= 0; at -= 1) stack.push(children[at]);
  }
  return out.join(' ');
}

function elementAttributes(
  tag: string,
  node: Record<string, unknown>,
  isCanvas: boolean,
): Record<string, unknown> {
  const declared = asRecord(node['attributes']);
  const out: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(declared ?? {})) {
    if (!ATTRIBUTE_SET.has(name) || typeof value !== 'string') continue;
    /*
      Every attribute stands only where the door would have let it stand: the
      same per-tag policy, read again, so a document edited by hand or written
      before a rule tightened cannot smuggle a `srcset` over http, a paint
      server from another host, or a popover target on a link.
    */
    if (customCodeAttributeProblem(tag, name, value) !== undefined) continue;
    if (name === 'src' || name === 'poster') {
      const safe = safeSrc(value);
      if (safe !== undefined) out[name] = safe;
      continue;
    }
    if (name === 'href') {
      /*
        The same policy RichText applies to a link mark: https, mailto, tel,
        and relative survive; `javascript:` and every unconsidered scheme are
        dropped, and the element renders as text without a destination.
      */
      const safe = tag === 'a' ? safeHref(value) : undefined;
      if (safe !== undefined) out['href'] = safe;
      continue;
    }
    if (name === 'target') {
      // Only a new tab is a meaningful target here; a named frame is not.
      if (value === '_blank') out['target'] = '_blank';
      continue;
    }
    if (BOOLEAN_ATTRIBUTES.has(name)) {
      // Only a bare spelling passed the policy: '', the name, or 'true'.
      out[REACT_PROP[name] ?? name] = true;
      continue;
    }
    out[REACT_PROP[name] ?? name] = value;
  }
  if (tag === 'a') {
    const href = out['href'];
    if (typeof href === 'string' && /^https?:\/\//iu.test(href)) {
      // An external link never hands the opener to the destination.
      out['rel'] = 'noopener noreferrer';
    }
    if (isCanvas) {
      // On the editing canvas a link is something to select, not to follow.
      out['onClick'] = (event: { preventDefault(): void }) => {
        event.preventDefault();
      };
    } else if (typeof href === 'string' && href.startsWith('#')) {
      out['onClick'] = closeOwningPopover;
    }
  }
  if (tag === 'button') {
    // Never a submit and never a handler: a styled affordance, wired later.
    out['type'] = 'button';
  }
  if (tag === 'video' && out['autoPlay'] === true) {
    /*
      A video that plays by itself never plays sound, whatever the stored
      tree says (the door refuses autoplay without muted; this is the read
      side of the same rule). And it plays in place: iOS Safari opens an
      autoplaying video full screen unless it is also playsinline.
    */
    out['muted'] = true;
    out['playsInline'] = true;
  }
  return out;
}

interface RenderContext {
  /** The document node hosting this tree; its id roots every synthetic id. */
  readonly hostId: NodeId;
  readonly lookup: CustomCodeBlockLookup | undefined;
  readonly isCanvas: boolean;
}

/**
 * The editing address of one authored element: its child-index path from the
 * tree root, the same position-derived identity the synthetic ids use. On the
 * canvas every element and icon carries it, so the shell's hit-test can name
 * the thing under the pointer (the portrait, the headline, the button) rather
 * than only the region — and the Inspector can read and write it by path. A
 * published page never carries it: it is chrome, not content.
 */
const PATH_ATTRIBUTE = 'data-ck-path';

function pathAttribute(context: RenderContext, path: string): Record<string, string> {
  return context.isCanvas ? { [PATH_ATTRIBUTE]: path } : {};
}

/**
 * The synthetic node handed to a referenced block.
 *
 * A tree element is not in `doc.nodes`, so there is no real `Node` to pass. A
 * survey of every renderer in the workspace settled what that costs: of 57
 * uses of `node`, 51 are `node.id` (aria wiring, DOM ids) and the rest are
 * `node.slots`. Nothing subscribes to the store through it. So an id that is
 * unique and STABLE is sufficient, and the path-derived form below is both —
 * stable across re-renders because it is derived from position, unique because
 * it is rooted in the host node's own id.
 */
function syntheticNode(
  context: RenderContext,
  path: string,
  type: string,
  props: Record<string, unknown>,
  childCount: number,
): Node {
  const slots: Record<SlotName, NodeId[]> = {
    default: Array.from(
      { length: childCount },
      (_unused, at) => `${context.hostId}::${path}.${String(at)}`,
    ),
  };
  return {
    id: `${context.hostId}::${path}`,
    type,
    props: props as Node['props'],
    slots,
  };
}

/**
 * Validate a reference's props against the referenced block's OWN schema.
 *
 * This is the line that keeps "free composition" from meaning "unvalidated
 * composition". The tree may name any registered block, but what it hands that
 * block still passes the block's door. A failure renders `UnknownBlock` rather
 * than a half-configured component, because a component rendered with props it
 * rejected is a bug that surfaces as a visual glitch three screens later.
 */
function validatedProps(
  entry: RegisteredBlock,
  raw: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const parsed = entry.schema.props.safeParse(raw);
  if (!parsed.success) return undefined;
  return withBlockPropDefaults(
    parsed.data as Record<string, unknown>,
    blockPropDefaults(entry.schema.props),
  );
}

function renderComponent(
  node: Record<string, unknown>,
  key: string,
  path: string,
  depth: number,
  context: RenderContext,
): ReactNode {
  const type = node['component'];
  if (typeof type !== 'string') return null;
  const entry = context.lookup?.(type);
  const render = entry?.render;
  if (entry === undefined || render === undefined) {
    return <UnknownBlock key={key} type={type} />;
  }
  const props = validatedProps(entry, asRecord(node['props']) ?? {});
  if (props === undefined) {
    return <UnknownBlock key={key} type={type} />;
  }
  const children = childrenOf(node);
  const rendered = children.map((child, at) =>
    renderNode(child, `${path}.${String(at)}`, depth + 1, context),
  );
  const Block = render as ComponentType<BlockRenderProps>;
  return (
    <Block
      key={key}
      node={syntheticNode(context, path, type, props, children.length)}
      props={props}
      slots={{ default: rendered }}
      data={{}}
      isCanvas={context.isCanvas}
    />
  );
}

/**
 * An icon is DRAWN from the set's path data, never loaded as markup: the
 * `<svg>` and its children are created here from a fixed vocabulary of shape
 * elements, so an icon node can carry exactly what a name can carry — a
 * name — and nothing an authored `<svg>` could smuggle.
 */
function renderIcon(node: Record<string, unknown>, key: string, context: RenderContext): ReactNode {
  const name = node['name'];
  if (typeof name !== 'string') return null;
  const data = lucideIconNode(name);
  const address = pathAttribute(context, key);
  if (data === undefined) {
    // Visible, like UnknownBlock: a missing icon that renders as nothing is a
    // layout that looks finished and is not.
    return (
      <span
        key={key}
        className="bldr-unknown-icon"
        role="img"
        aria-label={`Unknown icon: ${name}`}
        style={{ display: 'inline-block', minWidth: '1em', textAlign: 'center' }}
        {...address}
      >
        ?
      </span>
    );
  }
  const size = typeof node['size'] === 'number' ? node['size'] : 24;
  const strokeWidth = typeof node['strokeWidth'] === 'number' ? node['strokeWidth'] : 2;
  const className = typeof node['className'] === 'string' ? node['className'] : undefined;
  const rawLabel = node['label'];
  const label =
    typeof rawLabel === 'string' && rawLabel.trim() !== '' ? rawLabel.trim() : undefined;
  return (
    <svg
      key={key}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      data-icon={name}
      {...address}
      {...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      {data.map(([tag, attrs], at) => createElement(tag, { key: at, ...attrs }))}
    </svg>
  );
}

const BROKEN_ATTRIBUTE = 'data-ck-broken';

/**
 * An image whose address does not load keeps its box and becomes a quiet
 * surface, instead of the browser's broken-image mark and a stray alt line.
 * A model can name a photo that does not exist; a published page should not
 * look broken because of it. The marker lets a host find and replace them.
 */
function markBrokenImage(event: SyntheticEvent<HTMLImageElement>): void {
  const image = event.currentTarget;
  image.setAttribute(BROKEN_ATTRIBUTE, '');
  image.style.color = 'transparent';
  image.style.objectPosition = '-99999px 0';
  image.style.background = 'linear-gradient(135deg, rgb(231 229 228), rgb(214 211 209))';
}

/**
 * And back again when a later address loads. The marks are written on the DOM
 * node, not through React, and a new `src` reuses the same node (it is keyed
 * by its tree path) — so without this, a fixed photo loaded off-box behind the
 * grey surface until a reload, and a host looking for broken images found it.
 */
function clearBrokenImage(event: SyntheticEvent<HTMLImageElement>): void {
  const image = event.currentTarget;
  if (!image.hasAttribute(BROKEN_ATTRIBUTE)) return;
  image.removeAttribute(BROKEN_ATTRIBUTE);
  image.style.color = '';
  image.style.objectPosition = '';
  image.style.background = '';
  if (image.getAttribute('style') === '') image.removeAttribute('style');
}

function renderElement(
  node: Record<string, unknown>,
  key: string,
  path: string,
  depth: number,
  context: RenderContext,
): ReactNode {
  const tag = node['tag'];
  // An unknown tag is SKIPPED rather than rendered as a div: a document that
  // stored `iframe` must not become a container the reader cannot see.
  if (typeof tag !== 'string' || !isCustomCodeTag(tag)) return null;

  const className = typeof node['className'] === 'string' ? node['className'] : undefined;
  const text = typeof node['text'] === 'string' ? node['text'] : undefined;
  const attributes = elementAttributes(tag, node, context.isCanvas);
  const props: Record<string, unknown> = { key, ...attributes, ...pathAttribute(context, path) };
  if (className !== undefined) props['className'] = className;

  if (tag === 'img') {
    props['onError'] = markBrokenImage;
    props['onLoad'] = clearBrokenImage;
  }
  if (VOID_TAGS.has(tag)) {
    return createElement(tag, props);
  }
  /*
    An svg shape draws in the SVG namespace, which React enters at the `svg`
    element and keeps for its descendants: so a shape holds only shapes and
    no text. Anything else under it — an html element, an icon, a component —
    would be created as an SVG element nobody can see; the door refuses it on
    write, and the read skips it here.
  */
  const svg = isCustomCodeSvgTag(tag);
  const children = childrenOf(node).map((child, at) => {
    if (svg && !isSvgElement(child)) return null;
    return renderNode(child, `${path}.${String(at)}`, depth + 1, context);
  });
  return createElement(
    tag,
    props,
    text === undefined || svg ? children : [text, ...children],
  );
}

function isSvgElement(value: unknown): boolean {
  const node = asRecord(value);
  return (
    node !== null &&
    node['kind'] === 'element' &&
    typeof node['tag'] === 'string' &&
    isCustomCodeSvgTag(node['tag'])
  );
}

function renderNode(
  value: unknown,
  path: string,
  depth: number,
  context: RenderContext,
): ReactNode {
  const node = asRecord(value);
  if (node === null) return null;
  if (depth >= CUSTOM_CODE_MAX_DEPTH) {
    // Ceiling reached: the text survives, the structure does not. Matches the
    // door's own ceiling, which is what keeps "storable ⇒ renderable" true.
    const text = plainText(node);
    return text === '' ? null : <span key={path}>{text}</span>;
  }
  if (node['kind'] === 'icon') return renderIcon(node, path, context);
  return node['kind'] === 'component'
    ? renderComponent(node, path, path, depth, context)
    : renderElement(node, path, path, depth, context);
}

export interface CustomCodeProps {
  /** The stored tree. READ is tolerant by contract; malformed input renders nothing. */
  tree: unknown;
  /** Roots every synthetic child id; pass the hosting document node's id. */
  hostId: NodeId;
  isCanvas?: boolean | undefined;
  className?: string | undefined;
  /** Overrides the context lookup; the static export path passes one directly. */
  blockLookup?: CustomCodeBlockLookup | undefined;
}

/** Render a stored custom-code tree. Never throws; never injects raw HTML. */
export function CustomCode({
  tree,
  hostId,
  isCanvas = false,
  className,
  blockLookup,
}: CustomCodeProps) {
  const contextLookup = useCustomCodeBlockLookup();
  const root = asRecord(tree);
  const context: RenderContext = {
    hostId,
    lookup: blockLookup ?? contextLookup,
    isCanvas,
  };
  const children = root === null ? [] : childrenOf(root);
  // The region marker is where the live Tailwind sheet's `@scope` begins.
  const region = { [CUSTOM_CODE_REGION_ATTRIBUTE]: '' };
  return (
    <div className={className} data-ck={hostId} {...region}>
      {children.map((child, at) => renderNode(child, String(at), 0, context))}
    </div>
  );
}
