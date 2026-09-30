import { CUSTOM_CODE_ATTRIBUTES, isLucideIconName, safeCustomCodeUrl } from '@craftkit/builder-schema';

import { selectCatalogPhotos } from '../context/providers/photo-catalog';
import {
  HEADING_MARKER,
  captureString,
  compileKitMarkup,
  fillNodes,
  hasPlaceholder,
  isPresent,
  type FilledElement,
  type FilledNode,
  type TemplateNode,
} from './template';
import { COLUMN_IMAGE_SIZES, HERO_IMAGE_SIZES, srcsetFor } from './srcset';
import type { SectionKit, SectionKitSlot } from './types';

/**
 * A kit filled with slot values: the customCode tree, its region css and the
 * region label — or a refusal that says how to fix the call, because it is
 * the one repair round's only instruction (DESIGN §0).
 *
 * The rules (DESIGN §B):
 * - values are written as text and attribute values, never parsed as markup;
 * - a list repeats its template up to the slot's `max`; a text is cut at a
 *   word to its `max`;
 * - an optional block whose slot is empty is dropped;
 * - the outer element gets the anchor `id`, the marker class `ck-kit-<id>`
 *   (how `kit.swap` finds the kit again) and `aria-labelledby` naming the
 *   heading, whose level is `h1` only when asked for (the page's one h1);
 * - every image needs alt text and gets width and height from its aspect
 *   class; only a hero's FIRST image loads eagerly with a high fetch priority,
 *   every other one lazily.
 */

export interface InstantiateKitOptions {
  /** The section's anchor id (its `id` attribute; nav links point at it). */
  readonly id: string;
  /** The heading level; 'h1' only for the page's one h1. */
  readonly heading: 'h1' | 'h2';
  readonly locale: { readonly lang: string; readonly dir: 'rtl' | 'ltr' };
}

export interface KitTree {
  readonly kind: 'root';
  readonly children: FilledNode[];
}

export type InstantiateKitResult =
  | { readonly ok: true; readonly tree: KitTree; readonly css: string; readonly label: string }
  | { readonly ok: false; readonly error: string };

/** The class that marks a region as built from a kit: `ck-kit-<kit id>`. */
export const KIT_MARKER_PREFIX = 'ck-kit-';

/** Arrows and chevrons mirror on a right-to-left page (Meraki's `rtl:-scale-x-100`). */
export const KIT_FLIP_CLASS = 'ck-flip';
const FLIP_CSS = `.${KIT_FLIP_CLASS}:dir(rtl){transform:scaleX(-1)}`;

const ANCHOR_ID = /^[A-Za-z؀-ۿ][\w؀-ۿ-]{0,79}$/u;
const LABEL_MAX = 80;
const DEFAULT_TEXT_MAX = 600;
const DEFAULT_LIST_MAX = 12;
/** Control characters other than tab and newline: never part of what a person wrote. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Cut to `max` characters at a word, with an ellipsis. */
export function clampText(text: string, max: number): string {
  // Code points, not UTF-16 units: an Arabic or emoji character is never cut in half.
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const head = chars.slice(0, max - 1).join('');
  const space = head.lastIndexOf(' ');
  const cut = space >= head.length - 30 && space > 0 ? head.slice(0, space) : head;
  return `${cut.trimEnd()}…`;
}

function cleanText(value: string): string {
  return value.replace(CONTROL, '').trim();
}

const SAFE_HREF = /^(?:#[^\s'"<>]{1,120}|\/[^\s'"<>]{0,300}|https:\/\/[^\s'"<>]{1,500}|mailto:[^\s'"<>]{3,200}|tel:\+?[\d\s().-]{3,40})$/u;

// ── Slot values ───────────────────────────────────────────────────────────────

type SlotCheck =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: string };

interface CheckContext {
  readonly kit: SectionKit;
  readonly lang: string;
  /** Catalog photos already used by this instantiation, so a gallery never repeats one. */
  readonly usedPhotos: Set<string>;
}

function slotShape(slot: SectionKitSlot): string {
  switch (slot.kind) {
    case 'text':
      return '"…"';
    case 'link':
      return '{"label":"…","href":"#section-id"}';
    case 'image':
      return '{"src":"https://…","alt":"…"} or {"subject":"coffee","alt":"…"}';
    case 'icon':
      return 'a Lucide name such as "coffee"';
    case 'list': {
      const fields = Object.keys(slot.item ?? {});
      return `[{${fields.map((field) => `"${field}":…`).join(',')}}]`;
    }
  }
}

