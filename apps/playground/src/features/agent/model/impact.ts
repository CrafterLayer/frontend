import {
  isRichTextSchema,
  type BlockSchema,
  type BuilderDocument,
  type Node,
  type NodeId,
} from '@craftkit/builder';

import type { ChangeLineView, CopyParams } from './view-types';

/**
 * What a plan changes, computed by DIFFING documents (SPEC §4.9 ChangeLines, §4.13
 * ProposalCard, §7.4 `impact.ts`).
 *
 * Not a second model call, and not a re-reading of the plan's commands. `previewAiPlan`
 * already runs the plan on a scratch kernel through the real door, so the previewed
 * document IS the outcome: the only honest source for "what will change", because it
 * accounts for what the commands actually did rather than what they were named. A step
 * list answers "what was asked for"; this answers "what happens", and the two differ
 * exactly where it matters: an `insertNode` the schema placed elsewhere, a `setProp` to
 * the value already there, a command a later one in the same plan undid.
 *
 * Copied from v1 `AssistantPanel.impact.ts`. Changed per SPEC §7.4: `describeImpact`
 * returns catalog keys with counts, not English and Arabic sentences, so the catalog can
 * pick each count's plural form; `impactLines` is new; the token estimate and its
 * "~4.2k tokens" string are not here at all (telemetry and Technical details only).
 */
export interface PlanImpact {
  /**
   * Document-level metadata the plan changed. Not a node, so no node diff would mention
   * it, and a plan that flips a page to RTL rearranges everything a person can see while
   * touching no node: without this the card said "changes nothing" about the largest
   * change the panel can make.
   */
  readonly meta: readonly ('dir' | 'surface')[];
  /** Node ids that exist after and did not before. */
  readonly added: readonly NodeId[];
  /** Node ids that exist in both and whose content differs. */
  readonly changed: readonly NodeId[];
  /** Node ids that existed before and do not after. */
  readonly removed: readonly NodeId[];
  /** Blocks by type, for a sentence a person reads rather than a list of ids. */
  readonly addedTypes: readonly string[];
  /** True when the plan validated and applied cleanly but moved nothing. */
  readonly empty: boolean;
}

/*
  Everything about a node EXCEPT which children sit in its slots, as a string that does
  not depend on key ORDER. `JSON.stringify` walks keys in insertion order, and a plan's
  commands routinely produce the same props in a different order, which read as a change.
*/
function contentOf(node: Node | undefined): string {
  if (node === undefined) return '';
  const rest: Record<string, unknown> = { ...node };
  delete rest['slots'];
  return stableJson(rest);
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return entry;
    return Object.fromEntries(
      Object.entries(entry as Record<string, unknown>).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    );
  });
}

function slotsOf(node: Node | undefined): string {
  return JSON.stringify(node?.slots ?? {});
}

/*
  A node's slots with the ids this plan ADDED or REMOVED taken out. A parent that gained a
  child differs only by that child, which the summary already reports, so it is not
  counted again. A parent involved in a MOVE still differs: the id that left is neither
  added nor removed. (v1's first rule missed the move case, and a plan that rearranged the
  page reported that it changed nothing; found by an adversarial probe.)
*/
function slotsWithout(node: Node | undefined, ignore: ReadonlySet<NodeId>): string {
  const slots = node?.slots ?? {};
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(slots).map(([slot, ids]) => [slot, ids.filter((id) => !ignore.has(id))]),
    ),
  );
}

function meaningfullyChanged(
  previous: Node | undefined,
  next: Node | undefined,
  addedOrRemoved: ReadonlySet<NodeId>,
): boolean {
  if (contentOf(previous) !== contentOf(next)) return true;
  if (slotsOf(previous) === slotsOf(next)) return false;
  return slotsWithout(previous, addedOrRemoved) !== slotsWithout(next, addedOrRemoved);
}

/*
  The nodes in the order they read down the page, not `Object.keys` order (the order they
  were CREATED). An id the walk never reached is still reported: an orphan is exactly the
  kind of thing a summary exists to surface. Cycle-safe.
*/
function orderedIds(document: BuilderDocument): NodeId[] {
  const out: NodeId[] = [];
  const seen = new Set<NodeId>();
  const walk = (id: NodeId): void => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
    const node = document.nodes[id];
    if (node?.slots === undefined) return;
    for (const children of Object.values(node.slots)) {
      for (const child of children) walk(child);
    }
  };
  walk(document.rootId);
  for (const id of Object.keys(document.nodes)) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

