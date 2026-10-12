import type { ComponentType } from 'react';
import type { z } from 'zod';

import type { AssetLibraryPort } from '../assets/types';

/**
 * The Inspector's field-type contribution point (B0, extended additively).
 *
 * A field type is chosen by DECLARATION: `match` reads the property's schema
 * (a marker such as `richText()`, `customJs()` or `customCodeJsParams()`
 * leaves), never its name. Everything past `schema`/`value`/`path`/`onChange`
 * is optional, so a field written against the original contract still fits.
 */

/** A prop beside the row's own, for a field type that declared `siblings: true`. */
export interface FieldSibling {
  readonly key: string;
  /** Its property schema, so a field finds the one it needs by marker, not by name. */
  readonly schema: z.ZodType;
  readonly value: unknown;
}

/** What a field type's `hidden` rule reads: the row's value and the props beside it. */
export interface FieldRowState {
  readonly value: unknown;
  readonly siblings: readonly FieldSibling[];
}

export interface FieldProps {
  schema: z.ZodType;
  value: unknown;
  /** Into props or responsive[breakpoint]. */
  path: (string | number)[];
  /** The host wraps this into setProp / setResponsive dispatches. */
  onChange: (next: unknown) => void;
  disabled?: boolean;
  /** The editor's language, for a field that writes its own words (labels, direction). */
  locale?: 'en' | 'ar' | undefined;
  /** The block's other props (base values), when the field type declared `siblings: true`. */
  siblings?: readonly FieldSibling[] | undefined;
  /** The host's picture library, when it has one: image pickers offer it. */
  assetLibrary?: AssetLibraryPort | undefined;
}

export interface FieldTypeDef {
  id: string;
  /** Priority score; 0 = no match; highest wins. */
  match(schema: z.ZodType): number;
  load: () => Promise<{ default: ComponentType<FieldProps> }>;
  /**
   * Whether the Inspector leaves a matched prop out: no row, and no section or tab when nothing
   * else is in it. `true` — always: the prop is data another surface writes (a studio's library
   * reference) and is never shown or edited as fields. A function — per value: a group of
   * controls with nothing to control yet. Absent or `false`: the prop always has a row. A rule
   * that throws counts as `false`.
   */
  hidden?: boolean | ((row: FieldRowState) => boolean);
  /** The row receives its sibling props (`FieldProps.siblings`) and re-renders when one changes. */
  siblings?: boolean;
}
