import type { BuilderKernel } from '@craftkit/builder-core';

import { isTreeMarkup, parseTreeMarkup } from '../../plan/tree-markup';
import { splitKitBlock } from './page-kit';
import { isRecord } from './shared';

/**
 * Whether a zero-token tool plan changes anything a person can see
 * (colour-target fix, 2026-10-05).
 *
 * The owner's «سارة خليها احمر لونها» landed as a page-css rewrite that
 * moved nothing on screen, and the panel still said «عُدِّلت الصفحة». Two
 * ways a kit rewrite does that: `writePageKit` re-emits the block with the
 * font imports merged into one URL (text differs, look identical), and a
 * token can change that no element on the page reads (an accent on a page
 * with no button). A plan whose every step is like that is a no-op: the
 * direct path must not land it, and the model decides instead.
 *
 * Conservative by design: any step it cannot prove invisible counts as
 * visible. Only the root's kit block is read closely.
 */

type Props = Readonly<Record<string, unknown>>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(',')}}`;
  }
  return value === undefined ? 'undefined' : JSON.stringify(value);
}

function treeValue(value: unknown): unknown {
  return isTreeMarkup(value) ? parseTreeMarkup(value) : value;
}

// ── The kit block ─────────────────────────────────────────────────────────────

const IMPORT = /@import\s+url\(\s*['"]?([^'")]+)['"]?\s*\)\s*;?/gu;
const TOKEN_RULE = /(?:^|[\n}])\s*>\s*\*\s*\{([^}]*)\}/u;
const RULE = /([^{}]+)\{([^{}]*)\}/gu;

/** `Family:weights` for every face the imports load, however they are grouped into URLs. */
function importedFaces(css: string): string {
  const faces = new Set<string>();
  for (const [, url = ''] of css.matchAll(IMPORT)) {
    let decoded = url;
    try {
      decoded = decodeURIComponent(url);
    } catch {
      // A malformed escape: compare the URL as written.
    }
    for (const [, family = '', weights = ''] of decoded.matchAll(/family=([^&:]+)(?::[a-z,]*@([\d;.,]+))?/gu)) {
      faces.add(`${family.replaceAll('+', ' ')}:${weights.split(/[;,]/u).sort().join(';')}`);
    }
  }
  return [...faces].sort().join('|');
}

function tokensOf(block: string): ReadonlyMap<string, string> {
  const tokens = new Map<string, string>();
  const body = TOKEN_RULE.exec(block)?.[1] ?? '';
  for (const [, name = '', value = ''] of body.matchAll(/--ck-([a-z0-9-]+)\s*:\s*([^;]*)/gu)) {
    tokens.set(name, value.trim().toLowerCase());
  }
  return tokens;
}

function rulesOf(block: string): readonly string[] {
  const body = block.replace(IMPORT, '').replace(TOKEN_RULE, (match) => (match.startsWith('}') ? '}\n' : '\n'));
  return [...body.matchAll(RULE)]
    // blocks-polish additions (2026-10-08)
    /*
      A later `> *` rule is the kit's dark-scheme token rule (skeleton-from-plan
      `pageKitSchemeCss`): custom properties re-declared for a dark page, never
      a style. Its values follow the light tokens, so whether it shows is
      whether the page reads a changed token — the question asked above.
    */
    .filter(([, selector = '']) => selector.trim() !== '> *')
    // end blocks-polish additions
    .map(
      ([, selector = '', declarations = '']) => `${selector.trim().replace(/\s+/gu, ' ')}{${declarations.trim()}}`,
    );
}

/** A selector list split on its top-level commas (`:is(h1,h2),.x` is two). */
function selectorParts(selector: string): readonly string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index];
    if (char === '(' || char === '[') depth += 1;
    else if (char === ')' || char === ']') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(selector.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(selector.slice(start));
  return parts;
}

/** Whether a rule can reach the page: a part with no class always may; one with classes needs them all used. */
function reaches(rule: string, used: ReadonlySet<string>): boolean {
  const selector = rule.slice(0, rule.indexOf('{'));
  return selectorParts(selector).some((part) => {
    const classes = [...part.matchAll(/\.([A-Za-z0-9_-]+)/gu)].map(([, name = '']) => name);
    return classes.every((name) => used.has(name));
  });
}

function readsToken(text: string, names: ReadonlySet<string>): boolean {
  for (const [, name = ''] of text.matchAll(/var\(\s*--ck-([a-z0-9-]+)\s*[,)]/gu)) {
    if (names.has(name)) return true;
  }
  return false;
}

interface PageUse {
  /** Every class an element or icon carries. */
  readonly classes: ReadonlySet<string>;
  /** Everything outside the kit block that may read a token: region css, classNames, styles. */
  readonly outside: string;
}

function pageUse(kernel: BuilderKernel, props: (id: string) => Props): PageUse {
  const classes = new Set<string>();
  const outside: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const entry of node) walk(entry);
      return;
    }
    if (!isRecord(node)) return;
    if (typeof node['className'] === 'string') {
      for (const name of node['className'].split(/\s+/u)) if (name !== '') classes.add(name);
      outside.push(node['className']);
    }
    const attributes = node['attributes'];
    if (isRecord(attributes)) {
      for (const [key, value] of Object.entries(attributes)) {
        if (key === 'style' && typeof value === 'string') outside.push(value);
        if (key === 'class' && typeof value === 'string') {
          for (const name of value.split(/\s+/u)) if (name !== '') classes.add(name);
        }
      }
    }
    walk(node['children']);
  };
  const document = kernel.getDocument();
  for (const id of Object.keys(document.nodes)) {
    const own = props(id);
    if (id !== document.rootId) {
      for (const [key, value] of Object.entries(own)) {
        if (typeof value === 'string' && /css$/iu.test(key)) outside.push(value);
      }
    }
    walk(treeValue(own['tree']));
  }
  return { classes, outside: outside.join('\n') };
}

/**
 * Whether replacing the root's page css `before` with `after` changes the
 * look. Undefined pieces (no kit block on one side) count as visible.
 */
function pageCssChangesLook(before: string, after: string, use: PageUse): boolean {
  if (before === after) return false;
  const was = splitKitBlock(before);
  const now = splitKitBlock(after);
  if (was.block === undefined || now.block === undefined) return true;
  if (was.rest.replace(/\s+/gu, ' ') !== now.rest.replace(/\s+/gu, ' ')) return true;
  if (importedFaces(was.block) !== importedFaces(now.block)) return true;

  const oldTokens = tokensOf(was.block);
  const newTokens = tokensOf(now.block);
  const changed = new Set<string>();
  for (const name of new Set([...oldTokens.keys(), ...newTokens.keys()])) {
    if (oldTokens.get(name) !== newTokens.get(name)) changed.add(name);
  }
  if (readsToken(`${use.outside}\n${now.rest}`, changed)) return true;

  const oldRules = rulesOf(was.block);
  const pending = new Map<string, number>();
  for (const rule of oldRules) pending.set(rule, (pending.get(rule) ?? 0) + 1);
  const touched: string[] = [];
  for (const rule of rulesOf(now.block)) {
    const left = pending.get(rule) ?? 0;
    if (left > 0) {
      pending.set(rule, left - 1);
      if (readsToken(rule, changed)) touched.push(rule);
    } else {
      touched.push(rule);
    }
  }
  for (const [rule, left] of pending) if (left > 0) touched.push(rule);
  return touched.some((rule) => reaches(rule, use.classes));
}

/**
 * Whether a validated plan changes anything a person can see. A setProp to
 * the value already there, or a page-css rewrite `pageCssChangesLook`
 * clears, is invisible; every other step counts as visible.
 */
export function planChangesLook(
  commands: readonly { readonly command: string; readonly args?: unknown }[],
  kernel: BuilderKernel,
): boolean {
  const document = kernel.getDocument();
  const written = new Map<string, Record<string, unknown>>();
  const props = (id: string): Props => written.get(id) ?? document.nodes[id]?.props ?? {};
  for (const { command, args } of commands) {
    if (command !== 'setProp' || !isRecord(args) || typeof args['id'] !== 'string' || typeof args['key'] !== 'string') {
      return true;
    }
    written.set(args['id'], { ...props(args['id']), [args['key']]: args['value'] });
  }

  let use: PageUse | undefined;
  for (const { args } of commands) {
    const { id, key, value } = args as { id: string; key: string; value: unknown };
    const current = document.nodes[id]?.props[key];
    const sameValue =
      key === 'tree' ? stableJson(treeValue(current)) === stableJson(treeValue(value)) : stableJson(current) === stableJson(value);
    if (sameValue) continue;
    if (id === document.rootId && key === 'pageCss' && typeof current === 'string' && typeof value === 'string') {
      use ??= pageUse(kernel, props);
      if (!pageCssChangesLook(current, value, use)) continue;
    }
    return true;
  }
  return false;
}
