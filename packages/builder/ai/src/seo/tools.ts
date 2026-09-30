import {
  SEO_SCHEMA_KINDS,
  seoBusinessSchema,
  seoMeta,
  seoSlug,
  type BuilderDocument,
  type JsonValue,
  type NodeId,
  type SeoBusiness,
  type SeoSchemaKind,
} from '@craftkit/builder-schema';

import { defineAgentTool, type AgentTool, type AgentToolContext, type AgentToolStep } from '../tools/agent/types';
import { seoAutofixSteps } from './autofix';
import { effectiveLang, isSampleValue } from './check-seo';
import { isRecord, scanPage, type JsonRecord } from './scan';

/**
 * The four SEO tools (DESIGN A.2 rows 13-16). Each expands to ordinary root
 * `setProp`s (or, for seo.fix, region tree setProps) that the door judges like
 * any step the model writes. Errors say how to fix the call, because the one
 * repair round reads them.
 */

const ROOT_PROPS = ['title', 'description', 'slug', 'lang', 'noIndex', 'seo', 'socialTitle', 'socialDescription'];

/** The page as the plan's earlier steps leave it: every tree and root prop read through `readProp`. */
function workingDocument(context: AgentToolContext): {
  document: BuilderDocument;
  trees: Map<NodeId, unknown>;
} {
  const live = context.kernel.getDocument();
  const nodes = { ...live.nodes };
  const trees = new Map<NodeId, unknown>();
  for (const [id, node] of Object.entries(live.nodes)) {
    if (node.props['tree'] === undefined) continue;
    const tree = context.readProp(id, 'tree');
    trees.set(id, tree);
    nodes[id] = { ...node, props: { ...node.props, tree: tree as JsonValue } };
  }
  const root = nodes[live.rootId];
  if (root !== undefined) {
    const props: Record<string, JsonValue> = { ...root.props };
    for (const key of ROOT_PROPS) {
      const value = context.readProp(live.rootId, key);
      if (value === undefined) delete props[key];
      else props[key] = value as JsonValue;
    }
    nodes[live.rootId] = { ...root, props };
  }
  return { document: { ...live, nodes, dir: context.locale.dir }, trees };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
}

function seoRecord(context: AgentToolContext, rootId: NodeId): JsonRecord {
  const value = context.readProp(rootId, 'seo');
  return isRecord(value) ? value : {};
}

function pageLang(context: AgentToolContext, document: BuilderDocument): string {
  return context.locale.lang.trim() !== '' ? context.locale.lang : effectiveLang(scanPage(document));
}

function isArabicLang(lang: string): boolean {
  return lang.trim().toLowerCase().split(/[-_]/u)[0] === 'ar';
}

type Parse<I> = { readonly ok: true; readonly value: I } | { readonly ok: false; readonly error: string };

function optionalString(record: JsonRecord, key: string, max: number): Parse<string | undefined> {
  const value = record[key];
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value !== 'string') return { ok: false, error: `"${key}" must be a string.` };
  const trimmed = value.replace(/\s+/gu, ' ').trim();
  if (trimmed.length > max) return { ok: false, error: `"${key}" must be at most ${String(max)} characters.` };
  return { ok: true, value: trimmed === '' ? undefined : trimmed };
}

// ── seo.meta ────────────────────────────────────────────────────────────────

export interface SeoMetaToolInput {
  readonly title?: string;
  readonly description?: string;
  readonly keyword?: string;
  readonly slug?: string;
}

