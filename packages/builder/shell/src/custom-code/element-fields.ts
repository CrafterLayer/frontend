import { z } from 'zod';

import {
  CUSTOM_CODE_AUTOCOMPLETE_TOKENS,
  CUSTOM_CODE_ICON_NAME,
  type CustomCodeElement,
  type CustomCodeIcon,
  type CustomCodeNode,
  type TreeNodePatch,
} from '@craftkit/builder-schema';

/** A label in both languages; the host picks one by locale. */
export interface FieldLabel {
  readonly en: string;
  readonly ar: string;
}

/**
 * One editable value of an authored element (a GrapesJS-style "trait"): how
 * to read it off the node and how to write it.
 *
 * Pure data — the Inspector row renders the schema. An element trait writes
 * a `patch` (one `patchTreeNode`: `set` fields and/or attributes, `null`
 * removes); an icon trait, which the patch command cannot express, writes a
 * whole new node (`write`, committed with `setTreeNode`).
 */
export interface CustomCodeElementField {
  readonly key: string;
  readonly label: FieldLabel;
  readonly schema: z.ZodType;
  readonly read: (node: CustomCodeNode) => unknown;
  readonly patch?: ((value: unknown) => TreeNodePatch) | undefined;
  readonly write?: ((node: CustomCodeNode, value: unknown) => CustomCodeNode) | undefined;
}

export interface CustomCodeElementSection {
  readonly name: FieldLabel;
  readonly fields: readonly CustomCodeElementField[];
}

/*
  The Content traits per tag, exactly the list of style-manager DESIGN.md §A.4
  ("Content traits per tag"). They mirror the tree's own vocabulary
  (custom-code-tree.ts): the same ceilings and the same closed enums, so the
  panel never offers a value the validated door will refuse. Styling is NOT
  here — every tag gets the full Design sectors — and neither are id, role,
  aria-*, lang, dir or tabindex, which the Advanced group owns.
*/

const L = (en: string, ar: string): FieldLabel => ({ en, ar });

/** Tags rendered without children or text; the same set the renderer treats as void. */
const VOID_TAGS: ReadonlySet<string> = new Set(['br', 'hr', 'img', 'input', 'source', 'track', 'wbr']);

const TEXT_TAGS: ReadonlySet<string> = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'strong', 'em', 'small', 'b', 'i', 'u', 's',
  'mark', 'code', 'pre', 'kbd', 'sub', 'sup', 'blockquote', 'q', 'cite', 'abbr', 'li', 'dt', 'dd',
  'figcaption', 'caption', 'legend', 'summary', 'th', 'td', 'option', 'div', 'section', 'article',
  'aside', 'header', 'footer', 'nav', 'main', 'figure', 'address', 'a', 'button', 'label', 'time',
  'textarea',
]);

const FORM_CONTROLS: ReadonlySet<string> = new Set(['input', 'textarea', 'select']);

const attributeText = z.string().max(2_000);
const elementText = z.string().max(20_000);

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

function asElement(node: CustomCodeNode): CustomCodeElement | undefined {
  return node.kind === 'element' ? node : undefined;
}

function asIcon(node: CustomCodeNode): CustomCodeIcon | undefined {
  return node.kind === 'icon' ? node : undefined;
}

function attributeOf(node: CustomCodeNode, name: string): string | undefined {
  const attributes = asElement(node)?.attributes as Readonly<Record<string, string | undefined>> | undefined;
  return attributes?.[name];
}

/**
 * A string attribute. Clearing REMOVES it (`null` in the patch), never stores
 * `''`: a present-but-empty attribute renders (`alt=""` has meaning).
 */
function attributeField(name: string, label: FieldLabel, schema: z.ZodType = attributeText): CustomCodeElementField {
  return {
    key: name,
    label,
    schema,
    read: (node) => attributeOf(node, name),
    patch: (value) => ({
      attributes: { [name]: isBlank(value) || typeof value !== 'string' ? null : value.trim() },
    }),
  };
}

