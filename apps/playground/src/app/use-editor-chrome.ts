import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import {
  commitSiteSteps,
  createElementClipboard,
  createElementSelection,
  detachBlockToCustomCode,
  detectShortcutPlatform,
  findCanvasElement,
  makeSymbolSteps,
  renderStaticMarkup,
  replayMotion,
  resolveEditorShortcut,
  resolveElementTarget,
  runEditorAction,
  setBlockMarkupRenderer,
  type BuilderKernel,
  type BuilderSiteKernel,
  type EditorActionDeps,
  type EditorDevice,
  type EditorShortcutAction,
  type ElementClipboard,
  type ElementSelection,
  type ElementTarget,
  type LayersSaveTemplateRequest,
  type StyleBucket,
} from '@craftkit/builder';

import type { EditorLabels } from './editor-labels';

export interface EditorChromeOptions {
  readonly kernel: BuilderKernel | undefined;
  readonly siteKernel: BuilderSiteKernel | undefined;
  readonly labels: EditorLabels;
  /** The bucket the panel edits; Hide on this bucket writes there. */
  readonly bucket: StyleBucket;
  /** The canvas frame's document: Interactions → Preview replays there. */
  readonly frameDocument: Document | null;
  readonly onDevice: (device: EditorDevice) => void;
  /** A polite announcement (outcomes and refusals). */
  readonly announce: (message: string) => void;
}

export interface EditorChrome {
  /** The shared multi-selection (canvas, Layers, the panel). */
  readonly selection: ElementSelection | undefined;
  /** The element clipboard Layers and the keymap share. */
  readonly clipboard: ElementClipboard;
  /** Every selected element, primary first. */
  readonly targets: readonly ElementTarget[];
  readonly shortcutsOpen: boolean;
  readonly setShortcutsOpen: (open: boolean) => void;
  /** One keymap action, through the same deps everywhere (window, frame). */
  readonly runShortcut: (action: EditorShortcutAction) => boolean;
  /** EditorCanvas `onShortcut`: keys the canvas did not claim inside its frame. */
  readonly onFrameShortcut: (event: KeyboardEvent) => boolean;
  readonly saveTemplate: (request: LayersSaveTemplateRequest) => void;
  /** Canvas "Save as template" for an element or a region. */
  readonly saveTargetAsTemplate: (target: ElementTarget) => void;
  readonly makeSymbol: (regionId: string) => void;
  readonly removeTemplate: (id: string) => void;
  /** Registered block → editable custom-code region (DESIGN §A.9). */
  /** Converts a block to an editable region; returns the refusal, shown in the panel. */
  readonly convertBlock: (nodeId: string) => string | undefined;
  /** Interactions → Preview: replay the element's animation on the canvas. */
  readonly previewElement: (target: { readonly nodeId: string; readonly path: readonly number[] }) => void;
}

const NO_TARGETS: readonly ElementTarget[] = [];
const subscribeNothing = () => () => undefined;
const readNothing = () => NO_TARGETS;

/** `tpl-…` / `sym-…`: a fresh library id (`/^[a-z][a-z0-9-]{0,47}$/`). */
function freshLibraryId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/**
 * The manual editor's shared state and the seams between its surfaces
 * (style-manager DESIGN §E): one selection store, one clipboard, one keymap
 * runner, and the host actions the canvas, Layers and the panel call — save
 * as template, make a symbol, convert a block, preview an animation. Every
 * write is one labelled transaction through the kernel or the site door.
 */
