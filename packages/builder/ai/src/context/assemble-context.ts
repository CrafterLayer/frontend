import {
  // ── block-parts (2026-10-06) ──
  blockPartsOf,
  // ── /block-parts ──
  blockPropsJsonSchema,
  commandArgsJsonSchema,
  defineContextFragment,
  hasUtilityClassOracle,
  type AiContextBlockCatalogEntry,
  type AiContextCommandCatalogEntry,
  type AiContextCompositionCatalogEntry,
  type AiContextProvider,
  type AiContextReadApi,
  type AiContextWidgetCatalogEntry,
  type BuilderDocument,
  type CompositionDef,
  type ContextFragment,
  type ContextFragmentKind,
  type ContextFragmentTrust,
  type DeclarativeWidgetTypeDef,
  type JsonValue,
  type KernelApi,
  type KernelState,
  type Node,
  type NodeId,
  type RegisteredBlock,
  type Surface,
} from '@craftkit/builder-schema';

import { serializeTreeMarkup } from '../plan/tree-markup';
import { wirePropsSchema, withStudioSummaries } from './wire-schema';
import type {
  AiBlockContext,
  AiBlockPropertyIntentContext,
  AiCommandContext,
  AiContextOmission,
  AiDocumentContext,
  AiDocumentNodeContext,
  AiSelectionContext,
  AiTemplateContext,
  AiPlanOutputContract,
  AssembledAiContext,
} from '../types';
import type { AiPreparedSkillContext } from '../skills';
import { canonicalJsonStringify, estimateCanonicalJsonTokens } from '../internal/canonical-json';
import {
  blockIsInCatalogScope,
  resolveAiCompositionPolicy,
  type AiCompositionPolicy,
  type ResolvedAiCompositionPolicy,
} from './composition-policy';
import {
  childIdsOf,
  parentsOf,
  sectionOf,
  subtreeIds,
  type AiDocumentFocus,
} from './document-tree-mode';

const CHARACTERS_PER_TOKEN_ESTIMATE = 4;

type AiContextAssemblySource = Pick<KernelApi, 'store' | 'registry' | 'surface'>;

function deepFreezeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    for (const child of value) deepFreezeJson(child);
    Object.freeze(value);
    return value;
  }
  if (typeof value !== 'object' || value === null) return value;
  for (const child of Object.values(value)) deepFreezeJson(child);
  Object.freeze(value);
  return value;
}

function detachedStateSnapshot(ctx: AiContextAssemblySource): Readonly<KernelState> {
  const live = ctx.store.getState();
  const doc = deepFreezeJson(
    cloneJson(live.doc as unknown as JsonValue),
  ) as unknown as BuilderDocument;
  const selection = [...live.selection];
  Object.freeze(selection);
  // `elementFocus` is ephemeral UI state a peer added to KernelState; it rides along untouched.
  return Object.freeze({ doc, selection, seq: live.seq, elementFocus: live.elementFocus });
}

function frozenStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...values]);
}

function blockCatalogEntry({ schema }: RegisteredBlock): AiContextBlockCatalogEntry {
  const examples = Object.freeze(
    schema.examples.map((example) =>
      Object.freeze({
        prompt: example.prompt,
        node: deepFreezeJson(cloneJson(example.node)),
      }),
    ),
  );
  const slots = Object.freeze(
    Object.entries(schema.slots ?? {})
      .sort(([left], [right]) => compareText(left, right))
      .map(([name, declaration]) =>
        Object.freeze({
          name,
          allow: frozenStrings([...declaration.allow].sort(compareText)),
          ...(declaration.max === undefined ? {} : { max: declaration.max }),
        }),
      ),
  );
  const propertyGroups =
    schema.propertyGroups === undefined
      ? undefined
      : Object.freeze(
          Object.fromEntries(
            Object.entries(schema.propertyGroups)
              .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
                Boolean(entry[1]),
              )
              .sort(([left], [right]) => compareText(left, right))
              .map(([name, group]) => [name, Object.freeze({ ...group })]),
          ),
        );
  return Object.freeze({
    type: schema.type,
    description: schema.description,
    propsSchema: deepFreezeJson(cloneJson(withStudioSummaries(blockPropsJsonSchema(schema), schema.props))),
    ...(schema.surfaces === undefined
      ? {}
      : { surfaces: frozenStrings([...schema.surfaces].sort(compareText)) }),
    ...(schema.inlineEditable === undefined ? {} : { inlineEditable: schema.inlineEditable }),
    ...(propertyGroups === undefined ? {} : { propertyGroups }),
    examples,
    slots,
  });
}

function commandCatalogEntry(
  name: string,
  command: NonNullable<ReturnType<KernelApi['registry']['command']>>,
): AiContextCommandCatalogEntry {
  return Object.freeze({
    name,
    argsSchema: deepFreezeJson(cloneJson(commandArgsJsonSchema(command))),
  });
}

function compositionCatalogEntry(composition: CompositionDef): AiContextCompositionCatalogEntry {
  const root = composition.nodes[composition.rootId];
  return Object.freeze({
    id: composition.id,
    name: composition.name,
    version: composition.version,
    ...(composition.surfaces === undefined
      ? {}
      : { surfaces: frozenStrings([...composition.surfaces].sort(compareText)) }),
    rootType: root?.type ?? 'unknown',
    nodeCount: Object.keys(composition.nodes).length,
    blockTypes: frozenStrings(
      [...new Set(Object.values(composition.nodes).map((node) => node.type))].sort(compareText),
    ),
  });
}

