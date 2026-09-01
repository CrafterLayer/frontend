import { z } from 'zod';

/**
 * The custom-code tree: what the assistant writes when no registered
 * block says the shape it needs.
 *
 * ## Why a tree and not a string of HTML
 *
 * The obvious design is a `html: string` prop rendered with
 * `dangerouslySetInnerHTML` and a sanitizer in front of it. That trade was
 * refused for the same reason `RichText` refused it: a sanitizer is a
 * blacklist maintained against an adversary, and every one of them has had a
 * bypass. A tree cannot express a `<script>` because the vocabulary has no
 * such node — there is nothing to bypass. The stored form is plain JSON
 * (Law J), validated strictly on WRITE, and rendered tolerantly on READ.
 *
 * The model loses nothing it can use. It still chooses any tag in the
 * vocabulary, any Tailwind utility, any nesting — and, crucially, it can
 * reference REGISTERED components by name, which raw HTML could never do.
 *
 * ## Two node kinds, and why the second one is the point
 *
 * An `element` is markup the model authors outright. A `component` is a
 * reference to something already in the registry — a shadcn card, an
 * aceternity backdrop, a Radix-backed accordion. Without the second kind the
 * "free" mode would be a downgrade: unlimited divs and no access to the
 * vendored component library the product is built on. With it, the model
 * composes freely AND reaches every registered block, while the component's
 * own props schema still validates what it is handed.
 */

/** Tags the vocabulary admits. Structure, text, media, lists, links, and buttons — no more. */
export const CUSTOM_CODE_TAGS = [
  'a',
  'article',
  'aside',
  'blockquote',
  'br',
  'button',
  'code',
  'div',
  'em',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'img',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'ul',
] as const;

export type CustomCodeTag = (typeof CUSTOM_CODE_TAGS)[number];

/*
  Embedding and form tags are ABSENT on purpose, and each absence is a
  decision rather than an oversight:

    script, style, iframe, object, embed — code and frame injection.
    form, input, select, textarea — a control the document cannot wire to a
        handler is a control that lies to the reader; registered blocks own
        real interactivity, and a `component` reference reaches them.
    video, audio, canvas, svg — media and drawing need their own prop
        vocabularies (icons have one: the `icon` node kind); a later, explicit
        addition rather than a silent one.

  Two were absent in the first version and are present now, each with a policy
  the renderer enforces rather than a hope:

    a — `href` passes `safeHref` (https, mailto, tel, relative; never
        javascript:), an external link gets `rel="noopener noreferrer"`, and
        on the editing canvas a click is swallowed so the editor is not
        navigated away from. A CV page without a link to anything was the
        argument for admitting it.
    button — always `type="button"`, never a submit, never a handler. It is
        a styled affordance the assistant can place; a registered block or a
        host wires behaviour to it later.
*/

/** Attributes an element may carry. Presentation, accessibility, and link targets. */
export const CUSTOM_CODE_ATTRIBUTES = [
  'alt',
  'aria-hidden',
  'aria-label',
  'datetime',
  'href',
  'id',
  'role',
  'src',
  'target',
  'title',
] as const;

export type CustomCodeAttribute = (typeof CUSTOM_CODE_ATTRIBUTES)[number];

export interface CustomCodeElement {
  kind: 'element';
  tag: CustomCodeTag;
  /** Utility classes; validated against the run's vocabulary by the AI door. */
  className?: string | undefined;
  /** Literal text content. Rendered as text, never parsed. */
  text?: string | undefined;
  /*
    `Record<…, string | undefined>` rather than `Partial<Record<…, string>>`:
    this workspace compiles with `exactOptionalPropertyTypes`, under which those
    two are different types and zod's inferred output is the former.
  */
  attributes?: Partial<Record<CustomCodeAttribute, string | undefined>> | undefined;
  children?: CustomCodeNode[] | undefined;
}

export interface CustomCodeComponent {
  kind: 'component';
  /** A registered block type. Resolved at render; unknown ⇒ UnknownBlock. */
  component: string;
  /** Handed to that block's own schema for validation before it renders. */
  props?: Record<string, unknown> | undefined;
  /** Rendered into the referenced block's default slot. */
  children?: CustomCodeNode[] | undefined;
}

/**
 * An icon from the Lucide set, by its kebab-case name (`mail`, `arrow-right`,
 * `github`). A LEAF: it has no children and no text.
 *
 * Icons are a node kind rather than an `svg` tag in the element vocabulary
 * for one reason: an authored `<svg>` is a drawing surface, and a drawing
 * surface accepts `<script>`, `<foreignObject>`, `xlink:href` and everything
 * else the tree exists to make unrepresentable. A NAME is not a surface. The
 * renderer looks it up in a fixed set and draws the paths itself; an unknown
 * name draws a visible placeholder, and the AI door refuses it before that.
 */
