import { z } from 'zod';

import {
  CUSTOM_CODE_ICON_NAME,
  type CustomCodeAttribute,
  type CustomCodeElement,
  type CustomCodeIcon,
  type CustomCodeNode,
} from '@craftkit/builder-schema';

/**
 * One editable value of an authored element: how to read it off the node and
 * how to write a NEW node carrying it. Pure data — the Inspector row renders
 * the schema and calls `write` through the one setProp door.
 */
export interface CustomCodeElementField {
  readonly key: string;
  readonly schema: z.ZodType;
  readonly read: (node: CustomCodeNode) => unknown;
  readonly write: (node: CustomCodeNode, value: unknown) => CustomCodeNode;
}

export interface CustomCodeElementSection {
  readonly name: string;
  readonly fields: readonly CustomCodeElementField[];
}

/*
  The rows a person gets for each kind of authored node.

  These mirror the tree's own vocabulary (custom-code-tree.ts) — the same
  ceilings, the same attribute list — so the Inspector never offers a value the
  validated door will refuse. They are deliberately NOT derived from the zod
  schema at runtime: the tree schema is a discriminated union of strict
  objects, and the attribute list it admits says nothing about which of them
  matter for an `img` versus an `a`. That editorial judgement lives here.
*/

/** Tags rendered without children or text; the same set the renderer treats as void. */
const VOID_TAGS: ReadonlySet<string> = new Set(['br', 'hr', 'img']);

const ADVANCED_ATTRIBUTES: readonly CustomCodeAttribute[] = [
  'id',
  'title',
  'role',
  'aria-label',
  'aria-hidden',
];

const attributeText = z.string().max(2_000);
const classNameText = z.string().max(1_000);
const elementText = z.string().max(20_000);

function isBlank(value: unknown): value is undefined | '' {
  return (
    value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
  );
}

function asElement(node: CustomCodeNode): CustomCodeElement | undefined {
  return node.kind === 'element' ? node : undefined;
}

function asIcon(node: CustomCodeNode): CustomCodeIcon | undefined {
  return node.kind === 'icon' ? node : undefined;
}

/**
 * An attribute row. Clearing DELETES the key — never stores `''` or
 * `undefined` — because the document is JSON (Law J) and a present-but-empty
 * attribute would render (`alt=""` has meaning; `title=""` is noise).
 */
function attributeField(name: CustomCodeAttribute): CustomCodeElementField {
  return {
    key: name,
    schema: attributeText,
    read: (node) => asElement(node)?.attributes?.[name],
    write: (node, value) => {
      const element = asElement(node);
      /* v8 ignore next 3 -- fields are built from the node they will write; kinds cannot diverge. */
      if (element === undefined) {
        return node;
      }
      const attributes: NonNullable<CustomCodeElement['attributes']> = Object.fromEntries(
        Object.entries(element.attributes ?? {}).filter(([key]) => key !== name),
      );
      if (!isBlank(value) && typeof value === 'string') {
        attributes[name] = value;
      }
      const next: CustomCodeElement = { ...element };
      if (Object.keys(attributes).length === 0) {
        delete next.attributes;
      } else {
        next.attributes = attributes;
      }
      return next;
    },
  };
}

const textField: CustomCodeElementField = {
  key: 'text',
  schema: elementText,
  read: (node) => asElement(node)?.text,
  // Text stays a string when emptied: a heading with no words is still a
  // heading in the tree, and the person is mid-edit, not deleting it.
  write: (node, value) => ({ ...node, text: typeof value === 'string' ? value : '' }),
};

const classNameField: CustomCodeElementField = {
  key: 'className',
  schema: classNameText,
  read: (node) => (node.kind === 'component' ? undefined : node.className),
  write: (node, value) => {
    const next = { ...node } as CustomCodeNode & { className?: string };
    if (isBlank(value) || typeof value !== 'string') {
      delete next.className;
    } else {
      next.className = value.trim();
    }
    return next;
  },
};

function iconField<K extends 'name' | 'label' | 'size' | 'strokeWidth'>(
  key: K,
  schema: z.ZodType,
  accept: (value: unknown) => CustomCodeIcon[K] | undefined,
): CustomCodeElementField {
  return {
    key,
    schema,
    read: (node) => asIcon(node)?.[key],
    write: (node, value) => {
      const accepted = accept(value);
      const next: Record<string, unknown> = Object.fromEntries(
        Object.entries(node).filter(([candidate]) => candidate !== key),
      );
      if (accepted !== undefined) {
        next[key] = accepted;
      }
      return next as unknown as CustomCodeNode;
    },
  };
}

const nonBlankString = (value: unknown) =>
  typeof value === 'string' && !isBlank(value) ? value.trim() : undefined;
const finiteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const ICON_FIELDS = {
  name: iconField('name', z.string().min(1).max(64).regex(CUSTOM_CODE_ICON_NAME), nonBlankString),
  label: iconField('label', z.string().max(120), nonBlankString),
  size: iconField('size', z.number().int().min(8).max(256), finiteNumber),
  strokeWidth: iconField('strokeWidth', z.number().min(0.5).max(4), finiteNumber),
} as const;

function elementSections(element: CustomCodeElement): readonly CustomCodeElementSection[] {
  const content: CustomCodeElementField[] = [];
  if (!VOID_TAGS.has(element.tag)) {
    content.push(textField);
  }
  if (element.tag === 'a') {
    content.push(attributeField('href'), attributeField('target'));
  }
  if (element.tag === 'time') {
    content.push(attributeField('datetime'));
  }
  const sections: CustomCodeElementSection[] = [];
  if (element.tag === 'img') {
    sections.push({ name: 'Image', fields: [attributeField('src'), attributeField('alt')] });
  } else if (content.length > 0) {
    sections.push({ name: 'Content', fields: content });
  }
  sections.push({ name: 'Design', fields: [classNameField] });
  sections.push({ name: 'Advanced', fields: ADVANCED_ATTRIBUTES.map(attributeField) });
  return sections;
}

/**
 * The Inspector sections for one authored node. A component reference gets
 * none: it is a registered block with its own schema and belongs to a later
 * milestone (it renders through the block's renderer, which owns its root, so
 * the canvas cannot address it yet).
 */
export function customCodeElementSections(
  node: CustomCodeNode,
): readonly CustomCodeElementSection[] {
  switch (node.kind) {
    case 'element':
      return elementSections(node);
    case 'icon':
      return [
        { name: 'Icon', fields: [ICON_FIELDS.name, ICON_FIELDS.label] },
        { name: 'Design', fields: [ICON_FIELDS.size, ICON_FIELDS.strokeWidth, classNameField] },
      ];
    case 'component':
      return [];
  }
}
