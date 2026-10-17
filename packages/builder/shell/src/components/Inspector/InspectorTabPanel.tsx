import type { ReactNode } from 'react';

export interface InspectorTabPanelProps {
  readonly id: string;
  readonly labelledBy: string;
  readonly active: boolean;
  /** Lazy-once: false until the tab's first activation, true from then on. */
  readonly mounted: boolean;
  readonly children: ReactNode;
}

/**
 * Every populated tab always renders its panel shell so `aria-controls`
 * resolves; the BODY mounts on the tab's first activation and stays mounted,
 * so drafts, rejection reasons, contributed modules and focus locks survive a
 * round trip while a fresh selection pays only for the Content tab.
 */
export function InspectorTabPanel({
  id,
  labelledBy,
  active,
  mounted,
  children,
}: InspectorTabPanelProps) {
  return (
    <div
      id={id}
      className="bldr-inspector__tabpanel"
      role="tabpanel"
      aria-labelledby={labelledBy}
      hidden={!active}
    >
      {mounted ? <div className="bldr-inspector__sections">{children}</div> : null}
    </div>
  );
}
