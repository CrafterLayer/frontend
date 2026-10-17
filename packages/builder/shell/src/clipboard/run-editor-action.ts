import type { BuilderKernel } from '@craftkit/builder-core';
import type { Author, StyleBucket } from '@craftkit/builder-schema';

import type { ElementNameWords, ElementTarget } from '../custom-code/element-target';
import type { EditorDevice, EditorShortcutAction } from '../keyboard/editor-shortcuts';
import type { ElementSelection } from '../selection/element-selection';
import {
  deleteElements,
  duplicateElements,
  liveTreeTargets,
  moveElement,
  selectFirstChildElement,
  selectParentElement,
  toggleElementsHidden,
  toggleElementsLocked,
  unwrapElement,
  wrapElements,
  type ElementActionContext,
  type ElementActionOutcome,
} from './element-actions';
import type { ElementActionLabels } from './element-actions.labels';
import type { ElementClipboard } from './element-clipboard';

/*
  The keymap's executor: one resolved shortcut → the element action it names.
  Hosts call it from `useEditorShortcuts`' `onAction`. It returns `false` when
  the action does not apply (nothing selected, an undo with nothing to undo),
  so the browser keeps the key; geometry (nudge), the device bar and the
  shortcuts dialog are handed back to the host through callbacks.
*/

export interface EditorActionDeps {
  readonly kernel: BuilderKernel;
  /** The multi-selection; without it the kernel's primary is the only target. */
  readonly selection?: ElementSelection | undefined;
  readonly clipboard: ElementClipboard;
  /** The panel's current bucket — hide writes there. */
  readonly bucket?: StyleBucket | undefined;
  readonly labels?: ElementActionLabels | undefined;
  readonly words?: ElementNameWords | undefined;
  readonly author?: Author | undefined;
  /** Every outcome's message (success and refusal) for a live region. */
  readonly announce?: ((message: string, ok: boolean) => void) | undefined;
  readonly onDevice?: ((device: EditorDevice) => void) | undefined;
  readonly onNudge?: ((action: Extract<EditorShortcutAction, { type: 'nudge' }>) => boolean) | undefined;
  readonly onOpenShortcuts?: (() => void) | undefined;
}

/** The kernel's primary as a target: the focused element, else the selected block. */
export function primaryTarget(kernel: BuilderKernel): ElementTarget | undefined {
  const state = kernel.context.store.getState();
  if (state.elementFocus !== null) {
    return { kind: 'tree', nodeId: state.elementFocus.id, path: [...state.elementFocus.path] };
  }
  const first = state.selection[0];
  return first === undefined ? undefined : { kind: 'block', nodeId: first };
}

function currentTargets(deps: EditorActionDeps): readonly ElementTarget[] {
  const fromSelection = deps.selection?.targets();
  if (fromSelection !== undefined && fromSelection.length > 0) return fromSelection;
  const primary = primaryTarget(deps.kernel);
  return primary === undefined ? [] : [primary];
}

/** Run one shortcut action. `false` = it did not apply; leave the key to the browser. */
export function runEditorAction(action: EditorShortcutAction, deps: EditorActionDeps): boolean {
  const { kernel } = deps;
  const targets = currentTargets(deps);
  const context: ElementActionContext = {
    kernel,
    targets,
    labels: deps.labels,
    words: deps.words,
    author: deps.author,
  };
  const report = (outcome: ElementActionOutcome): boolean => {
    if (outcome.message !== '') deps.announce?.(outcome.message, outcome.ok);
    return true;
  };
  const reportLater = (pending: Promise<ElementActionOutcome>): boolean => {
    void pending.then(report);
    return true;
  };
  const hasTree = (): boolean => liveTreeTargets(kernel, targets).length > 0;

  switch (action.type) {
    case 'undo':
      return kernel.undo();
    case 'redo':
      return kernel.redo();
    case 'copy':
      return hasTree() ? reportLater(deps.clipboard.copy(context)) : false;
    case 'cut':
      return hasTree() ? reportLater(deps.clipboard.cut(context)) : false;
    case 'paste':
      return targets.length === 0 ? false : reportLater(deps.clipboard.paste(context));
    case 'copyStyle':
      return hasTree() ? report(deps.clipboard.copyStyle(context)) : false;
    case 'pasteStyle':
      return hasTree() ? report(deps.clipboard.pasteStyle(context)) : false;
    case 'duplicate':
      return targets.length === 0 ? false : report(duplicateElements(context));
    case 'delete':
      return targets.length === 0 ? false : report(deleteElements(context));
    case 'wrap':
      return hasTree() ? report(wrapElements(context)) : false;
    case 'unwrap':
      return hasTree() ? report(unwrapElement(context)) : false;
    case 'moveEarlier':
      return targets.length === 0 ? false : report(moveElement(context, 'earlier'));
    case 'moveLater':
      return targets.length === 0 ? false : report(moveElement(context, 'later'));
    case 'selectParent':
      return selectParentElement(kernel, targets[0]);
    case 'selectFirstChild':
      return selectFirstChildElement(kernel, targets[0]);
    case 'toggleHidden':
      return hasTree() ? report(toggleElementsHidden(context, deps.bucket ?? 'base')) : false;
    case 'toggleLocked':
      return hasTree() ? report(toggleElementsLocked(context)) : false;
    case 'device':
      if (deps.onDevice === undefined) return false;
      deps.onDevice(action.device);
      return true;
    case 'openShortcuts':
      if (deps.onOpenShortcuts === undefined) return false;
      deps.onOpenShortcuts();
      return true;
    case 'nudge':
      return deps.onNudge?.(action) ?? false;
  }
}