/* `schemaVersion` is deliberately absent: migrations own it and no command may change it. */
function changedMeta(before: BuilderDocument, after: BuilderDocument): ('dir' | 'surface')[] {
  const out: ('dir' | 'surface')[] = [];
  if (before.dir !== after.dir) out.push('dir');
  if (before.surface !== after.surface) out.push('surface');
  return out;
}

export function planImpact(before: BuilderDocument, after: BuilderDocument): PlanImpact {
  const added: NodeId[] = [];
  const changed: NodeId[] = [];
  const addedTypes: string[] = [];

  const afterIds = orderedIds(after);
  // Includes an id still LISTED in a slot but gone from `nodes`, reported once, here.
  const removed = orderedIds(before).filter((id) => after.nodes[id] === undefined);
  // Before the change pass: a parent is usually visited before the child that explains it.
  const addedOrRemoved = new Set<NodeId>([
    ...afterIds.filter((id) => before.nodes[id] === undefined),
    ...removed,
  ]);

  for (const id of afterIds) {
    const previous = before.nodes[id];
    const next = after.nodes[id];
    // A dangling reference, already reported as removed; not ALSO as changed.
    if (next === undefined) continue;
    if (previous === undefined) {
      added.push(id);
      addedTypes.push(next.type);
      continue;
    }
    if (meaningfullyChanged(previous, next, addedOrRemoved)) changed.push(id);
  }

  const meta = changedMeta(before, after);
  return {
    added,
    changed,
    removed,
    addedTypes,
    meta,
    empty: added.length === 0 && changed.length === 0 && removed.length === 0 && meta.length === 0,
  };
}

/* ── The impact as catalog keys ───────────────────────────────────────────────── */

/**
 * Every key `describeImpact` emits. The catalog (WP-04) renders each with the counted
 * noun's plural form: `impact.added` with `{ n: 3 }` is «أُضيف 3 عناصر» / "3 blocks added"
 * there, never a string assembled here (v1 wrote «إضافة 1» and "1 block added" inline).
 */
export const IMPACT_KEYS = [
  'impact.none',
  'impact.added',
  'impact.changed',
  'impact.removed',
  'impact.dir',
  'impact.surface',
] as const;

export type ImpactKey = (typeof IMPACT_KEYS)[number];

export interface ImpactPart {
  readonly key: ImpactKey;
  readonly params: CopyParams;
}

/**
 * The impact as parts of one sentence, in reading order. Counts, not ids: an id is the
 * right thing to jump to and the wrong thing to read. Direction and surface are NAMED,
 * not counted: "1 changed" would be true and useless when it is the page's direction
 * that turns. The component joins the parts with the locale's list separator.
 */
export function describeImpact(impact: PlanImpact): readonly ImpactPart[] {
  if (impact.empty) return [{ key: 'impact.none', params: {} }];
  const parts: ImpactPart[] = [];
  const count = (key: ImpactKey, n: number): void => {
    if (n > 0) parts.push({ key, params: { n } });
  };
  count('impact.added', impact.added.length);
  count('impact.changed', impact.changed.length);
  count('impact.removed', impact.removed.length);
  for (const field of impact.meta) {
    parts.push({ key: field === 'dir' ? 'impact.dir' : 'impact.surface', params: {} });
  }
  return parts;
}

/* ── The impact as lines, in schema terms ───────────────────────────────────── */

/**
 * The copy catalog keys `impactLines` takes its words from (SPEC §4.0: no string outside
 * the catalog). Every one names a SCHEMA thing (an element's role, a document field, a
 * value), never a command. Both catalogs hold each (`catalog.test.ts` checks it); the host
 * passes `(key) => t(locale, key)`, and an Arabic page reads «العنوان», not "Heading".
 */
export const IMPACT_WORD_KEYS = [
  'change.label.section',
  'change.label.heading',
  'change.label.link',
  'change.label.button',
  'change.label.listItem',
  'change.label.quote',
  'change.label.caption',
  'change.label.label',
  'change.label.tableHeading',
  'change.label.tableCell',
  'change.label.text',
  'change.label.pageDirection',
  'change.label.pageSurface',
  'change.value.ltr',
  'change.value.rtl',
  'change.value.on',
  'change.value.off',
] as const;

