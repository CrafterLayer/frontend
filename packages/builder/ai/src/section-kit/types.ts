/**
 * The section kit's data shape — frozen in DESIGN.md §B (2026-09-30); every
 * package codes against it, so it changes only with the design.
 *
 * A kit is a section template adapted from a vendored MIT library (HyperUI,
 * Tailark, Meraki UI; provenance in vendor/VENDOR.md). The agent names a kit
 * and fills its slots — ~30–300 output tokens — instead of writing the
 * section's markup token by token, and `instantiateKit` turns the slots into
 * an ordinary customCode tree the kernel door judges like any other.
 */

export interface SectionKitSlot {
  readonly kind: 'text' | 'image' | 'link' | 'icon' | 'list';
  /** text: at most this many characters (cut at a word); list: at most this many items. */
  readonly max?: number;
  readonly required?: boolean;
  /** list only: the fields of one item. */
  readonly item?: Readonly<Record<string, SectionKitSlot>>;
}

export interface SectionKit {
  /** 'hero-split-media' */
  readonly id: string;
  readonly role: 'header' | 'hero' | 'features' | 'proof' | 'offer' | 'media' | 'closing' | 'footer';
  /** The SECTION_VARIANTS id this kit realises (default kit per variant). */
  readonly variant?: string;
  /** 8 words or fewer. */
  readonly summary: string;
  readonly source: {
    readonly lib: 'hyperui' | 'tailark' | 'merakiui';
    readonly file: string;
    readonly commit: string;
  };
  readonly slots: Readonly<Record<string, SectionKitSlot>>;
  /** tree-markup (plan/tree-markup.ts) with {{slot}}, {{#items}}…{{/items}}, {{item.x}}. */
  readonly markup: string;
  /** Region css, ck- classes only. */
  readonly css?: string;
}

export type SectionKitRole = SectionKit['role'];

export const SECTION_KIT_ROLES: readonly SectionKitRole[] = Object.freeze([
  'header',
  'hero',
  'features',
  'proof',
  'offer',
  'media',
  'closing',
  'footer',
]);
