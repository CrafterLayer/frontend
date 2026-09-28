import type { JsonValue } from '@craftkit/builder-schema';

import type {
  AiDocumentContext,
  AiPlan,
  AiPlanProvider,
  AiProposeOptions,
  AssembledAiContext,
} from '../types';
import { AiProviderError } from './errors';

/**
 * A plan the CATALOG already knows how to make, produced without asking anyone.
 *
 * ## Why this exists
 *
 * A block declares `examples: [{ prompt, node }]`, and the panel offers those
 * prompts as suggestions. When a person picks one back, the answer is already
 * written down: this exact prompt produces this exact node. Sending it to a
 * model is asking a stranger to guess a value the catalog is holding — it costs
 * a round trip, tokens, and a chance of coming back different.
 *
 * ## What it is NOT
 *
 * It is not a shortcut around the door. The plan it returns is an ordinary
 * `AiPlan` and travels the ordinary route: validated by `validateAiPlan`,
 * wrapped by `createAiValidatedProposal`, applied only through `dispatchGroup`.
 * An example that stopped validating — its block deregistered, its props no
 * longer accepted, the root's slot full — is refused exactly as a model's plan
 * would be, and refused by exactly the same code. The catalog is a source of
 * candidates here, never a source of authority.
 *
 * ## The catalog is passed in, not read off the context
 *
 * `AssembledAiContext` carries examples only in `full` mode, and in `scoped`
 * mode only for the scoped types — so a run with a trimmed context has no
 * examples in it at all, and a provider reading them from there would answer
 * some requests and silently stop answering the same ones later. The host hands
 * over the catalog it DERIVED THE SUGGESTIONS FROM, so the chip a person
 * pressed and the plan they get come from one source and cannot drift.
 *
 * The context still decides two things it alone knows: where a new block lands
 * (`document.rootId`), and that the page's own ROOT type may never be inserted
 * into itself — a plan that tried would be refused at the door.
 *
 * It deliberately does NOT read the context's `insertable` flag. That flag also
 * goes false for a block the context described without a schema, which says the
 * MODEL cannot author one, not that the door would refuse it. This provider is
 * not authoring: it is copying a node the registry already holds, and honouring
 * that flag meant a chip stopped working the moment its block appeared on the
 * page — which is precisely when a person is most likely to want another.
 *
 * ## Matching is exact, and that is the point
 *
 * Only a request that IS one of the catalog's prompts is answered here. Not a
 * fuzzy match, not a keyword: those belong to a model, which can weigh what a
 * person meant. This answers the one case where nothing needs weighing — the
 * person pressed a button that carries the prompt verbatim — and hands
 * everything else to the fallback untouched. A near-miss served locally would
 * be a wrong answer delivered fast, which is worse than a slow right one.
 */
/** One catalog entry, in the shape the host already holds it. */
export interface DirectAiPlanCatalogEntry {
  readonly type: string;
  readonly examples: readonly { readonly prompt: string; readonly node: JsonValue }[];
}

export interface DirectAiPlanProviderOptions {
  /**
   * The catalog to match against, read at propose time.
   *
   * A function, not an array: a registry is mutable and grows when an extension
   * registers, and a snapshot taken when the provider was built would answer
   * for a catalog that no longer exists.
   */
  readonly catalog: () => readonly DirectAiPlanCatalogEntry[];
  /**
   * Where to send a request the catalog does not answer.
   *
   * Optional so a host can run catalog-only; without it, an unmatched request
   * throws a non-retryable `refusal` rather than silently returning an empty
   * plan, because "I have nothing for this" and "nothing needs to change" are
   * different answers and only one of them is true here.
   */
  readonly fallback?: AiPlanProvider;
}

