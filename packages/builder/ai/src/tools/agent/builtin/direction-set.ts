import {
  hasLanguageVersions,
  isLucideIconName,
  unknownUtilityClasses,
} from '@craftkit/builder-schema';

import { VERIFIED_FONT_FAMILIES } from '../../../skills/verified-fonts';
import { readPageKit, writePageKit } from '../page-kit';
import {
  declaresProp,
  fail,
  inputRecord,
  isElement,
  isIcon,
  mapTree,
  okParse,
  readTree,
  regionIds,
  rootIdOf,
  setProp,
  unknownKeys,
  type TreeNode,
} from '../shared';
import {
  defineAgentTool,
  type AgentToolContext,
  type AgentToolRun,
  type AgentToolStep,
} from '../types';
import { faceFor } from './fonts-set';

/**
 * direction.set — make a page read in another language direction.
 *
 * It sets the document direction and the root `lang`, rewrites every
 * physical side class in every region to its logical twin (`ml-4`→`ms-4`,
 * `text-left`→`text-start`, `rounded-l-lg`→`rounded-s-lg` …, only when the
 * twin is generated), points directional icons the other way when the
 * direction actually flips, and on an Arabic page swaps faces that have no
 * Arabic glyphs for verified Arabic ones.
 *
 * Icons are renamed (`arrow-right`↔`arrow-left`) rather than given
 * `rtl:-scale-x-100`: the static utility vocabulary generates no negative
 * scale, so that class would be refused at the door; a renamed icon is the
 * deck's own rule ("forward icon: arrow-right in ltr, arrow-left in rtl").
 */

export interface DirectionSetInput {
  readonly lang: string;
  readonly dir?: 'rtl' | 'ltr';
}

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'yi', 'ckb', 'dv', 'sd', 'ug']);

export function directionOf(lang: string): 'rtl' | 'ltr' {
  return RTL_LANGS.has(lang.toLowerCase().split('-')[0] ?? '') ? 'rtl' : 'ltr';
}

function parse(input: unknown) {
  const record = inputRecord(input);
  if (record === undefined)
    return fail<DirectionSetInput>('input must be an object like {"lang":"ar"}.');
  const extra = unknownKeys(record, ['lang', 'dir']);
  if (extra.length > 0)
    return fail<DirectionSetInput>(`unknown keys ${extra.join(', ')}; use lang and optional dir.`);
  const lang = record['lang'];
  if (
    typeof lang !== 'string' ||
    !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/iu.test(lang) ||
    lang.length > 12
  ) {
    return fail<DirectionSetInput>('"lang" must be a language tag such as ar, en or ar-jo.');
  }
  const dir = record['dir'];
  if (dir !== undefined && dir !== 'rtl' && dir !== 'ltr')
    return fail<DirectionSetInput>('"dir" is rtl or ltr.');
  return okParse<DirectionSetInput>({
    lang: lang.toLowerCase(),
    ...(dir === undefined ? {} : { dir }),
  });
}

/** Physical side → logical side, on the class stem after any variant prefix. */
const LOGICAL: readonly (readonly [RegExp, string])[] = [
  [/^(-?)ml-(.+)$/u, '$1ms-$2'],
  [/^(-?)mr-(.+)$/u, '$1me-$2'],
  [/^pl-(.+)$/u, 'ps-$1'],
  [/^pr-(.+)$/u, 'pe-$1'],
  [/^(-?)left-(.+)$/u, '$1start-$2'],
  [/^(-?)right-(.+)$/u, '$1end-$2'],
  [/^text-left$/u, 'text-start'],
  [/^text-right$/u, 'text-end'],
  [/^rounded-l(-.+)?$/u, 'rounded-s$1'],
  [/^rounded-r(-.+)?$/u, 'rounded-e$1'],
  [/^rounded-tl(-.+)?$/u, 'rounded-ss$1'],
  [/^rounded-tr(-.+)?$/u, 'rounded-se$1'],
  [/^rounded-bl(-.+)?$/u, 'rounded-es$1'],
  [/^rounded-br(-.+)?$/u, 'rounded-ee$1'],
  [/^border-l(-.+)?$/u, 'border-s$1'],
  [/^border-r(-.+)?$/u, 'border-e$1'],
];

