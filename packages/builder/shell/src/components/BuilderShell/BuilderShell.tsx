import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { clampPanelWidth, resolvePanelLayout } from './panel-layout';

import './BuilderShell.css';

export interface BuilderShellProps {
  /** The primary navigation rail — the one dark surface. */
  rail?: ReactNode | undefined;
  /** Blocks, layers, assets. The first region a narrow viewport gives up. */
  panel?: ReactNode | undefined;
  /**
   * Whether the panel may be dropped when the viewport gets narrow.
   *
   * `optional` is the default and the old behaviour: below 1180 the panel goes,
   * because a palette is a source you dip into and the canvas is the subject.
   * That reasoning is only true for SOME panel contents. A host that has put
   * the document's structure there — the way a person navigates the page — says
   * `essential`, and the shell keeps it and narrows the canvas instead.
   *
   * The shell cannot judge this for itself: it never sees what it places, which
   * is the whole point of a slot. Deciding to delete a region's contents on the
   * host's behalf is the one thing a container must not do.
   */
  panelPriority?: 'optional' | 'essential' | undefined;
  /** The page being edited. The only region with no reserved size. */
  canvas: ReactNode;
  /** Code view or the assistant, docked under the canvas. */
  dock?: ReactNode | undefined;
  /** The inspector, or whatever replaces it. */
  aside?: ReactNode | undefined;
  /** Product identity, device switcher, publish. */
  top?: ReactNode | undefined;
  /** Zoom, provenance, save state. */
  status?: ReactNode | undefined;
  /** Names the editor for assistive technology. */
  label?: string | undefined;
  className?: string | undefined;
  /** Measured editor layout retaining pane state while preserving canvas space. */
  adaptive?: boolean | undefined;
  panelOpen?: boolean | undefined;
  asideOpen?: boolean | undefined;
  activeSide?: 'panel' | 'aside' | undefined;
  panelWidth?: number | undefined;
  onPanelWidthChange?: ((width: number) => void) | undefined;
  onCanvasWidthChange?: ((width: number) => void) | undefined;
  onLayoutChange?:
    ((layout: { panel: boolean; aside: boolean; overlay: boolean }) => void) | undefined;
}

/**
 * The editor's layout — and the only component that knows what it is.
 *
 * Everything the shell places is a SLOT. `BuilderShell` never imports the
 * palette, the inspector or the canvas, so the layout can change without
 * touching them and they can change without touching it; it is also why the
 * playground could assemble the same regions in a different order for a
 * scenario without forking a layout.
 *
 * Three decisions worth stating, because each has an obvious wrong answer:
 *
 *  - **Sizes use theme tokens.** An adaptive host may additionally persist the
 *    user's panel width and open-pane preferences without recreating slots.
 *
 *  - **An absent region costs nothing.** The CSS collapses its track with
 *    `:has()` rather than the component computing a grid template, which would
 *    make the layout true in two places and eventually in neither.
 *
 *  - **Only the grid scrolls its own regions.** The shell fills its container
 *    and hides overflow; each region scrolls inside its track. An editor that
 *    scrolls as a page loses its toolbars the moment the document grows.
 *
 * The canvas is the one region with no reserved size: everything else is
 * measured, and the canvas is what remains. That is the whole argument for
 * "every pixel goes to the page".
 */