export type ImpactWordKey = (typeof IMPACT_WORD_KEYS)[number];

/**
 * Where `impactLines` gets every name it writes. Required, with no default: an English
 * default was one forgotten argument away from English lines on an Arabic page (found by
 * probe: an RTL Arabic document read "Page direction", "Right to left", "Heading").
 */
export interface ImpactNaming {
  /** A catalog word in the panel's locale: `(key) => t(locale, key)`. */
  readonly word: (key: ImpactWordKey) => string;
  /** A block type's name, as the layers panel shows it (`pricingTable` → "Pricing Table"). */
  readonly blockType: (type: string) => string;
  /** A block property's label, as the Inspector shows it (`buttonLabel` → "Button label"). */
  readonly property: (blockType: string, propKey: string) => string;
  /** A document surface (`site`, `email`), in words. */
  readonly surface: (surface: string) => string;
  /**
   * A block's OWN name when it carries one: the layers panel's instance label, never its
   * type (undefined when it has none, and the line reads its words, then its type).
   * Absent: the `label` prop, the builder's convention for an instance name.
   */
  readonly instanceName?: ((node: Node) => string | undefined) | undefined;
  /**
   * The props of a block type that hold words a person reads, in the schema's declaration
   * order: plain strings and rich text, never an enum, a URL-shaped string or a style.
   * Undefined for a type the host does not know; then only the props every catalog block
   * names its words with (`heading`, `title`, …) are read. `schemaImpactNaming` builds it
   * from the registry.
   */
  readonly textProps?: ((blockType: string) => readonly string[] | undefined) | undefined;
}

