import type { BuilderKernel, GroupStep } from '@craftkit/builder-core';
import {
  applyStyleIntents,
  readStyle,
  STYLE_PROPERTIES,
  type CustomCodeNode,
  type ResolvedStyle,
  type StyleBoxSide,
  type StyleBucket,
  type StyleCorner,
  type StyleElementKind,
  type StyleIntent,
  type StylePropertyId,
  type StyleSectorId,
  type StyleState,
  type StyleValue,
} from '@craftkit/builder-schema';

import {
  ELEMENT_NAME_WORDS_EN,
  resolveElementTarget,
  tryDispatchTreeEdits,
  type ElementNameWords,
  type ElementTarget,
  type ResolvedTreeTarget,
} from '../../custom-code/element-target';
import type { ValueOrigin } from '../../style-manager/controls/ValueSourceDot';

/*
  ── What the quick bar reads and writes (style-manager DESIGN.md §A.6, §A.8) ─

  The bar never touches the kernel itself. This model is its whole world: the
  values each control shows (read from document truth through the P1 engine,
  with provenance and Mixed for a multi-selection) and the three ways it
  writes — style intents, attributes, and an icon's own fields — each as ONE
  labelled transaction over every target ("Font size · Heading 'Our story'").
*/

/** The quick-bar kinds of §A.6, plus `component` (a registered block in a tree: actions only). */
export type QuickElementKind = StyleElementKind | 'component';

export interface QuickValue {
  readonly value: StyleValue | undefined;
  readonly origin: ValueOrigin;
  /** Several targets disagree. */
  readonly mixed: boolean;
}

export type QuickWriteResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

export interface ElementBarModel {
  readonly kind: QuickElementKind;
  /** The primary element's display name, for labels and announcements. */
  readonly name: string;
  readonly targetCount: number;
  /** The PAGE direction (where inline-start is drawn). */
  readonly pageDir: 'ltr' | 'rtl';
  readonly bucket: StyleBucket;
  readonly state: StyleState;
  /** The primary element as stored. */
  readonly node: CustomCodeNode;
  read(property: StylePropertyId): QuickValue;
  readSide(property: StylePropertyId, side: StyleBoxSide | StyleCorner): QuickValue;
  /** The primary element's attribute, as stored. */
  attribute(name: string): string | undefined;
  /** One intent list, applied to every target at the model's bucket and state. */
  apply(
    intents: readonly Omit<StyleIntent, 'bucket' | 'state'>[],
    propertyLabel: string,
  ): QuickWriteResult;
  setAttributes(attributes: Readonly<Record<string, string | null>>, propertyLabel: string): QuickWriteResult;
  /** A class edit the engine does not model (named-style markers), on every target. */
  editClasses(transform: (className: string) => string, propertyLabel: string): QuickWriteResult;
  /** Icon fields (name, size) on every icon target. */
  setIcon(patch: { readonly name?: string; readonly size?: number | null }, propertyLabel: string): QuickWriteResult;
}

const TEXT_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'span',
  'li',
  'blockquote',
  'label',
  'strong',
  'em',
  'small',
  'q',
  'figcaption',
  'code',
  'mark',
  'u',
  'b',
  'i',
  'time',
  'cite',
  'dt',
  'dd',
  'th',
  'td',
  'caption',
  'legend',
  'summary',
]);

const MEDIA_TAGS = new Set(['img', 'video', 'picture', 'iframe', 'audio']);
const LINK_TAGS = new Set(['a', 'button']);

/** Which quick bar an element gets (§A.6). */
export function quickElementKind(node: CustomCodeNode): QuickElementKind {
  if (node.kind === 'icon') return 'icon';
  if (node.kind === 'component') return 'component';
  if (MEDIA_TAGS.has(node.tag)) return 'media';
  if (LINK_TAGS.has(node.tag)) return 'link';
  if (TEXT_TAGS.has(node.tag)) return 'text';
  return 'container';
}

/** The panel sector "More" opens when no group was opened first. */
export function defaultSectorFor(kind: QuickElementKind): StyleSectorId {
  switch (kind) {
    case 'container':
      return 'layout';
    case 'media':
      return 'size';
    case 'component':
      return 'advanced';
    default:
      return 'typography';
  }
}

function classNameOf(node: CustomCodeNode): string {
  return node.kind === 'component' ? '' : (node.className ?? '');
}

function originOf(resolved: ResolvedStyle | undefined): ValueOrigin {
  return resolved === undefined ? 'unset' : resolved.source;
}

function valueKey(value: StyleValue | undefined): string {
  return value === undefined ? '' : JSON.stringify(value);
}

function sideOf(resolved: ResolvedStyle | undefined, side: StyleBoxSide | StyleCorner): ResolvedStyle | undefined {
  if (resolved === undefined) return undefined;
  if (resolved.sides === undefined) return resolved;
  return resolved.sides[side];
}