function checkImage(where: string, value: unknown, context: CheckContext): SlotCheck {
  if (!isRecord(value)) {
    return { ok: false, error: `slot "${where}" is an image: ${slotShape({ kind: 'image' })}.` };
  }
  let src = typeof value['src'] === 'string' ? value['src'].trim() : '';
  let alt = typeof value['alt'] === 'string' ? cleanText(value['alt']) : '';
  if (src === '' && typeof value['subject'] === 'string' && value['subject'].trim() !== '') {
    const photo = selectCatalogPhotos(value['subject'], {
      exclude: (entry) => context.usedPhotos.has(entry.url),
    })[0];
    if (photo === undefined) {
      return {
        ok: false,
        error: `slot "${where}": no catalog photo matches subject "${value['subject']}"; name a plainer subject (coffee, bakery, clinic, office, team) or give "src" from PHOTOS YOU MAY USE.`,
      };
    }
    src = photo.url;
    if (alt === '') alt = context.lang.startsWith('ar') ? photo.alt.ar : photo.alt.en;
  }
  if (src === '') {
    return { ok: false, error: `slot "${where}" needs "src" (an https photo address) or "subject".` };
  }
  if (!src.startsWith('https://') || safeCustomCodeUrl(src) === undefined) {
    return { ok: false, error: `slot "${where}": "src" must be an https:// address.` };
  }
  if (alt === '') {
    return {
      ok: false,
      error: `slot "${where}" needs "alt": say what the photo shows, in the page's language.`,
    };
  }
  context.usedPhotos.add(src);
  return { ok: true, value: { src, alt: clampText(alt, 180) } };
}

function checkSlot(where: string, slot: SectionKitSlot, value: unknown, context: CheckContext): SlotCheck {
  switch (slot.kind) {
    case 'text': {
      if (typeof value !== 'string' && typeof value !== 'number') {
        return { ok: false, error: `slot "${where}" is text: a string.` };
      }
      return { ok: true, value: clampText(cleanText(String(value)), slot.max ?? DEFAULT_TEXT_MAX) };
    }
    case 'icon': {
      if (typeof value !== 'string' || !isLucideIconName(value.trim())) {
        return {
          ok: false,
          error: `slot "${where}": ${JSON.stringify(value)} is not a Lucide icon; use a kebab-case name from lucide.dev such as "coffee", "star", "check" or "map-pin".`,
        };
      }
      return { ok: true, value: value.trim() };
    }
    case 'link': {
      if (!isRecord(value)) {
        return { ok: false, error: `slot "${where}" is a link: ${slotShape(slot)}.` };
      }
      const label = typeof value['label'] === 'string' ? cleanText(value['label']) : '';
      const href = typeof value['href'] === 'string' ? value['href'].trim() : '';
      if (label === '') return { ok: false, error: `slot "${where}" needs "label": the words on the link.` };
      if (!SAFE_HREF.test(href)) {
        return {
          ok: false,
          error: `slot "${where}": "href" must be "#section-id", "/path", "https://…", "mailto:…" or "tel:…" (got ${JSON.stringify(value['href'] ?? '')}).`,
        };
      }
      return { ok: true, value: { label: clampText(label, slot.max ?? 60), href } };
    }
    case 'image':
      return checkImage(where, value, context);
    case 'list': {
      if (!Array.isArray(value)) {
        return { ok: false, error: `slot "${where}" is a list: ${slotShape(slot)}.` };
      }
      const fields = slot.item ?? {};
      const names = Object.keys(fields);
      const items: Record<string, unknown>[] = [];
      for (const [index, raw] of (value as unknown[]).slice(0, slot.max ?? DEFAULT_LIST_MAX).entries()) {
        // A one-field item may be written as the bare value: "features":["…","…"].
        const record = isRecord(raw) ? raw : names.length === 1 ? { [names[0] ?? '']: raw } : undefined;
        if (record === undefined) {
          return { ok: false, error: `slot "${where}[${String(index)}]" is an item: ${slotShape(slot).slice(1, -1)}.` };
        }
        const checked = checkRecord(`${where}[${String(index)}].`, fields, record, context);
        if (!checked.ok) return checked;
        items.push(checked.value as Record<string, unknown>);
      }
      if (slot.required === true && items.length === 0) {
        return { ok: false, error: `slot "${where}" needs at least one item: ${slotShape(slot)}.` };
      }
      return { ok: true, value: items };
    }
  }
}

