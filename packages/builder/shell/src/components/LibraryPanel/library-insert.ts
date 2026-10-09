import { insertedNodeId, type BuilderKernel } from '@craftkit/builder-core';
import type { CustomCodeRoot, JsonValue, NodeId } from '@craftkit/builder-schema';

import { insertPayloads, pasteDestination } from '../../clipboard/element-clipboard';
import { primaryTarget } from '../../clipboard/run-editor-action';
import type { ElementActionLabels } from '../../clipboard/element-actions.labels';
import { customCodeTreeKey } from '../../custom-code/element-at';
import { elementPayload } from '../../custom-code/element-drag-payload';
import type { ElementNameWords } from '../../custom-code/element-target';
import { seatOf, slotAccepts } from '../../overlay/drop-resolver';
import { propsShapeOf } from '../../fields/resolve-field';

/*
  Inserting from the Library is the same door as everything else:
  - an ELEMENT lands inside the current custom section through
    `insertTreeNode` (after the focused element, or as the last child of a
    focused container, or at the end of a selected section);
  - a SECTION — or an element when nothing editable is selected — becomes a
    NEW custom-code region through `insertNode`, placed after the selected
    block, or at the end of the first slot up the tree that accepts it.
  Each is one labelled transaction.
*/

/** The registered block that holds an element tree: `customCode` when present. */
export function regionBlockType(kernel: BuilderKernel): string | undefined {
  if (kernel.context.registry.block('customCode') !== undefined && customCodeTreeKey(kernel, 'customCode') !== undefined) {
    return 'customCode';
  }
  const surface = kernel.getDocument().surface;
  return kernel.context.registry
    .blocks(surface)
    .map((entry) => entry.schema.type)
    .find((type) => customCodeTreeKey(kernel, type) !== undefined);
}

interface Placement {
  readonly parentId: NodeId;
  readonly slot: string;
  readonly index: number;
}

/** After the selected block when its seat accepts the region, else up the tree to the first accepting slot. */
function regionPlacement(kernel: BuilderKernel, type: string): Placement | undefined {
  const doc = kernel.getDocument();
  const registry = kernel.context.registry;
  const payload = { kind: 'insert', type } as const;
  const selected = kernel.context.store.getState().selection[0];
  if (selected !== undefined) {
    const seat = seatOf(doc, selected);
    if (seat !== undefined && slotAccepts(doc, registry, seat.parentId, seat.slot, payload)) {
      return { parentId: seat.parentId, slot: seat.slot, index: seat.index + 1 };
    }
  }
  let candidate: NodeId | undefined = selected ?? doc.rootId;
  while (candidate !== undefined) {
    const type0 = doc.nodes[candidate]?.type ?? '';
    for (const slot of Object.keys(registry.block(type0)?.schema.slots ?? {})) {
      if (slotAccepts(doc, registry, candidate, slot, payload)) {
        return { parentId: candidate, slot, index: doc.nodes[candidate]?.slots?.[slot]?.length ?? 0 };
      }
    }
    candidate = candidate === doc.rootId ? undefined : seatOf(doc, candidate)?.parentId;
  }
  return undefined;
}

export type LibraryInsertOutcome = { readonly ok: true } | { readonly ok: false; readonly message: string };

export interface LibraryInsertRequest {
  readonly kernel: BuilderKernel;
  readonly kind: 'element' | 'section';
  readonly name: string;
  readonly tree: CustomCodeRoot;
  readonly css?: string | undefined;
  readonly actionLabels: ElementActionLabels;
  readonly words?: ElementNameWords | undefined;
  readonly noRegionType: string;
  // library-playground additions (2026-10-08)
  /** The page kit a section's `ck-*` classes need; installed on the page root in the SAME transaction. */
  readonly pageKit?: LibraryPageKit | undefined;
  // end library-playground additions
}

// library-playground additions (2026-10-08): the section page kit (agent-script DESIGN §B.5).
/**
 * The stylesheet a ready-made section's classes (`ck-btn`, `ck-card`, the
 * `--ck-*` tokens) need, written ONCE on the page root's `pageCss`. `marker`
 * says whether a page already has it (the page plan's fence, `.ck-page-plan{`).
 */
export interface LibraryPageKit {
  readonly marker: string;
  readonly css: string;
}

