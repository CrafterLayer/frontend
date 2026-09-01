import {
  blockPropsJsonSchema,
  type AiContextBlockCatalogEntry,
  type AiContextCompositionCatalogEntry,
  type AiContextProvider,
  type AiContextReadApi,
  type AiContextWidgetCatalogEntry,
  type BuilderDocument,
  type CompositionDef,
  type ContextFragment,
  type DeclarativeWidgetTypeDef,
  type JsonValue,
  type KernelApi,
  type KernelState,
  type Node,
  type NodeId,
  type RegisteredBlock,
  type Surface,
} from '@craftkit/builder-schema';

import type {
  AiBlockContext,
  AiDocumentContext,
  AiDocumentNodeContext,
  AiSelectedNodeContext,
  AiSelectionContext,
  AiTemplateContext,
  AssembledAiContext,
} from '../types';
import type { AiPreparedSkillContext } from '../skills';

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
  return Object.freeze({ doc, selection, seq: live.seq });
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
  return Object.freeze({
    type: schema.type,
    description: schema.description,
    propsSchema: deepFreezeJson(cloneJson(blockPropsJsonSchema(schema))),
    ...(schema.surfaces === undefined
      ? {}
      : { surfaces: frozenStrings([...schema.surfaces].sort(compareText)) }),
    ...(schema.inlineEditable === undefined ? {} : { inlineEditable: schema.inlineEditable }),
    examples,
    slots,
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
  const commandNames = frozenStrings(ctx.registry.commandNames());
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

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, candidate: unknown) => {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
      return candidate;
    }
    return Object.fromEntries(
      Object.entries(candidate).sort(([left], [right]) => compareText(left, right)),
    );
  });
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
  return Math.max(1, Math.ceil(stableStringify(context).length / CHARACTERS_PER_TOKEN_ESTIMATE));
}

function fragment(title: string, value: unknown): ContextFragment & { tokens: number } {
  const body = stableStringify(value);
  return { title, body, tokens: estimateContextTokens(title, body) };
}

/**
 * Prompt-side excerpting for the document-shape FRAGMENT only. A page can hold
 * essays; a planner needs to locate text, not re-read it, and one giant prop
 * would crowd the catalog out of the window. The marker is explicit so a model
 * knows the value continues — and the structured `context.document` keeps every
 * exact byte for consumers that need the real thing.
 */
const PROMPT_STRING_LIMIT = 400;

function excerptForPrompt(value: JsonValue): JsonValue {
  if (typeof value === 'string') {
    return value.length > PROMPT_STRING_LIMIT
      ? `${value.slice(0, PROMPT_STRING_LIMIT)}… [truncated]`
      : value;
  }
  if (Array.isArray(value)) {
    return value.map(excerptForPrompt);
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, excerptForPrompt(child)]),
  );
}

function sortedSlots(node: Node): Readonly<Record<string, readonly NodeId[]>> {
  return Object.fromEntries(
    Object.entries(node.slots ?? {})
      .sort(([left], [right]) => compareText(left, right))
      .map(([name, ids]) => [name, [...ids]]),
  );
}

function documentNode(node: Node): AiDocumentNodeContext {
  return {
    id: node.id,
    type: node.type,
    // Full props for every node: page text lives here, and "change the word X"
    // is only answerable when the provider can actually read the page's words.
    props: Object.fromEntries(
      Object.entries(node.props)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, value]) => [key, cloneJson(value)]),
    ),
    slots: sortedSlots(node),
  };
}

function selectedNode(node: Node): AiSelectedNodeContext {
  return documentNode(node);
}

function collectBlocks(ctx: AiContextReadApi): readonly AiBlockContext[] {
  return ctx.registry
    .blocks(ctx.surface)
    .map((entry) => ({
      type: entry.type,
      description: entry.description,
      propsSchema: cloneJson(entry.propsSchema),
      examples: entry.examples.map((example) => ({
        prompt: example.prompt,
        node: cloneJson(example.node),
      })),
      slots: entry.slots.map((slot) => ({
        name: slot.name,
        allow: [...slot.allow],
        ...(slot.max === undefined ? {} : { max: slot.max }),
      })),
    }))
    .sort((left, right) => compareText(left.type, right.type));
}

