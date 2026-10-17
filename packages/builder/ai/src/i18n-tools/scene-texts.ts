import {
  isCustomCodeJsMetaSchema,
  isCustomCodeJsParamsSchema,
  isHexColour,
  jsParamsJsonLength,
  scriptParamSpecSchema,
  STUDIO_LIMITS,
} from '@craftkit/builder-schema';

import { isRecord, setProp } from '../tools/agent/shared';
import type { AgentToolContext, AgentToolStep } from '../tools/agent/types';
import type { Translation } from './page-texts';

/**
 * Scene settings text (T231, 2026-10-12): the words a Pixi scene shows that live in its
 * `jsParams` — a title, a start button's label, a HUD line — read and translated like any other
 * page text, through the same `Translation` swap as the trees. The scene's `js` is never read or
 * written: code stays code, and a scene that wants its words translated reads them through
 * `ck.params` (or keeps them in its tree, as `s.lib.dialogue.fromDom` does).
 *
 * A param is visible words when BOTH hold:
 * - its key NAMES words: the key's last camelCase word, digits dropped, is one of `WORD_KEYS`
 *   (`title`, `startLabel`, `hudText`, `text2`, `winMessage`) — so `textColor`, `titleSize`,
 *   `path`, `images` and `music` are not; and when the region's `jsMeta.params` declares the key
 *   (found by its declaration, never by name) the declared type is `text` — so a `select` named
 *   `label` keeps its option id;
 * - its value READS as words: a string with a letter that is not an address (https:, data:,
 *   blob:, a path), a `#hex` colour or `theme`.
 * A declared text param the region does not store shows its spec default, so that default counts
 * too and a translation of it is stored. Numbers, colours, ids and addresses are never touched.
 */

/** The last camelCase word of a key that names words a visitor reads or hears. */
const WORD_KEYS: ReadonlySet<string> = new Set([
  'text',
  'title',
  'subtitle',
  'heading',
  'headline',
  'label',
  'caption',
  'message',
  'prompt',
  'hint',
  'words',
  'phrase',
  'quote',
  'greeting',
  'tagline',
  'question',
  'answer',
  'description',
  'placeholder',
  'tooltip',
  'button',
  'cta',
  'intro',
  'outro',
]);

const LETTER = /\p{L}/u;
const ADDRESS = /^(?:https?:|data:|blob:|mailto:|tel:|\/|\.{1,2}\/|assets\/)/iu;

/** Whether a param key names words: `startLabel` → label, `text2` → text, `textColor` → color. */
export function namesWords(key: string): boolean {
  const last =
    key
      .replace(/\d+$/u, '')
      .split(/(?=[A-Z])/u)
      .pop() ?? '';
  return WORD_KEYS.has(last.toLowerCase());
}

/** Whether a param value reads as words rather than an address, a colour or a keyword. */
export function readsAsWords(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return LETTER.test(text) && !ADDRESS.test(text) && !isHexColour(text) && text !== 'theme';
}

type ShapeSchema = Parameters<typeof isCustomCodeJsParamsSchema>[0];

/** The props of a node's block that hold scene values and the scene spec, by declaration. */
function sceneProps(
  context: AgentToolContext,
  id: string,
): { readonly params: string; readonly meta: string | undefined } | undefined {
  const node = context.kernel.getDocument().nodes[id];
  const block = node === undefined ? undefined : context.kernel.context.registry.block(node.type);
  const shape = (
    block?.schema.props as { shape?: Readonly<Record<string, ShapeSchema>> } | undefined
  )?.shape;
  if (shape === undefined) return undefined;
  const keys = Object.keys(shape);
  const params = keys.find(
    (key) => shape[key] !== undefined && isCustomCodeJsParamsSchema(shape[key]),
  );
  if (params === undefined) return undefined;
  return {
    params,
    meta: keys.find((key) => shape[key] !== undefined && isCustomCodeJsMetaSchema(shape[key])),
  };
}

/** The text params' declared types and defaults (`jsMeta.params`); entries that do not parse are left out. */
function declaredTypes(meta: unknown): ReadonlyMap<string, { type: string; fallback: unknown }> {
  const specs = isRecord(meta) && Array.isArray(meta['params']) ? meta['params'] : [];
  const out = new Map<string, { type: string; fallback: unknown }>();
  for (const entry of specs) {
    const parsed = scriptParamSpecSchema.safeParse(entry);
    if (parsed.success && !out.has(parsed.data.key))
      out.set(parsed.data.key, { type: parsed.data.type, fallback: parsed.data.default });
  }
  return out;
}

/** One node's text params translated: a setProp of its whole `jsParams`, or nothing to change. */
export function translateSceneParams(
  context: AgentToolContext,
  id: string,
  translation: Translation,
): AgentToolStep | undefined {
  const props = sceneProps(context, id);
  if (props === undefined) return undefined;
  const stored = context.readProp(id, props.params);
  const values: Readonly<Record<string, unknown>> = isRecord(stored) ? stored : {};
  const declared = declaredTypes(
    props.meta === undefined ? undefined : context.readProp(id, props.meta),
  );
  const shown = new Map<string, unknown>();
  for (const [key, { type, fallback }] of declared)
    if (type === 'text' && namesWords(key)) shown.set(key, values[key] ?? fallback);
  for (const [key, value] of Object.entries(values))
    if (!declared.has(key) && namesWords(key)) shown.set(key, value);
  let next: Record<string, unknown> | undefined;
  for (const [key, value] of shown) {
    if (!readsAsWords(value)) continue;
    const swapped = translation.swap(value);
    if (swapped !== value) (next ??= { ...values })[key] = swapped;
  }
  // Past the stored limit the door would refuse the whole translation: these words stay as written.
  if (next === undefined || jsParamsJsonLength(next) > STUDIO_LIMITS.jsParamsJson) return undefined;
  return setProp(id, props.params, next);
}

/** Every node on the page whose block holds scene values, in page order. */
export function sceneNodeIds(context: AgentToolContext): readonly string[] {
  const document = context.kernel.getDocument();
  const order: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string): void => {
    const node = document.nodes[id];
    if (node === undefined || seen.has(id)) return;
    seen.add(id);
    if (sceneProps(context, id) !== undefined) order.push(id);
    for (const ids of Object.values(node.slots ?? {})) for (const child of ids) walk(child);
  };
  walk(document.rootId);
  return order;
}
