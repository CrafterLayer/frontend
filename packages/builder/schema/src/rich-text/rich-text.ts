import { z } from 'zod';

/**
 * Rich-text leaf props (008 contract §1). The stored form is plain JSON
 * (Law J) validated STRICTLY at the command door against this whitelist —
 * unknown node types, unknown mark types, out-of-range heading levels, and
 * extra attributes are all rejected on WRITE with path-addressed errors.
 * Reading is the renderer's tolerant concern; writing is this door's strict one.
 *
 * The whitelist is deliberately NO LOOSER than what a ProseMirror-family editor
 * can load (§10 review fix): a document this door accepts but an editor cannot
 * open would be silently emptied by the editor and then overwritten by the next
 * keystroke — data loss disguised as an ordinary edit. Hence: non-empty doc,
 * list items that start with a paragraph, and at most one mark of a kind per
 * text node.
 */

export interface RichTextLinkMark {
  type: 'link';
  attrs: { href: string };
}
export type RichTextMark = { type: 'bold' } | { type: 'italic' } | RichTextLinkMark;

export type RichTextInline =
  { type: 'text'; text: string; marks?: RichTextMark[] | undefined } | { type: 'hardBreak' };

export interface RichTextListItem {
  type: 'listItem';
  content: [RichTextParagraph, ...RichTextBlockNode[]];
}

export interface RichTextParagraph {
  type: 'paragraph';
  content?: RichTextInline[] | undefined;
}

export type RichTextBlockNode =
  | RichTextParagraph
  | { type: 'heading'; attrs: { level: 2 | 3 | 4 }; content?: RichTextInline[] | undefined }
  | { type: 'bulletList'; content: RichTextListItem[] }
  | { type: 'orderedList'; content: RichTextListItem[] };

export interface RichTextDoc {
  type: 'doc';
  content: [RichTextBlockNode, ...RichTextBlockNode[]];
}

/**
 * Structural nesting ceiling. Recursive zod schemas overflow the stack on
 * pathological input BEFORE any refinement runs, so the depth guard is a
 * separate, ITERATIVE pre-check piped ahead of the shape validation. It also
 * matches the renderer's own ceiling, keeping "storable ⇒ renderable" true.
 */
export const RICH_TEXT_MAX_DEPTH = 30;

function withinDepth(value: unknown): boolean {
  // Iterative walk: a hostile document must never recurse this validator.
  const stack: { node: unknown; depth: number }[] = [{ node: value, depth: 0 }];
  while (stack.length > 0) {
    const entry = stack.pop();
    /* v8 ignore next 3 -- pop() on a non-empty stack always yields an entry. */
    if (entry === undefined) {
      continue;
    }
    if (entry.depth > RICH_TEXT_MAX_DEPTH) {
      return false;
    }
    const node = entry.node;
    if (typeof node !== 'object' || node === null) {
      continue;
    }
    const content = (node as { content?: unknown }).content;
    if (Array.isArray(content)) {
      for (const child of content) {
        stack.push({ node: child, depth: entry.depth + 1 });
      }
    }
  }
  return true;
}

const markSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('bold') }),
  z.strictObject({ type: z.literal('italic') }),
  z.strictObject({
    type: z.literal('link'),
    attrs: z.strictObject({ href: z.string() }),
  }),
]);

const inlineSchema = z.discriminatedUnion('type', [
  z
    .strictObject({
      type: z.literal('text'),
      text: z.string(),
      marks: z.array(markSchema).optional(),
    })
    .refine(
      (node) =>
        node.marks === undefined ||
        new Set(node.marks.map((mark) => mark.type)).size === node.marks.length,
      { message: 'A text node may carry at most one mark of each kind.', path: ['marks'] },
    ),
  z.strictObject({ type: z.literal('hardBreak') }),
]);

const paragraphSchema = z.strictObject({
  type: z.literal('paragraph'),
  content: z.array(inlineSchema).optional(),
});

const blockNodeSchema: z.ZodType<RichTextBlockNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    paragraphSchema,
    z.strictObject({
      type: z.literal('heading'),
      attrs: z.strictObject({
        level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
      }),
      content: z.array(inlineSchema).optional(),
    }),
    z.strictObject({
      type: z.literal('bulletList'),
      content: z.array(listItemSchema).min(1),
    }),
    z.strictObject({
      type: z.literal('orderedList'),
      content: z.array(listItemSchema).min(1),
    }),
  ]),
);

const listItemSchema: z.ZodType<RichTextListItem> = z.lazy(() =>
  z.strictObject({
    type: z.literal('listItem'),
    // A list item OPENS with a paragraph, then may hold further blocks — the
    // shape every ProseMirror list schema requires (`paragraph block*`).
    content: z.tuple([paragraphSchema], blockNodeSchema),
  }),
);

const richTextStructureSchema = z.strictObject({
  type: z.literal('doc'),
  // A document always holds at least one block (the canonical empty document is
  // ONE empty paragraph) — an empty doc is unloadable in every editor.
  content: z.array(blockNodeSchema).min(1),
});

/** The full document validator — importable wherever the shape is needed. */
export const richTextDocSchema: z.ZodType<RichTextDoc> = z
  .custom<unknown>(withinDepth, {
    message: `Rich text nesting exceeds the supported depth (${String(RICH_TEXT_MAX_DEPTH)}).`,
  })
  .pipe(richTextStructureSchema) as unknown as z.ZodType<RichTextDoc>;

/** The meta marker field resolution matches on (s3: by META, never identity). */
export const RICH_TEXT_META_KEY = 'craftkit';
export const RICH_TEXT_META_VALUE = 'rich-text';

/**
 * Declare a rich-text prop: the strict structural validator tagged with the
 * machine-readable marker. Blocks use `richText()` directly; no package needs
 * the editing engine to DECLARE rich content (s1/s3).
 */
export function richText(): z.ZodType {
  return richTextDocSchema.meta({ [RICH_TEXT_META_KEY]: RICH_TEXT_META_VALUE });
}

/**
 * True when a property schema is a rich-text declaration — reads the meta
 * through optional/default/nullable wrappers (the resolve-field unwrap walk).
 */
export function isRichTextSchema(schema: z.ZodType): boolean {
  let current: z.ZodType = schema;
  for (;;) {
    const meta = (current as { meta?: () => Record<string, unknown> | undefined }).meta?.();
    if (meta?.[RICH_TEXT_META_KEY] === RICH_TEXT_META_VALUE) {
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

/** The canonical empty document: exactly one empty paragraph (never null). */
export function emptyRichText(): RichTextDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}
