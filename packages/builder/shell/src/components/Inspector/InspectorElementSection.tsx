import type { ReactNode } from 'react';

export interface InspectorElementSectionProps {
  readonly name: string;
  readonly children: ReactNode;
}

/**
 * One group of rows for a focused element. Plain and always open: an element
 * has a handful of rows, and a fold on three of them is furniture. The same
 * heading and row rhythm as a block section, so the panel reads as one thing.
 */
export function InspectorElementSection({ name, children }: InspectorElementSectionProps) {
  return (
    <section className="bldr-inspector__section" aria-label={name}>
      <h3 className="bldr-inspector__section-heading bldr-inspector__section-title">{name}</h3>
      <div className="bldr-inspector__section-region">
        <div className="bldr-inspector__rows">{children}</div>
      </div>
    </section>
  );
}