/** An enum attribute; the empty choice removes it. */
function enumField(name: string, label: FieldLabel, values: readonly [string, ...string[]]): CustomCodeElementField {
  return attributeField(name, label, z.enum(values).optional());
}

/** A boolean attribute: written bare (`''`) when on, removed when off. */
function flagField(name: string, label: FieldLabel): CustomCodeElementField {
  return {
    key: name,
    label,
    schema: z.boolean(),
    read: (node) => attributeOf(node, name) !== undefined,
    patch: (value) => ({ attributes: { [name]: value === true ? '' : null } }),
  };
}

/** One switch for several flags at once (video: autoplay + muted + playsinline). */
function flagsField(key: string, names: readonly string[], label: FieldLabel): CustomCodeElementField {
  return {
    key,
    label,
    schema: z.boolean(),
    read: (node) => names.every((name) => attributeOf(node, name) !== undefined),
    patch: (value) => ({
      attributes: Object.fromEntries(names.map((name) => [name, value === true ? '' : null])),
    }),
  };
}

/** A numeric attribute stored as a string (`colspan="2"`). */
function numberAttributeField(name: string, label: FieldLabel, min: number, max: number): CustomCodeElementField {
  return {
    key: name,
    label,
    schema: z.number().int().min(min).max(max).optional(),
    read: (node) => {
      const raw = attributeOf(node, name);
      const parsed = raw === undefined ? Number.NaN : Number(raw);
      return Number.isFinite(parsed) ? parsed : undefined;
    },
    patch: (value) => ({
      attributes: {
        [name]: typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : null,
      },
    }),
  };
}

const textField: CustomCodeElementField = {
  key: 'text',
  label: L('Text', 'النص'),
  schema: elementText,
  read: (node) => asElement(node)?.text,
  // Text stays a string when emptied: a heading with no words is still a
  // heading in the tree, and the person is mid-edit, not deleting it.
  patch: (value) => ({ set: { text: typeof value === 'string' ? value : '' } }),
};

function iconField<K extends 'name' | 'label' | 'size' | 'strokeWidth'>(
  key: K,
  label: FieldLabel,
  schema: z.ZodType,
  accept: (value: unknown) => CustomCodeIcon[K] | undefined,
): CustomCodeElementField {
  return {
    key,
    label,
    schema,
    read: (node) => asIcon(node)?.[key],
    write: (node, value) => {
      const accepted = accept(value);
      const next: Record<string, unknown> = Object.fromEntries(
        Object.entries(node).filter(([candidate]) => candidate !== key),
      );
      if (accepted !== undefined) next[key] = accepted;
      return next as unknown as CustomCodeNode;
    },
  };
}

const nonBlankString = (value: unknown) =>
  typeof value === 'string' && !isBlank(value) ? value.trim() : undefined;
const finiteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** The icon sets a name may come from (DESIGN §D.1). */
export const ICON_SETS = ['lucide', 'tabler', 'tabler-filled'] as const;
export type IconSet = (typeof ICON_SETS)[number];

/** `tabler:heart` → { set: 'tabler', glyph: 'heart' }; a bare name is Lucide. */
export function splitIconName(name: string): { readonly set: IconSet; readonly glyph: string } {
  if (name.startsWith('tabler-filled:')) return { set: 'tabler-filled', glyph: name.slice('tabler-filled:'.length) };
  if (name.startsWith('tabler:')) return { set: 'tabler', glyph: name.slice('tabler:'.length) };
  return { set: 'lucide', glyph: name };
}

export function joinIconName(set: IconSet, glyph: string): string {
  return set === 'lucide' ? glyph : `${set}:${glyph}`;
}