function widgetCatalogEntry(widget: DeclarativeWidgetTypeDef): AiContextWidgetCatalogEntry {
  return Object.freeze({
    type: widget.type,
    defaultSkin: widget.defaultSkin,
    skinIds: frozenStrings(widget.skins.map(({ id }) => id).sort(compareText)),
    contractFields: frozenStrings(Object.keys(widget.contract).sort(compareText)),
    bindingSource: widget.binding.source,
  });
}

function visibleOnSurface(
  entry: { readonly surfaces?: readonly Surface[] },
  surface: Surface,
): boolean {
  return entry.surfaces === undefined || entry.surfaces.includes(surface);
}

function createAiContextReadApi(ctx: AiContextAssemblySource): AiContextReadApi {
  const snapshot = detachedStateSnapshot(ctx);
  const blocks = Object.freeze(
    ctx.registry
      .blocks()
      .map(blockCatalogEntry)
      .sort((left, right) => compareText(left.type, right.type)),
  );
  const blocksByType = new Map(blocks.map((entry) => [entry.type, entry]));
  const compositions = Object.freeze(
    ctx.registry
      .compositions()
      .map(compositionCatalogEntry)
      .sort((left, right) => compareText(left.id, right.id)),
  );
  const compositionsById = new Map(compositions.map((entry) => [entry.id, entry]));
  const widgetTypes = Object.freeze(
    ctx.registry
      .widgetTypes()
      .map(widgetCatalogEntry)
      .sort((left, right) => compareText(left.type, right.type)),
  );
  const widgetTypesByType = new Map(widgetTypes.map((entry) => [entry.type, entry]));
  const commands = Object.freeze(
    ctx.registry
      .commandNames()
      .flatMap((name) => {
        const command = ctx.registry.command(name);
        return command === undefined ? [] : [commandCatalogEntry(name, command)];
      })
      .sort((left, right) => compareText(left.name, right.name)),
  );
  const commandsByName = new Map(commands.map((entry) => [entry.name, entry]));
  const commandNames = frozenStrings(commands.map(({ name }) => name));
  const store: AiContextReadApi['store'] = Object.freeze({
    getState: () => snapshot,
  });
  const registry: AiContextReadApi['registry'] = Object.freeze({
    block: (type: string) => blocksByType.get(type),
    blocks: (surface?: Surface) =>
      surface === undefined
        ? blocks
        : Object.freeze(blocks.filter((entry) => visibleOnSurface(entry, surface))),
    commandNames: () => commandNames,
    command: (name: string) => commandsByName.get(name),
    commands: () => commands,
    composition: (id: string) => compositionsById.get(id),
    compositions: (surface?: Surface) =>
      surface === undefined
        ? compositions
        : Object.freeze(compositions.filter((entry) => visibleOnSurface(entry, surface))),
    widgetType: (type: string) => widgetTypesByType.get(type as `widget:${string}`),
    widgetTypes: () => widgetTypes,
  });
  const readApi: AiContextReadApi = {
    store,
    registry,
    get surface() {
      return snapshot.doc.surface;
    },
  };
  return Object.freeze(readApi);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function cloneJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(cloneJson);
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJson(child)]));
}

export function estimateContextTokens(title: string, body: string): number {
  const characters = `${title}\n${body}`.length;
  return Math.max(1, Math.ceil(characters / CHARACTERS_PER_TOKEN_ESTIMATE));
}

/** Conservative estimate for the complete provider/wire payload, not only fragments. */
export function estimateAssembledAiContextTokens(context: AssembledAiContext): number {
  return estimateCanonicalJsonTokens(context);
}

interface FragmentMetadata {
  source: string;
  kind: ContextFragmentKind;
  trust: ContextFragmentTrust;
  title: string;
}

function fragment(metadata: FragmentMetadata, value: unknown): Readonly<ContextFragment> {
  const body = canonicalJsonStringify(value);
  return defineContextFragment({
    ...metadata,
    body,
    tokens: estimateContextTokens(metadata.title, body),
  });
}

/**
 * The OUTLINE contract: the same shape with `commands` optional and empty.
 *
 * Kept as a separate frozen constant rather than built by mutating the one
 * below, so both are readable in full and neither can drift into the other.
 */
const AI_OUTLINE_OUTPUT_CONTRACT: AiPlanOutputContract = Object.freeze({
  version: 1,
  schema: deepFreezeJson({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: ['rationale', 'commands'],
    properties: {
      rationale: { type: 'string', minLength: 1, pattern: '\\S' },
      // Required by the shape, and REQUIRED TO BE EMPTY by this run.
      commands: { type: 'array', maxItems: 0, items: {} },
      followUp: { type: 'string' },
    },
  }),
});

const AI_PLAN_OUTPUT_CONTRACT: AiPlanOutputContract = Object.freeze({
  version: 1,
  schema: deepFreezeJson({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: ['rationale', 'commands'],
    properties: {
      rationale: { type: 'string', minLength: 1, pattern: '\\S' },
      commands: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['command', 'args'],
          properties: {
            command: { type: 'string', minLength: 1, pattern: '\\S' },
            args: {},
            title: { type: 'string' },
          },
        },
      },
      followUp: { type: 'string' },
    },
  }),
});

