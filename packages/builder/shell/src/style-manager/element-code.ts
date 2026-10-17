import {
  customCodeAttributeProblem,
  type CustomCodeElement,
  type TreeNodePatch,
} from '@craftkit/builder-schema';

/*
  The element Code tab (style-manager DESIGN.md §G): ONE element as
  `<tag class="…" attr="…">text</tag>`, children collapsed to `…`, edited as
  text and committed as one `patchTreeNode`. This is a small attribute
  parser, not an HTML parser: it reads exactly one start tag, an optional
  text body and the matching end tag, and refuses anything else with the
  place it stopped — so an error can be shown AT the attribute.
*/

/** Children of the element are kept, shown as this marker. */
export const CHILDREN_MARKER = '…';

const VOID_TAGS: ReadonlySet<string> = new Set([
  'area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'track', 'wbr',
]);

export interface ParsedElementCode {
  readonly tag: string;
  readonly className: string;
  readonly attributes: Readonly<Record<string, string>>;
  /** `undefined` when the body is the children marker (or the tag is void). */
  readonly text: string | undefined;
}

export interface ElementCodeError {
  readonly message: string;
  /** The attribute the problem is about, when it is about one. */
  readonly attribute?: string | undefined;
  /** Character offset in the source where the problem starts. */
  readonly offset: number;
}

export type ElementCodeResult =
  | { readonly ok: true; readonly value: ParsedElementCode }
  | { readonly ok: false; readonly error: ElementCodeError };

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function unescape(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

/** The element as one line of markup, children collapsed. */
export function formatElementCode(element: CustomCodeElement): string {
  const parts: string[] = [element.tag];
  if (element.className !== undefined && element.className !== '') {
    parts.push(`class="${escapeAttribute(element.className)}"`);
  }
  for (const [name, value] of Object.entries(element.attributes ?? {})) {
    if (value === undefined) continue;
    parts.push(value === '' ? name : `${name}="${escapeAttribute(value)}"`);
  }
  const open = `<${parts.join(' ')}>`;
  if (VOID_TAGS.has(element.tag)) return open;
  const hasChildren = (element.children ?? []).length > 0;
  const body = hasChildren ? CHILDREN_MARKER : escapeText(element.text ?? '');
  return `${open}${body}</${element.tag}>`;
}

const NAME = /[A-Za-z][\w:-]*/uy;
const SPACE = /\s*/uy;

function fail(message: string, offset: number, attribute?: string): ElementCodeResult {
  return { ok: false, error: attribute === undefined ? { message, offset } : { message, offset, attribute } };
}

/** Parse one element of markup. */
export function parseElementCode(source: string): ElementCodeResult {
  const text = source.trim();
  const lead = source.indexOf(text);
  if (!text.startsWith('<')) return fail('Start with a tag, like <h2 class="…">', lead);
  NAME.lastIndex = 1;
  const tagMatch = NAME.exec(text);
  if (tagMatch === null) return fail('Name the tag right after "<"', lead + 1);
  const tag = tagMatch[0].toLowerCase();
  let at = NAME.lastIndex;
  const attributes: Record<string, string> = {};
  let className = '';

  for (;;) {
    SPACE.lastIndex = at;
    SPACE.exec(text);
    at = SPACE.lastIndex;
    if (text.startsWith('/>', at)) {
      at += 2;
      break;
    }
    if (text[at] === '>') {
      at += 1;
      break;
    }
    if (at >= text.length) return fail(`The <${tag}> tag is never closed with ">"`, lead + at);
    NAME.lastIndex = at;
    const nameMatch = NAME.exec(text);
    if (nameMatch === null) return fail(`Unexpected "${text[at] ?? ''}" in the <${tag}> tag`, lead + at);
    const name = nameMatch[0].toLowerCase();
    const nameAt = at;
    at = NAME.lastIndex;
    let value = '';
    if (text[at] === '=') {
      at += 1;
      const quote = text[at];
      if (quote !== '"' && quote !== "'") {
        return fail(`Put ${name}'s value in quotes: ${name}="…"`, lead + at, name);
      }
      const end = text.indexOf(quote, at + 1);
      if (end === -1) return fail(`${name}'s value is never closed with ${quote}`, lead + at, name);
      value = unescape(text.slice(at + 1, end));
      at = end + 1;
    }
    if (name === 'class') {
      className = value.trim().replace(/\s+/gu, ' ');
      continue;
    }
    if (name === 'style' || name.startsWith('on')) {
      return fail(
        `${name} is not allowed: style lives in classes and behaviour in data-ck-* names`,
        lead + nameAt,
        name,
      );
    }
    if (Object.hasOwn(attributes, name)) return fail(`${name} is written twice`, lead + nameAt, name);
    const problem = customCodeAttributeProblem(tag, name, value);
    if (problem !== undefined) return fail(problem, lead + nameAt, name);
    attributes[name] = value;
  }

  const rest = text.slice(at);
  if (VOID_TAGS.has(tag) || rest === '') {
    if (rest !== '' && rest !== `</${tag}>`) return fail(`<${tag}> takes no content`, lead + at);
    return { ok: true, value: { tag, className, attributes, text: undefined } };
  }
  const close = `</${tag}>`;
  if (!rest.endsWith(close)) return fail(`End with ${close}`, lead + text.length);
  const body = rest.slice(0, -close.length);
  if (body.includes('<')) {
    return fail('Only text goes inside here; edit child elements in Layers', lead + at + body.indexOf('<'));
  }
  return {
    ok: true,
    value: { tag, className, attributes, text: body.trim() === CHILDREN_MARKER ? undefined : unescape(body) },
  };
}

/** The patch that turns `element` into what was parsed (empty `set`/`attributes` are omitted). */
export function patchFromCode(element: CustomCodeElement, parsed: ParsedElementCode): TreeNodePatch {
  const set: { className?: string | null; text?: string | null; tag?: string } = {};
  if (parsed.tag !== element.tag) set.tag = parsed.tag;
  if (parsed.className !== (element.className ?? '')) {
    set.className = parsed.className === '' ? null : parsed.className;
  }
  const hasChildren = (element.children ?? []).length > 0;
  if (parsed.text !== undefined && !hasChildren && parsed.text !== (element.text ?? '')) {
    set.text = parsed.text;
  }
  const attributes: Record<string, string | null> = {};
  const before = element.attributes ?? {};
  for (const [name, value] of Object.entries(parsed.attributes)) {
    if (before[name as keyof typeof before] !== value) attributes[name] = value;
  }
  for (const name of Object.keys(before)) {
    if (!Object.hasOwn(parsed.attributes, name)) attributes[name] = null;
  }
  const patch: { set?: typeof set; attributes?: typeof attributes } = {};
  if (Object.keys(set).length > 0) patch.set = set;
  if (Object.keys(attributes).length > 0) patch.attributes = attributes;
  return patch;
}

/** The attribute a door refusal names, so the error can be shown at it. */
export function attributeInMessage(message: string, names: readonly string[]): string | undefined {
  return [...names]
    .sort((a, b) => b.length - a.length)
    .find((name) => new RegExp(`(^|[^\\w-])${name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}([^\\w-]|$)`, 'u').test(message));
}
