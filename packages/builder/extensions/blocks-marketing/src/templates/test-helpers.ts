import { z } from 'zod';

import { createBuilder, insertedNodeId, type BuilderKernel } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  defineBlockSchema,
  type BlockRenderComponent,
  type CompositionDef,
  type DeclarativeExtensionManifest,
  type JsonValue,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { blocksMarketing } from '../index';
import { TEMPLATE_PHOTOS } from './photos';
import type { TemplateLang } from './types';

/*
  Shared checks for every template test (templates-core and, later,
  templates-verticals). Test-only: nothing in the package entry imports this.
*/

const ARABIC_LETTERS = /[ء-يٱ-ۓۺ-ۼ]/gu;

/** How many Arabic letters a text holds (digits and punctuation excluded). */
export function arabicLetters(text: string): number {
  return text.match(ARABIC_LETTERS)?.length ?? 0;
}

/** Words an Arabic page may show in Latin script: brand-like product terms. */
export const LATIN_ALLOW_LIST: readonly string[] = ['SaaS', 'API', 'CraftKit'];

const MACHINE_TEXT = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b|https?:\/\/\S+|mailto:\S+|tel:\S+/giu;

/**
 * The Latin words in a text that are not on the allow-list. Email addresses
 * and URLs are machine text and never count.
 */
export function latinWords(
  text: string,
  allowList: readonly string[] = LATIN_ALLOW_LIST,
): string[] {
  const allowed = new Set(allowList.map((word) => word.toLowerCase()));
  const words = text.replace(MACHINE_TEXT, ' ').match(/[A-Za-z][A-Za-z'’-]*/gu) ?? [];
  return words.filter((word) => !allowed.has(word.toLowerCase()));
}

/** Prop keys whose string values are never shown as text. */
const MACHINE_KEYS = new Set([
  'href',
  'src',
  'imageSrc',
  'posterSrc',
  'action',
  'formAction',
  'actionHref',
  'profileHref',
  'autoComplete',
  'dateTime',
  'method',
  'type',
  'id',
  'variant',
  'layout',
  'align',
  'tone',
  'spacing',
  'width',
  'columns',
  'emphasis',
  'size',
  'fit',
  'ratio',
  'radius',
  'direction',
  'gap',
  'wrap',
  'style',
  'density',
  'border',
  'shadow',
  'headerLayout',
  'mediaPosition',
  'mediaAspect',
  'panelStyle',
  'padding',
  'imageRatio',
  'imageFit',
  'captionStyle',
  'aspect',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textCase',
  'textColor',
  'background',
  'controlDensity',
  'controlRadius',
  'buttonVariant',
  'buttonWidth',
  'formLayout',
  'period',
]);

/** A form field's `name` / an option's `value`: identifiers, not copy. */
const IDENTIFIER = /^[a-z][a-z0-9_-]*$/u;

export interface CollectedString {
  readonly nodeId: string;
  readonly path: string;
  readonly value: string;
}

function walk(
  value: JsonValue,
  path: string,
  key: string,
  out: (path: string, text: string) => void,
) {
  if (typeof value === 'string') {
    if (MACHINE_KEYS.has(key)) return;
    if ((key === 'name' || key === 'value') && IDENTIFIER.test(value)) return;
    out(path, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walk(item, `${path}[${String(index)}]`, key, out);
    });
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) {
      walk(child, path === '' ? childKey : `${path}.${childKey}`, childKey, out);
    }
  }
}

/** Every human-readable string a composition renders, with where it lives. */
export function collectStrings(composition: CompositionDef): CollectedString[] {
  const strings: CollectedString[] = [];
  for (const node of Object.values(composition.nodes)) {
    walk(node.props, '', '', (path, value) => {
      strings.push({ nodeId: node.id, path, value });
    });
  }
  return strings;
}

/** Every image address a composition uses (image blocks, cards, banners). */
export function collectImageSrcs(composition: CompositionDef): string[] {
  const out: string[] = [];
  const visit = (value: JsonValue, key: string) => {
    if (typeof value === 'string') {
      if ((key === 'src' || key === 'imageSrc' || key === 'posterSrc') && value !== '')
        out.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, key);
      return;
    }
    if (value !== null && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
    }
  };
  for (const node of Object.values(composition.nodes)) visit(node.props, '');
  return out;
}

/** Every verified template photo address. */
export function templatePhotoSrcs(): Set<string> {
  return new Set(Object.values(TEMPLATE_PHOTOS).flatMap((list) => list.map((entry) => entry.src)));
}

/** The children of a composition's root column, in order, as node types. */
export function sectionTypes(composition: CompositionDef): string[] {
  const root = composition.nodes[composition.rootId];
  return (root?.slots?.['default'] ?? []).map((id) => composition.nodes[id]?.type ?? '?');
}

const NullRender: BlockRenderComponent = () => null;

