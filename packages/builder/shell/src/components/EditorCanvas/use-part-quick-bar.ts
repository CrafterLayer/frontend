import { useCallback, useEffect, useMemo, useState } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type {
  BuilderDocument,
  NodeId,
  PartRef,
  StyleBucket,
  StyleSectorId,
  StyleState,
} from '@craftkit/builder-schema';

import type { ElementNameWords } from '../../custom-code/element-target';
import {
  partDeclOf,
  partInstanceName,
  partTarget,
  type PartTarget,
} from '../../overlay/part-target';
import {
  createPartBarModel,
  dispatchPartPlan,
  partStringValue,
  performPartAction,
  planPartLinkValue,
  quickGroupsForPart,
  resolvePartActions,
  PART_QUICK_BAR_LABELS_EN,
  type ElementQuickBarLabels,
  type PartActionId,
  type PartLinkPage,
} from '../ElementQuickBar';
import type { EditorCanvasLabels } from './EditorCanvas.labels';
import type { InlineEditEntryIntent } from './inline-edit-seam';
import type { CanvasRefs } from './use-canvas-refs';

type CanvasState = ReturnType<BuilderKernel['context']['store']['getState']>;

export interface PartQuickBarInputs {
  kernel: BuilderKernel;
  doc: BuilderDocument;
  dir: 'ltr' | 'rtl';
  editable: boolean;
  selectedId: NodeId | null;
  partFocus: NonNullable<CanvasState['partFocus']> | null;
  bucket: StyleBucket;
  styleState: StyleState;
  locale: EditorCanvasLabels['locale'];
  quickBarLabels: ElementQuickBarLabels;
  elementNameWords: ElementNameWords;
  namedStyleClasses: Readonly<Record<string, string>> | undefined;
  linkPages: readonly PartLinkPage[] | undefined;
  /** A part's "More": open the side panel's part Design tab at this sector. */
  onOpenPartStyle: ((sector: StyleSectorId, target: PartTarget) => void) | undefined;
  /** A part's "Edit with AI". Absent ⇒ no sparkle. */
  onEditWithAiPart: ((target: PartTarget) => void) | undefined;
  /** An image part's "Replace": the host's asset picker. Absent ⇒ disabled. */
  onReplacePartImage: ((target: PartTarget) => void) | undefined;
  activatePart: (nodeId: NodeId, ref: PartRef, entry: InlineEditEntryIntent) => boolean;
  refs: CanvasRefs;
}

// ── block-parts (2026-10-06) ──
/**
 * The quick bar over a focused PART of a registered block (DESIGN §2.14):
 * the same bar, its model writing `partStyles` in tokens mode and bound
 * values through the part planners — one transaction per control.
 */