function sortedSlots(node: Node): Readonly<Record<string, readonly NodeId[]>> {
  return Object.fromEntries(
    Object.entries(node.slots ?? {})
      .sort(([left], [right]) => compareText(left, right))
      .map(([name, ids]) => [name, [...ids]]),
  );
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A composed tree, recognised by its SHAPE — the same way the validation door
 * finds trees in a plan's args. A prop that merely happens to be named `tree`
 * is not one, and a tree stored under any other name still is.
 */
function isCustomCodeTreeValue(value: unknown): boolean {
  return isJsonRecord(value) && value['kind'] === 'root' && Array.isArray(value['children']);
}

/**
 * A composed tree, described instead of quoted.
 *
 * Counts the nodes and keeps the region's FIRST heading — enough for the model
 * to know what already stands there and not rebuild it — while dropping the
 * body copy it was told not to touch. Depth-first, iterative, and bounded, so
 * a hostile tree cannot spend the request budget here.
 */
function summariseCustomCodeTree(tree: unknown): string {
  let nodes = 0;
  let heading: string | undefined;
  const stack: unknown[] = [tree];
  while (stack.length > 0 && nodes < CUSTOM_CODE_SUMMARY_SCAN_LIMIT) {
    const current = stack.pop();
    if (!isJsonRecord(current)) continue;
    nodes += 1;
    if (
      heading === undefined &&
      typeof current['tag'] === 'string' &&
      HEADING_TAGS.has(current['tag'])
    ) {
      const text = current['text'];
      if (typeof text === 'string' && text.trim() !== '') heading = text.trim().slice(0, 80);
    }
    const children = current['children'];
    if (Array.isArray(children)) for (const child of children) stack.push(child);
  }
  const shape = `filled · ${String(Math.max(0, nodes - 1))} nodes`;
  return heading === undefined ? shape : `${shape} · “${heading}”`;
}

const HEADING_TAGS: ReadonlySet<string> = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const CUSTOM_CODE_SUMMARY_SCAN_LIMIT = 5_000;

function documentNode(node: Node, summariseTrees = false): AiDocumentNodeContext {
  const bindings =
    node.bindings === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(node.bindings).sort(([left], [right]) => compareText(left, right)),
        );
  const responsive =
    node.responsive === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(node.responsive)
            .sort(([left], [right]) => compareText(left, right))
            .map(([breakpoint, props]) => [
              breakpoint,
              Object.fromEntries(
                Object.entries(props)
                  .sort(([left], [right]) => compareText(left, right))
                  .map(([key, value]) => [key, cloneJson(value)]),
              ),
            ]),
        );
  return {
    id: node.id,
    type: node.type,
    // Full props for every node: page text lives here, and "change the word X"
    // is only answerable when the provider can actually read the page's words.
    props: Object.fromEntries(
      Object.entries(node.props)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, value]) => [
          key,
          !isCustomCodeTreeValue(value)
            ? cloneJson(value)
            : summariseTrees
              ? summariseCustomCodeTree(value)
              : /*
                  A region's tree as the markup the model writes back: a third
                  shorter than the nested tree, and quotable exactly — which is
                  what an `editTree` find has to be. A component reference is
                  spelled `<ck-component>`; only a value that is not a tree at
                  all is shown as itself.
                */
                (serializeTreeMarkup(value) ?? cloneJson(value)),
        ]),
    ),
    ...(bindings === undefined ? {} : { bindings }),
    ...(node.variantOf === undefined ? {} : { variantOf: node.variantOf }),
    ...(responsive === undefined ? {} : { responsive }),
    slots: sortedSlots(node),
  };
}

type RegistryBlockEntry = ReturnType<AiContextReadApi['registry']['blocks']>[number];

/**
 * Identity only: what the block IS called and what it is FOR. Always present,
 * in every mode — this is the vocabulary, and a name the model never sees is a
 * block it can never ask for.
 */
function blockIndexEntry(entry: RegistryBlockEntry): AiBlockContext {
  return {
    type: entry.type,
    description: entry.description,
  };
}

/** Identity plus everything needed to actually author the block's props. */
function blockDetailEntry(entry: RegistryBlockEntry): AiBlockContext {
  const propertyIntents = propertyIntentSummary(entry.propertyGroups);
  return {
    ...blockIndexEntry(entry),
    propsSchema: wirePropsSchema(cloneJson(entry.propsSchema)),
    ...(propertyIntents === undefined ? {} : { propertyIntents }),
    examples: entry.examples.map((example) => ({
      prompt: example.prompt,
      node: cloneJson(example.node),
    })),
    slots: entry.slots.map((slot) => ({
      name: slot.name,
      allow: [...slot.allow],
      ...(slot.max === undefined ? {} : { max: slot.max }),
    })),
  };
}

/** Identity plus the prop NAMES: enough to edit a block, not to author one. */
function blockPresenceEntry(entry: RegistryBlockEntry): AiBlockContext {
  const schema = entry.propsSchema;
  const properties =
    typeof schema === 'object' && schema !== null && !Array.isArray(schema)
      ? schema['properties']
      : undefined;
  const propKeys =
    typeof properties === 'object' && properties !== null && !Array.isArray(properties)
      ? Object.keys(properties).sort(compareText)
      : [];
  // No schema travels with it, so authoring one would mean inventing props.
  return { ...blockIndexEntry(entry), insertable: false, propKeys };
}

