import './overlay.css';

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DragChrome {
  /** Ghost outline sized like the dragged node, following the pointer. */
  showGhost(size: { width: number; height: number }, label: string): void;
  moveGhost(x: number, y: number): void;
  /** Indicator line at the resolved gap + a soft highlight on the receiving parent. */
  showTarget(indicator: Box, parent: Box | undefined): void;
  hideTarget(): void;
  hideAll(): void;
  dispose(): void;
}

/**
 * Prebuilt drag chrome (006 contract §1 s2): three fixed elements positioned by
 * transforms — the drag path allocates nothing per pointer move. Geometry is
 * physical (measured boxes; see the B2a exception note in overlay.css).
 */
export function createDragChrome(layer: HTMLElement): DragChrome {
  const doc = layer.ownerDocument;

  const ghost = doc.createElement('div');
  ghost.className = 'bldr-drag-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  const ghostLabel = doc.createElement('span');
  ghostLabel.className = 'bldr-outline__label';
  ghost.appendChild(ghostLabel);

  const indicator = doc.createElement('div');
  indicator.className = 'bldr-drop-indicator';
  indicator.setAttribute('aria-hidden', 'true');

  const parentHighlight = doc.createElement('div');
  parentHighlight.className = 'bldr-drop-parent';
  parentHighlight.setAttribute('aria-hidden', 'true');

  layer.append(ghost, indicator, parentHighlight);

  let ghostVisible = false;
  const place = (element: HTMLElement, box: Box) => {
    element.style.transform = `translate(${String(box.x)}px, ${String(box.y)}px)`;
    element.style.width = `${String(box.width)}px`;
    element.style.height = `${String(box.height)}px`;
    element.style.visibility = 'visible';
  };

  return {
    showGhost(size, label) {
      ghost.style.width = `${String(size.width)}px`;
      ghost.style.height = `${String(size.height)}px`;
      ghostLabel.textContent = label;
      ghost.style.visibility = 'visible';
      ghostVisible = true;
    },
    moveGhost(x, y) {
      if (ghostVisible) {
        // Slight offset so the ghost never sits under the hit-tested point.
        ghost.style.transform = `translate(${String(x + 10)}px, ${String(y + 10)}px)`;
      }
    },
    showTarget(indicatorBox, parentBox) {
      place(indicator, indicatorBox);
      if (parentBox === undefined) {
        parentHighlight.style.visibility = 'hidden';
      } else {
        place(parentHighlight, parentBox);
      }
    },
    hideTarget() {
      indicator.style.visibility = 'hidden';
      parentHighlight.style.visibility = 'hidden';
    },
    hideAll() {
      ghost.style.visibility = 'hidden';
      ghostVisible = false;
      indicator.style.visibility = 'hidden';
      parentHighlight.style.visibility = 'hidden';
    },
    dispose() {
      ghost.remove();
      indicator.remove();
      parentHighlight.remove();
    },
  };
}
