import type { ReactNode } from 'react';

import { themeStyle, type ChromeThemeOverride, type DensityName } from '@craftkit/builder-theme';

export interface BuilderThemeProps {
  children: ReactNode;
  /**
   * Force a chrome theme. OMIT IT to follow the operating system, which is the
   * default and the state most viewers are in — passing `'light'` is a
   * different decision from passing nothing, and it beats a dark OS.
   */
  theme?: 'light' | 'dark' | undefined;
  /** `compact` tightens every band of the shell; the colours do not move. */
  density?: DensityName | undefined;
  /**
   * Re-point any token, at runtime. Name only what changes — everything else
   * keeps cascading from the stylesheet, so a re-brand is three lines rather
   * than a fork.
   */
  overrides?: ChromeThemeOverride | undefined;
  /** Merged after the theme's own class, so a host can add layout of its own. */
  className?: string | undefined;
  /** The EDITOR's direction (`rtl` for an Arabic editor); absent inherits the document's. */
  dir?: 'ltr' | 'rtl' | undefined;
}

/**
 * The chrome root — where the builder's interface gets its theme.
 *
 * This is deliberately NOT `Builder`. `Builder` renders the page being edited,
 * and the page carries its OWN theme: an author working on a dark website must
 * not be forced into a dark editor, and a dark editor must never repaint their
 * light page. `BuilderTheme` wraps the editor AROUND that page.
 *
 * Overrides are set as custom properties on this element rather than injected
 * as a stylesheet, which is what makes them cascade: floating chrome portalled
 * into the host document inherits them too, and a class-based approach would
 * miss exactly that chrome.
 */
export function BuilderTheme({
  children,
  theme,
  density,
  overrides,
  className,
  dir,
}: BuilderThemeProps) {
  return (
    <div
      className={className === undefined ? 'bldr-root' : `bldr-root ${className}`}
      {...(theme === undefined ? {} : { 'data-bldr-theme': theme })}
      {...(density === undefined ? {} : { 'data-bldr-density': density })}
      {...(overrides === undefined ? {} : { style: themeStyle(overrides) })}
      {...(dir === undefined ? {} : { dir })}
    >
      {children}
    </div>
  );
}
