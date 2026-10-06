import {
  Fragment,
  createElement,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
  type SyntheticEvent,
} from 'react';

import {
  CUSTOM_CODE_ATTRIBUTES,
  CUSTOM_CODE_IFRAME_ALLOW,
  CUSTOM_CODE_IFRAME_REFERRER_POLICY,
  CUSTOM_CODE_IFRAME_SANDBOX,
  CUSTOM_CODE_MAX_DEPTH,
  CUSTOM_CODE_SVG_TEXT_TAGS,
  blockPropDefaults,
  customCodeAttributeProblem,
  customCodeIconNames,
  isCustomCodeSvgTag,
  isCustomCodeTag,
  parseCustomCodeIconName,
  safeCustomCodeUrl,
  withBlockPropDefaults,
  type BlockRenderProps,
  type Node,
  type NodeId,
  type RegisteredBlock,
  type SlotName,
} from '@craftkit/builder-schema';

import { ensureBehaviorCss, ensureMotionCss } from '../../behaviors/behaviors-css';
import { BEHAVIOR_RUNTIME_SELECTOR } from '../../behaviors/script';
import { mountBehaviors } from '../../behaviors/runtime';
import { CUSTOM_CODE_REGION_ATTRIBUTE } from '../../tailwind/live-utilities';
import { safeHref } from '../RichText/safe-href';
import { UnknownBlock } from '../UnknownBlock';

import {
  useCustomCodeClassTransform,
  type CustomCodeClassTransform,
} from './class-transform-context';
import { lucideIconNode } from './lucide-icon-node';
import { useCustomCodeBlockLookup, type CustomCodeBlockLookup } from './registry-context';
import {
  loadTablerIcons,
  subscribeTablerIcons,
  tablerIconNode,
  tablerIconsFailed,
  tablerIconsLoaded,
  tablerIconsVersion,
} from './tabler-icons';

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
const VOID_TAGS: ReadonlySet<string> = new Set(['br', 'hr', 'img', 'source', 'input', 'track']);

/** The svg tags whose `text` renders (every other shape holds none). */
const SVG_TEXT_TAGS: ReadonlySet<string> = new Set(CUSTOM_CODE_SVG_TEXT_TAGS);

/** Form controls: inert on the editing canvas, so a click selects instead of typing. */
const CONTROL_TAGS: ReadonlySet<string> = new Set(['input', 'textarea', 'select']);

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
  fetchpriority: 'fetchPriority',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  // 2026-10-05: form, track and accessibility attributes React spells its own way.
  tabindex: 'tabIndex',
  maxlength: 'maxLength',
  minlength: 'minLength',
  inputmode: 'inputMode',
  autocomplete: 'autoComplete',
  for: 'htmlFor',
  srclang: 'srcLang',
  // 2026-10-05: svg text, clip and filter attributes.
  'clip-path': 'clipPath',
  'flood-color': 'floodColor',
  'flood-opacity': 'floodOpacity',
  'text-anchor': 'textAnchor',
  'dominant-baseline': 'dominantBaseline',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'font-family': 'fontFamily',
  'letter-spacing': 'letterSpacing',
};

/** Attributes whose presence is the value; stored bare (`''`), rendered as `true`. */
const BOOLEAN_ATTRIBUTES: ReadonlySet<string> = new Set([
  'open',
  'autoplay',
  'muted',
  'loop',
  'playsinline',
  'controls',
  'required',
  'disabled',
  'multiple',
  'checked',
]);

/*
  A stored `value` or `checked` is where a control STARTS, not a value React
  owns: rendered as `value`/`checked` it would be a controlled field with no
  change handler (React warns, and the field cannot be typed into).
*/
const INITIAL_VALUE_PROP: Readonly<Record<string, string>> = {
  checked: 'defaultChecked',
};

/** Swallow an event: on the canvas a form never submits and a link never navigates. */
function preventDefault(event: { preventDefault(): void }): void {
  event.preventDefault();
}

