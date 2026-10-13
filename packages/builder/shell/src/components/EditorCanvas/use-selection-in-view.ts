import { useEffect, useRef } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { RenderBreakpoint } from '@craftkit/builder-renderer';
import type { NodeId } from '@craftkit/builder-schema';

import { elementDomOf } from './element-canvas-helpers';
import type { CanvasRefs } from './use-canvas-refs';

type ElementFocus = ReturnType<BuilderKernel['context']['store']['getState']>['elementFocus'];

export interface ResizeInViewInputs {
  kernel: BuilderKernel;
  frame: HTMLIFrameElement | null;
  frameWidth: number | undefined;
  breakpoint: RenderBreakpoint | undefined;
  refs: CanvasRefs;
}

/*
  A new screen size keeps the selection — and keeps it IN VIEW. At a narrower
  frame the page reflows taller, so the element a person picked on desktop
  sat thousands of pixels below the fold on mobile: the outline and quick
  bar hid with it, and the selection read as lost (final test, 2026-10-06).
  Only a width change scrolls; the first render never does.
*/
export function useSelectionInViewOnResize({
  kernel,
  frame,
  frameWidth,
  breakpoint,
  refs,
}: ResizeInViewInputs): void {
  const { machineryRef, elementsRef } = refs;
  const sizedFor = useRef<string | null>(null);
  useEffect(() => {
    const key = `${String(frameWidth)}:${breakpoint ?? 'desktop'}`;
    const previous = sizedFor.current;
    sizedFor.current = key;
    if (previous === null || previous === key || frame === null) return undefined;
    let second = 0;
    const first = requestAnimationFrame(() => {
      // Two frames: the breakpoint's re-render lands, then its layout settles.
      second = requestAnimationFrame(() => {
        const machinery = machineryRef.current;
        const state = kernel.context.store.getState();
        const focus = state.elementFocus;
        const selected = state.selection[0];
        const element =
          focus !== null && machinery !== null
            ? elementDomOf(machinery.index, focus.id, focus.path)
            : selected === undefined
              ? null
              : (elementsRef.current.get(selected) ?? null);
        try {
          element?.scrollIntoView({ block: 'center', inline: 'nearest' });
        } catch {
          // A document without layout (jsdom) has nothing to scroll.
        }
        machinery?.anchors.refresh();
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [frameWidth, breakpoint, frame, kernel, machineryRef, elementsRef]);
}

export interface OffscreenSelectionInputs {
  frame: HTMLIFrameElement | null;
  selectedId: NodeId | null;
  elementFocus: ElementFocus;
  refs: CanvasRefs;
}

/*
  A selection made OUTSIDE the canvas — a library card inserting at the end
  of the page, a Layers row, the agent — is brought into view when it sits
  wholly off screen (walk 2026-10-08: an inserted Icon landed 8229px down
  while the canvas stayed at the top, and nothing visible changed). A click
  on the canvas selects something already on screen, so this never moves it.
*/
export function useRevealOffscreenSelection({
  frame,
  selectedId,
  elementFocus,
  refs,
}: OffscreenSelectionInputs): void {
  const { machineryRef, elementsRef } = refs;
  useEffect(() => {
    if (frame === null || (selectedId === null && elementFocus === null)) return undefined;
    let second = 0;
    const first = requestAnimationFrame(() => {
      // Two frames: the insert's render lands, then its layout settles.
      second = requestAnimationFrame(() => {
        const machinery = machineryRef.current;
        const element =
          elementFocus !== null && machinery !== null
            ? elementDomOf(machinery.index, elementFocus.id, elementFocus.path)
            : selectedId === null
              ? null
              : (elementsRef.current.get(selectedId) ?? null);
        const view = element?.ownerDocument.defaultView;
        if (element == null || view == null) return;
        const rect = element.getBoundingClientRect();
        const offScreen = rect.bottom < 0 || rect.top > view.innerHeight;
        if (!offScreen) return;
        try {
          const still = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
          element.scrollIntoView({
            block: rect.height > view.innerHeight ? 'start' : 'center',
            inline: 'nearest',
            behavior: still ? 'auto' : 'smooth',
          });
        } catch {
          // A document without layout (jsdom) has nothing to scroll.
        }
        machinery?.anchors.refresh();
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [selectedId, elementFocus, frame, machineryRef, elementsRef]);
}