const seoMetaTool = defineAgentTool<SeoMetaToolInput>({
  name: 'seo.meta',
  lanes: ['seo', 'edit'],
  summary: 'Set page title, description, slug and keyword',
  signature: '{title?,description?,keyword?,slug?} — omitted fields fill from the h1 and lead',
  parse: (input) => {
    const record = input ?? {};
    if (!isRecord(record)) return { ok: false, error: 'input must be an object like {"keyword":"…"}.' };
    const out: { title?: string; description?: string; keyword?: string; slug?: string } = {};
    for (const [key, max] of [
      ['title', 120],
      ['description', 200],
      ['keyword', 80],
      ['slug', 120],
    ] as const) {
      const parsed = optionalString(record, key, max);
      if (!parsed.ok) return parsed;
      if (parsed.value !== undefined) out[key] = parsed.value;
    }
    return { ok: true, value: out };
  },
  run: (input, context) => {
    const { document } = workingDocument(context);
    const rootId = document.rootId;
    const scan = scanPage(document);
    const lang = pageLang(context, document);
    const h1 = scan.elements.find((element) => element.tag === 'h1')?.fullText ?? '';
    const lead = scan.elements.find((element) => element.tag === 'p' && element.fullText !== '')?.fullText ?? '';
    const currentTitle = text(context.readProp(rootId, 'title'));
    const currentDescription = text(context.readProp(rootId, 'description'));
    const meta = seoMeta({
      title: input.title ?? currentTitle,
      description: input.description ?? currentDescription,
      h1,
      lead,
      lang,
    });
    const language = isArabicLang(lang) ? 'Arabic' : `the page's language (${lang})`;
    if (input.title !== undefined && meta.issues.some((issue) => issue.code === 'title-script')) {
      return { ok: false, error: `the title is not written in ${language}; write it in ${language}.` };
    }
    if (input.description !== undefined && meta.issues.some((issue) => issue.code === 'description-script')) {
      return { ok: false, error: `the description is not written in ${language}; write it in ${language}.` };
    }
    if (meta.title === '') {
      return { ok: false, error: 'the page has no h1 to take a title from; pass "title".' };
    }

    const steps: AgentToolStep[] = [];
    const set = (key: string, value: unknown, current: unknown): void => {
      if (JSON.stringify(value) !== JSON.stringify(current)) {
        steps.push({ command: 'setProp', args: { id: rootId, key, value } });
      }
    };
    set('title', meta.title, currentTitle);
    if (meta.description !== '') set('description', meta.description, currentDescription);

    const socialTitle = text(context.readProp(rootId, 'socialTitle'));
    if (socialTitle === '' || input.title !== undefined) set('socialTitle', meta.title, socialTitle);
    const socialDescription = text(context.readProp(rootId, 'socialDescription'));
    if (meta.description !== '' && (socialDescription === '' || input.description !== undefined)) {
      set('socialDescription', meta.description, socialDescription);
    }

    const seo = seoRecord(context, rootId);
    const currentSlug = text(context.readProp(rootId, 'slug'));
    if (input.slug !== undefined) {
      set('slug', seoSlug(input.slug, lang), currentSlug);
    } else if (currentSlug === '' && seo['pageKind'] !== 'home') {
      set('slug', seoSlug(h1 !== '' ? h1 : meta.title, lang), currentSlug);
    }

    if (input.keyword !== undefined && input.keyword !== seo['keyword']) {
      steps.push({ command: 'setProp', args: { id: rootId, key: 'seo', value: { ...seo, keyword: input.keyword } } });
    }
    const adjusted = meta.issues
      .filter((issue) => /truncated|filled|suffix/u.test(issue.code))
      .map((issue) => issue.message);
    return adjusted.length === 0 ? { ok: true, steps } : { ok: true, steps, note: adjusted.join(' ') };
  },
});

// ── seo.business ────────────────────────────────────────────────────────────

function toList(value: unknown): unknown {
  return typeof value === 'string' ? [value] : value;
}

const seoBusinessTool = defineAgentTool<SeoBusiness>({
  name: 'seo.business',
  lanes: ['seo', 'edit'],
  summary: "Record the owner's real business facts",
  signature: '{type,name,telephone?,whatsapp?,email?,address?:{city,country,street?},hours?,priceRange?,cuisine?,sameAs?}',
  parse: (input) => {
    if (!isRecord(input)) return { ok: false, error: 'input must be an object like {"type":"CafeOrCoffeeShop","name":"…"}.' };
    const { hours, cuisine, openingHours, servesCuisine, ...rest } = input;
    const candidate: JsonRecord = { ...rest };
    const hoursValue = toList(openingHours ?? hours);
    const cuisineValue = toList(servesCuisine ?? cuisine);
    if (hoursValue !== undefined) candidate['openingHours'] = hoursValue;
    if (cuisineValue !== undefined) candidate['servesCuisine'] = cuisineValue;
    const parsed = seoBusinessSchema.safeParse(candidate);
    if (!parsed.success) {
      const first = parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.length === 0 ? 'input' : issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      return { ok: false, error: first };
    }
    return { ok: true, value: parsed.data };
  },
  run: (input, context) => {
    const rootId = context.kernel.getDocument().rootId;
    const seo = seoRecord(context, rootId);
    if (seo['pageKind'] !== undefined && seo['pageKind'] !== 'home') {
      return {
        ok: false,
        error: "business facts live on the home page (address '/'); call seo.business while editing the home page.",
      };
    }
    const ownSamples = Array.isArray(seo['samples'])
      ? (seo['samples'] as unknown[]).filter((value): value is string => typeof value === 'string')
      : [];
    const samples = new Set<string>();
    for (const value of [...context.sampleValues, ...ownSamples]) {
      const flat = value.replace(/\s+/gu, ' ').trim().toLowerCase();
      if (flat !== '') samples.add(flat);
      const digits = value.replace(/\D+/gu, '');
      if (digits.length >= 7) samples.add(`#${digits}`);
    }
    const offending: string[] = [];
    const visit = (value: unknown, path: string): void => {
      if (typeof value === 'string') {
        if (isSampleValue(value, samples)) offending.push(`${path} "${value}"`);
      } else if (Array.isArray(value)) value.forEach((item, at) => { visit(item, `${path}[${String(at)}]`); });
      else if (isRecord(value)) for (const [key, item] of Object.entries(value)) visit(item, path === '' ? key : `${path}.${key}`);
    };
    visit(input, '');
    if (offending.length > 0) {
      return {
        ok: false,
        error: `${offending.join(', ')} ${offending.length === 1 ? 'is a sample value' : 'are sample values'} from the facts ledger, not the owner's. Ask the owner for the real value and leave the field out until then.`,
      };
    }
    const site = isRecord(seo['site']) ? seo['site'] : {};
    return {
      ok: true,
      steps: [
        { command: 'setProp', args: { id: rootId, key: 'seo', value: { ...seo, site: { ...site, business: input } } } },
      ],
    };
  },
});