/** One class as its logical twin, when it has one that the page generates. */
export function logicalClass(name: string): string {
  const cut = name.lastIndexOf(':');
  const variant = cut < 0 ? '' : name.slice(0, cut + 1);
  const stem = cut < 0 ? name : name.slice(cut + 1);
  for (const [pattern, replacement] of LOGICAL) {
    if (!pattern.test(stem)) continue;
    const twin = `${variant}${stem.replace(pattern, replacement)}`;
    return unknownUtilityClasses(twin).length === 0 ? twin : name;
  }
  return name;
}

export function logicalClassName(className: string): string {
  return className
    .split(/\s+/u)
    .filter((name) => name !== '')
    .map(logicalClass)
    .join(' ');
}

/** `arrow-right` ↔ `arrow-left`, `chevrons-left` ↔ `chevrons-right`, … when the mirror exists. */
export function mirroredIcon(name: string): string {
  if (!/(?:arrow|chevron|caret|move|corner|undo|redo|reply|forward|log-in|log-out)/u.test(name))
    return name;
  const swapped = name.replace(/\b(left|right)\b/gu, (side) =>
    side === 'left' ? 'right' : 'left',
  );
  return swapped !== name && isLucideIconName(swapped) ? swapped : name;
}

function flipTree(node: TreeNode, flipIcons: boolean): TreeNode {
  if (isIcon(node)) {
    const name = flipIcons ? mirroredIcon(node.name) : node.name;
    const className = node.className === undefined ? undefined : logicalClassName(node.className);
    if (name === node.name && className === node.className) return node;
    return { ...node, name, ...(className === undefined ? {} : { className }) };
  }
  if (isElement(node) && typeof node.className === 'string') {
    const className = logicalClassName(node.className);
    return className === node.className ? node : { ...node, className };
  }
  return node;
}

function run(input: DirectionSetInput, context: AgentToolContext): AgentToolRun {
  const kernel = context.kernel;
  const rootId = rootIdOf(kernel);
  const dir = input.dir ?? directionOf(input.lang);
  const steps: AgentToolStep[] = [];
  const flips = dir !== context.locale.dir;
  // A page in a language set turns by its own `lang` (languageSetDirection); a site keeps one dir.
  const inSet = hasLanguageVersions(context.readProp(rootId, 'seo'));
  if (kernel.getDocument().dir !== dir && !inSet)
    steps.push({ command: 'setDocMeta', args: { dir } });
  if (declaresProp(kernel, rootId, 'lang') && context.readProp(rootId, 'lang') !== input.lang) {
    steps.push(setProp(rootId, 'lang', input.lang));
  }
  for (const id of regionIds(context)) {
    const tree = readTree(context, id);
    if (tree === undefined) continue;
    const next = mapTree(tree, (node) => flipTree(node, flips));
    if (next !== tree) steps.push(setProp(id, 'tree', next));
  }
  const arabic = input.lang.startsWith('ar');
  if (arabic && declaresProp(kernel, rootId, 'pageCss')) {
    const current = context.readProp(rootId, 'pageCss');
    const pageCss = typeof current === 'string' ? current : '';
    const kit = readPageKit(pageCss, true);
    const latinOnly = (family: string) => VERIFIED_FONT_FAMILIES[family]?.arabic !== true;
    if (kit.hasKit && (latinOnly(kit.state.display.family) || latinOnly(kit.state.body.family))) {
      const serif = /serif|garamond|fraunces|gloock|young/iu.test(kit.state.display.family);
      const next = {
        ...kit.state,
        display: latinOnly(kit.state.display.family)
          ? faceFor(serif ? 'El Messiri' : 'Readex Pro', 'display')
          : kit.state.display,
        body: latinOnly(kit.state.body.family)
          ? faceFor(serif ? 'Noto Naskh Arabic' : 'IBM Plex Sans Arabic', 'body')
          : kit.state.body,
      };
      steps.push(
        setProp(rootId, 'pageCss', writePageKit(pageCss, next, { lang: input.lang, dir })),
      );
    }
  }
  return steps.length === 0
    ? { ok: true, steps, note: 'the page already reads this way' }
    : { ok: true, steps };
}

export const directionSetTool = defineAgentTool<DirectionSetInput>({
  name: 'direction.set',
  lanes: ['edit'],
  summary: 'Switch language and direction',
  signature: '{lang,dir?}',
  parse,
  run,
});