function checkRecord(
  prefix: string,
  slots: Readonly<Record<string, SectionKitSlot>>,
  values: Readonly<Record<string, unknown>>,
  context: CheckContext,
): SlotCheck {
  const out: Record<string, unknown> = {};
  for (const [name, slot] of Object.entries(slots)) {
    const value = values[name];
    if (!isPresent(value)) {
      if (slot.required === true) {
        return {
          ok: false,
          error: `kit "${context.kit.id}" needs slot "${prefix}${name}": ${slotShape(slot)}.`,
        };
      }
      continue;
    }
    const checked = checkSlot(`${prefix}${name}`, slot, value, context);
    if (!checked.ok) return checked;
    // A text field named href is an address: the same policy as a link slot's.
    if (name === 'href' && slot.kind === 'text' && !SAFE_HREF.test(String(checked.value))) {
      return {
        ok: false,
        error: `slot "${prefix}${name}" must be "#section-id", "/path", "https://…", "mailto:…" or "tel:…".`,
      };
    }
    out[name] = checked.value;
  }
  return { ok: true, value: out };
}

/**
 * The slot values a kit takes, checked and normalised: text cut to `max`,
 * lists to `max` items, images resolved (a `subject` becomes a catalog photo)
 * and links checked. Unknown slot names are ignored.
 */
export function checkKitSlots(
  kit: SectionKit,
  slots: unknown,
  lang = 'en',
): { readonly ok: true; readonly slots: Record<string, unknown> } | { readonly ok: false; readonly error: string } {
  if (!isRecord(slots)) {
    return { ok: false, error: `"slots" must be an object with ${Object.keys(kit.slots).join(', ')}.` };
  }
  const checked = checkRecord('', kit.slots, slots, { kit, lang, usedPhotos: new Set() });
  return checked.ok ? { ok: true, slots: checked.value as Record<string, unknown> } : checked;
}

// ── Images ────────────────────────────────────────────────────────────────────

const ASPECTS: Readonly<Record<string, readonly [number, number]>> = {
  square: [1, 1],
  video: [16, 9],
};

/** Intrinsic width and height from the first unprefixed aspect class (1200 wide), or 4:3. */
export function imageSize(className: string | undefined): { width: number; height: number } {
  const aspect = (className ?? '')
    .split(/\s+/u)
    .find((name) => name.startsWith('aspect-'))
    ?.slice('aspect-'.length);
  const known = aspect === undefined ? undefined : ASPECTS[aspect];
  const ratio = /^(\d+)\/(\d+)$/u.exec(aspect ?? '');
  const [w, h] = known ?? (ratio === null ? [4, 3] : [Number(ratio[1]), Number(ratio[2])]);
  const width = 1200;
  return { width, height: Math.round((width * h) / w) };
}

const FETCHPRIORITY = (CUSTOM_CODE_ATTRIBUTES as readonly string[]).includes('fetchpriority');