export function usePartQuickBar({
  kernel,
  doc,
  dir,
  editable,
  selectedId,
  partFocus,
  bucket,
  styleState,
  locale,
  quickBarLabels,
  elementNameWords,
  namedStyleClasses,
  linkPages,
  onOpenPartStyle,
  onEditWithAiPart,
  onReplacePartImage,
  activatePart,
  refs,
}: PartQuickBarInputs) {
  const { partScopeRef, hostRef, announceGestureRef } = refs;
  const focusedPart = useMemo<PartTarget | undefined>(
    () =>
      partFocus !== null && partFocus.id === selectedId
        ? partTarget(partFocus.id, partFocus)
        : undefined,
    [partFocus, selectedId],
  );
  // The scope switch belongs to ONE part name on one node; moving on resets it.
  const focusedPartKey =
    focusedPart === undefined ? '' : `${focusedPart.nodeId}|${focusedPart.part}`;
  const [partScopeState, setPartScopeState] = useState<{ key: string; scope: 'all' | 'this' }>({
    key: '',
    scope: 'all',
  });
  // A click on an indexed instance ("Feature 1") means THAT instance: the bar
  // names one item, so styling starts on it, and the scope switch widens it.
  const partScope =
    partScopeState.key === focusedPartKey
      ? partScopeState.scope
      : (focusedPart?.index.length ?? 0) > 0
        ? 'this'
        : 'all';
  useEffect(() => {
    partScopeRef.current = partScope;
  }, [partScope, partScopeRef]);
  const partLocale = locale ?? 'en';
  const partWords = quickBarLabels.parts ?? PART_QUICK_BAR_LABELS_EN;
  const partModel = useMemo(
    () =>
      focusedPart === undefined || doc.nodes[focusedPart.nodeId] === undefined
        ? undefined
        : createPartBarModel(kernel, focusedPart, {
            bucket,
            state: styleState,
            pageDir: dir,
            scope: partScope,
            locale: partLocale,
            words: elementNameWords,
            namedStyles: namedStyleClasses,
          }),
    [
      kernel,
      doc,
      focusedPart,
      bucket,
      styleState,
      dir,
      partScope,
      partLocale,
      elementNameWords,
      namedStyleClasses,
    ],
  );
  const partDecl =
    focusedPart === undefined
      ? undefined
      : partDeclOf(kernel, focusedPart.nodeId, focusedPart.part);
  const partGroups = useMemo(
    () =>
      partModel === undefined
        ? undefined
        : quickGroupsForPart(partModel.kind, partDecl?.styleSections),
    [partModel, partDecl],
  );
  const partActionContext = useMemo(
    () => ({
      scope: partScope,
      locale: partLocale,
      words: partWords,
      nameWords: elementNameWords,
      editable,
    }),
    [partScope, partLocale, partWords, elementNameWords, editable],
  );
  // Read at render time on purpose (cheap): the gates follow every edit.
  const partActions =
    focusedPart === undefined || partModel === undefined
      ? []
      : resolvePartActions(kernel, focusedPart, partActionContext);
  const runPartAction = useCallback(
    (id: PartActionId) => {
      const target = focusedPart;
      if (target === undefined) {
        return;
      }
      if (id === 'editText') {
        activatePart(target.nodeId, target, { kind: 'keyboard' });
        return;
      }
      if (id === 'scopeThis') {
        const next = partScope === 'this' ? 'all' : 'this';
        setPartScopeState({ key: focusedPartKey, scope: next });
        announceGestureRef.current(
          next === 'this'
            ? partWords.actions.scopeThis
            : partInstanceName(kernel, target.nodeId, { part: target.part, index: [] }, partLocale),
        );
        return;
      }
      if (id === 'selectBlock') {
        // Focus moves FIRST: the bar unmounts with the part focus.
        hostRef.current?.focus({ preventScroll: true });
      }
      const result = performPartAction(kernel, target, id, partActionContext);
      if ((kernel.context.store.getState().partFocus ?? null) === null) {
        hostRef.current?.focus({ preventScroll: true });
      }
      announceGestureRef.current(result.announcement);
    },
    [
      kernel,
      focusedPart,
      focusedPartKey,
      partScope,
      partWords,
      partLocale,
      partActionContext,
      activatePart,
      hostRef,
      announceGestureRef,
    ],
  );
  const partLink = useMemo(() => {
    const node = focusedPart === undefined ? undefined : doc.nodes[focusedPart.nodeId];
    if (focusedPart === undefined || node === undefined || partDecl?.kind !== 'link') {
      return undefined;
    }
    return {
      text: partStringValue(node, partDecl, focusedPart, 'text') ?? '',
      href: partStringValue(node, partDecl, focusedPart, 'href') ?? '',
      pages: linkPages,
      onApply: (value: { readonly text: string; readonly href: string }) =>
        dispatchPartPlan(kernel, planPartLinkValue(kernel, focusedPart, value)),
    };
  }, [kernel, doc, focusedPart, partDecl, linkPages]);

  // The bar's part-specific props: its groups and actions, the link editor, and
  // what More, Edit with AI and Replace do for THIS part.
  const barProps =
    focusedPart === undefined
      ? undefined
      : {
          groups: partGroups,
          partActions,
          onPartAction: runPartAction,
          partLink,
          onMore: (sector: StyleSectorId) => {
            onOpenPartStyle?.(sector, focusedPart);
          },
          onEditWithAi:
            onEditWithAiPart === undefined
              ? undefined
              : () => {
                  onEditWithAiPart(focusedPart);
                },
          onReplaceMedia:
            onReplacePartImage === undefined
              ? undefined
              : () => {
                  onReplacePartImage(focusedPart);
                },
        };

  return { partModel, barProps };
}
// ── /block-parts ──