export function BuilderShell({
  rail,
  panel,
  panelPriority = 'optional',
  canvas,
  dock,
  aside,
  top,
  status,
  label = 'Builder',
  className,
  adaptive = false,
  panelOpen = true,
  asideOpen = true,
  activeSide = 'panel',
  panelWidth = 320,
  onPanelWidthChange,
  onCanvasWidthChange,
  onLayoutChange,
}: BuilderShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ x: number; width: number; direction: number } | null>(null);
  const [width, setWidth] = useState(1440);
  const reportCanvasWidth = useEffectEvent((width: number) => onCanvasWidthChange?.(width));
  useEffect(() => {
    const root = rootRef.current;
    if (!adaptive || root === null) return;
    const measure = () => {
      setWidth(root.getBoundingClientRect().width);
      if (canvasRef.current !== null)
        reportCanvasWidth(canvasRef.current.getBoundingClientRect().width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    if (canvasRef.current !== null) observer.observe(canvasRef.current);
    return () => { observer.disconnect(); };
  }, [adaptive]);
  const controlledWidth = clampPanelWidth(panelWidth);
  const layout = resolvePanelLayout({
    width,
    railWidth: rail === undefined ? 0 : 48,
    panelWidth: controlledWidth,
    asideWidth: 288,
    minCanvasWidth: 640,
    activeSide,
    panelOpen: panelOpen && panel !== undefined,
    asideOpen: asideOpen && aside !== undefined,
  });
  const reportLayout = useEffectEvent(() => onLayoutChange?.(layout));
  useEffect(() => {
    if (adaptive) reportLayout();
  }, [adaptive, layout.panel, layout.aside, layout.overlay]);
  return (
    <div
      ref={rootRef}
      className={className === undefined ? 'bldr-shell' : `bldr-shell ${className}`}
      role="application"
      aria-label={label}
      data-bldr-panel-priority={panelPriority}
      data-adaptive={adaptive ? '' : undefined}
      data-panel-open={adaptive ? String(layout.panel) : undefined}
      data-aside-open={adaptive ? String(layout.aside) : undefined}
      data-panel-overlay={adaptive && layout.overlay ? '' : undefined}
      style={
        adaptive
          ? ({
              '--bldr-panel-width': `${String(controlledWidth)}px`,
              '--bldr-inspector-width': '288px',
              '--bldr-shell-rail-size': rail === undefined ? '0px' : '48px',
            } as CSSProperties)
          : undefined
      }
    >
      {top === undefined ? null : <div className="bldr-shell__top">{top}</div>}
      {rail === undefined ? null : <div className="bldr-shell__rail">{rail}</div>}
      {panel === undefined ? null : (
        <div className="bldr-shell__panel" hidden={adaptive && !layout.panel}>
          {panel}
          {!adaptive || onPanelWidthChange === undefined ? null : (
            <div
              className="bldr-shell__resize"
              role="separator"
              tabIndex={0}
              aria-label="Resize workspace panel"
              aria-orientation="vertical"
              aria-valuemin={288}
              aria-valuemax={480}
              aria-valuenow={controlledWidth}
              onKeyDown={(event) => {
                const direction =
                  getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1;
                const delta =
                  event.key === 'ArrowRight'
                    ? 8 * direction
                    : event.key === 'ArrowLeft'
                      ? -8 * direction
                      : 0;
                if (delta === 0 && event.key !== 'Home' && event.key !== 'End') return;
                event.preventDefault();
                onPanelWidthChange(
                  clampPanelWidth(
                    event.key === 'Home'
                      ? 288
                      : event.key === 'End'
                        ? 480
                        : controlledWidth + delta,
                  ),
                );
              }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                pointerRef.current = {
                  x: event.clientX,
                  width: controlledWidth,
                  direction: getComputedStyle(event.currentTarget).direction === 'rtl' ? -1 : 1,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const start = pointerRef.current;
                if (start !== null)
                  onPanelWidthChange(
                    clampPanelWidth(start.width + (event.clientX - start.x) * start.direction),
                  );
              }}
              onPointerUp={() => {
                pointerRef.current = null;
              }}
              onLostPointerCapture={() => {
                pointerRef.current = null;
              }}
            />
          )}
        </div>
      )}
      <div className="bldr-shell__main">
        <div ref={canvasRef} className="bldr-shell__canvas">
          {canvas}
        </div>
        {dock === undefined ? null : <div className="bldr-shell__dock">{dock}</div>}
      </div>
      {aside === undefined ? null : (
        <div className="bldr-shell__aside" hidden={adaptive && !layout.aside}>
          {aside}
        </div>
      )}
      {status === undefined ? null : <div className="bldr-shell__status">{status}</div>}
    </div>
  );
}