/** The block types the document holds right now. */
function presentBlockTypes(ctx: AiContextReadApi): ReadonlySet<string> {
  return new Set(Object.values(ctx.store.getState().doc.nodes).map((node) => node.type));
}

/** The root's own type — a `page` cannot be inserted into a `page`, in any mode. */
function rootBlockType(ctx: AiContextReadApi): string | undefined {
  const { doc } = ctx.store.getState();
  return doc.nodes[doc.rootId]?.type;
}

/**
 * The catalog, at the cost the run asked for.
 *
 * The sort is not cosmetic and must stay outside the mode branch: a stable
 * type order is what lets an unchanged registry serialize to identical bytes
 * across requests, and identical bytes are the precondition for caching the
 * prompt prefix. Sorting inside a branch would work today and silently stop
 * working the first time a mode forgot it.
 */
function collectBlocks(
  ctx: AiContextReadApi,
  policy: ResolvedAiCompositionPolicy,
  focus?: AiDocumentFocus,
): readonly AiBlockContext[] {
  const present = policy.catalogMode === 'none' ? presentBlockTypes(ctx) : undefined;
  const rootType = rootBlockType(ctx);
  /*
    fast-edits (2026-09-28): an EDIT on a remote catalog authors nothing new.
    The escape hatch is always detailed so the model can WRITE a region
    (composition-policy `alwaysDetailedBlockTypes`), and on the owner's CV
    edit that was 1,251 of 11,368 wire tokens — schema 682, example 240 —
    for a region already on the page, whose own markup is the example. Its
    name, description and prop names stay; a registered type in scope keeps
    its schema for editing, less the worked examples. `full` (the offline
    provider, which plans by scoring examples) is left whole.
  */
  const editing = focus?.kind === 'edit' && policy.catalogMode !== 'full';
  const withRootRule = (block: AiBlockContext): AiBlockContext => {
    if (block.type !== rootType) return block;
    /*
      The root's type must not be AUTHORED, and saying so is not enough while
      its worked examples are still in the request: the page block ships
      few-shots that map "ابدأ صفحة فارغة" to insertNode {type:'page'} — a
      demonstration of the exact command the door will refuse, handed to a model
      that was just asked in Arabic for a page. Examples teach; a rule only
      asks. So the examples go and the schema stays: the root is still EDITED
      constantly (pageCss, contentWidth, title) and that needs its props.
    */
    const editable = { ...block, insertable: false };
    delete editable.examples;
    return editable;
  };
  return ctx.registry
    .blocks(ctx.surface)
    .flatMap((entry) => {
      if (blockIsInCatalogScope(policy, entry.type)) {
        if (!editing) return [withRootRule(blockDetailEntry(entry))];
        if (policy.alwaysDetailedBlockTypes.has(entry.type)) return [blockPresenceEntry(entry)];
        const editable = { ...withRootRule(blockDetailEntry(entry)) };
        delete editable.examples;
        return [editable];
      }
      if (present !== undefined) {
        // `none` states nothing about a block the run did not ask for — not
        // even its name. The model composes; it does not choose from a list.
        // The one exception is a block ALREADY ON THE PAGE: the person will
        // ask to change it, and a model that cannot name its props invents
        // one. Its name and prop keys ride along; its schema does not.
        return present.has(entry.type) ? [blockPresenceEntry(entry)] : [];
      }
      return [withRootRule(blockIndexEntry(entry))];
    })
    .sort((left, right) => compareText(left.type, right.type));
}

function propertyIntentSummary(
  groups: AiContextBlockCatalogEntry['propertyGroups'],
): AiBlockPropertyIntentContext | undefined {
  if (groups === undefined) return undefined;
  const tabs: Record<string, string[]> = {};
  const kinds: Record<string, string[]> = {};
  for (const [property, intent] of Object.entries(groups).sort(([left], [right]) =>
    compareText(left, right),
  )) {
    (tabs[intent.tab] ??= []).push(property);
    if (intent.kind !== undefined) (kinds[intent.kind] ??= []).push(property);
  }
  return {
    tabs: Object.freeze(
      Object.fromEntries(
        Object.entries(tabs)
          .sort(([left], [right]) => compareText(left, right))
          .map(([tab, properties]) => [tab, frozenStrings(properties)]),
      ),
    ),
    kinds: Object.freeze(
      Object.fromEntries(
        Object.entries(kinds)
          .sort(([left], [right]) => compareText(left, right))
          .map(([kind, properties]) => [kind, frozenStrings(properties)]),
      ),
    ),
  };
}

function collectTemplates(ctx: AiContextReadApi, full: boolean): readonly AiTemplateContext[] {
  return ctx.registry.compositions(ctx.surface).map((composition) => ({
    id: composition.id,
    name: composition.name,
    rootType: composition.rootType,
    nodeCount: composition.nodeCount,
    ...(full ? { blockTypes: [...composition.blockTypes] } : {}), // a model without the catalog cannot author them
  }));
}