export interface CustomCodeIcon {
  kind: 'icon';
  /** Kebab-case Lucide name. Validated for shape here; for existence at the door. */
  name: string;
  className?: string | undefined;
  /** Rendered size in CSS pixels; 24 when absent, the set's native grid. */
  size?: number | undefined;
  /** Stroke width in the 24-unit grid; 2 when absent. */
  strokeWidth?: number | undefined;
  /**
   * Accessible name. Present ⇒ `role="img"` with this label; absent ⇒ the
   * icon is decorative and hidden from assistive technology. There is no
   * third state: an unlabelled icon that is not hidden is announced as
   * "image", which is worse than either.
   */
  label?: string | undefined;
}

export type CustomCodeNode = CustomCodeElement | CustomCodeComponent | CustomCodeIcon;

/** The shape of a Lucide name: lowercase words joined by single hyphens, digits allowed. */
export const CUSTOM_CODE_ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/**
 * Structural nesting ceiling — the same argument as `RICH_TEXT_MAX_DEPTH`, and
 * deliberately the same number. Recursive zod schemas overflow the stack on
 * pathological input BEFORE any refinement runs, so the guard is an ITERATIVE
 * pre-check piped ahead of shape validation. It also matches the renderer's
 * ceiling, which is what keeps "storable ⇒ renderable" true.
 */
export const CUSTOM_CODE_MAX_DEPTH = 30;

/**
 * Total node ceiling. Depth alone does not bound size: a flat list of a
 * million spans is depth 1 and would still take the canvas down. The door
 * refuses what the renderer could not survive.
 */
export const CUSTOM_CODE_MAX_NODES = 2_000;

interface WalkLimits {
  readonly withinDepth: boolean;
  readonly withinCount: boolean;
}

/** One iterative pass answering both ceilings; a hostile tree never recurses it. */
function walkLimits(value: unknown): WalkLimits {
  const stack: { node: unknown; depth: number }[] = [{ node: value, depth: 0 }];
  let count = 0;
  while (stack.length > 0) {
    const entry = stack.pop();
    /* v8 ignore next 3 -- pop() on a non-empty stack always yields an entry. */
    if (entry === undefined) {
      continue;
    }
    if (entry.depth > CUSTOM_CODE_MAX_DEPTH) {
      return { withinDepth: false, withinCount: count <= CUSTOM_CODE_MAX_NODES };
    }
    const node = entry.node;
    if (typeof node !== 'object' || node === null) {
      continue;
    }
    count += 1;
    if (count > CUSTOM_CODE_MAX_NODES) {
      return { withinDepth: true, withinCount: false };
    }
    const children = (node as { children?: unknown }).children;
    if (Array.isArray(children)) {
      for (const child of children) {
        stack.push({ node: child, depth: entry.depth + 1 });
      }
    }
  }
  return { withinDepth: true, withinCount: true };
}

const attributesSchema = z.strictObject(
  Object.fromEntries(
    CUSTOM_CODE_ATTRIBUTES.map((name) => [name, z.string().max(2_000).optional()]),
  ) as Record<CustomCodeAttribute, z.ZodOptional<z.ZodString>>,
);

const nodeSchema: z.ZodType<CustomCodeNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('element'),
      tag: z.enum(CUSTOM_CODE_TAGS),
      className: z.string().max(1_000).optional(),
      text: z.string().max(20_000).optional(),
      attributes: attributesSchema.optional(),
      children: z.array(nodeSchema).optional(),
    }),
    z.strictObject({
      kind: z.literal('component'),
      /*
        A block type, not a path or a URL. The bound is generous for a
        namespaced type name and firmly short of anything that could carry a
        payload — the renderer only ever uses this to key a registry lookup.
      */
      component: z.string().min(1).max(120),
      props: z.record(z.string(), z.json()).optional(),
      children: z.array(nodeSchema).optional(),
    }),
    z.strictObject({
      kind: z.literal('icon'),
      name: z.string().min(1).max(64).regex(CUSTOM_CODE_ICON_NAME),
      className: z.string().max(1_000).optional(),
      size: z.number().int().min(8).max(256).optional(),
      strokeWidth: z.number().min(0.5).max(4).optional(),
      label: z.string().max(120).optional(),
    }),
  ]),
);

const structureSchema = z.strictObject({
  kind: z.literal('root'),
  children: z.array(nodeSchema),
});

export interface CustomCodeRoot {
  kind: 'root';
  children: CustomCodeNode[];
}

/** The full tree validator — importable wherever the shape is needed. */
export const customCodeTreeSchema: z.ZodType<CustomCodeRoot> = z
  .custom<unknown>((value) => walkLimits(value).withinDepth, {
    message: `Custom-code nesting exceeds the supported depth (${String(CUSTOM_CODE_MAX_DEPTH)}).`,
  })
  .pipe(
    z.custom<unknown>((value) => walkLimits(value).withinCount, {
      message: `Custom-code tree exceeds the supported node count (${String(CUSTOM_CODE_MAX_NODES)}).`,
    }),
  )
  .pipe(structureSchema);

/** The meta marker, matched by META rather than identity (the rich-text rule). */
export const CUSTOM_CODE_META_KEY = 'craftkit';
export const CUSTOM_CODE_META_VALUE = 'custom-code-tree';

