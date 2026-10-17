// Ambient raw CSS types must accompany this standalone entry into consumer projects.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- A type-only import cannot load a global declaration file.
/// <reference path="./globals.d.ts" />

import sectionLayoutCss from './components/section-layout.css?raw';
const marketingClasses = new Set(
  [...sectionLayoutCss.matchAll(/\.(mkt-[\w-]+)/gu)].map((match) => match[1]),
);

/**
 * The original canvas stylesheet when rendered classes reference its rules.
 * Tailwind cannot compile its slab colours or comparison container rules.
 * Selector names come from that same file; no second vocabulary or renderer loads.
 * A bundler must support raw CSS imports, as Vite does for the publishing host.
 */
export function marketingSectionStylesheet(classNames: Iterable<string>): string {
  for (const name of classNames) if (marketingClasses.has(name)) return sectionLayoutCss;
  return '';
}
