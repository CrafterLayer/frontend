import type { SectionKit, SectionKitSlot } from '../types';

/*
  Parts every kit shares, named once. The classes are the page kit's
  (`ck-*`, PAGE_KIT_CLASSES in agent/page-plan/skeleton-from-plan.ts) for
  colour, and utilities from the static vocabulary for everything else —
  logical sides only, no `tracking-*` (Arabic letters join, and spacing pulls
  them apart), leading-snug on display type (Arabic ascenders need it).
  At phone width (kits.fit.test.ts, 320–390px): display type breaks a word
  longer than its line (`break-words`), a grid or flex item that holds a long
  number or word carries `min-w-0` (break-words alone does not let an item
  shrink), and a grid that must hold its width says `grid-cols-1` (a bare
  `grid` track grows to its content).
*/

export const HYPERUI_COMMIT = '2b5aebbc50d2c9ac89650f51b554f53895b4803c';
export const TAILARK_COMMIT = '8139698115c1341bfd2e3e286c04bb4d8146f472';
export const MERAKIUI_COMMIT = 'fe0472efe93f6cd275424ecbdfa7f6cb8da6f908';

export function hyperui(path: string): SectionKit['source'] {
  return { lib: 'hyperui', file: `public/examples/${path}`, commit: HYPERUI_COMMIT };
}

export function tailark(path: string): SectionKit['source'] {
  return { lib: 'tailark', file: `registry/bases/radix/${path}`, commit: TAILARK_COMMIT };
}

export function merakiui(path: string): SectionKit['source'] {
  return { lib: 'merakiui', file: `components/${path}`, commit: MERAKIUI_COMMIT };
}

// ── Slots ─────────────────────────────────────────────────────────────────────

export const text = (max: number, required = false): SectionKitSlot =>
  required ? { kind: 'text', max, required } : { kind: 'text', max };
export const link = (required = false): SectionKitSlot =>
  required ? { kind: 'link', required } : { kind: 'link' };
export const image = (required = false): SectionKitSlot =>
  required ? { kind: 'image', required } : { kind: 'image' };
export const icon = (required = false): SectionKitSlot =>
  required ? { kind: 'icon', required } : { kind: 'icon' };
export const list = (
  item: Readonly<Record<string, SectionKitSlot>>,
  max: number,
  required = true,
): SectionKitSlot => (required ? { kind: 'list', item, max, required } : { kind: 'list', item, max });

/** The heading block most sections open with. */
export const HEAD_SLOTS: Readonly<Record<string, SectionKitSlot>> = {
  eyebrow: text(40),
  title: text(90, true),
  lead: text(260),
};

// ── Markup ────────────────────────────────────────────────────────────────────

export const EYEBROW = `{{#eyebrow}}<p class='ck-eyebrow'>{{eyebrow}}</p>{{/eyebrow}}`;
export const H2 = `<h2 data-kit-heading class='ck-display mt-3 text-3xl font-bold leading-snug text-balance break-words md:text-5xl'>{{title}}</h2>`;
export const LEAD = `{{#lead}}<p class='ck-muted mt-5 text-lg leading-relaxed text-pretty'>{{lead}}</p>{{/lead}}`;

export const HEAD_CENTER = `<div class='mx-auto max-w-2xl text-center'>${EYEBROW}${H2}${LEAD}</div>`;
export const HEAD_START = `<div class='max-w-2xl'>${EYEBROW}${H2}${LEAD}</div>`;

export const H1 = `<h1 data-kit-heading class='ck-display text-4xl font-bold leading-snug text-balance break-words md:text-6xl'>{{title}}</h1>`;

export const CTA = `<a class='ck-btn' href='{{cta.href}}'>{{cta.label}}</a>`;
export const CTA_ARROW = `<a class='ck-btn' href='{{cta.href}}'>{{cta.label}}<icon name='arrow-right' class='ck-flip' size='18'/></a>`;
export const CTA2 = `{{#cta2}}<a class='ck-btn ck-btn--ghost' href='{{cta2.href}}'>{{cta2.label}}</a>{{/cta2}}`;
export const ACTIONS = `<div class='mt-8 flex flex-wrap gap-3'>${CTA_ARROW}${CTA2}</div>`;
export const ACTIONS_CENTER = `<div class='mt-8 flex flex-wrap justify-center gap-3'>${CTA_ARROW}${CTA2}</div>`;

/** A section band: ground, rhythm, the container. */
export function band(inner: string, ground = 'ck-ground'): string {
  return `<section class='${ground} py-20 md:py-28'><div class='mx-auto max-w-6xl px-4 md:px-8'>${inner}</div></section>`;
}
