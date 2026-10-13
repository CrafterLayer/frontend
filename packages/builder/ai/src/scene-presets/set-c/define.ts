/**
 * Builders for the set-C builtin scene presets: the game and story KITS (2026-10-13).
 *
 * A kit is a whole playable section, not a backdrop: its code drives controls, a status line and
 * every word a visitor reads, and those live in the region's tree (`KitRegion.tree`), in the
 * page's language, so `page.translate` and a person edit them like any other text. The code holds
 * only logic: it finds its words and buttons by the scene hooks the tree door admits
 * (`data-game-*`, `data-story-*`, `data-scene-part`, `data-scene-value`). A kit's params are the
 * set-B shared four (palette, seed, speed, density) plus its own tuning; words a kit must keep in
 * params (the quiz's questions) are text params whose Arabic values ride in `KitRegion.params`.
 *
 * Every entry is a `ScriptEntry` written by CraftKit (author 'craftkit', trust 'trusted', MIT,
 * version 1, kind 'scene'). Its code is generated from the param spec, so the `ck.params({...})`
 * literal and the spec defaults can never disagree.
 */
import type {
  Bilingual,
  CustomCodeNode,
  CustomCodeRoot,
  ScriptEntry,
  ScriptParamSpec,
  ScriptParamValue,
  StudioLibKey,
} from '@craftkit/builder-schema';

export { range, select, sharedParams, text, toggle } from '../set-b/define';

/** One fixed timestamp: builtin entries never change under a clock. */
export const SET_C_SAVED_AT = '2026-10-13T00:00:00.000Z';

/** The languages a kit's words are written in; any other page language reads the English. */
export const KIT_LANGS = ['en', 'ar'] as const;
export type KitLang = (typeof KIT_LANGS)[number];

/** What a kit is: a playable game or a story read chapter by chapter. */
export type KitCategory = 'game' | 'story';

/** The section a kit's code drives: its tree in each language, and the region css. */
export interface KitRegion {
  /** The customCode tree, one outer `<section>`, per page language. */
  readonly tree: Readonly<Record<KitLang, CustomCodeRoot>>;
  /** Region css: `ck-kit*` classes only, colours from the theme tokens. */
  readonly css: string;
  /** Text-param values for a page in that language (stored as the region's jsParams). */
  readonly params?: Readonly<Partial<Record<KitLang, Readonly<Record<string, ScriptParamValue>>>>>;
}

export interface SceneKit {
  readonly entry: ScriptEntry;
  readonly category: KitCategory;
  readonly region: KitRegion;
}

/** The sound switch every game kit offers: a Sound button, muted until a visitor presses it. */
export function soundButton(): ScriptParamSpec {
  return {
    key: 'sound',
    type: 'toggle',
    label: { en: 'Sound button', ar: 'زر الصوت' },
    default: true,
    group: 'sound',
    help: {
      en: 'Offers a Sound button; nothing plays until a visitor presses it.',
      ar: 'يعرض زر الصوت، ولا يُسمع شيء حتى يضغطه الزائر.',
    },
  };
}

/** A whole number setting (lives, a goal, seconds). */
export function count(
  key: string,
  en: string,
  ar: string,
  value: number,
  min: number,
  max: number,
  group: NonNullable<ScriptParamSpec['group']> = 'look',
  help?: Bilingual,
): ScriptParamSpec {
  return {
    key,
    type: 'range',
    label: { en, ar },
    default: value,
    min,
    max,
    step: 1,
    group,
    ...(help === undefined ? {} : { help }),
  };
}

/** The `ck.params({...})` literal for a spec: every key with its default, in spec order. */
export function paramsLiteral(params: readonly ScriptParamSpec[]): string {
  const entries = params.map((spec) => `${spec.key}: ${JSON.stringify(spec.default)}`);
  return `{ ${entries.join(', ')} }`;
}

export interface KitDefinition {
  id: string;
  category: KitCategory;
  name: Bilingual;
  description: Bilingual;
  tags: string[];
  /** Equal to `declaredLibs(code).libs`: 'kit' plus every key the scene options list. */
  libs: StudioLibKey[];
  params: ScriptParamSpec[];
  /** The `ck.scene({...})` options, written literally (libs as a literal array). */
  scene: string;
  /** The body after `const p = ck.params(…)` and `const s = await ck.scene(…)`. */
  body: string;
  region: KitRegion;
}

/** A set-C kit: its library entry (code generated from the spec) and its region. */
export function defineKit(definition: KitDefinition): SceneKit {
  const code = [
    `const p = ck.params(${paramsLiteral(definition.params)});`,
    `const s = await ck.scene(${definition.scene});`,
    definition.body.trim(),
  ].join('\n');
  const entry: ScriptEntry = {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    tags: definition.tags,
    kind: 'scene',
    code,
    params: definition.params,
    libs: definition.libs,
    sound: false,
    reducedMotion: 'still',
    version: 1,
    author: 'craftkit',
    trust: 'trusted',
    licence: 'MIT',
    createdAt: SET_C_SAVED_AT,
    updatedAt: SET_C_SAVED_AT,
  };
  return { entry, category: definition.category, region: definition.region };
}

// ── Tree building ────────────────────────────────────────────────────────────

type Attributes = Readonly<Record<string, string>>;

/** One element of a kit's tree (`ck-kit*` classes only; the door admits every hook used). */
export function el(
  tag: string,
  className: string,
  attributes: Attributes = {},
  children: readonly CustomCodeNode[] | string = [],
): CustomCodeNode {
  const node: Record<string, unknown> = { kind: 'element', tag };
  if (className !== '') node['className'] = className;
  const attrs = tag === 'button' ? { type: 'button', ...attributes } : attributes;
  if (Object.keys(attrs).length > 0) node['attributes'] = { ...attrs };
  if (typeof children === 'string') node['text'] = children;
  else if (children.length > 0) node['children'] = [...children];
  return node as unknown as CustomCodeNode;
}

/** A tree whose one child is the kit's outer section. */
export function root(section: CustomCodeNode): CustomCodeRoot {
  return { kind: 'root', children: [section] };
}

/** The tree in both languages from one builder. */
export function bilingualTree(
  build: (lang: KitLang) => CustomCodeNode,
): Record<KitLang, CustomCodeRoot> {
  return { en: root(build('en')), ar: root(build('ar')) };
}

/** A hidden list of the words the code reads by key (`data-scene-value`), in one language. */
export function wordList(
  lang: KitLang,
  words: Readonly<Record<string, Bilingual>>,
  part = 'says',
): CustomCodeNode {
  return el(
    'ul',
    'ck-kit-words',
    { hidden: 'hidden', 'data-scene-part': part },
    Object.entries(words).map(([key, value]) =>
      el('li', '', { 'data-scene-value': key }, value[lang]),
    ),
  );
}