/**
 * The step that installs a page kit on the current page root, or undefined
 * when the page already holds it (its `pageCss` contains the marker), the kit
 * is empty, or the root block has no `pageCss` prop to hold it.
 */
export function pageKitStep(
  kernel: BuilderKernel,
  pageKit: LibraryPageKit | undefined,
): { readonly command: 'setProp'; readonly args: { id: NodeId; key: 'pageCss'; value: string } } | undefined {
  if (pageKit === undefined || pageKit.css.trim() === '' || pageKit.marker === '') return undefined;
  const doc = kernel.getDocument();
  const root = doc.nodes[doc.rootId];
  if (root === undefined) return undefined;
  const rootSchema = kernel.context.registry.block(root.type)?.schema;
  if (rootSchema === undefined || !('pageCss' in propsShapeOf(rootSchema.props))) return undefined;
  const raw = root.props['pageCss'];
  const current = typeof raw === 'string' ? raw : '';
  if (current.includes(pageKit.marker)) return undefined;
  return {
    command: 'setProp',
    args: { id: doc.rootId, key: 'pageCss', value: current === '' ? pageKit.css : `${current}\n${pageKit.css}` },
  };
}
// end library-playground additions

/** Insert a library entry at the selection — one transaction either way. */
export function insertLibraryTree(request: LibraryInsertRequest): LibraryInsertOutcome {
  const { kernel, tree, css, actionLabels } = request;
  if (request.kind === 'element') {
    const destination = pasteDestination(kernel, primaryTarget(kernel));
    if (destination !== undefined) {
      const payloads = tree.children.map((node) => elementPayload(node, css));
      const outcome = insertPayloads(
        { kernel, targets: [], labels: actionLabels, words: request.words },
        payloads,
        destination,
        actionLabels.insert,
      );
      return outcome.ok ? { ok: true } : { ok: false, message: outcome.message };
    }
  }
  const type = regionBlockType(kernel);
  if (type === undefined) return { ok: false, message: request.noRegionType };
  const placement = regionPlacement(kernel, type);
  if (placement === undefined) return { ok: false, message: actionLabels.refused(actionLabels.insert, request.name) };
  const treeKey = customCodeTreeKey(kernel, type) ?? 'tree';
  const schema = kernel.context.registry.block(type)?.schema;
  const shape = schema === undefined ? {} : propsShapeOf(schema.props);
  const props: Record<string, JsonValue> = { [treeKey]: JSON.parse(JSON.stringify(tree)) as JsonValue };
  if (css !== undefined && css.trim() !== '' && 'css' in shape) props['css'] = css;
  if ('label' in shape) props['label'] = request.name.slice(0, 80);
  const label = `${actionLabels.insert} · ${request.name}`;
  try {
    // library-playground additions (2026-10-08): the page kit rides in the SAME group — one
    // transaction, one Undo. A page whose css cannot take it (over the prop's limit) still gets the section.
    const insertStep = { command: 'insertNode', args: { type, props, ...placement } };
    const kitStep = pageKitStep(kernel, request.pageKit);
    const options = { label: label.slice(0, 160) };
    const dispatchWithKit = () => {
      if (kitStep === undefined) return kernel.dispatchGroup([insertStep], options);
      try {
        return kernel.dispatchGroup([insertStep, kitStep], options);
      } catch {
        return kernel.dispatchGroup([insertStep], options);
      }
    };
    const tx = dispatchWithKit();
    // end library-playground additions
    const inserted = insertedNodeId(tx.patches);
    if (inserted !== undefined) {
      if (tree.children.length > 0) kernel.focusElement(inserted, [0]);
      else kernel.setSelection([inserted]);
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, message: actionLabels.refused(actionLabels.insert, error instanceof Error ? error.message : String(error)) };
  }
}

/** A registered page template (composition): inserted with `insertComposition`, like the Palette. */
export function insertCompositionAtSelection(
  kernel: BuilderKernel,
  compositionId: string,
  rootType: string,
): boolean {
  const placement = regionPlacement(kernel, rootType);
  if (placement === undefined) return false;
  try {
    const tx = kernel.dispatch('insertComposition', { compositionId, ...placement });
    const inserted = insertedNodeId(tx.patches);
    if (inserted !== undefined) kernel.setSelection([inserted]);
    return true;
  } catch {
    return false;
  }
}