function collectDocument(
  ctx: AiContextReadApi,
  policy: ResolvedAiCompositionPolicy,
  selection: readonly NodeId[],
): AiDocumentContext {
  const { doc } = ctx.store.getState();
  /*
    Under `scoped`, a region the run was told to leave alone is described
    rather than quoted. The ids that keep their trees are the policy's own
    list when it named one, and otherwise the run's selection — so "edit this
    region" needs no extra wiring to keep the region it is editing.
  */
  const keepWhole =
    policy.documentTreeMode === 'full'
      ? undefined
      : policy.treeScopeNodeIds.size > 0
        ? policy.treeScopeNodeIds
        : new Set(selection);
  return {
    schemaVersion: doc.schemaVersion,
    surface: doc.surface,
    dir: doc.dir,
    rootId: doc.rootId,
    nodes: Object.values(doc.nodes)
      .map((node) => documentNode(node, keepWhole !== undefined && !keepWhole.has(node.id)))
      .sort((left, right) => compareText(left.id, right.id)),
  };
}

function sortedJsonRecord(record: Record<string, JsonValue>): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => compareText(left, right)),
  );
}

/**
 * One section OUTSIDE an edit's focus, as one line: its name, never its
 * contents — a composed region's label, a block's label, heading or title,
 * and a heading only where it says something the label does not. Its slots
 * are not listed: the nodes under it are not in the document either.
 *
 * Measured 2026-09-28 on a nine-section CV: the tree summary each line used
 * to carry (`filled · 14 nodes · “نبذة عني”`) repeated the label on most
 * sections and cost ~8 tokens a line — 64 of a 2.5k edit budget — for words
 * the model is told to leave alone.
 */
function outlineNode(node: Node): AiDocumentNodeContext {
  const props: Record<string, JsonValue> = {};
  for (const key of ['label', 'heading', 'title']) {
    const value = node.props[key];
    if (typeof value === 'string') props[key] = value;
  }
  const label = typeof props['label'] === 'string' ? props['label'] : undefined;
  for (const value of Object.values(node.props)) {
    if (!isCustomCodeTreeValue(value)) continue;
    const heading = firstTreeHeading(value);
    if (heading !== undefined && heading !== label) props['heading'] = heading;
  }
  return { id: node.id, type: node.type, props: sortedJsonRecord(props), slots: {} };
}

/** A composed tree's first h1–h6 text, bounded like the summary. */
function firstTreeHeading(tree: unknown): string | undefined {
  const stack: unknown[] = [tree];
  let seen = 0;
  while (stack.length > 0 && seen < CUSTOM_CODE_SUMMARY_SCAN_LIMIT) {
    const current = stack.pop();
    seen += 1;
    if (!isJsonRecord(current)) continue;
    if (typeof current['tag'] === 'string' && HEADING_TAGS.has(current['tag'])) {
      const text = current['text'];
      if (typeof text === 'string' && text.trim() !== '') return text.trim().slice(0, 80);
    }
    const children = current['children'];
    if (Array.isArray(children)) {
      for (let at = children.length - 1; at >= 0; at -= 1) stack.push(children[at]);
    }
  }
  return undefined;
}

/**
 * The document an EDIT sees (fast-edits, 2026-09-28): the root as it is (its
 * page CSS carries the design tokens a restyle keeps to), the focused
 * sections — and the sections holding the selection — WHOLE, each with every
 * node under it, and every other top-level section outlined. Nodes outside
 * the page tree are left out: an edit cannot reach them.
 */
function collectFocusedDocument(
  ctx: AiContextReadApi,
  focus: AiDocumentFocus,
  selection: readonly NodeId[],
): { readonly document: AiDocumentContext; readonly shown: readonly NodeId[] } {
  const { doc } = ctx.store.getState();
  const parents = parentsOf(doc);
  const shown: NodeId[] = [];
  const whole = new Set<NodeId>();
  for (const id of [...focus.nodeIds, ...selection]) {
    if (id === doc.rootId || doc.nodes[id] === undefined) continue;
    const section = sectionOf(id, doc, parents) ?? id;
    if (shown.includes(section)) continue;
    shown.push(section);
    for (const inside of subtreeIds(section, doc)) whole.add(inside);
  }
  const root = doc.nodes[doc.rootId];
  const nodes: AiDocumentNodeContext[] = root === undefined ? [] : [documentNode(root)];
  for (const id of childIdsOf(root)) {
    const node = doc.nodes[id];
    if (node !== undefined && !whole.has(id)) nodes.push(outlineNode(node));
  }
  for (const id of whole) {
    const node = doc.nodes[id];
    if (node !== undefined) nodes.push(documentNode(node));
  }
  return {
    document: {
      schemaVersion: doc.schemaVersion,
      surface: doc.surface,
      dir: doc.dir,
      rootId: doc.rootId,
      nodes: nodes.sort((left, right) => compareText(left.id, right.id)),
    },
    shown,
  };
}

/**
 * A command's args schema without what a model never reads: JSON Schema's own
 * `$schema` pointer (57 characters on every command), the ±2^53−1 bounds zod
 * writes on every integer, `propertyNames: {type: 'string'}` and
 * `additionalProperties: {}` (what JSON and JSON Schema already say), and the
 * `minLength: 1` on every id (the door refuses an empty one either way). On a
 * focused edit that was ~260 of the ~970 command tokens (fast-edits, measured
 * 2026-09-28 on the eleven core commands). `properties` and
 * `additionalProperties: false` — the keys a server closes a plan's args on
 * (ai-server plan-shape.ts `closedKeys`) — are kept exactly.
 */