// ── seo.schema ──────────────────────────────────────────────────────────────

export interface SeoSchemaToolInput {
  readonly kinds: readonly SeoSchemaKind[];
}

const SCHEMA_KINDS: ReadonlySet<string> = new Set(SEO_SCHEMA_KINDS);

const seoSchemaTool = defineAgentTool<SeoSchemaToolInput>({
  name: 'seo.schema',
  lanes: ['seo'],
  summary: 'Choose which structured data this page publishes',
  signature: `{kinds:[${SEO_SCHEMA_KINDS.join('|')}]}`,
  parse: (input) => {
    const kinds = isRecord(input) ? input['kinds'] : undefined;
    if (!Array.isArray(kinds)) return { ok: false, error: `input needs "kinds": an array of ${SEO_SCHEMA_KINDS.join(', ')}.` };
    const out: SeoSchemaKind[] = [];
    for (const kind of kinds) {
      if (typeof kind !== 'string' || !SCHEMA_KINDS.has(kind)) {
        return { ok: false, error: `"${String(kind)}" is not a schema kind; use one of ${SEO_SCHEMA_KINDS.join(', ')}.` };
      }
      if (!out.includes(kind as SeoSchemaKind)) out.push(kind as SeoSchemaKind);
    }
    if (out.length > 6) return { ok: false, error: 'at most 6 schema kinds.' };
    return { ok: true, value: { kinds: out } };
  },
  run: (input, context) => {
    const rootId = context.kernel.getDocument().rootId;
    const seo = seoRecord(context, rootId);
    const rest: JsonRecord = { ...seo };
    delete rest['schemaKinds'];
    const value = input.kinds.length === 0 ? rest : { ...rest, schemaKinds: [...input.kinds] };
    return { ok: true, steps: [{ command: 'setProp', args: { id: rootId, key: 'seo', value } }] };
  },
});

// ── seo.fix ─────────────────────────────────────────────────────────────────

const seoFixTool = defineAgentTool<Record<string, never>>({
  name: 'seo.fix',
  lanes: ['seo', 'build'],
  summary: 'Apply every safe SEO fix on this page',
  signature: '{}',
  parse: (input) =>
    input === undefined || input === null || isRecord(input)
      ? { ok: true, value: {} }
      : { ok: false, error: 'input must be {}.' },
  run: (_input, context) => {
    const { document } = workingDocument(context);
    const steps = seoAutofixSteps(document, { sampleValues: context.sampleValues });
    return steps.length === 0 ? { ok: true, steps, note: 'Nothing to fix.' } : { ok: true, steps };
  },
});

/* A tool's input type is private to it: the registry reaches `run` only with
   the value that tool's own `parse` returned. */
function erased<I>(tool: AgentTool<I>): AgentTool {
  return tool as unknown as AgentTool;
}

export const SEO_TOOLS: readonly AgentTool[] = Object.freeze([
  erased(seoMetaTool),
  erased(seoBusinessTool),
  erased(seoSchemaTool),
  erased(seoFixTool),
]);
