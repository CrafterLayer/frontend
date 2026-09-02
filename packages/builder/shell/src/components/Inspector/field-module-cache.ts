import type { ComponentType } from 'react';

import type { z } from 'zod';

import type { FieldProps, FieldTypeDef } from '@craftkit/builder-schema';

import { MotionField } from '../../fields/MotionField';
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

type ScalarDefaultControl = Exclude<DefaultControl, 'color-role' | 'repeater'>;

export const DEFAULT_CONTROLS: Record<ScalarDefaultControl, ComponentType<FieldControlProps>> = {
  text: TextField,
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
};

/**
 * Per-DEF load cache, module-level: keyed by the FieldTypeDef OBJECT identity —
 * a re-registered id is a DIFFERENT contribution and must load its own
 * component (an id is a registry slot name, not a version identity). Shared
 * across rows and selections so a loaded component never re-flashes; disposed
 * defs simply GC away with their entry.
 */
export const fieldModuleCache = new WeakMap<FieldTypeDef, ComponentType<FieldProps> | 'failed'>();

export function fallbackRendering(schema: z.ZodType, loading: boolean): Rendering {
  const fallback = defaultFieldFor(schema);
  return fallback.kind === 'default'
    ? { kind: 'default', control: fallback.control, loading }
    : { kind: 'readonly', loading };
}