/*
  The Inspector's own rule (`shell/.../Inspector/property-label.ts`, not on the public
  facade yet): split camelCase, snake and kebab, sentence case.
*/
function humanise(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[_-]+/gu, ' ')
    .trim()
    .toLowerCase();
  return words === '' ? key : `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

/* The layers panel's rule for a type (`shell/.../naming/block-display-name.ts`): Title Case, CTA kept. */
function typeName(type: string): string {
  const words = type
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .split(/[^a-zA-Z0-9]+/u)
    .filter((word) => word !== '');
  if (words.length === 0) return type;
  return words
    .map((word) =>
      word.toLowerCase() === 'cta'
        ? 'CTA'
        : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join(' ');
}

/** The zod-4 introspection surface read here: every schema has `_zod.def.type`. */
type PropSchema = BlockSchema['props'];
interface SchemaDef {
  readonly type: string;
  readonly innerType?: PropSchema;
  readonly shape?: Readonly<Record<string, PropSchema>>;
  readonly format?: string;
}

function defOf(schema: PropSchema): SchemaDef {
  return schema._zod.def;
}

/** Past optional / default / nullable, as the Inspector's field resolution unwraps. */
function unwrapped(schema: PropSchema): PropSchema {
  let current = schema;
  for (;;) {
    const def = defOf(current);
    if (
      (def.type === 'optional' || def.type === 'default' || def.type === 'nullable') &&
      def.innerType !== undefined
    ) {
      current = def.innerType;
    } else {
      return current;
    }
  }
}

/*
  Keys whose string is an address, an identifier or a machine token, whatever its schema
  says: a block's `href` is `z.string()`, and "Section «#templates»" names nothing. `alt`
  and `placeholder` are words, but about a picture or an empty field, not the block.
*/
const NOT_WORDS: ReadonlySet<string> = new Set([
  'href',
  'src',
  'url',
  'action',
  'poster',
  'image',
  'avatar',
  'logo',
  'icon',
  'id',
  'anchor',
  'anchorId',
  'target',
  'rel',
  'autoComplete',
  'alt',
  'placeholder',
]);

/**
 * The words-bearing props of a block schema, in declaration order: a plain string (no
 * `format`: a URL, email or uuid is not words) or rich text. An enum is a choice among
 * the schema's own tokens (`tone: 'dark'`), and a boolean, a number or a style is not
 * words either.
 */
export function textPropsOf(schema: BlockSchema): readonly string[] {
  const shape = defOf(unwrapped(schema.props)).shape ?? {};
  return Object.entries(shape).flatMap(([key, prop]) => {
    if (NOT_WORDS.has(key) || STYLE_KEYS.has(key)) return [];
    if (isRichTextSchema(prop)) return [key];
    const def = defOf(unwrapped(prop));
    return def.type === 'string' && def.format === undefined ? [key] : [];
  });
}

/**
 * A naming from the catalog's words and the schema's own names: block types as the layers
 * panel shows them and properties as the Inspector labels them. Those two are the builder's
 * names in every locale today (the schema carries no Arabic ones), so a ChangeLine and the
 * Inspector beside it agree. `schemaOf` (the registry's `block(type)?.schema`) tells which
 * props hold words, so a block is never named by an enum or a URL. The host overrides any
 * of these when it has better names.
 */
export function schemaImpactNaming(
  word: ImpactNaming['word'],
  schemaOf?: (blockType: string) => BlockSchema | undefined,
): ImpactNaming {
  return {
    word,
    blockType: typeName,
    property: (_type, key) => humanise(key),
    surface: humanise,
    ...(schemaOf === undefined
      ? {}
      : {
          textProps: (type: string) => {
            const schema = schemaOf(type);
            return schema === undefined ? undefined : textPropsOf(schema);
          },
        }),
  };
}

/** An element's role inside a free-form region's tree, as the key that names it. */
const ELEMENT_ROLE: Readonly<Record<string, ImpactWordKey>> = {
  h1: 'change.label.heading',
  h2: 'change.label.heading',
  h3: 'change.label.heading',
  h4: 'change.label.heading',
  h5: 'change.label.heading',
  h6: 'change.label.heading',
  a: 'change.label.link',
  button: 'change.label.button',
  li: 'change.label.listItem',
  blockquote: 'change.label.quote',
  figcaption: 'change.label.caption',
  label: 'change.label.label',
  th: 'change.label.tableHeading',
  td: 'change.label.tableCell',
};

function elementRole(tag: string, naming: ImpactNaming): string {
  return naming.word(ELEMENT_ROLE[tag] ?? 'change.label.text');
}

/**
 * One ChangeLines line (SPEC §4.9): exactly `ChangeLineView`, which holds the changes in
 * words and, since wave 1's verifiers, the two that have none (`restyled`, `moved`). Those
 * used to get no line at all while `describeImpact` still counted them ("make the hero
 * darker" showed an empty card). One type, so the controller hands `impactLines`' output to
 * `EditRecordView.changes` and `ProposalView.changes` as it is.
 */
export type ImpactLine = ChangeLineView;

/** Longest value a line shows; the rest is on the page, one "Show on page" away. */
const MAX_VALUE = 80;

/* Keys that carry styling, not words: a change there is real but has no before → after in words. */
const STYLE_KEYS: ReadonlySet<string> = new Set(['className', 'css', 'style']);

/*
  Keys inside a structured value that are its SHAPE, not its words: ProseMirror's `type`,
  `marks` and `attrs`, a tree's `kind`, and link or media addresses. Read as words they put
  "paragraph", "text" and "https://…" on ChangeLines as if the page said them (found by
  probe: one paragraph added to the landing page's rich text read as three lines).
*/
const SHAPE_KEYS: ReadonlySet<string> = new Set(['type', 'kind', 'marks', 'attrs', 'href', 'src']);

function shown(text: string): string {
  const flat = text.replace(/\s+/gu, ' ').trim();
  return flat.length > MAX_VALUE ? `${flat.slice(0, MAX_VALUE - 1).trimEnd()}…` : flat;
}

interface Leaf {
  readonly label: string;
  readonly text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/*
  The words inside a structured prop, in reading order, each with the label a person
  would give it. A free-form region's tree (`{kind:'root'}`) is read element by element,
  so a changed `h2` says "Heading"; any other object or array is read string by string
  under its property's label. Styling keys are skipped: they change how words look, not
  what they say.
*/
function leavesOf(value: unknown, label: string, naming: ImpactNaming, out: Leaf[]): void {
  if (typeof value === 'string') {
    const text = value.trim();
    if (text !== '') out.push({ label, text });
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) leavesOf(entry, label, naming, out);
    return;
  }
  if (!isRecord(value)) return;

  if (value['kind'] === 'root' && Array.isArray(value['children'])) {
    leavesOf(value['children'], label, naming, out);
    return;
  }
  if (value['kind'] === 'element') {
    const tag = typeof value['tag'] === 'string' ? value['tag'] : '';
    leavesOf(value['text'], elementRole(tag, naming), naming, out);
    leavesOf(value['children'], label, naming, out);
    return;
  }
  if (value['kind'] === 'component') {
    const component = typeof value['component'] === 'string' ? value['component'] : '';
    if (isRecord(value['props'])) {
      for (const [key, entry] of Object.entries(value['props'])) {
        if (!STYLE_KEYS.has(key)) leavesOf(entry, naming.property(component, key), naming, out);
      }
    }
    leavesOf(value['children'], label, naming, out);
    return;
  }
  // An icon is drawn, not read.
  if (value['kind'] === 'icon') return;

  // A rich-text block (a paragraph, a heading) is ONE run of words, however many marks
  // split it into text nodes: "Every edit is **one transaction**" is one sentence.
  const inline = inlineText(value);
  if (inline !== undefined) {
    if (inline !== '') {
      out.push({
        label: value['type'] === 'heading' ? naming.word('change.label.heading') : label,
        text: inline,
      });
    }
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    if (!STYLE_KEYS.has(key) && !SHAPE_KEYS.has(key)) leavesOf(entry, label, naming, out);
  }
}

/*
  The words of a rich-text block whose children are all inline (text nodes and breaks),
  joined; undefined when it is not such a block. A hard break reads as a space.
*/
function inlineText(value: Readonly<Record<string, unknown>>): string | undefined {
  const content = value['content'];
  if (typeof value['type'] !== 'string' || !Array.isArray(content) || content.length === 0) {
    return undefined;
  }
  let text = '';
  for (const child of content as readonly unknown[]) {
    if (!isRecord(child)) return undefined;
    if (typeof child['text'] === 'string') text += child['text'];
    else if (child['type'] === 'hardBreak' || child['type'] === 'hard_break') text += ' ';
    else return undefined;
  }
  return text.replace(/\s+/gu, ' ').trim();
}

/*
  Two leaf sequences aligned by their longest common run (LCS), so an element inserted at
  the top reads as ONE addition, not as every later element changed. Between two matched
  leaves, a removed and an added leaf with the same label are one change (the heading's
  words were rewritten); whatever is left over was added or removed.
*/
function diffLeaves(before: readonly Leaf[], after: readonly Leaf[]): ChangeLineView[] {
  const same = (left: Leaf | undefined, right: Leaf | undefined): boolean =>
    right !== undefined && left?.label === right.label && left.text === right.text;
  const rows = before.length + 1;
  const columns = after.length + 1;
  const table = new Array<number>(rows * columns).fill(0);
  const at = (i: number, j: number): number => table[i * columns + j] ?? 0;
  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      table[i * columns + j] = same(before[i], after[j])
        ? at(i + 1, j + 1) + 1
        : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }

  const lines: ChangeLineView[] = [];
  let gone: Leaf[] = [];
  let arrived: Leaf[] = [];
  const flush = (): void => {
    for (const leaf of gone) {
      const index = arrived.findIndex((candidate) => candidate.label === leaf.label);
      const partner = arrived[index];
      if (partner === undefined) {
        lines.push({ kind: 'removed', label: leaf.label, value: shown(leaf.text) });
        continue;
      }
      arrived.splice(index, 1);
      lines.push({
        kind: 'changed',
        label: leaf.label,
        before: shown(leaf.text),
        after: shown(partner.text),
      });
    }
    for (const leaf of arrived)
      lines.push({ kind: 'added', label: leaf.label, value: shown(leaf.text) });
    gone = [];
    arrived = [];
  };

  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    const left = before[i];
    const right = after[j];
    if (same(left, right)) {
      flush();
      i += 1;
      j += 1;
    } else if (right === undefined || (left !== undefined && at(i + 1, j) >= at(i, j + 1))) {
      if (left !== undefined) gone.push(left);
      i += 1;
    } else {
      arrived.push(right);
      j += 1;
    }
  }
  flush();
  return lines;
}

function scalarText(value: unknown, naming: ImpactNaming): string | undefined {
  if (typeof value === 'string') return value.trim() === '' ? undefined : shown(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean')
    return naming.word(value ? 'change.value.on' : 'change.value.off');
  return undefined;
}

function isScalar(value: unknown): boolean {
  return value === undefined || value === null || typeof value !== 'object';
}

/** One changed node's lines in words: what it says that differs, prop by prop. */
function propLines(previous: Node, next: Node, naming: ImpactNaming): ChangeLineView[] {
  const lines: ChangeLineView[] = [];
  const keys = [...new Set([...Object.keys(next.props), ...Object.keys(previous.props)])];
  for (const key of keys) {
    if (STYLE_KEYS.has(key)) continue;
    const before = previous.props[key];
    const after = next.props[key];
    if (stableJson(before) === stableJson(after)) continue;
    const label = naming.property(next.type, key);

    if (isScalar(before) && isScalar(after)) {
      const was = scalarText(before, naming);
      const now = scalarText(after, naming);
      if (was !== undefined && now !== undefined)
        lines.push({ kind: 'changed', label, before: was, after: now });
      else if (now !== undefined) lines.push({ kind: 'added', label, value: now });
      else if (was !== undefined) lines.push({ kind: 'removed', label, value: was });
      continue;
    }

    const was: Leaf[] = [];
    const now: Leaf[] = [];
    leavesOf(before, label, naming, was);
    leavesOf(after, label, naming, now);
    lines.push(...diffLeaves(was, now));
  }
  return lines;
}

/*
  A node's styling, by WHAT it styles: each record in its props (the props themselves, a
  nested object, a region's element) gets a signature that holds no array index. An
  element's is its tag and its words, so a paragraph inserted above a heading neither
  shifts the heading's signature nor brings its own classes in as a restyle: it is an
  addition, and says so on its own line.
*/
interface Styling {
  /** How many records carry each signature. */
  readonly records: Map<string, number>;
  /** Each signature's styling values, per styling key, in reading order. */
  readonly values: Map<string, string[]>;
}

function collectStyling(value: unknown, signature: string, into: Styling): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectStyling(entry, signature, into);
    return;
  }
  if (!isRecord(value)) return;
  const tag = typeof value['tag'] === 'string' ? value['tag'] : '';
  const text = typeof value['text'] === 'string' ? value['text'] : '';
  const own = value['kind'] === 'element' ? `${signature}>${tag}:${text}` : signature;
  into.records.set(own, (into.records.get(own) ?? 0) + 1);
  for (const [key, entry] of Object.entries(value)) {
    if (STYLE_KEYS.has(key)) {
      const slot = `${own}#${key}`;
      into.values.set(slot, [...(into.values.get(slot) ?? []), stableJson(entry)]);
    } else {
      collectStyling(entry, value['kind'] === 'element' ? own : `${own}.${key}`, into);
    }
  }
}

