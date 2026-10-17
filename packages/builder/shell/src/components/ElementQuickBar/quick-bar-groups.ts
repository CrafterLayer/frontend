import type { StylePropertyId, StyleSectorId } from '@craftkit/builder-schema';

import type { QuickElementKind } from './element-bar-model';

/*
  ── The quick-bar groups per element kind — exactly DESIGN.md §A.6 ──────────

  - Text (h1–h6, p, span, a, li, blockquote, label): size, weight, colour,
    background, spacing (padding + margin box model), align, line height,
    direction, radius, shadow, motion.
  - Container: background, spacing popover (padding + margin box model), gap,
    flex direction, align/justify, radius, border, shadow, motion.
  - Image / video: replace (asset manager), fit, radius, aspect, alt, spacing,
    shadow, motion.
  - Link / button: link editor (href, target), colour, background, spacing,
    radius, style preset (named style), hover preset, motion.
  - Icon: icon picker, size, colour, spacing (icons animate with their parent).

  The owner's ask (2026-10-05): every element is a widget with its colours,
  spacing, margin, direction and animation one click away. Groups that do not
  fit fold into the overflow menu, so a long list never crowds the canvas.

  A group is one toolbar button that opens a compact popover with the P6
  controls for its properties. `properties` are catalogue rows the popover
  renders generically; the special groups (replace, alt, link, style preset,
  icon) have their own editors.
*/

export type QuickGroupId =
  | 'fontSize'
  | 'fontWeight'
  | 'textColor'
  | 'textAlign'
  | 'lineHeight'
  | 'direction'
  | 'background'
  | 'padding'
  | 'gap'
  | 'flexDirection'
  | 'align'
  | 'radius'
  | 'border'
  | 'shadow'
  | 'replace'
  | 'fit'
  | 'aspect'
  | 'alt'
  | 'link'
  | 'stylePreset'
  | 'hoverPreset'
  | 'icon'
  | 'iconSize'
  | 'motion';

export interface QuickGroup {
  readonly id: QuickGroupId;
  /** Catalogue rows the popover shows, in order. Empty for the special editors. */
  readonly properties: readonly StylePropertyId[];
  /** The panel sector "More" opens after this group was used. */
  readonly sector: StyleSectorId;
  /** Runs a host callback instead of opening a popover (replace media). */
  readonly action?: true;
}

const GROUPS: Readonly<Record<QuickGroupId, QuickGroup>> = {
  fontSize: { id: 'fontSize', properties: ['fontSize'], sector: 'typography' },
  fontWeight: { id: 'fontWeight', properties: ['fontWeight'], sector: 'typography' },
  textColor: { id: 'textColor', properties: ['textColor'], sector: 'typography' },
  textAlign: { id: 'textAlign', properties: ['textAlign'], sector: 'typography' },
  lineHeight: { id: 'lineHeight', properties: ['lineHeight'], sector: 'typography' },
  direction: { id: 'direction', properties: ['direction'], sector: 'advanced' },
  background: { id: 'background', properties: ['backgroundColor'], sector: 'backgrounds' },
  padding: { id: 'padding', properties: ['padding', 'margin'], sector: 'spacing' },
  gap: { id: 'gap', properties: ['gap'], sector: 'layout' },
  flexDirection: { id: 'flexDirection', properties: ['flexDirection'], sector: 'layout' },
  align: { id: 'align', properties: ['alignItems', 'justifyContent'], sector: 'layout' },
  radius: { id: 'radius', properties: ['borderRadius'], sector: 'borders' },
  border: { id: 'border', properties: ['borderWidth', 'borderColor'], sector: 'borders' },
  shadow: { id: 'shadow', properties: ['boxShadow'], sector: 'effects' },
  replace: { id: 'replace', properties: [], sector: 'size', action: true },
  fit: { id: 'fit', properties: ['objectFit'], sector: 'size' },
  aspect: { id: 'aspect', properties: ['aspectRatio'], sector: 'size' },
  alt: { id: 'alt', properties: [], sector: 'advanced' },
  link: { id: 'link', properties: [], sector: 'advanced' },
  stylePreset: { id: 'stylePreset', properties: [], sector: 'advanced' },
  hoverPreset: { id: 'hoverPreset', properties: ['hoverMotion'], sector: 'motion' },
  icon: { id: 'icon', properties: [], sector: 'advanced' },
  iconSize: { id: 'iconSize', properties: [], sector: 'size' },
  motion: { id: 'motion', properties: ['motion'], sector: 'motion' },
};

const BY_KIND: Readonly<Record<QuickElementKind, readonly QuickGroupId[]>> = {
  text: [
    'fontSize',
    'fontWeight',
    'textColor',
    'background',
    'padding',
    'textAlign',
    'lineHeight',
    'direction',
    'radius',
    'shadow',
    'motion',
  ],
  container: [
    'background',
    'padding',
    'gap',
    'flexDirection',
    'align',
    'radius',
    'border',
    'shadow',
    'motion',
  ],
  media: ['replace', 'fit', 'radius', 'aspect', 'alt', 'padding', 'shadow', 'motion'],
  link: ['link', 'textColor', 'background', 'padding', 'radius', 'stylePreset', 'hoverPreset', 'motion'],
  icon: ['icon', 'iconSize', 'textColor', 'padding'],
  component: [],
};

/** The groups of one element kind, in bar order. */
export function quickGroupsFor(kind: QuickElementKind): readonly QuickGroup[] {
  return BY_KIND[kind].map((id) => GROUPS[id]);
}

export function quickGroup(id: QuickGroupId): QuickGroup {
  return GROUPS[id];
}

// ── block-parts (2026-10-06) ──
/*
  A registered block's PART gets the same bar minus the groups that write
  free attributes (direction, hover preset, the attribute link editor)
  or named-style markers: a part's attributes belong to its block, and its
  classes keep the tokens law. Direction has its own part actions
  (`planPartDir`), and a link part edits text + address in PartLinkPopover.

  gsap-pixi additions (2026-10-08): `motion` is back on text, container,
  media and link parts — Cinematic motion ONLY (the model's `motionScope`
  is `part`), stored in the part's own `partStyles` entry; CSS presets stay
  refused there.
*/
const PART_BY_KIND: Readonly<Record<QuickElementKind, readonly QuickGroupId[]>> = {
  text: [
    'fontSize',
    'fontWeight',
    'textColor',
    'background',
    'padding',
    'textAlign',
    'lineHeight',
    'radius',
    'shadow',
    'motion', // gsap-pixi additions (2026-10-08)
  ],
  container: ['background', 'padding', 'gap', 'flexDirection', 'align', 'radius', 'border', 'shadow', 'motion'],
  media: ['replace', 'fit', 'radius', 'aspect', 'alt', 'padding', 'shadow', 'motion'],
  link: ['textColor', 'background', 'padding', 'radius', 'shadow', 'motion'],
  icon: [],
  component: [],
};

/**
 * The groups of one PART kind, in bar order. With `sectors` (the part's
 * declared `styleSections`) the style groups narrow to those sectors; the
 * replace and alt editors are content, not style, and always stay.
 */
export function quickGroupsForPart(
  kind: QuickElementKind,
  sectors?: readonly StyleSectorId[],
): readonly QuickGroup[] {
  const groups = PART_BY_KIND[kind].map((id) => GROUPS[id]);
  if (sectors === undefined || sectors.length === 0) return groups;
  const allowed = new Set(sectors);
  return groups.filter((group) => group.properties.length === 0 || allowed.has(group.sector));
}
// ── /block-parts ──
