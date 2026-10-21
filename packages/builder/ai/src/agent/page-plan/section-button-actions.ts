import type { LandedNode } from './check-section';
import { closingParen, firstLiteralArgument, readSceneSource } from './scene-source';

function attr(entry: LandedNode, name: string): string | undefined {
  const attributes = entry.node['attributes'];
  if (attributes === null || typeof attributes !== 'object') return undefined;
  const value = (attributes as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : undefined;
}

/** Small literal selectors only; this is admission evidence, not a browser selector engine. */
function matches(entry: LandedNode, selector: string): boolean {
  return selector.split(',').some((part) => {
    if (part.trim() === 'button') return entry.node['tag'] === 'button';
    const match =
      /^(button)?(?:#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:\s*=\s*(?:"([^"\\]*)"|'([^'\\]*)'|([\w-]+)))?\])$/u.exec(
        part.trim(),
      );
    if (match === null || (match[1] !== undefined && entry.node['tag'] !== 'button')) return false;
    if (match[2] !== undefined) return attr(entry, 'id') === match[2];
    if (match[3] !== undefined) {
      const className = entry.node['className'];
      return typeof className === 'string' && className.split(/\s+/u).includes(match[3]);
    }
    const value = attr(entry, match[4] ?? '');
    const expected = match[5] ?? match[6] ?? match[7];
    return value !== undefined && (expected === undefined || value === expected);
  });
}

function receiver(before: string): string | undefined {
  return /(?:^|[^\w$.])([\w$]+(?:\s*\.\s*[\w$]+)*)\s*(?:\?\.|\.)\s*$/u
    .exec(before)?.[1]
    ?.replace(/\s/gu, '');
}

function nativeAction(entry: LandedNode, elements: readonly LandedNode[]): boolean {
  const popover = attr(entry, 'popovertarget');
  if (
    popover !== undefined &&
    elements.some(
      (target) => attr(target, 'id') === popover && attr(target, 'popover') !== undefined,
    )
  )
    return true;
  const behavior = attr(entry, 'data-ck-behavior');
  if (behavior === 'copy-text' || behavior === 'back-to-top') return true;
  if (
    behavior === 'whatsapp-form' &&
    (attr(entry, 'data-ck-phone') ?? '').replace(/\D/gu, '').length >= 7
  )
    return true;
  return false;
}

/**
 * Admit known native actions or explicit selector/click bindings. Lexing excludes comments,
 * strings and regex examples. A recognized binding still needs runtime/interaction verification;
 * arbitrary JS, passive animation and a selector without a click binding are not evidence.
 */
export function sectionButtonActions(
  elements: readonly LandedNode[],
  js = '',
): ReadonlySet<LandedNode> {
  const buttons = elements.filter(({ node }) => node['tag'] === 'button');
  const admitted = new Set(buttons.filter((button) => nativeAction(button, elements)));
  if (js.trim() === '') return admitted;
  const source = readSceneSource(js);
  const { bare } = source;
  const roots = new Set(['ck.root']);
  for (const alias of bare.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*=\s*ck\s*\.\s*root\b/gu)) {
    if (alias[1] !== undefined) roots.add(alias[1]);
  }
  const clicks = [...bare.matchAll(/\baddEventListener\s*\(/gu)].flatMap((match) => {
    const open = match.index + match[0].length - 1;
    if (firstLiteralArgument(source, open)?.text !== 'click') return [];
    return [
      {
        start: match.index,
        end: closingParen(bare, open),
        receiver: receiver(bare.slice(0, match.index)),
      },
    ];
  });
  for (const query of bare.matchAll(/\b(querySelector(?:All)?|closest|matches)\s*\(/gu)) {
    const open = query.index + query[0].length - 1;
    const literal = firstLiteralArgument(source, open);
    if (literal === undefined) continue;
    const selector = literal.text.replace(/\\(['"\\])/gu, '$1');
    const selected = elements.filter((entry) => matches(entry, selector));
    const targets = query[1] === 'querySelector' ? selected.slice(0, 1) : selected;
    const end = closingParen(bare, open);
    const before = bare.slice(0, query.index);
    const onRoot = roots.has(receiver(before) ?? '');
    const alias = /([\w$]+)\s*=\s*(?:[\w$]+\s*\.\s*)+$/u.exec(before)?.[1];
    const each = /^\s*\.\s*forEach\s*\(\s*\(?\s*([\w$]+)\s*\)?\s*=>/u.exec(bare.slice(end + 1));
    const eachEnd = each === null ? -1 : closingParen(bare, bare.indexOf('(', end + 1));
    const bound = clicks.some((click) => {
      if (query[1] === 'closest' || query[1] === 'matches') {
        return (
          roots.has(click.receiver ?? '') && click.start < query.index && query.index < click.end
        );
      }
      if (!onRoot || click.start <= end) return false;
      if (
        query[1] === 'querySelector' &&
        /^\s*(?:\?\.|\.)\s*$/u.test(bare.slice(end + 1, click.start))
      )
        return true;
      if (query[1] === 'querySelector' && alias !== undefined && click.receiver === alias)
        return true;
      return (
        query[1] === 'querySelectorAll' && each?.[1] === click.receiver && click.start < eachEnd
      );
    });
    if (bound)
      for (const target of targets) if (target.node['tag'] === 'button') admitted.add(target);
  }
  return admitted;
}