/** A bare page root that accepts the template's root column. */
const templateHost: TrustedExtensionManifest = {
  tier: 1,
  name: 'template-test-host',
  version: '1.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'Template test page.',
          props: z.object({}),
          slots: { default: { allow: ['stack'] } },
          examples: [],
        }),
        render: NullRender,
      },
    ],
  },
};

/** A kernel with the marketing blocks and the given compositions hydrated. */
export function templateKernel(compositions: readonly CompositionDef[]): BuilderKernel {
  const kernel = createBuilder({
    extensions: [templateHost, blocksMarketing],
    ports: { clock: fixedClock(), ids: seededIds('template') },
  });
  const manifest: DeclarativeExtensionManifest = {
    tier: 2,
    name: 'templates-under-test',
    version: '1.0.0',
    contributes: { compositions: [...compositions] },
  };
  kernel.extensions.hydrateDeclarative(manifest);
  return kernel;
}

export interface InsertResult {
  readonly insertedId: string | undefined;
  readonly transactions: number;
  readonly violations: readonly unknown[];
  readonly undoRestores: boolean;
}

/**
 * Hydrates one composition into a fresh kernel, inserts it into the page as
 * ONE transaction, validates the whole document, then proves Undo restores
 * the page exactly.
 */
export function insertAndValidate(composition: CompositionDef): InsertResult {
  const kernel = templateKernel([composition]);
  const before = structuredClone(kernel.getDocument());
  const tx = kernel.dispatch('insertComposition', {
    compositionId: composition.id,
    parentId: kernel.getDocument().rootId,
  });
  const insertedId = insertedNodeId(tx.patches);
  const transactions = kernel.transactions().length;
  const violations = kernel.validate();
  const undone = kernel.undo();
  const undoRestores = undone && JSON.stringify(kernel.getDocument()) === JSON.stringify(before);
  return { insertedId, transactions, violations, undoRestores };
}

/** A marketing block's props with every default applied, or undefined. */
export function schemaDefaults(type: string): Record<string, unknown> | undefined {
  const entry = blocksMarketing.contributes?.blocks?.find((block) => block.schema.type === type);
  if (entry === undefined) return undefined;
  const parsed = entry.schema.props.safeParse({});
  return parsed.success ? (parsed.data as Record<string, unknown>) : undefined;
}

/** Keys whose default is rendered as copy (labels, headings, notes…). */
const TEXT_KEY =
  /(label|title|heading|body|eyebrow|text|note|message|placeholder|caption|privacy|prefix|suffix|headline)$/iu;

export interface DefaultLeak {
  readonly nodeId: string;
  readonly key: string;
  readonly value: unknown;
}

/**
 * Block-default copy a template would show because it left a prop unset (or
 * set it to the default). Headings, bodies and eyebrows must always be the
 * template's own words; an Arabic page must also set every label whose
 * default is English. List props (stats, steps, logos) must never fall back
 * to their default rows.
 */
export function defaultLeaks(composition: CompositionDef, lang: TemplateLang): DefaultLeak[] {
  const leaks: DefaultLeak[] = [];
  for (const node of Object.values(composition.nodes)) {
    const defaults = schemaDefaults(node.type);
    if (defaults === undefined) continue;
    for (const [key, fallback] of Object.entries(defaults)) {
      const own = node.props[key];
      if (key === 'heading' || key === 'body' || key === 'eyebrow') {
        if (fallback !== undefined && (own === undefined || own === fallback)) {
          leaks.push({ nodeId: node.id, key, value: fallback });
        }
        continue;
      }
      if (own !== undefined) continue;
      if (Array.isArray(fallback) && fallback.length > 0) {
        leaks.push({ nodeId: node.id, key, value: fallback });
        continue;
      }
      if (
        lang === 'ar' &&
        typeof fallback === 'string' &&
        TEXT_KEY.test(key) &&
        latinWords(fallback, []).length > 0
      ) {
        leaks.push({ nodeId: node.id, key, value: fallback });
      }
    }
  }
  return leaks;
}

/** Every call-to-action label a visitor can see on the page. */
export function actionLabels(composition: CompositionDef): string[] {
  const labels: string[] = [];
  for (const node of Object.values(composition.nodes)) {
    const props = node.props;
    if (node.type === 'cta' && typeof props['label'] === 'string') labels.push(props['label']);
    if (node.type === 'promoBanner' && Array.isArray(props['actions'])) {
      for (const action of props['actions']) {
        if (action !== null && typeof action === 'object' && !Array.isArray(action)) {
          const label = action['label'];
          if (typeof label === 'string') labels.push(label);
        }
      }
    }
    if (node.type === 'comparisonTable' && Array.isArray(props['plans'])) {
      for (const plan of props['plans']) {
        if (plan !== null && typeof plan === 'object' && !Array.isArray(plan)) {
          const label = plan['actionLabel'];
          if (typeof label === 'string') labels.push(label);
        }
      }
    }
  }
  return labels;
}