const ICON_FIELDS = {
  set: {
    key: 'iconSet',
    label: L('Icon set', 'مجموعة الأيقونات'),
    schema: z.enum(ICON_SETS),
    read: (node: CustomCodeNode) => {
      const icon = asIcon(node);
      return icon === undefined ? undefined : splitIconName(icon.name).set;
    },
    write: (node: CustomCodeNode, value: unknown) => {
      const icon = asIcon(node);
      if (icon === undefined || typeof value !== 'string') return node;
      const { glyph } = splitIconName(icon.name);
      return { ...icon, name: joinIconName(value as IconSet, glyph) };
    },
  } satisfies CustomCodeElementField,
  name: iconField(
    'name',
    L('Icon', 'الأيقونة'),
    z.string().min(1).max(64).regex(CUSTOM_CODE_ICON_NAME),
    nonBlankString,
  ),
  size: iconField('size', L('Size', 'الحجم'), z.number().int().min(8).max(256), finiteNumber),
  strokeWidth: iconField('strokeWidth', L('Stroke', 'سماكة الخط'), z.number().min(0.5).max(4), finiteNumber),
  label: iconField('label', L('Accessible label', 'الوصف للقارئ الآلي'), z.string().max(120), nonBlankString),
} as const;

const A = {
  href: attributeField('href', L('Link to', 'الرابط')),
  target: enumField('target', L('Opens in', 'يفتح في'), ['_self', '_blank']),
  rel: attributeField('rel', L('Relationship', 'العلاقة')),
  src: attributeField('src', L('Source', 'المصدر')),
  alt: attributeField('alt', L('Alternative text', 'النص البديل')),
  loading: enumField('loading', L('Loading', 'التحميل'), ['lazy', 'eager']),
  decoding: enumField('decoding', L('Decoding', 'فك الترميز'), ['async', 'sync', 'auto']),
  width: attributeField('width', L('Width', 'العرض')),
  height: attributeField('height', L('Height', 'الارتفاع')),
  srcset: attributeField('srcset', L('Sources (srcset)', 'المصادر')),
  sizes: attributeField('sizes', L('Sizes', 'الأحجام')),
  fetchpriority: enumField('fetchpriority', L('Priority', 'الأولوية'), ['high', 'low', 'auto']),
  poster: attributeField('poster', L('Poster image', 'صورة الغلاف')),
  autoplay: flagsField('autoplay', ['autoplay', 'muted', 'playsinline'], L('Autoplay (muted, inline)', 'تشغيل تلقائي (بلا صوت)')),
  loop: flagField('loop', L('Loop', 'تكرار')),
  controls: flagField('controls', L('Controls', 'أزرار التحكم')),
  preload: enumField('preload', L('Preload', 'التحميل المسبق'), ['none', 'metadata', 'auto']),
  embed: attributeField('src', L('Embed URL (YouTube, Vimeo, Maps, Spotify)', 'رابط التضمين')),
  title: attributeField('title', L('Title', 'العنوان')),
  popovertarget: attributeField('popovertarget', L('Opens (popover id)', 'يفتح (معرّف النافذة)')),
  popovertargetaction: enumField('popovertargetaction', L('Popover action', 'إجراء النافذة'), ['toggle', 'show', 'hide']),
  ariaLabel: attributeField('aria-label', L('Accessible label', 'الوصف للقارئ الآلي')),
  type: enumField('type', L('Button type', 'نوع الزر'), ['button', 'submit', 'reset']),
  open: flagField('open', L('Open', 'مفتوح')),
  name: attributeField('name', L('Name', 'الاسم')),
  scope: enumField('scope', L('Header scope', 'نطاق الترويسة'), ['col', 'row', 'colgroup', 'rowgroup']),
  colspan: numberAttributeField('colspan', L('Column span', 'امتداد الأعمدة'), 1, 1000),
  rowspan: numberAttributeField('rowspan', L('Row span', 'امتداد الصفوف'), 1, 65534),
  datetime: attributeField('datetime', L('Machine-readable date', 'التاريخ المقروء آليًا')),
  placeholder: attributeField('placeholder', L('Placeholder', 'نص إرشادي')),
  required: flagField('required', L('Required', 'إلزامي')),
  autocomplete: enumField(
    'autocomplete',
    L('Autocomplete', 'الإكمال التلقائي'),
    CUSTOM_CODE_AUTOCOMPLETE_TOKENS,
  ),
  inputmode: enumField('inputmode', L('Keyboard', 'لوحة المفاتيح'), [
    'text', 'numeric', 'decimal', 'tel', 'email', 'url', 'search', 'none',
  ]),
  min: attributeField('min', L('Minimum', 'الحد الأدنى')),
  max: attributeField('max', L('Maximum', 'الحد الأقصى')),
  step: attributeField('step', L('Step', 'الخطوة')),
  rows: numberAttributeField('rows', L('Rows', 'الأسطر'), 1, 100),
  for: attributeField('for', L('Labels the field (id)', 'يصف الحقل (المعرّف)')),
} as const;

