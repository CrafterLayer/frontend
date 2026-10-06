import { createContext, useContext } from 'react';

import type { AssetLibraryPort } from '@craftkit/builder-schema';

import { FIELD_LABELS, type FieldLabels, type FieldLocale } from './field-labels';

/** A page a LinkField can point at: its path is the href, its title the option text. */
export interface FieldPage {
  readonly path: string;
  readonly title: string;
}

/**
 * What the Inspector's fields may need from the host, beyond one property's
 * value. Everything is optional: a field with no library falls back to URL
 * entry, a LinkField with no pages offers no page picker, and the copy is
 * English unless the host says Arabic.
 */
export interface FieldServices {
  /** The site's picture library — AssetField and ImageUrlField pick from it. */
  readonly assetLibrary?: AssetLibraryPort | undefined;
  /** The site's pages — LinkField offers them as a picker beside the address. */
  readonly pages?: readonly FieldPage[] | undefined;
  /** The editor locale the field copy is written in. */
  readonly locale?: FieldLocale | undefined;
}

const EMPTY: FieldServices = {};

/** Read through `useFieldServices`; provided by `FieldServicesProvider` (field-services.tsx). */
export const FieldServicesContext = createContext<FieldServices>(EMPTY);

/** The services of the nearest provider, or none. */
export function useFieldServices(): FieldServices {
  return useContext(FieldServicesContext);
}

/** The field copy for the provider's locale (English without a provider). */
export function useFieldLabels(): FieldLabels {
  const { locale } = useContext(FieldServicesContext);
  return FIELD_LABELS[locale ?? 'en'];
}
