import { createElement, type ComponentType, type ReactNode } from 'react';

import {
  CUSTOM_CODE_ATTRIBUTES,
  CUSTOM_CODE_MAX_DEPTH,
  blockPropDefaults,
  isCustomCodeTag,
  withBlockPropDefaults,
  type BlockRenderProps,
  type CustomCodeAttribute,
  type Node,
  type NodeId,
  type RegisteredBlock,
  type SlotName,
} from '@craftkit/builder-schema';

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
const VOID_TAGS: ReadonlySet<string> = new Set(['br', 'hr', 'img']);

const ATTRIBUTE_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_ATTRIBUTES);

/**
 * `src` is the one attribute that can reach the network, so it is the one
 * attribute with a policy. Anything that is not a plain relative path, an
 * https URL, or an inline data image is dropped: `javascript:` never renders,
 * and neither does a scheme this list has not considered.
 */
function safeSrc(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (trimmed.startsWith('/') || trimmed.startsWith('./')) return trimmed;
  if (/^https:\/\//iu.test(trimmed)) return trimmed;
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=]+$/iu.test(trimmed)) {
    return trimmed;
  }
  return undefined;
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
    if (name === 'src') {
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
    out[name satisfies string as CustomCodeAttribute] = value;
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
    }
  }
  if (tag === 'button') {
    // Never a submit and never a handler: a styled affordance, wired later.
    out['type'] = 'button';
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
function renderIcon(node: Record<string, unknown>, key: string): ReactNode {
  const name = node['name'];
  if (typeof name !== 'string') return null;
  const data = lucideIconNode(name);
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
      >
        ?
      </span>
    );
  }
  const size = typeof node['size'] === 'number' ? node['size'] : 24;
  const strokeWidth = typeof node['strokeWidth'] === 'number' ? node['strokeWidth'] : 2;
  const className = typeof node['className'] === 'string' ? node['className'] : undefined;
  const rawLabel = node['label'];
  const label = typeof rawLabel === 'string' && rawLabel.trim() !== '' ? rawLabel.trim() : undefined;
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
      {...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      {data.map(([tag, attrs], at) => createElement(tag, { key: at, ...attrs }))}
    </svg>
  );
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
  const props: Record<string, unknown> = { key, ...attributes };
  if (className !== undefined) props['className'] = className;

  if (VOID_TAGS.has(tag)) {
    return createElement(tag, props);
  }
  const children = childrenOf(node).map((child, at) =>
    renderNode(child, `${path}.${String(at)}`, depth + 1, context),
  );
  return createElement(tag, props, text === undefined ? children : [text, ...children]);
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
  if (node['kind'] === 'icon') return renderIcon(node, path);
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
  return (
    <div className={className} data-ck={hostId}>
      {children.map((child, at) => renderNode(child, String(at), 0, context))}
    </div>
  );
}
