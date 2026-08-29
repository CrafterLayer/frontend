import type { ReactNode } from 'react';

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
 *  - **Sizes are tokens, not props.** A `panelWidth` prop would put the number
 *    in every call site; `--bldr-panel-width` puts it in the theme, so density
 *    is one decision and a host can re-point it at runtime like any colour.
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
}: BuilderShellProps) {
  return (
    <div
      className={className === undefined ? 'bldr-shell' : `bldr-shell ${className}`}
      role="application"
      aria-label={label}
      data-bldr-panel-priority={panelPriority}
    >
      {top === undefined ? null : <div className="bldr-shell__top">{top}</div>}
      {rail === undefined ? null : <div className="bldr-shell__rail">{rail}</div>}
      {panel === undefined ? null : <div className="bldr-shell__panel">{panel}</div>}
      <div className="bldr-shell__main">
        <div className="bldr-shell__canvas">{canvas}</div>
        {dock === undefined ? null : <div className="bldr-shell__dock">{dock}</div>}
      </div>
      {aside === undefined ? null : <div className="bldr-shell__aside">{aside}</div>}
      {status === undefined ? null : <div className="bldr-shell__status">{status}</div>}
    </div>
  );
}