/** The relationship tokens a link renders with: authored ones first, then the forced ones. */
function linkRel(authored: unknown, forced: readonly string[]): string | undefined {
  const tokens = typeof authored === 'string' ? authored.trim().split(/\s+/u).filter(Boolean) : [];
  for (const token of forced) if (!tokens.includes(token)) tokens.push(token);
  return tokens.length === 0 ? undefined : tokens.join(' ');
}

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
  const popover = link.closest<HTMLElement>('[popover]');
  try {
    popover?.hidePopover();
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
  context: RenderContext,
): Record<string, unknown> {
  const isCanvas = context.isCanvas;
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
      // An iframe's src already passed the embed allowlist above.
      const safe = tag === 'iframe' ? value.trim() : safeSrc(value);
      if (safe !== undefined) out[name] = safe;
      continue;
    }
    if (name === 'href') {
      /*
        The same policy RichText applies to a link mark: https, mailto, tel,
        and relative survive; `javascript:` and every unconsidered scheme are
        dropped, and the element renders as text without a destination. A
        text path's href is a `#id` in the same drawing (checked above).
      */
      const safe = tag === 'a' ? safeHref(value) : tag === 'textPath' ? value : undefined;
      if (safe !== undefined) out['href'] = safe;
      continue;
    }
    if (name === 'target') {
      // Only a new tab is a meaningful target here; a named frame is not.
      if (value === '_blank') out['target'] = '_blank';
      continue;
    }
    if (name === 'value' && tag === 'input') {
      out['defaultValue'] = value;
      continue;
    }
    if (name === 'type' && tag === 'button') continue; // decided below
    if (BOOLEAN_ATTRIBUTES.has(name)) {
      // Only a bare spelling passed the policy: '', the name, or 'true'.
      out[INITIAL_VALUE_PROP[name] ?? REACT_PROP[name] ?? name] = true;
      continue;
    }
    out[REACT_PROP[name] ?? name] = value;
  }
  if (tag === 'a') {
    const href = out['href'];
    const forced: string[] = [];
    if (typeof href === 'string' && /^https?:\/\//iu.test(href)) {
      // An external link never hands the opener to the destination.
      forced.push('noopener', 'noreferrer');
    }
    // A new tab never gets the opener either, wherever it points.
    if (out['target'] === '_blank') forced.push('noopener');
    const rel = linkRel(out['rel'], forced);
    if (rel === undefined) delete out['rel'];
    else out['rel'] = rel;
    if (isCanvas) {
      // On the editing canvas a link is something to select, not to follow.
      out['onClick'] = preventDefault;
    } else if (typeof href === 'string' && href.startsWith('#')) {
      out['onClick'] = closeOwningPopover;
    }
  }
  if (tag === 'button') {
    /*
      Never a handler, and a submit only inside a form that sends through the
      WhatsApp behaviour — the one way a tree's form leaves the page. Anywhere
      else it is a styled affordance, wired later.
    */
    out['type'] = declared?.['type'] === 'submit' && context.inSendingForm ? 'submit' : 'button';
  }
  if (tag === 'form') {
    /*
      A form has no action, so a submit that reached the browser would reload
      the page with its fields in the address. The WhatsApp behaviour sends
      it (and prevents the reload itself) on a published page; on the canvas,
      and for a form without that behaviour, React swallows the submit.
    */
    if (isCanvas || declared?.['data-ck-behavior'] !== 'whatsapp-form') {
      out['onSubmit'] = preventDefault;
    }
  }
  if (tag === 'iframe') {
    /*
      Forced, whatever the tree says — none of these is an attribute the
      vocabulary admits, so a stored tree cannot weaken them. On the canvas
      the frame does not take the pointer, so a click selects it.
    */
    out['sandbox'] = CUSTOM_CODE_IFRAME_SANDBOX;
    out['loading'] = 'lazy';
    out['referrerPolicy'] = CUSTOM_CODE_IFRAME_REFERRER_POLICY;
    out['allow'] = CUSTOM_CODE_IFRAME_ALLOW;
    out['allowFullScreen'] = true;
    if (isCanvas) out['style'] = { pointerEvents: 'none' };
  }
  if (isCanvas && CONTROL_TAGS.has(tag)) {
    // Inert in the editor: not a tab stop, and typing never changes the page.
    out['tabIndex'] = -1;
    if (tag !== 'select') out['readOnly'] = true;
    // readOnly does not stop a checkbox or radio toggling; a swallowed click does.
    if (tag === 'input') out['onClick'] = preventDefault;
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
  /** Rewrites every element and icon className before it renders (named styles). */
  readonly classTransform: CustomCodeClassTransform;
  /** Inside a form that sends through the WhatsApp behaviour: a button may submit it. */
  readonly inSendingForm: boolean;
  /**
   * Changes when the lazily loaded icon data lands, so a render that drew a
   * placeholder draws the icon on the next pass. Read by nothing but identity.
   */
  readonly iconVersion: number;
}

function transformedClass(context: RenderContext, value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  return context.classTransform(value);
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
  return addressComponent(
    context,
    key,
    path,
    type,
    componentBody(node, path, depth, context, type),
  );
}

/**
 * On the canvas a tree component is ADDRESSABLE like an element: it sits in a
 * box-less wrapper (`display: contents`) carrying its path, so the shell's
 * hit-test can name it and the Inspector can read and write it by path. The
 * published page renders the block alone — the wrapper is chrome, not content.
 */
function addressComponent(
  context: RenderContext,
  key: string,
  path: string,
  type: string,
  body: ReactNode,
): ReactNode {
  if (!context.isCanvas) return <Fragment key={key}>{body}</Fragment>;
  return (
    <div
      key={key}
      {...{ [PATH_ATTRIBUTE]: path }}
      data-ck-component={type}
      style={{ display: 'contents' }}
    >
      {body}
    </div>
  );
}