export interface ElementBarModelOptions {
  readonly bucket: StyleBucket;
  readonly state: StyleState;
  readonly pageDir: 'ltr' | 'rtl';
  readonly words?: ElementNameWords | undefined;
  /** Named-style utilities by id, so values from a `ck-s-*` marker show their source. */
  readonly namedStyles?: Readonly<Record<string, string>> | undefined;
}

/**
 * Build the model for the current element targets (primary first). Block
 * targets are ignored — a registered block has its own panel. `undefined`
 * when no tree target is live.
 */
export function createElementBarModel(
  kernel: BuilderKernel,
  targets: readonly ElementTarget[],
  options: ElementBarModelOptions,
): ElementBarModel | undefined {
  const words = options.words ?? ELEMENT_NAME_WORDS_EN;
  const resolved: ResolvedTreeTarget[] = [];
  for (const target of targets) {
    if (target.kind !== 'tree') continue;
    const found = resolveElementTarget(kernel, target, words);
    if (found?.kind === 'tree') resolved.push(found);
  }
  const primary = resolved[0];
  if (primary === undefined) return undefined;
  const at = { bucket: options.bucket, state: options.state };
  const readOptions = options.namedStyles === undefined ? undefined : { namedStyles: options.namedStyles };
  const readings = resolved.map((entry) => readStyle(classNameOf(entry.node), at, readOptions));
  const subject =
    resolved.length === 1 ? primary.displayName : `${String(resolved.length)} elements`;

  const write = (steps: readonly GroupStep[], propertyLabel: string): QuickWriteResult => {
    if (steps.length === 0) return { ok: true };
    const result = tryDispatchTreeEdits(kernel, steps, `${propertyLabel} · ${subject}`);
    return result.ok ? { ok: true } : { ok: false, message: result.message };
  };

  const quick = (pick: (reading: ReadonlyMap<StylePropertyId, ResolvedStyle>) => ResolvedStyle | undefined): QuickValue => {
    const first = readings[0] === undefined ? undefined : pick(readings[0]);
    const key = valueKey(first?.value);
    const mixed = readings.some((reading) => valueKey(pick(reading)?.value) !== key);
    return { value: mixed ? undefined : first?.value, origin: originOf(first), mixed };
  };

  return {
    kind: quickElementKind(primary.node),
    name: primary.displayName,
    targetCount: resolved.length,
    pageDir: options.pageDir,
    bucket: options.bucket,
    state: options.state,
    node: primary.node,
    read: (property) => quick((reading) => reading.get(property)),
    readSide: (property, side) => quick((reading) => sideOf(reading.get(property), side)),
    attribute: (name) => {
      const node = primary.node;
      if (node.kind !== 'element') return undefined;
      return (node.attributes as Record<string, string | undefined> | undefined)?.[name];
    },
    apply: (intents, propertyLabel) => {
      const steps: GroupStep[] = [];
      for (const entry of resolved) {
        if (entry.node.kind === 'component') continue;
        const next = applyStyleIntents(
          classNameOf(entry.node),
          intents.map((intent) => ({ ...intent, bucket: options.bucket, state: options.state })),
          { mode: 'free' },
        );
        if (!next.ok) return { ok: false, message: next.message };
        if (next.className === classNameOf(entry.node)) continue;
        steps.push({
          command: 'patchTreeNode',
          args: {
            id: entry.target.nodeId,
            path: [...entry.target.path],
            set: { className: next.className === '' ? null : next.className },
          },
        });
      }
      return write(steps, propertyLabel);
    },
    setAttributes: (attributes, propertyLabel) =>
      write(
        resolved
          .filter((entry) => entry.node.kind === 'element')
          .map((entry) => ({
            command: 'patchTreeNode',
            args: { id: entry.target.nodeId, path: [...entry.target.path], attributes: { ...attributes } },
          })),
        propertyLabel,
      ),
    editClasses: (transform, propertyLabel) =>
      write(
        resolved.flatMap((entry) => {
          if (entry.node.kind === 'component') return [];
          const before = classNameOf(entry.node);
          const after = transform(before).replace(/\s+/gu, ' ').trim();
          if (after === before) return [];
          return [
            {
              command: 'patchTreeNode',
              args: {
                id: entry.target.nodeId,
                path: [...entry.target.path],
                set: { className: after === '' ? null : after },
              },
            },
          ];
        }),
        propertyLabel,
      ),
    setIcon: (patch, propertyLabel) =>
      write(
        resolved.flatMap((entry) => {
          if (entry.node.kind !== 'icon') return [];
          const next: Record<string, unknown> = { ...entry.node };
          if (patch.name !== undefined) next['name'] = patch.name;
          if (patch.size === null) delete next['size'];
          else if (patch.size !== undefined) next['size'] = patch.size;
          return [
            {
              command: 'setTreeNode',
              args: { id: entry.target.nodeId, path: [...entry.target.path], node: next },
            },
          ];
        }),
        propertyLabel,
      ),
  };
}

/** The label a person reads for a catalogue property, in the bar's language. */
export function propertyLabel(property: StylePropertyId, locale: 'en' | 'ar'): string {
  return STYLE_PROPERTIES[property].labels[locale];
}