/** Declare a custom-code-tree prop, tagged with the machine-readable marker. */
export function customCodeTree(): z.ZodType {
  return customCodeTreeSchema.meta({ [CUSTOM_CODE_META_KEY]: CUSTOM_CODE_META_VALUE });
}

/** True when a property schema is a custom-code declaration; unwraps wrappers. */
export function isCustomCodeTreeSchema(schema: z.ZodType): boolean {
  let current: z.ZodType = schema;
  for (;;) {
    const meta = (current as { meta?: () => Record<string, unknown> | undefined }).meta?.();
    if (meta?.[CUSTOM_CODE_META_KEY] === CUSTOM_CODE_META_VALUE) {
      return true;
    }
    const def = current._zod.def as { type: string; innerType?: z.ZodType };
    const isWrapper = def.type === 'optional' || def.type === 'default' || def.type === 'nullable';
    if (!isWrapper || def.innerType === undefined) {
      return false;
    }
    current = def.innerType;
  }
}

/** The canonical empty tree: a root with no children (never null). */
export function emptyCustomCodeTree(): CustomCodeRoot {
  return { kind: 'root', children: [] };
}

const TAG_SET: ReadonlySet<string> = new Set(CUSTOM_CODE_TAGS);

/** Whether a tag name is in the render vocabulary — the renderer's read guard. */
export function isCustomCodeTag(tag: string): tag is CustomCodeTag {
  return TAG_SET.has(tag);
}

/**
 * Every `className` in a tree, in document order.
 *
 * Lives here rather than in the AI package because the AI door and the
 * Inspector both need it and neither should own a second tree walk. Tolerant
 * by design: it reads whatever it is given, so the AI door can inspect a
 * proposal that has not been validated yet.
 */
export function customCodeClassNames(value: unknown): readonly string[] {
  const found: string[] = [];
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) {
      continue;
    }
    const className = (node as { className?: unknown }).className;
    if (typeof className === 'string') {
      found.push(className);
    }
    const children = (node as { children?: unknown }).children;
    if (Array.isArray(children)) {
      for (const child of children) {
        stack.push(child);
      }
    }
  }
  return found;
}

/** Every icon name in a tree, deduplicated and sorted — for the door that checks existence. */
export function customCodeIconNames(value: unknown): readonly string[] {
  const found = new Set<string>();
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) {
      continue;
    }
    const record = node as { kind?: unknown; name?: unknown; children?: unknown };
    if (record.kind === 'icon' && typeof record.name === 'string') {
      found.add(record.name);
    }
    if (Array.isArray(record.children)) {
      for (const child of record.children) {
        stack.push(child);
      }
    }
  }
  return [...found].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/** Every referenced component type in a tree, deduplicated and sorted. */
export function customCodeComponentTypes(value: unknown): readonly string[] {
  const found = new Set<string>();
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const node = stack.pop();
    if (typeof node !== 'object' || node === null) {
      continue;
    }
    const record = node as { kind?: unknown; component?: unknown; children?: unknown };
    if (record.kind === 'component' && typeof record.component === 'string') {
      found.add(record.component);
    }
    if (Array.isArray(record.children)) {
      for (const child of record.children) {
        stack.push(child);
      }
    }
  }
  return [...found].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/*
  ── Custom CSS declaration ──────────────────────────────────────────────────

  A stylesheet prop is a `z.string()`, and so is a title, a slug, and a label.
  Nothing in the shape distinguishes them, so the Inspector would offer all
  four the same single-line box — and the one that needs a code surface and a
  refusal list would be the one least served by it.

  The marker is the same mechanism `richText()` uses, and for the same reason:
  a field type matches on a DECLARATION the block makes, never on a property
  name. Matching `key === 'css'` would silently capture any block that happened
  to name a prop `css`, and silently miss one that named it `styles`.
*/

/** The meta marker a CSS field type matches on. */
export const CUSTOM_CSS_META_VALUE = 'custom-css';

/*
  Returns a `ZodType<string>` rather than a bare `ZodType`: the marker is for
  the Inspector, and it must not cost the BLOCK its inferred prop type. Declared
  loosely, `props.css` infers as `unknown` and every renderer that touches it
  needs a cast — a type hole opened by a presentation concern.
*/
/** Declare a scoped-CSS prop: a string, marked as a stylesheet. */
export function customCss(max = 8_000): z.ZodType<string> {
  return z
    .string()
    .max(max)
    .default('')
    .meta({ [CUSTOM_CODE_META_KEY]: CUSTOM_CSS_META_VALUE });
}

/** True when a property schema is a scoped-CSS declaration; unwraps wrappers. */
export function isCustomCssSchema(schema: z.ZodType): boolean {
  let current: z.ZodType = schema;
  for (;;) {
    const meta = (current as { meta?: () => Record<string, unknown> | undefined }).meta?.();
    if (meta?.[CUSTOM_CODE_META_KEY] === CUSTOM_CSS_META_VALUE) {
      return true;
    }
    const def = current._zod.def as { type: string; innerType?: z.ZodType };
    const isWrapper = def.type === 'optional' || def.type === 'default' || def.type === 'nullable';
    if (!isWrapper || def.innerType === undefined) {
      return false;
    }
    current = def.innerType;
  }
}