export function useEditorChrome(options: EditorChromeOptions): EditorChrome {
  const { kernel, siteKernel, labels, frameDocument, announce } = options;

  const selection = useMemo(() => (kernel === undefined ? undefined : createElementSelection(kernel)), [kernel]);
  useEffect(() => () => selection?.dispose(), [selection]);
  const clipboard = useMemo(() => createElementClipboard(), []);
  const selectionStore = useMemo(
    () =>
      selection === undefined
        ? { subscribe: subscribeNothing, read: readNothing }
        : {
            subscribe: (listener: () => void) => selection.subscribe(listener),
            read: () => selection.targets(),
          },
    [selection],
  );
  const targets = useSyncExternalStore(selectionStore.subscribe, selectionStore.read, selectionStore.read);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // "Convert to editable" and the agent's block.convert render a block's static markup.
  useEffect(() => {
    if (kernel === undefined) return undefined;
    setBlockMarkupRenderer((document) =>
      renderStaticMarkup(document, { blocks: kernel.context.registry.block }),
    );
    return () => {
      setBlockMarkupRenderer(undefined);
    };
  }, [kernel]);

  // The keymap reads the newest options without re-creating its listeners.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const runShortcut = useCallback(
    (action: EditorShortcutAction): boolean => {
      const current = latest.current;
      if (current.kernel === undefined) return false;
      const deps: EditorActionDeps = {
        kernel: current.kernel,
        selection,
        clipboard,
        bucket: current.bucket,
        labels: current.labels.elementActions,
        words: current.labels.elementWords,
        author: 'user',
        announce: (message) => {
          current.announce(message);
        },
        onDevice: (device) => {
          current.onDevice(device);
        },
        onOpenShortcuts: () => {
          setShortcutsOpen(true);
        },
      };
      return runEditorAction(action, deps);
    },
    [selection, clipboard],
  );

  const platform = useMemo(() => detectShortcutPlatform(), []);
  const onFrameShortcut = useCallback(
    (event: KeyboardEvent): boolean => {
      const current = latest.current.kernel;
      if (current === undefined) return false;
      const action = resolveEditorShortcut(event, { platform, dir: current.getDocument().dir });
      return action === undefined ? false : runShortcut(action);
    },
    [platform, runShortcut],
  );

  const commitSite = useCallback(
    (steps: Parameters<typeof commitSiteSteps>[1], label: string): boolean => {
      if (siteKernel === undefined) return false;
      const result = commitSiteSteps(siteKernel, steps, label);
      if (!result.ok) announce(result.message);
      return result.ok;
    },
    [siteKernel, announce],
  );

  const saveTemplate = useCallback(
    (request: LayersSaveTemplateRequest) => {
      const name = request.name.trim().slice(0, 60) || request.kind;
      const template = {
        id: freshLibraryId('tpl'),
        name,
        kind: request.kind,
        tree: request.tree,
        ...(request.css === undefined ? {} : { css: request.css }),
        savedAt: new Date().toISOString(),
      };
      if (commitSite([{ command: 'saveTemplate', args: { template } }], `Save template · ${name}`)) {
        announce(`Saved “${name}” to the library.`);
      }
    },
    [commitSite, announce],
  );

  const saveTargetAsTemplate = useCallback(
    (target: ElementTarget) => {
      if (kernel === undefined) return;
      const resolved = resolveElementTarget(kernel, target, labels.elementWords);
      if (resolved === undefined) return;
      const regionId = target.nodeId;
      const css = kernel.getDocument().nodes[regionId]?.props['css'];
      const cssText = typeof css === 'string' && css.trim() !== '' ? css : undefined;
      if (resolved.kind === 'tree') {
        saveTemplate({
          kind: 'element',
          target,
          name: resolved.displayName,
          tree: { kind: 'root', children: [structuredClone(resolved.node)] },
          ...(cssText === undefined ? {} : { css: cssText }),
        });
        return;
      }
      const tree = resolved.node.props['tree'];
      if (typeof tree !== 'object' || tree === null) {
        announce('Only an element or a composed region can be saved as a template.');
        return;
      }
      saveTemplate({
        kind: 'section',
        target,
        name: resolved.displayName,
        tree: structuredClone(tree) as unknown as LayersSaveTemplateRequest['tree'],
        ...(cssText === undefined ? {} : { css: cssText }),
      });
    },
    [kernel, labels.elementWords, saveTemplate, announce],
  );

  const makeSymbol = useCallback(
    (regionId: string) => {
      if (kernel === undefined || siteKernel === undefined) return;
      const label = kernel.getDocument().nodes[regionId]?.props['label'];
      const name = typeof label === 'string' && label.trim() !== '' ? label.trim() : 'Symbol';
      const result = makeSymbolSteps(
        siteKernel.getSite(),
        kernel.getDocument(),
        regionId,
        name,
        siteKernel.currentPage(),
      );
      if (!result.ok) {
        announce(result.message);
        return;
      }
      if (commitSite(result.steps, `Make symbol · ${name}`)) announce(`“${name}” is now a symbol.`);
    },
    [kernel, siteKernel, commitSite, announce],
  );

  const removeTemplate = useCallback(
    (id: string) => {
      commitSite([{ command: 'removeTemplate', args: { id } }], 'Remove template');
    },
    [commitSite],
  );

  const convertBlock = useCallback(
    (nodeId: string) => {
      if (kernel === undefined) return undefined;
      const result = detachBlockToCustomCode(kernel, nodeId, {
        render: (document) => renderStaticMarkup(document, { blocks: kernel.context.registry.block }),
      });
      if (!result.ok) {
        const reason = result.reasons.join(' ');
        announce(reason);
        return reason;
      }
      announce(`${result.label}: every part is now editable.`);
      if (result.regionId !== undefined) kernel.setSelection([result.regionId]);
      return undefined;
    },
    [kernel, announce],
  );

  const previewElement = useCallback(
    (target: { readonly nodeId: string; readonly path: readonly number[] }) => {
      if (frameDocument === null) return;
      const element = findCanvasElement(frameDocument, target.nodeId, target.path);
      if (element !== null) replayMotion(element);
    },
    [frameDocument],
  );

  return {
    selection,
    clipboard,
    targets,
    shortcutsOpen,
    setShortcutsOpen,
    runShortcut,
    onFrameShortcut,
    saveTemplate,
    saveTargetAsTemplate,
    makeSymbol,
    removeTemplate,
    convertBlock,
    previewElement,
  };
}
