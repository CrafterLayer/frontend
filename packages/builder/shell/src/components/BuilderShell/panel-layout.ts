export interface PanelLayoutInput {
  readonly width: number;
  readonly railWidth: number;
  readonly panelWidth: number;
  readonly asideWidth: number;
  readonly panelOpen: boolean;
  readonly asideOpen: boolean;
  readonly activeSide: 'panel' | 'aside';
  readonly minCanvasWidth: number;
}

export function clampPanelWidth(width: number): number {
  return Math.max(288, Math.min(480, Number.isFinite(width) ? width : 320));
}

/** Hide the inactive pane first. On small hosts the active pane overlays the canvas. */
export function resolvePanelLayout(input: PanelLayoutInput) {
  let panel = input.panelOpen;
  let aside = input.asideOpen;
  const remaining = input.width - input.railWidth;
  if (panel && aside && remaining - input.panelWidth - input.asideWidth < input.minCanvasWidth) {
    if (input.activeSide === 'panel') aside = false;
    else panel = false;
  }
  return {
    panel,
    aside,
    overlay:
      remaining - (panel ? input.panelWidth : 0) - (aside ? input.asideWidth : 0) <
      input.minCanvasWidth,
  };
}
