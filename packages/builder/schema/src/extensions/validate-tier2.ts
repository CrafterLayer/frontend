import { z } from 'zod';

import { type BuilderError, builderError } from '../errors';
import type { JsonValue } from '../json/json-value';
import { SKIN_STATES } from '../widgets/contract';
import type { DeclarativeExtensionManifest } from './manifests';

export type Tier2ValidationResult =
  { ok: true; manifest: DeclarativeExtensionManifest } | { ok: false; errors: BuilderError[] };

/**
 * The security gate for database-sourced manifests (Law T, defense-in-depth):
 * 1. a structural walk rejects ANY function value anywhere (`ext/tier2-executable`,
 *    naming the offending path) — checked before everything else;
 * 2. a strict shape parse rejects unknown keys (setup, render, …) and malformed
 *    payloads (`ext/tier2-invalid`), with missing skin states surfaced as
 *    `widget/missing-states`.
 * All-or-nothing: a failing manifest registers nothing.
 */
export function validateTier2Manifest(raw: unknown): Tier2ValidationResult {
  const errors: BuilderError[] = [];

  const functionPath = findFunctionValue(raw, [], new Set());
  if (functionPath !== undefined) {
    errors.push(
      builderError(
        'ext/tier2-executable',
        `Stored manifests are pure data; found executable code at "${functionPath.join('.')}".`,
        functionPath,
      ),
    );
    return { ok: false, errors };
  }

  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path as (string | number)[];
      const last = path.at(-1);
      const isMissingSkinState =
        typeof last === 'string' &&
        (SKIN_STATES as readonly string[]).includes(last) &&
        path.includes('states');
      errors.push(
        isMissingSkinState
          ? builderError(
              'widget/missing-states',
              `Skin is missing required state "${last}". All four states ship or the skin does not.`,
              path,
            )
          : builderError(
              'ext/tier2-invalid',
              `Stored manifest is malformed: ${issue.message}`,
              path,
            ),
      );
    }
    return { ok: false, errors };
  }

  const manifest = parsed.data as DeclarativeExtensionManifest;

  for (const [widgetIndex, widget] of (manifest.contributes?.widgetTypes ?? []).entries()) {
    if (!widget.skins.some((skin) => skin.id === widget.defaultSkin)) {
      errors.push(
        builderError(
          'ext/tier2-invalid',
          `Widget "${widget.type}" defaultSkin "${widget.defaultSkin}" is not among its skins.`,
          ['contributes', 'widgetTypes', widgetIndex, 'defaultSkin'],
        ),
      );
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, manifest };
}

function findFunctionValue(
  value: unknown,
  path: (string | number)[],
  seen: Set<object>,
): (string | number)[] | undefined {
  if (typeof value === 'function') {
    return path;
  }
  if (value === null || typeof value !== 'object') {
    return undefined;
  }
  if (seen.has(value)) {
    return undefined;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findFunctionValue(value[index], [...path, index], seen);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }

  for (const [key, entry] of Object.entries(value)) {
    const found = findFunctionValue(entry, [...path, key], seen);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const jsonRecordSchema = z.record(z.string(), jsonValueSchema);

const subTreeNodeSchema = z.strictObject({
  id: z.string().min(1),
  type: z.string().min(1),
  props: jsonRecordSchema,
  bindings: z.record(z.string(), z.string().min(1)).optional(),
  variantOf: z.string().min(1).optional(),
  responsive: z
    .strictObject({
      tablet: jsonRecordSchema.optional(),
      mobile: jsonRecordSchema.optional(),
    })
    .optional(),
  slots: z.record(z.string().min(1), z.array(z.string().min(1)).min(1)).optional(),
});

const subTreeSchema = z.strictObject({
  rootId: z.string().min(1),
  nodes: z.record(z.string(), subTreeNodeSchema),
});

const skinSchema = z.strictObject({
  id: z.string().min(1),
  version: z.number().int().nonnegative(),
  states: z.strictObject({
    loading: subTreeSchema,
    empty: subTreeSchema,
    error: subTreeSchema,
    success: subTreeSchema,
  }),
});

const compositionSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().nonnegative(),
  surfaces: z.array(z.string().min(1)).optional(),
  dir: z.enum(['ltr', 'rtl']).optional(),
  rootId: z.string().min(1),
  nodes: z.record(z.string(), subTreeNodeSchema),
});

const widgetTypeSchema = z.strictObject({
  type: z.string().regex(/^widget:.+$/, 'Widget types are namespaced as "widget:<name>".'),
  contract: z.record(
    z.string().min(1),
    z.strictObject({
      shape: jsonValueSchema,
      required: z.boolean().optional(),
    }),
  ),
  binding: z.strictObject({
    source: z.string().min(1),
    map: z.record(z.string(), z.string()),
    secretRef: z.string().min(1).optional(),
  }),
  skins: z.array(skinSchema),
  defaultSkin: z.string().min(1),
});

const manifestSchema = z.strictObject({
  tier: z.literal(2),
  name: z.string().min(1),
  version: z.string().min(1),
  contributes: z
    .strictObject({
      compositions: z.array(compositionSchema).optional(),
      widgetTypes: z.array(widgetTypeSchema).optional(),
      skins: z.array(skinSchema).optional(),
    })
    .optional(),
});