function compactArgsSchema(schema: JsonValue): JsonValue {
  if (Array.isArray(schema)) return deepFreezeJson(schema.map(compactArgsSchema));
  if (typeof schema !== 'object' || schema === null) return schema;
  const out: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === '$schema') continue;
    if (key === 'maximum' && value === Number.MAX_SAFE_INTEGER) continue;
    if (key === 'minimum' && value === Number.MIN_SAFE_INTEGER) continue;
    if (key === 'minLength' && value === 1) continue;
    if (key === 'propertyNames' && isStringTypeOnly(value)) continue;
    if (key === 'additionalProperties' && isEmptyRecord(value)) continue;
    out[key] = compactArgsSchema(value);
  }
  return deepFreezeJson(out);
}

function isStringTypeOnly(value: JsonValue): boolean {
  return isJsonRecord(value) && Object.keys(value).length === 1 && value['type'] === 'string';
}

function isEmptyRecord(value: JsonValue): boolean {
  return isJsonRecord(value) && Object.keys(value).length === 0;
}

/** The fragment source that tells a focused run the page is shown in part. */
export const DOCUMENT_FOCUS_FRAGMENT_SOURCE = 'craftkit.document-focus';

/**
 * ~40 tokens that keep a focused run honest: the outline is not the page's
 * content, so an outlined section is to be left alone rather than "filled in".
 */
function focusFragment(shown: readonly NodeId[]): Readonly<ContextFragment> {
  return fragment(
    {
      source: DOCUMENT_FOCUS_FRAGMENT_SOURCE,
      kind: 'data',
      trust: 'builtin',
      title: 'Document focus',
    },
    {
      shown,
      note: 'Only the `shown` sections are whole; every other section is one outline line. Change what the request names; leave outlined sections as they are.',
    },
  );
}

// ── block-parts (2026-10-06) ──
/** The fragment source that lists the parts of the registered blocks an edit can reach. */
export const BLOCK_PARTS_FRAGMENT_SOURCE = 'craftkit.block-parts';
const MAX_PART_BLOCK_TYPES = 12;
const MAX_PART_NAMES = 16;

/**
 * The parts of every registered block type among `ids`, one compact line per
 * type — `hero: eyebrow, heading, body, trustLine`; a repeated part ends in
 * `[]` (it takes an index) — so the model names `part.style {id, part}`
 * instead of rewriting className. Types in a stable order, so an unchanged
 * page serializes to the same bytes. Undefined when no type declares parts.
 */
function blockPartsFragment(
  ctx: AiContextAssemblySource,
  ids: Iterable<NodeId>,
): Readonly<ContextFragment> | undefined {
  const { doc } = ctx.store.getState();
  const lines = new Map<string, string>();
  for (const id of ids) {
    const type = doc.nodes[id]?.type;
    if (type === undefined || lines.has(type)) continue;
    const parts = Object.entries(blockPartsOf(ctx.registry.block(type)?.schema));
    if (parts.length === 0) continue;
    const names = parts.slice(0, MAX_PART_NAMES).map(([name, decl]) => {
      const bind = decl.bind;
      const pattern =
        bind === undefined ? '' : typeof bind === 'string' ? bind : 'href' in bind ? bind.text : bind.src;
      return pattern.split('.').includes('*') ? `${name}[]` : name;
    });
    lines.set(type, `${names.join(', ')}${parts.length > MAX_PART_NAMES ? ', …' : ''}`);
  }
  if (lines.size === 0) return undefined;
  const parts = Object.fromEntries(
    [...lines.entries()].sort(([left], [right]) => compareText(left, right)).slice(0, MAX_PART_BLOCK_TYPES),
  );
  return fragment(
    {
      source: BLOCK_PARTS_FRAGMENT_SOURCE,
      kind: 'data',
      trust: 'builtin',
      title: 'Block parts',
    },
    {
      parts,
      note: 'Edit a registered block\'s inner element with part.text / part.style / part.link / part.image / part.list {id, part (name, alias or label) or find (its exact text), index? (for [] parts)}. part.style takes style: {property: token}, e.g. {"textColor":"accent","fontSize":"2xl","padding":"4"}, and scope "all" for every item; theme tokens only, never palette colours.',
    },
  );
}
// ── /block-parts ──

function collectSelection(
  _ctx: AiContextReadApi,
  selection: readonly NodeId[],
): AiSelectionContext {
  return {
    ids: [...selection],
  };
}

export const blockCatalogContextProvider: AiContextProvider = {
  id: 'craftkit.block-catalog',
  collect(ctx) {
    return fragment(
      {
        source: 'craftkit.block-catalog',
        kind: 'data',
        trust: 'builtin',
        title: 'Registered block vocabulary',
      },
      /*
        The standalone provider has no run to read a policy from, so it states
        the whole vocabulary. It is also never the path that costs: built-ins
        are recognised by `additiveContextProviders` and never become
        fragments — `assembleAiContext` reads their structured form directly,
        under the run's policy. This branch exists for a host that collects the
        provider by itself.
      */
      collectBlocks(ctx, resolveAiCompositionPolicy(undefined)),
    );
  },
};

