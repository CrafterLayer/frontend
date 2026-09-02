import {
  blockPropsJsonSchema,
  commandArgsJsonSchema,
  defineContextFragment,
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
    propsSchema: deepFreezeJson(cloneJson(blockPropsJsonSchema(schema))),
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

function documentNode(node: Node): AiDocumentNodeContext {
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
        .map(([key, value]) => [key, cloneJson(value)]),
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
    propsSchema: cloneJson(entry.propsSchema),
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
  return { ...blockIndexEntry(entry), propKeys };
}

/** The block types the document holds right now. */
function presentBlockTypes(ctx: AiContextReadApi): ReadonlySet<string> {
  return new Set(Object.values(ctx.store.getState().doc.nodes).map((node) => node.type));
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
): readonly AiBlockContext[] {
  const present = policy.catalogMode === 'none' ? presentBlockTypes(ctx) : undefined;
  return ctx.registry
    .blocks(ctx.surface)
    .flatMap((entry) => {
      if (blockIsInCatalogScope(policy, entry.type)) return [blockDetailEntry(entry)];
      if (present !== undefined) {
        // `none` states nothing about a block the run did not ask for — not
        // even its name. The model composes; it does not choose from a list.
        // The one exception is a block ALREADY ON THE PAGE: the person will
        // ask to change it, and a model that cannot name its props invents
        // one. Its name and prop keys ride along; its schema does not.
        return present.has(entry.type) ? [blockPresenceEntry(entry)] : [];
      }
      return [blockIndexEntry(entry)];
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
      collectTemplates(ctx),
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
      collectDocument(ctx),
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
  const fragments = Object.freeze([...providerFragments, ...skillFragments]);
  const allowedCommands =
    options.allowedCommands === undefined ? undefined : new Set([...options.allowedCommands]);
  const allCommands = readCtx.registry.commands();
  const commands: readonly AiCommandContext[] = Object.freeze(
    allCommands
      .filter(({ name }) => allowedCommands === undefined || allowedCommands.has(name))
      .map((command) => Object.freeze({ name: command.name, argsSchema: command.argsSchema })),
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
    blocks: collectBlocks(readCtx, composition),
    templates: collectTemplates(readCtx),
    document: collectDocument(readCtx),
    selection: collectSelection(readCtx, selection),
    commands,
    outputContract: AI_PLAN_OUTPUT_CONTRACT,
    omissions,
  };
  if (options.skillContext === undefined) return base;
  return {
    ...base,
    skillCatalog: options.skillContext.catalog,
    skills: options.skillContext.activations,
  };
}