function finishImages(nodes: readonly FilledNode[], hero: boolean): void {
  let first = true;
  const visit = (node: FilledNode): void => {
    if (node.kind !== 'element') {
      if (node.kind === 'component') node.children?.forEach(visit);
      return;
    }
    if (node.tag === 'img') {
      const attributes = { ...node.attributes };
      const size = imageSize(node.className);
      attributes['width'] ??= String(size.width);
      attributes['height'] ??= String(size.height);
      if (hero && first) {
        attributes['loading'] = 'eager';
        if (FETCHPRIORITY) attributes['fetchpriority'] = 'high';
      } else {
        attributes['loading'] = 'lazy';
        delete attributes['fetchpriority'];
      }
      attributes['decoding'] = 'async';
      const srcset = typeof attributes['src'] === 'string' ? srcsetFor(attributes['src']) : undefined;
      if (srcset !== undefined && attributes['srcset'] === undefined) {
        attributes['srcset'] = srcset;
        attributes['sizes'] = hero && first ? HERO_IMAGE_SIZES : COLUMN_IMAGE_SIZES;
      }
      node.attributes = attributes;
      first = false;
    }
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
}

const EASTERN_DIGITS = /[٠-٩۰-۹]/gu;
const FIRST_NUMBER = /\d[\d,]*(?:\.\d+)?/u;

/** The number a stat shows ('+1,200', '٩٨٪', '4.9'), as `data-ck-to` wants it; undefined when it shows none. */
function statTarget(text: string): string | undefined {
  const western = text.replace(EASTERN_DIGITS, (digit) => String((digit.codePointAt(0) ?? 0) % 16)).replace(/[٬]/gu, ',').replace(/[٫]/gu, '.');
  const match = FIRST_NUMBER.exec(western)?.[0]?.replaceAll(',', '');
  return match === undefined || !Number.isFinite(Number(match)) ? undefined : match;
}

/**
 * A kit's `count-up` element counts to the number its own text shows: the
 * value slot is copy ('+500', '٩٨٪'), so the target is read from it here, and
 * a value with no number ('24/7' still counts to 24; 'Free' does not) drops
 * the behaviour instead of counting to nothing.
 */
function finishBehaviors(nodes: readonly FilledNode[]): void {
  const visit = (node: FilledNode): void => {
    if (node.kind === 'icon') return;
    if (node.kind === 'element' && node.attributes?.['data-ck-behavior'] === 'count-up' && node.attributes['data-ck-to'] === undefined) {
      const target = statTarget(node.text ?? '');
      const attributes = { ...node.attributes };
      if (target === undefined) delete attributes['data-ck-behavior'];
      else attributes['data-ck-to'] = target;
      node.attributes = attributes;
    }
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
}

// ── Heading and outer element ─────────────────────────────────────────────────

function findHeading(nodes: readonly FilledNode[]): FilledElement | undefined {
  for (const node of nodes) {
    if (node.kind === 'icon') continue;
    if (node.kind === 'element' && node.attributes !== undefined && HEADING_MARKER in node.attributes) {
      return node;
    }
    const inner = findHeading(node.children ?? []);
    if (inner !== undefined) return inner;
  }
  return undefined;
}

function usesClass(nodes: readonly FilledNode[], name: string): boolean {
  return nodes.some((node) => {
    if (node.kind === 'component') return usesClass(node.children ?? [], name);
    if ((node.className ?? '').split(/\s+/u).includes(name)) return true;
    return node.kind === 'element' && usesClass(node.children ?? [], name);
  });
}

function headingText(node: FilledElement | undefined): string {
  if (node === undefined) return '';
  return [node.text ?? '', ...(node.children ?? []).map((child) => (child.kind === 'element' ? headingText(child) : ''))]
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Fills a kit. See the module comment for the rules. */
export function instantiateKit(
  kit: SectionKit,
  slots: unknown,
  options: InstantiateKitOptions,
): InstantiateKitResult {
  if (!ANCHOR_ID.test(options.id)) {
    return {
      ok: false,
      error: `section id "${options.id}" must start with a letter and hold only letters, digits, - and _ (at most 80).`,
    };
  }
  const checked = checkKitSlots(kit, slots, options.locale.lang);
  if (!checked.ok) return checked;

  let template: readonly TemplateNode[];
  try {
    template = compileKitMarkup(kit.markup);
  } catch (cause) {
    return { ok: false, error: `kit "${kit.id}" has a broken template: ${String(cause)}` };
  }
  const children = fillNodes(template, { root: checked.slots, items: [] });
  const outer = children[0];
  if (outer?.kind !== 'element' || children.length !== 1) {
    return { ok: false, error: `kit "${kit.id}" must fill exactly one outer element.` };
  }

  const heading = findHeading(children);
  if (heading !== undefined) {
    const attributes = { ...heading.attributes };
    delete attributes[HEADING_MARKER];
    attributes['id'] = `${options.id}-title`;
    heading.attributes = attributes;
    if (options.heading === 'h1') heading.tag = 'h1';
    else if (heading.tag === 'h1') heading.tag = 'h2';
  }
  outer.className = [outer.className ?? '', `${KIT_MARKER_PREFIX}${kit.id}`].join(' ').trim();
  outer.attributes = {
    ...outer.attributes,
    id: options.id,
    ...(heading === undefined ? {} : { 'aria-labelledby': `${options.id}-title` }),
  };
  finishImages(children, kit.role === 'hero');
  finishBehaviors(children);

  const css = [kit.css ?? '', usesClass(children, KIT_FLIP_CLASS) ? FLIP_CSS : '']
    .filter((part) => part !== '')
    .join('\n');
  const title = headingText(heading);
  const label = clampText(title === '' ? kit.summary : title, LABEL_MAX);
  return { ok: true, tree: { kind: 'root', children }, css, label };
}

// ── Reading a filled tree back ────────────────────────────────────────────────

type Frame = Record<string, unknown>;

interface ReadScope {
  readonly root: Frame;
  readonly items: readonly Frame[];
}

function setPath(scope: ReadScope, path: string, value: string): void {
  const segments = path.split('.');
  let target: Frame;
  if (segments[0] === 'item') {
    const item = scope.items[scope.items.length - 1];
    if (item === undefined) return;
    target = item;
    segments.shift();
  } else {
    target = scope.root;
  }
  const last = segments.pop();
  if (last === undefined) return;
  for (const segment of segments) {
    const next = target[segment];
    if (isRecord(next)) target = next;
    else {
      const created: Frame = {};
      target[segment] = created;
      target = created;
    }
  }
  target[last] = value;
}

/** The slot definition a template path names, given the list slots entered on the way down. */
function slotAt(
  path: string,
  kit: SectionKit,
  items: readonly Readonly<Record<string, SectionKitSlot>>[],
): SectionKitSlot | undefined {
  const segments = path.split('.');
  let fields: Readonly<Record<string, SectionKitSlot>> | undefined = kit.slots;
  if (segments[0] === 'item') {
    fields = items[items.length - 1];
    segments.shift();
  }
  const first = segments[0];
  return first === undefined || fields === undefined ? undefined : fields[first];
}

function classesWithoutMarker(value: unknown): string {
  return typeof value === 'string'
    ? value
        .split(/\s+/u)
        .filter((name) => name !== '' && !name.startsWith(KIT_MARKER_PREFIX))
        .join(' ')
    : '';
}

const HEADINGS = new Set(['h1', 'h2', 'h3']);

interface ReadContext {
  readonly kit: SectionKit;
  readonly fields: readonly Readonly<Record<string, SectionKitSlot>>[];
}

function cloneScope(scope: ReadScope): ReadScope {
  const clone = (frame: Frame): Frame => JSON.parse(JSON.stringify(frame)) as Frame;
  return { root: clone(scope.root), items: scope.items.map(clone) };
}

function adopt(into: ReadScope, from: ReadScope): void {
  for (const key of Object.keys(into.root)) delete into.root[key];
  Object.assign(into.root, from.root);
  into.items.forEach((item, index) => {
    for (const key of Object.keys(item)) delete item[key];
    Object.assign(item, from.items[index]);
  });
}

function matchNode(template: TemplateNode, node: unknown, scope: ReadScope, context: ReadContext): boolean {
  if (!isRecord(node) || template.kind === 'each') return false;
  if (template.kind === 'icon') {
    if (node['kind'] !== 'icon' || typeof node['name'] !== 'string') return false;
    if (!hasPlaceholder(template.name)) return true;
    const captured = captureString(template.name, node['name']);
    if (captured === undefined) return false;
    captured.forEach(({ path, value }) => { setPath(scope, path, value); });
    return true;
  }
  if (template.kind === 'component') {
    if (node['kind'] !== 'component' || node['component'] !== template.component) return false;
    return matchChildren(template.children, node['children'], scope, context);
  }
  if (node['kind'] !== 'element' || typeof node['tag'] !== 'string') return false;
  const heading = HEADING_MARKER in template.attributes;
  const sameTag = heading ? HEADINGS.has(node['tag']) : node['tag'] === template.tag;
  if (!sameTag) return false;
  if (classesWithoutMarker(template.className) !== classesWithoutMarker(node['className'])) return false;
  const attributes = isRecord(node['attributes']) ? node['attributes'] : {};
  for (const [name, raw] of Object.entries(template.attributes)) {
    if (!hasPlaceholder(raw)) continue;
    const actual = attributes[name];
    if (typeof actual !== 'string') continue;
    const captured = captureString(raw, actual);
    if (captured === undefined) return false;
    captured.forEach(({ path, value }) => { setPath(scope, path, value); });
  }
  if (template.text !== undefined && hasPlaceholder(template.text)) {
    if (typeof node['text'] === 'string') {
      const captured = captureString(template.text, node['text']);
      if (captured === undefined) return false;
      captured.forEach(({ path, value }) => { setPath(scope, path, value); });
    }
  } else if ((template.text ?? '') !== (typeof node['text'] === 'string' ? node['text'] : '')) {
    return false;
  }
  return matchChildren(template.children, node['children'], scope, context);
}

function matchSequence(
  templates: readonly TemplateNode[],
  nodes: readonly unknown[],
  start: number,
  scope: ReadScope,
  context: ReadContext,
): number | undefined {
  let at = start;
  for (const template of templates) {
    if (template.kind !== 'each') {
      if (at >= nodes.length || !matchNode(template, nodes[at], scope, context)) return undefined;
      at += 1;
      continue;
    }
    const slot = slotAt(template.path, context.kit, context.fields);
    if (slot?.kind === 'list') {
      const list: Frame[] = [];
      const fields = [...context.fields, slot.item ?? {}];
      for (;;) {
        const item: Frame = {};
        const trial = cloneScope(scope);
        const inner: ReadScope = { root: trial.root, items: [...trial.items, item] };
        const next = matchSequence(template.children, nodes, at, inner, { kit: context.kit, fields });
        if (next === undefined || next === at) break;
        adopt(scope, { root: trial.root, items: trial.items });
        list.push(item);
        at = next;
      }
      setList(scope, template.path, list);
      continue;
    }
    // An optional block: present when its elements match here.
    const trial = cloneScope(scope);
    const next = matchSequence(template.children, nodes, at, trial, context);
    if (next !== undefined) {
      adopt(scope, trial);
      at = next;
    }
  }
  return at;
}

function setList(scope: ReadScope, path: string, list: Frame[]): void {
  const segments = path.split('.');
  let target: Frame | undefined = scope.root;
  if (segments[0] === 'item') {
    target = scope.items[scope.items.length - 1];
    segments.shift();
  }
  const last = segments.pop();
  if (target === undefined || last === undefined) return;
  target[last] = list;
}

function matchChildren(
  templates: readonly TemplateNode[],
  children: unknown,
  scope: ReadScope,
  context: ReadContext,
): boolean {
  const nodes = Array.isArray(children) ? children : [];
  return matchSequence(templates, nodes, 0, scope, context) === nodes.length;
}

/**
 * The slot values a tree filled from `kit` holds — walking the template
 * beside the tree — or undefined when the tree no longer has the kit's shape
 * (edited by hand since). Image width, height and loading are not slots: they
 * are recomputed on the next fill.
 */
export function readKitSlots(kit: SectionKit, tree: unknown): Record<string, unknown> | undefined {
  if (!isRecord(tree) || !Array.isArray(tree['children'])) return undefined;
  let template: readonly TemplateNode[];
  try {
    template = compileKitMarkup(kit.markup);
  } catch {
    return undefined;
  }
  const scope: ReadScope = { root: {}, items: [] };
  const ok = matchChildren(template, tree['children'], scope, { kit, fields: [] });
  return ok ? scope.root : undefined;
}

/** The kit id a region's tree carries in its outer element's marker class, if any. */
export function kitIdOfTree(tree: unknown): string | undefined {
  if (!isRecord(tree) || !Array.isArray(tree['children'])) return undefined;
  const outer: unknown = tree['children'][0];
  if (!isRecord(outer) || typeof outer['className'] !== 'string') return undefined;
  const marker = outer['className'].split(/\s+/u).find((name) => name.startsWith(KIT_MARKER_PREFIX));
  return marker?.slice(KIT_MARKER_PREFIX.length);
}

/** Whether a filled element holds the heading an `h1` option made (for kit.swap keeping the level). */
export function treeHasH1(tree: unknown): boolean {
  const walk = (node: unknown): boolean =>
    isRecord(node) &&
    (node['tag'] === 'h1' || (Array.isArray(node['children']) && node['children'].some(walk)));
  return walk(tree);
}
