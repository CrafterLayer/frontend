/**
 * The style manager's vocabulary: buckets, states, values and intents
 * (style-manager DESIGN.md §A.2–A.3).
 *
 * One storage model (D1): every style lives in the element's own `className`
 * as Tailwind utilities. These types describe a change to that string in
 * person-sized terms ("padding, inline-start, mobile, hover") so the panel,
 * the quick bar, the canvas handles and the agent tools all ask the engine
 * for the same edit the same way.
 */
import type { StylePropertyId } from './catalogue';

/**
 * Where a value applies. Desktop-first (D2): `base` is unprefixed, `tablet` is
 * `max-lg:`, `mobile` is `max-md:`, and a custom bucket is `max-[Npx]:`.
 */
export type StyleBucket = 'base' | 'tablet' | 'mobile' | { readonly maxWidth: number };

/** The interaction state a value applies in. `focus` is written `focus-visible:`. */
export type StyleState = 'default' | 'hover' | 'focus' | 'active' | 'open' | 'group-hover';

/**
 * `free` admits every value kind (agent trees). `tokens` admits theme tokens
 * and scale steps only (registered blocks), mirroring `findRejectedUtilities`.
 */
export type StyleMode = 'free' | 'tokens';

/** A value, before it becomes a class. */
export type StyleValue =
  /** A theme token or scale step: `accent`, `4`, `lg`, `accent/80`, `-2`. */
  | { readonly kind: 'token'; readonly token: string }
  /** A site-library palette colour, written `(--ck-c-<id>)`. */
  | { readonly kind: 'palette'; readonly id: string }
  /** An exact CSS value, written as an arbitrary value: `17px`, `#0f766e`. */
  | { readonly kind: 'raw'; readonly css: string }
  /** One of the property's named options: `flex`, `column`, `center`, `none`. */
  | { readonly kind: 'keyword'; readonly keyword: string };

/** Logical sides of the box model (padding, margin, border width, inset). */
export type StyleBoxSide = 'block-start' | 'block-end' | 'inline-start' | 'inline-end';

/** Logical corners (radius): `ss` = start-start … `ee` = end-end. */
export type StyleCorner = 'start-start' | 'start-end' | 'end-start' | 'end-end';

/** Which part of a sided property an intent addresses. */
export type StyleSide =
  | 'all'
  | 'block'
  | 'inline'
  | 'block-start'
  | 'block-end'
  | 'inline-start'
  | 'inline-end'
  | StyleCorner;

/** One requested change. */
export interface StyleIntent {
  readonly property: StylePropertyId;
  /** `null` resets: removes only the class behind the value at this bucket and state. */
  readonly value: StyleValue | null;
  readonly bucket: StyleBucket;
  readonly state: StyleState;
  /** Sided properties only. Defaults to `all`. */
  readonly side?: StyleSide | undefined;
}

export interface ApplyStyleOptions {
  readonly mode: StyleMode;
}

export type ApplyStyleResult =
  | {
      readonly ok: true;
      readonly className: string;
      readonly added: readonly string[];
      readonly removed: readonly string[];
    }
  | { readonly ok: false; readonly message: string };

/** Where the value a control shows comes from. */
export type StyleSource = 'here' | 'larger-bucket' | 'default-state' | 'named-style';

export interface ResolvedStyle {
  readonly value: StyleValue;
  /** The class the value was read from, exactly as written. */
  readonly className: string;
  readonly source: StyleSource;
  /** Sided properties: each side resolved on its own (it may come from another bucket). */
  readonly sides?: Readonly<Partial<Record<StyleBoxSide | StyleCorner, ResolvedStyle>>>;
  /**
   * The family also has classes behind breakpoints the engine does not write
   * (`sm:`, `xl:`, `2xl:`, `@md:`, or mobile-first `md:`/`lg:` not normalised
   * yet). They are left untouched; the UI shows a badge.
   */
  readonly customBreakpoint?: true;
}

export interface ReadStyleOptions {
  /** Named-style utilities by id, for markers `ck-s-<id>` on the element. */
  readonly namedStyles?: Readonly<Record<string, string>> | undefined;
}

/** Bilingual labels: the host picks one by locale. */
export interface StyleLabels {
  readonly en: string;
  readonly ar: string;
}