function stylingOf(node: Node): Styling {
  const styling: Styling = { records: new Map(), values: new Map() };
  collectStyling(node.props, '', styling);
  return styling;
}

/* Whether something that stands on both sides changed its look. */
function restyled(previous: Node, next: Node): boolean {
  const was = stylingOf(previous);
  const now = stylingOf(next);
  for (const slot of new Set([...was.values.keys(), ...now.values.keys()])) {
    const record = slot.slice(0, slot.lastIndexOf('#'));
    if (!was.records.has(record) || !now.records.has(record)) continue;
    const before = was.values.get(slot) ?? [];
    const after = now.values.get(slot) ?? [];
    const pairs = Math.max(before.length, after.length);
    const onBoth = Math.min(was.records.get(record) ?? 0, now.records.get(record) ?? 0);
    // A record on both sides that gained or lost its styling key restyled too.
    for (let index = 0; index < Math.min(pairs, onBoth); index += 1) {
      if (before[index] !== after[index]) return true;
    }
  }
  return false;
}

/*
  The props every catalog block names its words with, most title-like first: what a block
  is called on the page. Read first even when the schema lists `eyebrow` above `heading`.
*/
const TITLE_KEYS = [
  'heading',
  'title',
  'headline',
  'name',
  'question',
  'eyebrow',
  'message',
  'text',
  'quote',
  'content',
  'body',
  'caption',
] as const;