export const templateCatalogContextProvider: AiContextProvider = {
  id: 'craftkit.template-catalog',
  collect(ctx) {
    return fragment(
      {
        source: 'craftkit.template-catalog',
        kind: 'data',
        trust: 'builtin',
        title: 'Registered page templates',
      },
      collectTemplates(ctx, true),
    );
  },
};

export const selectionContextProvider: AiContextProvider = {
  id: 'craftkit.selection',
  collect(ctx, selection) {
    return fragment(
      {
        source: 'craftkit.selection',
        kind: 'data',
        trust: 'builtin',
        title: 'Current selection',
      },
      collectSelection(ctx, selection),
    );
  },
};

export const documentShapeContextProvider: AiContextProvider = {
  id: 'craftkit.document-shape',
  collect(ctx) {
    return fragment(
      {
        source: 'craftkit.document-shape',
        kind: 'data',
        trust: 'builtin',
        title: 'Document shape',
      },
      // A bare provider has no run policy: it keeps the full document, as before.
      collectDocument(ctx, resolveAiCompositionPolicy(undefined), []),
    );
  },
};

export const BUILDER_AI_CONTEXT_PROVIDERS: readonly AiContextProvider[] = Object.freeze([
  blockCatalogContextProvider,
  templateCatalogContextProvider,
  selectionContextProvider,
  documentShapeContextProvider,
]);

export interface AssembleAiContextOptions {
  selection?: readonly NodeId[];
  /** Legacy alias retained for compatibility; this input is additive too. */
  providers?: readonly AiContextProvider[];
  /** Request-local providers composed after registry contributions. */
  additionalContextProviders?: readonly AiContextProvider[];
  /** Effective command names already intersected by the caller's run/Skill policy. */
  allowedCommands?: readonly string[];
  /** Prepared per-request skill data; no ambient global activation state. */
  skillContext?: AiPreparedSkillContext;
  /**
   * How much of the registry crosses the wire this run. Omitted ⇒ the full
   * catalog, exactly as before this option existed.
   */
  composition?: AiCompositionPolicy;
  /**
   * This run wants a PLAN in prose, not a plan of commands.
   *
   * The output contract normally requires `commands` with `minItems: 1` — the
   * whole point of a build run is that it produces at least one. An outline
   * produces none, deliberately, and shipping a schema that demands one would
   * be telling the model the opposite of the instruction it was just given, in
   * the one part of the request it is most likely to obey.
   */
  outline?: boolean;
}

const BUILTIN_CONTEXT_PROVIDERS = new Map(
  BUILDER_AI_CONTEXT_PROVIDERS.map((provider) => [provider.id, provider]),
);

function additiveContextProviders(
  ctx: AiContextAssemblySource,
  additions: readonly AiContextProvider[],
): readonly AiContextProvider[] {
  const providers = new Map<string, AiContextProvider>();
  const add = (provider: AiContextProvider): void => {
    const builtin = BUILTIN_CONTEXT_PROVIDERS.get(provider.id);
    if (builtin !== undefined) {
      if (builtin !== provider) {
        throw new Error(`AI context provider id "${provider.id}" conflicts with a built-in.`);
      }
      // Built-ins have one structured representation and never become fragments.
      return;
    }
    const existing = providers.get(provider.id);
    if (existing !== undefined && existing !== provider) {
      throw new Error(`AI context provider id "${provider.id}" is registered more than once.`);
    }
    providers.set(provider.id, provider);
  };
  for (const provider of ctx.registry.aiContextProviders()) add(provider);
  for (const provider of additions) add(provider);
  return Object.freeze([...providers.values()]);
}

function usableTokenCount(tokens: number | undefined): tokens is number {
  return tokens !== undefined && Number.isSafeInteger(tokens) && tokens >= 0;
}