function contentFields(element: CustomCodeElement): CustomCodeElementField[] {
  const fields: CustomCodeElementField[] = [];
  const hasChildren = (element.children ?? []).length > 0;
  if (TEXT_TAGS.has(element.tag) && !VOID_TAGS.has(element.tag) && (!hasChildren || element.text !== undefined)) {
    fields.push(textField);
  }
  switch (element.tag) {
    case 'a':
      fields.push(A.href, A.target, A.rel);
      break;
    case 'img':
      fields.push(A.src, A.alt, A.loading, A.decoding, A.width, A.height, A.srcset, A.sizes, A.fetchpriority);
      break;
    case 'video':
      fields.push(A.src, A.poster, A.autoplay, A.loop, A.controls, A.preload);
      break;
    case 'iframe':
      fields.push(A.embed, A.title);
      break;
    case 'button':
      fields.push(A.popovertarget, A.popovertargetaction, A.ariaLabel, A.type);
      break;
    case 'details':
      fields.push(A.open, A.name);
      break;
    case 'th':
    case 'td':
      fields.push(A.scope, A.colspan, A.rowspan);
      break;
    case 'time':
      fields.push(A.datetime);
      break;
    case 'label':
      fields.push(A.for);
      break;
    default:
      break;
  }
  if (FORM_CONTROLS.has(element.tag)) {
    fields.push(A.name, A.placeholder, A.required, A.autocomplete, A.inputmode, A.min, A.max, A.step);
    if (element.tag === 'textarea') fields.push(A.rows);
  }
  return fields;
}

/**
 * The Content tab for one authored node: its traits by tag. An icon gets its
 * set, a searchable name, size, stroke and accessible label. A component
 * reference gets nothing here: its rows come from the referenced block's own
 * schema (the element panel resolves that).
 */
export function customCodeElementSections(node: CustomCodeNode): readonly CustomCodeElementSection[] {
  switch (node.kind) {
    case 'element': {
      const fields = contentFields(node);
      return fields.length === 0 ? [] : [{ name: L('Content', 'المحتوى'), fields }];
    }
    case 'icon':
      return [
        {
          name: L('Icon', 'الأيقونة'),
          fields: [ICON_FIELDS.set, ICON_FIELDS.name, ICON_FIELDS.size, ICON_FIELDS.strokeWidth, ICON_FIELDS.label],
        },
      ];
    case 'component':
      return [];
  }
}

/** The attributes the Advanced group edits (DESIGN §A.4 Advanced). */
export const ADVANCED_ATTRIBUTE_FIELDS: readonly CustomCodeElementField[] = [
  attributeField('id', L('Id', 'المعرّف')),
  attributeField('role', L('Role', 'الدور')),
  attributeField('aria-label', L('Accessible label', 'الوصف للقارئ الآلي')),
  attributeField('aria-labelledby', L('Labelled by (id)', 'موصوف بـ (معرّف)')),
  attributeField('aria-describedby', L('Described by (id)', 'مشروح بـ (معرّف)')),
  enumField('aria-hidden', L('Hidden from screen readers', 'مخفي عن القارئ الآلي'), ['true', 'false']),
  enumField('aria-live', L('Live region', 'منطقة حيّة'), ['off', 'polite', 'assertive']),
  attributeField('lang', L('Language', 'اللغة')),
  enumField('tabindex', L('Keyboard focus (tabindex)', 'التركيز بلوحة المفاتيح'), ['0', '-1']),
  attributeField('title', L('Tooltip', 'تلميح')),
];