function collectTemplates(ctx: AiContextReadApi): readonly AiTemplateContext[] {
  return ctx.registry.compositions(ctx.surface).map((composition) => ({
    id: composition.id,
    name: composition.name,
    rootType: composition.rootType,
    nodeCount: composition.nodeCount,
    blockTypes: [...composition.blockTypes],
  }));
}

function collectDocument(ctx: AiContextReadApi): AiDocumentContext {
  const { doc } = ctx.store.getState();
  return {
    schemaVersion: doc.schemaVersion,
    surface: doc.surface,
    dir: doc.dir,
    rootId: doc.rootId,
    nodes: Object.values(doc.nodes)
      .map(documentNode)
      .sort((left, right) => compareText(left.id, right.id)),
  };
}

function collectSelection(ctx: AiContextReadApi, selection: readonly NodeId[]): AiSelectionContext {
  const { doc } = ctx.store.getState();
  return {
    ids: [...selection],
    nodes: selection.flatMap((id) => {
      const node = doc.nodes[id];
      return node === undefined ? [] : [selectedNode(node)];
    }),
  };
}

export const blockCatalogContextProvider: AiContextProvider = {
  id: 'craftkit.block-catalog',
  collect(ctx) {
    return fragment('Registered block vocabulary', collectBlocks(ctx));
  },
};

export const templateCatalogContextProvider: AiContextProvider = {
  id: 'craftkit.template-catalog',
  collect(ctx) {
    return fragment('Registered page templates', collectTemplates(ctx));
  },
};

export const selectionContextProvider: AiContextProvider = {
  id: 'craftkit.selection',
  collect(ctx, selection) {
    return fragment('Current selection', collectSelection(ctx, selection));
  },
};

export const documentShapeContextProvider: AiContextProvider = {
  id: 'craftkit.document-shape',
  collect(ctx) {
    return fragment(
      'Document shape',
      excerptForPrompt(collectDocument(ctx) as unknown as JsonValue),
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
  providers?: readonly AiContextProvider[];
  /** Prepared per-request skill data; no ambient global activation state. */
  skillContext?: AiPreparedSkillContext;
}

function defaultContextProviders(ctx: AiContextAssemblySource): readonly AiContextProvider[] {
  const providers = new Map(
    BUILDER_AI_CONTEXT_PROVIDERS.map((provider) => [provider.id, provider]),
  );
  for (const provider of ctx.registry.aiContextProviders()) {
    const existing = providers.get(provider.id);
    if (existing !== undefined && existing !== provider) {
      throw new Error(
        `AI context provider id "${provider.id}" conflicts with a built-in provider.`,
      );
    }
    providers.set(provider.id, provider);
  }
  return [...providers.values()];
}

function usableTokenCount(tokens: number | undefined): tokens is number {
  return tokens !== undefined && Number.isSafeInteger(tokens) && tokens >= 0;
}

export function assembleAiContext(
  ctx: AiContextAssemblySource,
  options: AssembleAiContextOptions = {},
): AssembledAiContext {
  const readCtx = createAiContextReadApi(ctx);
  const selection = Object.freeze([...(options.selection ?? readCtx.store.getState().selection)]);
  const providers = Object.freeze([...(options.providers ?? defaultContextProviders(ctx))]);
  const providerFragments = providers.map((provider) => {
    const collected = provider.collect(readCtx, selection);
    const tokens = usableTokenCount(collected.tokens)
      ? collected.tokens
      : estimateContextTokens(collected.title, collected.body);
    return { ...collected, tokens };
  });
  const skillFragments =
    options.skillContext === undefined
      ? []
      : [
          fragment('Available AI skills', options.skillContext.catalog),
          ...options.skillContext.active.map((skill) =>
            fragment(`Active AI skill: ${skill.id}`, skill),
          ),
        ];
  const fragments = [...providerFragments, ...skillFragments];

  const base = {
    fragments,
    totalTokens: fragments.reduce((total, current) => total + current.tokens, 0),
    blocks: collectBlocks(readCtx),
    templates: collectTemplates(readCtx),
    document: collectDocument(readCtx),
    selection: collectSelection(readCtx, selection),
  };
  if (options.skillContext === undefined) return base;
  return {
    ...base,
    skillCatalog: options.skillContext.catalog,
    skills: options.skillContext.activations,
  };
}