/*
  A string that is an address as a whole (a URL, a path, an in-page anchor): what a link or
  a file is found by, never a block's name. A sentence that mentions a URL is still words.
*/
const ADDRESS = /^(?:(?:https?|mailto|tel|data|blob|ftp):\S*|\/\S*|#[\p{L}\p{N}_-]*|www\.\S*)$/iu;

function wordsOf(text: string): string | undefined {
  const flat = text.replace(/\s+/gu, ' ').trim();
  return flat === '' || ADDRESS.test(flat) ? undefined : flat;
}

/* The first heading's words in a structured value (a region's tree, a rich-text doc), else its first words. */
function firstWords(value: unknown, naming: ImpactNaming): string | undefined {
  if (typeof value === 'string') return wordsOf(value);
  const leaves: Leaf[] = [];
  leavesOf(value, '', naming, leaves);
  const heading = naming.word('change.label.heading');
  const chosen = leaves.find((leaf) => leaf.label === heading) ?? leaves[0];
  return chosen === undefined ? undefined : wordsOf(chosen.text);
}

/**
 * What a line calls a block (SPEC §4.9: the page's words, in schema terms). Its own name
 * when it has one; else the words of its most title-like text prop, as the schema declares
 * them (a URL, an enum value or a ProseMirror discriminator is never words); else nothing,
 * and the line reads its type. v1 took the first string of ANY prop, and the landing page
 * read "Section «dark»", "Section «dual»", "Section «doc»" and a photo's address.
 */
function titleOf(node: Node, naming: ImpactNaming): string | undefined {
  const own = (naming.instanceName ?? instanceLabel)(node);
  if (own !== undefined && own.trim() !== '') return shown(own);
  const declared = naming.textProps?.(node.type);
  const known = TITLE_KEYS.filter((key) => declared === undefined || declared.includes(key));
  const keys = [...known, ...(declared ?? []).filter((key) => !known.some((k) => k === key))];
  for (const key of keys) {
    const words = firstWords(node.props[key], naming);
    if (words !== undefined) return shown(words);
  }
  return undefined;
}

/* The builder's convention for an instance's own name (`blockDisplayName` reads it too). */
function instanceLabel(node: Node): string | undefined {
  const label = node.props['label'];
  return typeof label === 'string' && label.trim() !== '' ? label : undefined;
}

/** Where a block stands: its parent and the slot it sits in. */
interface Placement {
  readonly parent: NodeId;
  readonly slot: string;
}

function placements(document: BuilderDocument): Map<NodeId, Placement> {
  const out = new Map<NodeId, Placement>();
  for (const node of Object.values(document.nodes)) {
    for (const [slot, children] of Object.entries(node.slots ?? {})) {
      for (const child of children) if (!out.has(child)) out.set(child, { parent: node.id, slot });
    }
  }
  return out;
}

/*
  The ids in `now` that are out of `was`'s order: everything off their longest common run.
  On a tie the later-listed block is the one that moved, so [a, b, c] → [a, c, b] reads as
  "c moved" rather than "b moved"; either is true, and one line is what a swap deserves.
*/
function outOfOrder(was: readonly NodeId[], now: readonly NodeId[]): NodeId[] {
  const columns = now.length + 1;
  const table = new Array<number>((was.length + 1) * columns).fill(0);
  const at = (i: number, j: number): number => table[i * columns + j] ?? 0;
  for (let i = was.length - 1; i >= 0; i -= 1) {
    for (let j = now.length - 1; j >= 0; j -= 1) {
      table[i * columns + j] =
        was[i] === now[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const out: NodeId[] = [];
  let i = 0;
  let j = 0;
  while (j < now.length) {
    const id = now[j];
    if (id === undefined) break;
    if (i < was.length && was[i] === id) {
      i += 1;
      j += 1;
    } else if (i < was.length && at(i + 1, j) > at(i, j + 1)) {
      i += 1;
    } else {
      out.push(id);
      j += 1;
    }
  }
  return out;
}

/*
  The blocks that stand somewhere else: in another parent or slot, or out of order among
  the siblings that stayed. A block only ADDED or REMOVED around another does not move it:
  those are compared out before the order is.
*/
function movedIds(before: BuilderDocument, after: BuilderDocument): ReadonlySet<NodeId> {
  const was = placements(before);
  const now = placements(after);
  const onBoth = (id: NodeId): boolean =>
    before.nodes[id] !== undefined && after.nodes[id] !== undefined;
  const stayed = (id: NodeId): boolean => {
    const from = was.get(id);
    const to = now.get(id);
    return from?.parent === to?.parent && from?.slot === to?.slot;
  };

  const moved = new Set<NodeId>();
  for (const id of Object.keys(after.nodes)) {
    if (onBoth(id) && !stayed(id)) moved.add(id);
  }
  for (const node of Object.values(after.nodes)) {
    const previous = before.nodes[node.id];
    if (previous === undefined) continue;
    for (const [slot, children] of Object.entries(node.slots ?? {})) {
      const kept = (ids: readonly NodeId[]): NodeId[] =>
        ids.filter((id) => onBoth(id) && stayed(id));
      for (const id of outOfOrder(kept(previous.slots?.[slot] ?? []), kept(children))) {
        moved.add(id);
      }
    }
  }
  return moved;
}

/**
 * The impact as lines for ChangeLines (SPEC §4.9: "Sourced from `planImpact` plus new
 * `impactLines()`, in schema labels, never command names"), every word from `naming`.
 *
 * - A document field that changed reads as its own line (Page direction).
 * - An added or removed block reads as ONE line, by its own title: a new section is
 *   "Section + «Pricing»", not a line per heading inside it.
 * - A changed block reads as the words that changed, labelled by property or by the
 *   element's role inside a region ("Heading «FAQ» → «Questions patients ask»").
 * - A block whose look changed reads as `restyled`, and one that stands elsewhere as
 *   `moved`, so every change `describeImpact` counts has a line.
 *
 * Lines follow the page top to bottom; removals come last, in the order they stood.
 */
export function impactLines(
  before: BuilderDocument,
  after: BuilderDocument,
  naming: ImpactNaming,
): readonly ImpactLine[] {
  const impact = planImpact(before, after);
  const lines: ImpactLine[] = impact.meta.map((field): ImpactLine => {
    const value = (document: BuilderDocument): string =>
      field === 'dir'
        ? naming.word(document.dir === 'rtl' ? 'change.value.rtl' : 'change.value.ltr')
        : naming.surface(document.surface);
    return {
      kind: 'changed',
      label: naming.word(
        field === 'dir' ? 'change.label.pageDirection' : 'change.label.pageSurface',
      ),
      before: value(before),
      after: value(after),
    };
  });

  const nameOf = (node: Node, parent: NodeId | undefined, root: NodeId) => {
    const kind =
      parent === root ? naming.word('change.label.section') : naming.blockType(node.type);
    return { label: kind, value: titleOf(node, naming) ?? naming.blockType(node.type) };
  };

  const added = new Set(impact.added);
  const changed = new Set(impact.changed);
  const moved = movedIds(before, after);
  const afterPlaces = placements(after);
  for (const id of orderedIds(after)) {
    const next = after.nodes[id];
    if (next === undefined) continue;
    const parent = afterPlaces.get(id)?.parent;
    if (added.has(id)) {
      if (parent !== undefined && added.has(parent)) continue;
      lines.push({ kind: 'added', ...nameOf(next, parent, after.rootId) });
      continue;
    }
    const previous = before.nodes[id];
    if (previous === undefined) continue;
    if (changed.has(id) && contentOf(previous) !== contentOf(next)) {
      const words = propLines(previous, next, naming);
      lines.push(...words);
      // A change with no words at all (an icon, a link target) is still a change to see.
      if (words.length === 0 || restyled(previous, next)) {
        lines.push({ kind: 'restyled', ...nameOf(next, parent, after.rootId) });
      }
    }
    if (moved.has(id)) lines.push({ kind: 'moved', ...nameOf(next, parent, after.rootId) });
  }

  const removed = new Set(impact.removed);
  const beforePlaces = placements(before);
  for (const id of impact.removed) {
    const previous = before.nodes[id];
    const parent = beforePlaces.get(id)?.parent;
    if (previous === undefined || (parent !== undefined && removed.has(parent))) continue;
    lines.push({ kind: 'removed', ...nameOf(previous, parent, before.rootId) });
  }
  return lines;
}
