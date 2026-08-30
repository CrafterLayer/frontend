import { z } from 'zod';

import type { Surface, SlotName } from '../document/types';
import { builderError } from '../errors';
import { isJsonValue, type JsonValue } from '../json/json-value';
import { isRichTextSchema } from '../rich-text/rich-text';

export interface SlotDecl {
  /** Block types this slot accepts. */
  allow: string[];
  /** Maximum number of children; unlimited when absent. */
  max?: number;
}

/** The fixed top-level destinations available to generated property panels. */
export type BlockPropertyTab = 'content' | 'design' | 'advanced';

/** An explicit Inspector control kind declared by the block, never inferred from a prop name. */
/*
  A block-declared hint that a property is one recognised decision rather than
  whatever its zod shape happens to look like. `motion` is an object of six
  optional enums; without the declaration it resolves to the read-only fallback,
  which is technically correct and useless.
*/
export type BlockPropertyKind = 'color-role' | 'motion';

/** A block-owned declaration of where one property appears in the Inspector. */
export interface BlockPropertyGroup {
  readonly tab: BlockPropertyTab;
  readonly section?: string;
  readonly kind?: BlockPropertyKind;
}

type PropertyKeyOf<P extends z.ZodType> =
  unknown extends z.output<P>
    ? string
    : z.output<P> extends Record<string, unknown>
      ? Extract<keyof z.output<P>, string>
      : never;

/**
 * Optional property-panel placement keyed only by keys declared in `props`.
 * An omitted property always belongs to the Content tab; consumers may choose
 * a presentational default section for declarations that omit `section`.
 */
export type BlockPropertyGroups<P extends z.ZodType = z.ZodType> = Readonly<
  Partial<Record<PropertyKeyOf<P>, BlockPropertyGroup>>
>;

/**
 * Declarative description of one block kind. Carries NO renderer — rendering is
 * attached only inside trusted (tier-1) manifests at registration time (Law T).
 */
export interface BlockSchema<P extends z.ZodType = z.ZodType> {
  type: string;
  /** Written FOR the model, not the human. */
  description: string;
  /** Applicable surfaces; absent = all. */
  surfaces?: Surface[];
  /** Enums over free numbers; intent over pixels. Must stay JSON-representable. */
  props: P;
  /**
   * Inspector placement declared by the block. Optional for compatibility:
   * every property without an entry defaults to the Content tab.
   */
  propertyGroups?: BlockPropertyGroups<NoInfer<P>>;
  slots?: Record<SlotName, SlotDecl>;
  /**
   * The property edited IN PLACE on the canvas (009 contract §1). Absent ⇒ the
   * block is not inline-editable and the gesture does nothing. Declaration is
   * DATA: no package needs the shell, the canvas, or an editing engine to say
   * a block edits in place.
   */
  inlineEditable?: string;
  bindings?: Record<string, { shape: z.ZodType; required?: boolean }>;
  /** Few-shot examples for AI context assembly. */
  examples: { prompt: string; node: JsonValue }[];
}

/**
 * The kinds that can be edited in place: a plain string, or a rich-text
 * declaration (recognised by its marker, so the schema layer never imports the
 * editing extension). Wrappers are unwrapped first, exactly as field
 * resolution does.
 */
function isInlineEditableKind(schema: z.ZodType): boolean {
  if (isRichTextSchema(schema)) {
    return true;
  }
  let current: z.ZodType = schema;
  for (;;) {
    const def = current._zod.def as { type: string; innerType?: z.ZodType };
    if (def.type === 'string') {
      return true;
    }
    const isWrapper = def.type === 'optional' || def.type === 'default' || def.type === 'nullable';
    if (!isWrapper || def.innerType === undefined) {
      return false;
    }
    current = def.innerType;
  }
}

/**
 * Definition-time gate: a block schema whose props cannot round-trip as JSON
 * (dates, bigints, functions, transforms, maps/sets, …) is rejected immediately
 * with `block/non-json-props` — Law J starts at definition, not at runtime.
 */
export function defineBlockSchema<P extends z.ZodType>(def: BlockSchema<P>): BlockSchema<P> {
  if (def.type.trim() === '') {
    throw builderError('block/non-json-props', 'Block type must be a non-empty string.', ['type']);
  }
  if (def.description.trim() === '') {
    throw builderError(
      'block/non-json-props',
      `Block "${def.type}" must carry a model-facing description.`,
      ['description'],
    );
  }

  for (const [slotName, decl] of Object.entries(def.slots ?? {})) {
    if (slotName === '') {
      throw builderError(
        'block/non-json-props',
        `Block "${def.type}" declares an empty slot name.`,
        ['slots', slotName],
      );
    }
    if (decl.allow.length === 0) {
      throw builderError(
        'block/non-json-props',
        `Block "${def.type}" slot "${slotName}" must allow at least one block type.`,
        ['slots', slotName, 'allow'],
      );
    }
    if (decl.max !== undefined && (!Number.isInteger(decl.max) || decl.max < 1)) {
      throw builderError(
        'block/non-json-props',
        `Block "${def.type}" slot "${slotName}" max must be a positive integer.`,
        ['slots', slotName, 'max'],
      );
    }
  }

  if (def.inlineEditable !== undefined) {
    // d1 — a mis-declaration is a REGISTRATION-time error, never a runtime
    // surprise on a canvas the author is not looking at.
    const shape = (def.props._zod.def as { type: string; shape?: Record<string, z.ZodType> }).shape;
    const declared = shape?.[def.inlineEditable];
    if (declared === undefined) {
      throw builderError(
        'block/non-json-props',
        `Block "${def.type}" declares inlineEditable "${def.inlineEditable}", which is not one of its props.`,
        ['inlineEditable'],
      );
    }
    if (!isInlineEditableKind(declared)) {
      throw builderError(
        'block/non-json-props',
        `Block "${def.type}" declares inlineEditable "${def.inlineEditable}", which is neither a string nor rich text — those are the only kinds that can be edited in place.`,
        ['inlineEditable'],
      );
    }
  }

  try {
    z.toJSONSchema(def.props);
  } catch (cause) {
    throw builderError(
      'block/non-json-props',
      `Block "${def.type}" props schema is not JSON-representable: ${cause instanceof Error ? cause.message : String(cause)}`,
      ['props'],
    );
  }

  def.examples.forEach((example, index) => {
    if (!isJsonValue(example.node)) {
      throw builderError(
        'block/non-json-props',
        `Block "${def.type}" example #${String(index)} contains non-JSON data.`,
        ['examples', index, 'node'],
      );
    }
  });

  return Object.freeze({ ...def });
}