function componentBody(
  node: Record<string, unknown>,
  path: string,
  depth: number,
  context: RenderContext,
  type: string,
): ReactNode {
  const entry = context.lookup?.(type);
  const render = entry?.render;
  if (entry === undefined || render === undefined) {
    return <UnknownBlock type={type} />;
  }
  const props = validatedProps(entry, asRecord(node['props']) ?? {});
  if (props === undefined) {
    return <UnknownBlock type={type} />;
  }
  const children = childrenOf(node);
  const rendered = children.map((child, at) =>
    renderNode(child, `${path}.${String(at)}`, depth + 1, context),
  );
  const Block = render as ComponentType<BlockRenderProps>;
  return (
    <Block
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
  const ref = parseCustomCodeIconName(name);
  const filled = ref.set === 'tabler-filled';
  const address = pathAttribute(context, key);
  const size = typeof node['size'] === 'number' ? node['size'] : 24;
  const className = transformedClass(context, node['className']);
  if (ref.set !== 'lucide' && !tablerIconsLoaded() && !tablerIconsFailed()) {
    /*
      The Tabler set arrives lazily. Until it lands the icon keeps its box,
      empty and hidden from assistive technology, so the layout does not jump
      and nothing announces a placeholder; CustomCode re-renders on arrival.
    */
    return (
      <svg
        key={key}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={className}
        data-icon={name}
        data-ck-icon-pending=""
        aria-hidden
        {...address}
      />
    );
  }
  const data =
    ref.set === 'lucide'
      ? lucideIconNode(ref.name)
      : tablerIconNode(ref.name, filled ? 'filled' : 'outline');
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
  const strokeWidth = typeof node['strokeWidth'] === 'number' ? node['strokeWidth'] : 2;
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
      // A filled Tabler icon is painted, not stroked.
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={filled ? undefined : strokeWidth}
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

  const className = transformedClass(context, node['className']);
  const text = typeof node['text'] === 'string' ? node['text'] : undefined;
  /*
    `label` and `locked` are editor metadata (the Layers name, the canvas
    lock). They are node fields, not attributes, and nothing here reads them:
    they never reach the DOM, on the canvas or in the published page.
  */
  const attributes = elementAttributes(tag, node, context);
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
  if (tag === 'textarea') {
    // A textarea's text is where it starts, not a child React would own.
    if (text !== undefined) props['defaultValue'] = text;
    return createElement(tag, props);
  }
  const attributesRecord = asRecord(node['attributes']);
  const inner: RenderContext =
    tag === 'form' && attributesRecord?.['data-ck-behavior'] === 'whatsapp-form'
      ? { ...context, inSendingForm: true }
      : context;
  const children = childrenOf(node).map((child, at) => {
    if (svg && !isSvgElement(child)) return null;
    return renderNode(child, `${path}.${String(at)}`, depth + 1, inner);
  });
  // Drawn text (`text`, `tspan`, `textPath`) is the one svg family that holds text.
  const drawsText = !svg || SVG_TEXT_TAGS.has(tag);
  return createElement(
    tag,
    props,
    text === undefined || !drawsText ? children : [text, ...children],
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
  const classTransform = useCustomCodeClassTransform();
  const regionRef = useRef<HTMLDivElement>(null);
  /*
    Tabler icons draw from data loaded on first use. The version is part of
    the render context, so the pass after it lands draws them; a tree without
    a Tabler name never starts the load.
  */
  const iconVersion = useSyncExternalStore(
    subscribeTablerIcons,
    tablerIconsVersion,
    tablerIconsVersion,
  );
  const usesTabler = customCodeIconNames(tree).some((name) => name.startsWith('tabler'));
  useEffect(() => {
    if (usesTabler && !tablerIconsLoaded()) void loadTablerIcons();
  }, [usesTabler]);
  /*
    Site behaviours (data-ck-behavior): the curated runtime mounts on the
    region after each commit of a new tree and is disposed before the next.
    On the canvas the click-driven ones (lightbox, WhatsApp, copy) stay inert,
    so a click selects rather than opens. The styles arrive with the first
    behaviour, so a host needs no stylesheet import for them.
  */
  useEffect(() => {
    const region = regionRef.current;
    if (region === null) return undefined;
    /*
      Effects (ck-fx-*) need only their stylesheet; motion, hover presets and
      the spotlight also need the runtime, which sets data-ck-still on the
      canvas so Preview (data-ck-play) can replay them.
    */
    if (region.querySelector('[class*="ck-fx-"]') !== null) ensureMotionCss(region.ownerDocument);
    if (region.querySelector(BEHAVIOR_RUNTIME_SELECTOR) === null) return undefined;
    ensureBehaviorCss(region.ownerDocument);
    return mountBehaviors(region, { interactive: !isCanvas });
  }, [tree, isCanvas]);
  const root = asRecord(tree);
  const context: RenderContext = {
    hostId,
    lookup: blockLookup ?? contextLookup,
    isCanvas,
    classTransform,
    inSendingForm: false,
    iconVersion,
  };
  const children = root === null ? [] : childrenOf(root);
  // The region marker is where the live Tailwind sheet's `@scope` begins.
  const region = { [CUSTOM_CODE_REGION_ATTRIBUTE]: '' };
  return (
    <div ref={regionRef} className={className} data-ck={hostId} {...region}>
      {children.map((child, at) => renderNode(child, String(at), 0, context))}
    </div>
  );
}
