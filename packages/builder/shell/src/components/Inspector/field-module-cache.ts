import type { ComponentType } from 'react';

import type { z } from 'zod';

import type { FieldProps, FieldTypeDef } from '@craftkit/builder-schema';

import { AssetField } from '../../fields/AssetField';
import { ImageUrlField } from '../../fields/ImageUrlField';
import { KeyValueField } from '../../fields/KeyValueField';
import { MotionField } from '../../fields/MotionField';
import { TextAreaField } from '../../fields/TextAreaField';
import { UtilityClassField } from '../../fields/UtilityClassField';
import {
  NumberField,
  SelectField,
  SwitchField,
  TextField,
  type FieldControlProps,
} from '../../fields/controls';
import { defaultFieldFor, type DefaultControl } from '../../fields/resolve-field';
import type { Rendering } from './types';

/**
 * Controls the row renders with its OWN structure (they need the row's
 * recursion, the kernel, or a palette) rather than as one FieldControlProps
 * component.
 */
export type CompositeDefaultControl = 'color-role' | 'repeater' | 'object' | 'link' | 'part-styles';

export type ScalarDefaultControl = Exclude<DefaultControl, CompositeDefaultControl>;

const COMPOSITE: ReadonlySet<DefaultControl> = new Set<CompositeDefaultControl>([
  'color-role',
  'repeater',
  'object',
  'link',
  'part-styles',
]);

export function isCompositeControl(control: DefaultControl): control is CompositeDefaultControl {
  return COMPOSITE.has(control);
}

export const DEFAULT_CONTROLS: Record<ScalarDefaultControl, ComponentType<FieldControlProps>> = {
  text: TextField,
  textarea: TextAreaField,
  select: SelectField,
  switch: SwitchField,
  number: NumberField,
  /*
    Motion joins the scalar map rather than needing its own branch the way
    `color-role` and `repeater` do: it takes plain FieldControlProps and renders
    one self-contained fieldset, so nothing about the row has to know it is
    composite.
  */
  motion: MotionField,
  /*
    So does the class editor. It renders chips and an input rather than one
    element, but the row's label is a SIBLING carrying `htmlFor` — so pointing
    it at the input is both possible and better than naming a group: clicking
    "Custom classes" puts the caret where a person is about to type.
  */
  'utility-classes': UtilityClassField,
  // block-parts P3: the image editors and the record editor read their
  // services (asset library, locale) from FieldServicesProvider, so they too
  // take plain FieldControlProps.
  'image-url': ImageUrlField,
  asset: AssetField,
  'key-value': KeyValueField,
};

/**
 * Per-DEF load cache, module-level: keyed by the FieldTypeDef OBJECT identity —
 * a re-registered id is a DIFFERENT contribution and must load its own
 * component (an id is a registry slot name, not a version identity). Shared
 * across rows and selections so a loaded component never re-flashes; disposed
 * defs simply GC away with their entry.
 *
 * Only SUCCESS is cached. A failure lives in `fieldModuleFailures` and is
 * retried — by the Retry button, and by the next row that mounts — rather than
 * being remembered forever: a lazy chunk that failed once on a flaky dev
 * server (or an optimize-deps reload) must not leave the field dead for the
 * rest of the session.
 */
export const fieldModuleCache = new WeakMap<FieldTypeDef, ComponentType<FieldProps>>();

/** The latest load or render failure of a contribution, with its sentence. */
export interface FieldModuleFailure {
  readonly message: string;
  /** Bumped per failure, so a retry that fails again is still a change. */
  readonly attempt: number;
}

export const fieldModuleFailures = new WeakMap<FieldTypeDef, FieldModuleFailure>();

export function recordFieldFailure(def: FieldTypeDef, error: unknown): void {
  const previous = fieldModuleFailures.get(def);
  fieldModuleFailures.set(def, {
    message: error instanceof Error && error.message !== '' ? error.message : String(error),
    attempt: (previous?.attempt ?? 0) + 1,
  });
}

/**
 * Loads in flight, per def: rows sharing a contribution share ONE request,
 * and a retry while one is pending joins it instead of starting another.
 */
const inFlight = new WeakMap<FieldTypeDef, Promise<void>>();

export function loadFieldModule(def: FieldTypeDef): Promise<void> {
  const pending = inFlight.get(def);
  if (pending !== undefined) return pending;
  const run = def
    .load()
    .then(
      (mod) => {
        fieldModuleCache.set(def, mod.default);
        fieldModuleFailures.delete(def);
      },
      (error: unknown) => {
        recordFieldFailure(def, error);
      },
    )
    .finally(() => {
      inFlight.delete(def);
    });
  inFlight.set(def, run);
  return run;
}

export function fallbackRendering(schema: z.ZodType, loading: boolean): Rendering {
  const fallback = defaultFieldFor(schema);
  return fallback.kind === 'default'
    ? { kind: 'default', control: fallback.control, loading }
    : { kind: 'readonly', loading };
}
