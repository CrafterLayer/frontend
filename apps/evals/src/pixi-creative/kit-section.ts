/*
  A game or story kit's section as the published page renders it, for the browser tests
  (2026-10-13): the region element carrying the kit's code (`data-ck-js`) and its values
  (`data-ck-params`), with the kit's tree inside it as plain HTML. The tree is data only — tags,
  `ck-kit*` classes, the door's attributes and text — so serialising it is escaping and nesting.
*/

export interface KitTreeNode {
  readonly kind: string;
  readonly tag?: string;
  readonly className?: string;
  readonly text?: string;
  readonly attributes?: Readonly<Record<string, string | undefined>>;
  readonly children?: readonly KitTreeNode[];
}

export interface KitUnderTest {
  readonly id: string;
  readonly category: string;
  readonly code: string;
  readonly params: readonly { readonly key: string; readonly type: string }[];
  readonly region?: {
    readonly tree: Readonly<Record<'en' | 'ar', { readonly children: readonly KitTreeNode[] }>>;
    readonly css: string;
    readonly params?: Readonly<Partial<Record<'en' | 'ar', Readonly<Record<string, unknown>>>>>;
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;');
}

function nodeHtml(node: KitTreeNode): string {
  if (node.kind !== 'element' || node.tag === undefined) return '';
  const attributes = Object.entries(node.attributes ?? {})
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
    .join('');
  const className = node.className === undefined ? '' : ` class="${escapeHtml(node.className)}"`;
  const inner = `${escapeHtml(node.text ?? '')}${(node.children ?? []).map(nodeHtml).join('')}`;
  return `<${node.tag}${className}${attributes}>${inner}</${node.tag}>`;
}

/** The kit's language for a direction: an RTL page reads the Arabic tree. */
export function kitLang(dir: 'ltr' | 'rtl'): 'en' | 'ar' {
  return dir === 'rtl' ? 'ar' : 'en';
}

/** The region markup: the code and values on the region element, the kit's tree inside it. */
export function kitMarkup(
  kit: KitUnderTest,
  dir: 'ltr' | 'rtl',
  code: string,
  params?: Readonly<Record<string, unknown>>,
): string {
  const lang = kitLang(dir);
  const values = { ...(kit.region?.params?.[lang] ?? {}), ...(params ?? {}) };
  const data =
    Object.keys(values).length === 0
      ? ''
      : ` data-ck-params="${escapeHtml(JSON.stringify(values))}"`;
  const tree = (kit.region?.tree[lang].children ?? []).map(nodeHtml).join('');
  return `<div data-ck="kit" data-ck-custom-code="" data-ck-js-id="kit" data-ck-js="${escapeHtml(code)}"${data}>${tree}</div>`;
}
