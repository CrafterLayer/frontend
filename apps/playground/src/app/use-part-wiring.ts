import { useCallback } from 'react';

import type { BuilderKernel, ElementTarget, StyleSectorId } from '@craftkit/builder';

/** A part instance on the canvas, as EditorCanvas hands it over (structural: PartTarget). */
export interface PartWiringTarget {
  readonly nodeId: string;
  readonly part: string;
  readonly index: readonly number[];
}

export interface PartWiringOptions {
  readonly kernel: BuilderKernel | undefined;
  readonly locale: 'en' | 'ar';
  /** Opens the Inspector aside (the part panel lives there). */
  readonly openAside: () => void;
  /** The quick bar's "More": the Inspector's Design tab at a sector. */
  readonly openStyleSector: (sector: StyleSectorId) => void;
  /** "Edit with AI" for an element target: opens the assistant and focuses its composer. */
  readonly editWithAi: (target: ElementTarget) => void;
}

export interface PartWiring {
  readonly onReplacePartImage: (target: PartWiringTarget) => void;
  readonly onOpenPartStyle: (sector: StyleSectorId, target: PartWiringTarget) => void;
  readonly onEditWithAiPart: (target: PartWiringTarget) => void;
}

const COMPOSER = '.pg-agent-host textarea, .pg-legacy-agent-host textarea';

/** The address the assistant reads: "Heading · Hero [hero-1 · heading]", "Title 3 · Features [f1 · item.title@2]". */
export function partAddress(kernel: BuilderKernel, target: PartWiringTarget, locale: 'en' | 'ar'): string {
  const node = kernel.getDocument().nodes[target.nodeId];
  const schema = node === undefined ? undefined : kernel.context.registry.block(node.type)?.schema;
  const decl = schema?.parts?.[target.part];
  const label = decl === undefined ? target.part : decl.label[locale] === '' ? decl.label.en : decl.label[locale];
  const position = target.index.at(-1);
  const name = position === undefined ? label : `${label} ${String(position + 1)}`;
  const key = target.index.length === 0 ? target.part : `${target.part}@${target.index.join('.')}`;
  return `${name} · ${node?.type ?? target.nodeId} [${target.nodeId} · ${key}]`;
}

/*
  The composer is a controlled React textarea: setting `.value` alone would be
  overwritten on the next render. The native setter plus an `input` event is
  the change React itself listens for, so the draft lands in the controller.
*/
function prefillComposer(text: string): void {
  const field = document.querySelector<HTMLTextAreaElement>(COMPOSER);
  if (field === null) return;
  const current = field.value.trim();
  const next = current === '' || current.startsWith(text) ? `${text} ` : `${text} ${current}`;
  // The prototype's own setter, called on the field (the receiver): what React tracks.
  Reflect.set(HTMLTextAreaElement.prototype, 'value', next, field);
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.focus();
  field.setSelectionRange(next.length, next.length);
}

/**
 * The playground's side of block parts (block-parts DESIGN §2.13): what the
 * canvas's part gestures open. Every one first puts the kernel's part focus on
 * the target, so the Inspector shows that part's panel and the agent reads the
 * part as its context.
 *
 * - Replace image → the part panel's Content tab, whose image field holds the
 *   asset picker (the Inspector's `assetLibrary`); its commit is `planPartValue`
 *   for `src` and `alt`, one labelled transaction each.
 * - Style → the part panel's Design tab at that sector.
 * - Edit with AI → the assistant, its composer prefilled with the part address.
 */
export function usePartWiring({ kernel, locale, openAside, openStyleSector, editWithAi }: PartWiringOptions): PartWiring {
  const focus = useCallback(
    (target: PartWiringTarget) => {
      kernel?.focusPart(target.nodeId, { part: target.part, index: [...target.index] });
    },
    [kernel],
  );

  const onReplacePartImage = useCallback(
    (target: PartWiringTarget) => {
      focus(target);
      openAside();
    },
    [focus, openAside],
  );

  const onOpenPartStyle = useCallback(
    (sector: StyleSectorId, target: PartWiringTarget) => {
      focus(target);
      openStyleSector(sector);
    },
    [focus, openStyleSector],
  );

  const onEditWithAiPart = useCallback(
    (target: PartWiringTarget) => {
      if (kernel === undefined) return;
      // Opens the assistant on the block (a selection, which clears any part
      // focus), then narrows the focus to the part itself.
      editWithAi({ kind: 'block', nodeId: target.nodeId });
      focus(target);
      const address = partAddress(kernel, target, locale);
      requestAnimationFrame(() => {
        prefillComposer(address);
      });
    },
    [kernel, editWithAi, focus, locale],
  );

  return { onReplacePartImage, onOpenPartStyle, onEditWithAiPart };
}
