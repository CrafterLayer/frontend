import { useCallback, useState } from 'react';

import type { LibraryTab } from '@craftkit/builder';

/** A request to show the library on one of its tabs; the nonce makes a repeat a new request. */
export interface LibraryRequest {
  readonly tab: LibraryTab;
  readonly nonce: number;
}

/**
 * The editor's layout state: which rail section is open, which panes are open and
 * actually shown, their widths, the zoom and the workspace view. View state only —
 * never document, never kernel.
 */
export function useEditorPanes() {
  /*
    Which rail section is open. The rail used to be handed a hard-coded
    `activeId` and no handler at all: it drew a selected state, moved focus,
    announced `aria-current`, and did nothing whatever when clicked. A control
    that looks live and is not is worse than no control.
  */
  const [railSection, setRailSection] = useState('blocks');
  const [panelOpen, setPanelOpen] = useState(true);
  const [asideOpen, setAsideOpen] = useState(true);
  const [visiblePanes, setVisiblePanes] = useState({ panel: true, aside: true, overlay: false });
  const [activeSide, setActiveSide] = useState<'panel' | 'aside'>('panel');
  const [panelWidth, setPanelWidth] = useState(320);
  const [canvasWidth, setCanvasWidth] = useState(1280);
  const [zoomChoice, setZoomChoice] = useState('fit');
  const [workspaceView, setWorkspaceView] = useState<'canvas' | 'sitemap'>('canvas');
  /*
    "Add a block" / "Start from a template" (the empty page, Help): open the library on a
    tab. The Library keeps its own tab once open, so a request re-opens it at the asked tab.
  */
  const [libraryRequest, setLibraryRequest] = useState<LibraryRequest | undefined>(undefined);
  const openLibrary = useCallback((tab: LibraryTab) => {
    setRailSection('blocks');
    setPanelOpen(true);
    setActiveSide('panel');
    setWorkspaceView('canvas');
    setLibraryRequest((current) => ({ tab, nonce: (current?.nonce ?? 0) + 1 }));
  }, []);
  return {
    railSection,
    setRailSection,
    panelOpen,
    setPanelOpen,
    asideOpen,
    setAsideOpen,
    visiblePanes,
    setVisiblePanes,
    activeSide,
    setActiveSide,
    panelWidth,
    setPanelWidth,
    canvasWidth,
    setCanvasWidth,
    zoomChoice,
    setZoomChoice,
    workspaceView,
    setWorkspaceView,
    libraryRequest,
    openLibrary,
  };
}

export type EditorPanes = ReturnType<typeof useEditorPanes>;