export function assembleAiContext(
  ctx: AiContextAssemblySource,
  options: AssembleAiContextOptions = {},
): AssembledAiContext {
  const readCtx = createAiContextReadApi(ctx);
  const composition = resolveAiCompositionPolicy(options.composition);
  const selection = Object.freeze([...(options.selection ?? readCtx.store.getState().selection)]);
  const additions = Object.freeze([
    ...(options.providers ?? []),
    ...(options.additionalContextProviders ?? []),
  ]);
  const providers = additiveContextProviders(ctx, additions);
  const providerFragments = providers.map((provider) => {
    const collected = provider.collect(readCtx, selection);
    const tokens = usableTokenCount(collected.tokens)
      ? collected.tokens
      : estimateContextTokens(collected.title, collected.body);
    const source = collected.source ?? provider.id;
    if (source !== provider.id) {
      throw new Error(
        `AI context provider "${provider.id}" cannot claim fragment source "${source}".`,
      );
    }
    return defineContextFragment({
      source,
      kind: collected.kind ?? 'data',
      trust: collected.trust ?? 'reviewed',
      title: collected.title,
      body: collected.body,
      tokens,
    });
  });
  const skillFragments =
    options.skillContext === undefined
      ? []
      : options.skillContext.active.map((skill) => {
          const manifest = options.skillContext?.catalog.find(({ id }) => id === skill.id);
          return fragment(
            {
              source: skill.id,
              kind: 'instruction',
              trust: manifest?.trust ?? 'untrusted',
              title: `Active AI skill: ${skill.id}`,
            },
            {
              instructions: skill.instructions,
              references: skill.references,
            },
          );
        });
  // fast-edits (2026-09-28): an edit that names its section sees that section, not the page.
  const focus = options.composition?.documentFocus;
  const focused =
    focus === undefined ? undefined : collectFocusedDocument(readCtx, focus, selection);
  // ── block-parts (2026-10-06): an edit sees the parts of the blocks it can reach ──
  const partsFragment =
    options.outline === true || focus?.kind === 'add-section'
      ? undefined
      : blockPartsFragment(
          ctx,
          focused === undefined
            ? Object.keys(readCtx.store.getState().doc.nodes)
            : focused.shown.flatMap((id) => subtreeIds(id, readCtx.store.getState().doc)),
        );
  // ── /block-parts ──
  const fragments = Object.freeze([
    ...providerFragments,
    ...skillFragments,
    ...(focused === undefined ? [] : [focusFragment(focused.shown)]),
    // ── block-parts (2026-10-06) ──
    ...(partsFragment === undefined ? [] : [partsFragment]),
    // ── /block-parts ──
  ]);
  const allowedCommands =
    options.allowedCommands === undefined ? undefined : new Set([...options.allowedCommands]);
  const allCommands = readCtx.registry.commands();
  const commands: readonly AiCommandContext[] = Object.freeze(
    allCommands
      .filter(({ name }) => allowedCommands === undefined || allowedCommands.has(name))
      .map((command) =>
        Object.freeze({
          name: command.name,
          argsSchema:
            focused === undefined ? command.argsSchema : compactArgsSchema(command.argsSchema),
        }),
      ),
  );
  const omittedCommandCount = allCommands.length - commands.length;
  const omissions: readonly AiContextOmission[] = Object.freeze(
    omittedCommandCount === 0
      ? []
      : [
          Object.freeze({
            source: 'commands' as const,
            reason: 'policy-filtered' as const,
            omittedCount: omittedCommandCount,
          }),
        ],
  );

  const base = {
    fragments,
    totalTokens: fragments.reduce((total, current) => total + (current.tokens ?? 0), 0),
    blocks: collectBlocks(readCtx, composition, focus),
    templates: collectTemplates(readCtx, composition.catalogMode === 'full'),
    document: focused?.document ?? collectDocument(readCtx, composition, selection),
    selection: collectSelection(readCtx, selection),
    commands,
    outputContract: options.outline === true ? AI_OUTLINE_OUTPUT_CONTRACT : AI_PLAN_OUTPUT_CONTRACT,
    omissions,
    // The host compiles Tailwind at runtime: the prompt stops holding the model to the static list.
    ...(hasUtilityClassOracle() ? { utilities: 'tailwind' as const } : {}),
    // This client reads trees written as markup (plan/tree-markup.ts).
    treeMarkup: true as const,
  };
  if (options.skillContext === undefined) return base;
  return {
    ...base,
    /*
      A focused edit ships no skill catalog: no server renders it (prompt.ts
      reads the active fragments and the pins, never the catalog), and on the
      owner's CV edit it was 5,431 of 11,368 wire tokens — the largest single
      part of "~11.3k" (fast-edits, measured 2026-09-28).
    */
    /*
      And an unfocused call ships only the PINNED skills' manifests: the one
      thing a server reads from the catalog is a pin's activation mode and
      intents (prompt.ts `editCompatible`, the edit-variant decision). The
      whole catalog was ~23,800 characters on every page plan, section fill
      and unfocused edit — about 40% of a fill's bytes, unread (2026-09-30).
    */
    ...(focused === undefined ? { skillCatalog: pinnedManifests(options.skillContext) } : {}),
    skills: options.skillContext.activations,
  };
}

/** The catalog entries of the skills this call pinned, in catalog order. */
function pinnedManifests(
  skillContext: NonNullable<AssembleAiContextOptions['skillContext']>,
): NonNullable<AssembledAiContext['skillCatalog']> {
  const pinned = new Set(skillContext.activations.map(({ id }) => id));
  return Object.freeze(skillContext.catalog.filter(({ id }) => pinned.has(id)));
}

/**
 * The context a DIRECT edit read (`tryDirectEdit`, fast-edits 2026-09-28):
 * the nodes it writes, as they stood, and the selection — no catalog, no
 * commands, no skills, zero tokens, because no model was asked. It exists so
 * the direct edit's proposal is fingerprinted against what it was made from,
 * exactly as a model's proposal is against the context the model saw.
 */
export function assembleDirectEditContext(
  ctx: Pick<KernelApi, 'store'>,
  options: { readonly nodeIds: readonly NodeId[]; readonly selection?: readonly NodeId[] },
): AssembledAiContext {
  const { doc, selection: live } = ctx.store.getState();
  const ids = [...new Set(options.nodeIds)].sort(compareText);
  return {
    fragments: Object.freeze([]),
    totalTokens: 0,
    blocks: Object.freeze([]),
    templates: Object.freeze([]),
    document: {
      schemaVersion: doc.schemaVersion,
      surface: doc.surface,
      dir: doc.dir,
      rootId: doc.rootId,
      nodes: ids.flatMap((id) => {
        const node = doc.nodes[id];
        return node === undefined ? [] : [documentNode(node)];
      }),
    },
    selection: { ids: [...(options.selection ?? live)] },
    commands: Object.freeze([]),
    outputContract: AI_PLAN_OUTPUT_CONTRACT,
    omissions: Object.freeze([]),
    treeMarkup: true,
  };
}