/** Whitespace folded, case folded, Unicode-normalised: how a person reads it. */
function fold(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

/**
 * A catalog node as `insertNode` args.
 *
 * The example's `node` is `{ type, props }` in the shape a document holds. Only
 * those two fields are read: an example carrying slots or an id is describing a
 * subtree this command cannot insert in one step, and quietly dropping the
 * extra would produce a block that is not the example it promised.
 */
function insertArgsFor(node: JsonValue, rootId: string): Record<string, JsonValue> | undefined {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return undefined;
  const shape = node as Record<string, JsonValue>;
  const type = shape['type'];
  if (typeof type !== 'string' || type.length === 0) return undefined;
  const extra = Object.keys(shape).filter((key) => key !== 'type' && key !== 'props');
  if (extra.length > 0) return undefined;
  const props = shape['props'];
  if (
    props !== undefined &&
    (props === null || typeof props !== 'object' || Array.isArray(props))
  ) {
    return undefined;
  }
  return {
    type,
    parentId: rootId,
    ...(props === undefined ? {} : { props }),
  };
}

/** The type of the node a new block would be inserted into. */
function rootTypeOf(document: AiDocumentContext): string | undefined {
  return document.nodes.find((node) => node.id === document.rootId)?.type;
}

/** The first catalog example whose prompt IS this request, and may be inserted. */
function matchExample(
  catalog: readonly DirectAiPlanCatalogEntry[],
  document: AiDocumentContext,
  request: string,
): { readonly type: string; readonly node: JsonValue } | undefined {
  const needle = fold(request);
  const rootType = rootTypeOf(document);
  for (const entry of catalog) {
    /*
      A page cannot be inserted into itself. Matching it here would turn a free,
      instant answer into a guaranteed round trip to a refusal.
    */
    if (entry.type === rootType) continue;
    for (const example of entry.examples) {
      if (fold(example.prompt) === needle) return { type: entry.type, node: example.node };
    }
  }
  return undefined;
}

/**
 * A provider that answers from the catalog when it can, and delegates when it
 * cannot.
 *
 * Pure in the sense that matters: it reads only the request and the context it
 * is handed, so the catalog it matches against is the same catalog the model
 * would have been shown. There is no second source of truth to drift.
 */
export function createDirectPlanProvider(options: DirectAiPlanProviderOptions): AiPlanProvider {
  const { catalog, fallback } = options;
  return {
    async propose(
      request: string,
      context: AssembledAiContext,
      proposeOptions?: AiProposeOptions,
    ): Promise<AiPlan> {
      const match = matchExample(catalog(), context.document, request);
      const args =
        match === undefined ? undefined : insertArgsFor(match.node, context.document.rootId);
      if (match === undefined || args === undefined) {
        if (fallback === undefined) {
          /*
            `refusal`, not a network or output code: nothing failed. This
            provider was asked for something it does not carry, and saying so
            is the answer. `retryable: false` because asking again changes
            nothing — the catalog is the same catalog.
          */
          throw new AiProviderError('No catalog example matches this request.', {
            code: 'refusal',
            retryable: false,
          });
        }
        return fallback.propose(request, context, proposeOptions);
      }
      return {
        /*
          The rationale names the CATALOG, not a model. A card that read like an
          answer from the assistant would be claiming a judgement nobody made —
          this is the example the block itself ships, chosen because the person
          picked it by name.
        */
        rationale: `Insert the catalog’s “${match.type}” example.`,
        commands: [
          {
            command: 'insertNode',
            args,
            title: `Add a ${match.type}`,
          },
        ],
      };
    },
    /*
      No `repair`. There is nothing to repair: this provider does not compose,
      it copies. An example the door refuses will be refused again identically,
      and a second attempt would only spend time proving that. When a fallback
      exists it keeps its own repair — a plan it wrote is a plan it can fix.
    */
    ...(fallback?.repair === undefined
      ? {}
      : { repair: fallback.repair.bind(fallback) satisfies AiPlanProvider['repair'] }),
    /*
      The fallback's other capabilities pass straight through, and only when
      it has them. A page plan or a rewritten draft is never a catalog example,
      so there is nothing to match first; hiding them would switch off the
      page-plan build and the Improve action for every host that puts the
      catalog in front of its provider (2026-09-28). A rejected plan is
      forgotten by whoever remembered it — the fallback, when it wrote it.
    */
    ...(fallback?.forget === undefined
      ? {}
      : { forget: fallback.forget.bind(fallback) satisfies AiPlanProvider['forget'] }),
    ...(fallback?.proposePagePlan === undefined
      ? {}
      : {
          proposePagePlan: fallback.proposePagePlan.bind(
            fallback,
          ) satisfies AiPlanProvider['proposePagePlan'],
        }),
    ...(fallback?.enhancePrompt === undefined
      ? {}
      : {
          enhancePrompt: fallback.enhancePrompt.bind(
            fallback,
          ) satisfies AiPlanProvider['enhancePrompt'],
        }),
  };
}
