import {
  blockPropsJsonSchema,
  type AiContextProvider,
  type ContextFragment,
  type JsonValue,
  type KernelApi,
  type Node,
  type NodeId,
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

const CHARACTERS_PER_TOKEN_ESTIMATE = 4;

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

function fragment(title: string, value: unknown): ContextFragment {
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

function collectBlocks(ctx: KernelApi): readonly AiBlockContext[] {
  return ctx.registry
    .blocks(ctx.surface)
    .map(({ schema }) => ({
      type: schema.type,
      description: schema.description,
      propsSchema: cloneJson(blockPropsJsonSchema(schema)),
      examples: schema.examples.map((example) => ({
        prompt: example.prompt,
        node: cloneJson(example.node),
      })),
      slots: Object.entries(schema.slots ?? {})
        .sort(([left], [right]) => compareText(left, right))
        .map(([name, declaration]) => {
          const slot = { name, allow: [...declaration.allow].sort(compareText) };
          return declaration.max === undefined ? slot : { ...slot, max: declaration.max };
        }),
    }))
    .sort((left, right) => compareText(left.type, right.type));
}

function collectTemplates(ctx: KernelApi): readonly AiTemplateContext[] {
  return ctx.registry.compositions(ctx.surface).map((composition) => {
    const root = composition.nodes[composition.rootId];
    return {
      id: composition.id,
      name: composition.name,
      rootType: root?.type ?? 'unknown',
      nodeCount: Object.keys(composition.nodes).length,
      blockTypes: [...new Set(Object.values(composition.nodes).map((node) => node.type))].sort(
        compareText,
      ),
    };
  });
}

function collectDocument(ctx: KernelApi): AiDocumentContext {
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

function collectSelection(ctx: KernelApi, selection: readonly NodeId[]): AiSelectionContext {
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
}

function usableTokenCount(tokens: number | undefined): tokens is number {
  return tokens !== undefined && Number.isSafeInteger(tokens) && tokens >= 0;
}

export function assembleAiContext(
  ctx: KernelApi,
  options: AssembleAiContextOptions = {},
): AssembledAiContext {
  const selection = options.selection ?? ctx.store.getState().selection;
  const providerSelection = [...selection];
  const fragments = (options.providers ?? BUILDER_AI_CONTEXT_PROVIDERS).map((provider) => {
    const collected = provider.collect(ctx, providerSelection);
    const tokens = usableTokenCount(collected.tokens)
      ? collected.tokens
      : estimateContextTokens(collected.title, collected.body);
    return { ...collected, tokens };
  });

  return {
    fragments,
    totalTokens: fragments.reduce((total, current) => total + current.tokens, 0),
    blocks: collectBlocks(ctx),
    templates: collectTemplates(ctx),
    document: collectDocument(ctx),
    selection: collectSelection(ctx, selection),
  };
}
