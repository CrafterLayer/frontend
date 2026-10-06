import type { ReactNode } from 'react';

import type { z } from 'zod';

import type { FieldCommit, FieldCommitResult } from '../field-commit';
import { initialValueForSchema } from '../repeater-schema';
import { propsShapeOf, unwrapSchema } from '../resolve-field';
import './ObjectField.css';

/** One sub-row the host renders — the same shape a repeater item row has. */
export interface ObjectFieldRowProps {
  readonly key: string;
  readonly propKey: string;
  readonly schema: z.ZodType;
  readonly value: unknown;
  readonly path: (string | number)[];
  readonly commit: FieldCommit;
  readonly disabled: boolean;
}

export interface ObjectFieldProps {
  readonly schema: z.ZodType;
  readonly value: unknown;
  readonly path: (string | number)[];
  readonly disabled?: boolean | undefined;
  readonly describedBy?: string | undefined;
  /** id of the row's label — names the group. */
  readonly labelledBy?: string | undefined;
  /** The ONE door of the owning top-level property: the whole object is written per edit. */
  readonly commit: FieldCommit;
  /** Keys this field must not render (a LinkField renders label/href itself). */
  readonly omitKeys?: readonly string[] | undefined;
  readonly renderRow: (props: ObjectFieldRowProps) => ReactNode;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}

/**
 * The value an absent optional object starts from when one of its fields is
 * first edited: the schema's own seed (defaults filled in), so the write that
 * creates the object can pass the door.
 */
function baseObject(schema: z.ZodType, value: unknown): Readonly<Record<string, unknown>> {
  const current = asRecord(value);
  if (current !== undefined) return current;
  const seed = initialValueForSchema(unwrapSchema(schema));
  return (seed.ok ? asRecord(seed.value) : undefined) ?? {};
}

/**
 * A plain object property as GROUPED SUB-ROWS: `link: { label, href }`,
 * `cta: { label, href, newTab }`, `seo.site.business`… Each sub-property gets
 * the editor its own schema resolves to (recursing as deep as the schema
 * goes), and each sub-edit is ONE write of the whole object through the
 * owning property's door — so one change is one Undo.
 *
 * This replaced the `JSON.stringify` read-only box those properties showed.
 */
export function ObjectField({
  schema,
  value,
  path,
  disabled = false,
  describedBy,
  labelledBy,
  commit,
  omitKeys,
  renderRow,
}: ObjectFieldProps) {
  const shape = propsShapeOf(unwrapSchema(schema));
  const omitted = new Set(omitKeys ?? []);
  const entries = Object.entries(shape).filter(([key]) => !omitted.has(key));
  const current = asRecord(value);

  return (
    <div
      className="bldr-object-field"
      role={labelledBy === undefined ? undefined : 'group'}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
    >
      {entries.map(([propKey, propertySchema]) =>
        renderRow({
          key: propKey,
          propKey,
          schema: propertySchema,
          value: current?.[propKey],
          path: [...path, propKey],
          commit: (next): FieldCommitResult =>
            commit({ ...baseObject(schema, value), [propKey]: next }),
          disabled,
        }),
      )}
    </div>
  );
}
