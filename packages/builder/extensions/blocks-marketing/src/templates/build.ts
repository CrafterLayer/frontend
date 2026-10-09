import type { CompositionDef, JsonValue, Node, Surface } from '@craftkit/builder-schema';

import { TEMPLATE_PHOTOS } from './photos';
import type {
  BilingualText,
  MarketingTemplateCard,
  TemplateCategory,
  TemplateDefinition,
  TemplateLang,
} from './types';

/*
  Pure helpers every template is written with (agent-script DESIGN §B.2).

  Nothing here touches a kernel: each helper returns plain JSON nodes, so a
  composition is data the kernel validates at hydration AND again at insert
  (`insertComposition` re-checks the subtree against the live vocabulary).
*/

export type Props = Record<string, JsonValue>;
export type Slots = Readonly<Record<string, readonly string[]>>;

/** A small subtree: its root id plus every node it owns (root included). */
export interface Fragment {
  readonly rootId: string;
  readonly nodes: Readonly<Record<string, Node>>;
}

/** `ids('saas-en')('hero')` → `'saas-en-hero'`. Node ids are prefixed per language. */
export function ids(prefix: string): (name: string) => string {
  return (name) => `${prefix}-${name}`;
}

const ARABIC_LETTER = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/u;

/**
 * Page chrome copy must be in the page's language: an English page carries no
 * Arabic letter and an Arabic label carries at least one. Thrown at build
 * time, so a mixed-up label fails the template tests rather than shipping.
 */
export function assertLanguage(text: string, lang: TemplateLang, where: string): void {
  const arabic = ARABIC_LETTER.test(text);
  if (lang === 'en' && arabic) throw new Error(`English ${where} contains Arabic: "${text}".`);
  if (lang === 'ar' && !arabic) throw new Error(`Arabic ${where} has no Arabic text: "${text}".`);
}

function makeNode(id: string, type: string, props: Props, slots?: Slots): Node {
  const node: Node = { id, type, props };
  if (slots !== undefined) {
    const kept = Object.entries(slots).filter(([, children]) => children.length > 0);
    // The document stores no empty slot arrays.
    if (kept.length > 0)
      node.slots = Object.fromEntries(kept.map(([slot, list]) => [slot, [...list]]));
  }
  return node;
}

/**
 * The page under construction: a full-width column stack whose children are
 * the sections in order. `add` registers a child node (a CTA, an image, a nav
 * row) without placing it; `section` registers AND places; `place` merges a
 * header/footer fragment and places its root.
 */
export interface PageNodes {
  readonly id: (name: string) => string;
  add(name: string, type: string, props: Props, slots?: Slots): string;
  section(name: string, type: string, props: Props, slots?: Slots): string;
  place(fragment: Fragment): string;
  composition(meta: {
    readonly id: string;
    readonly name: string;
    readonly surfaces?: readonly Surface[];
  }): CompositionDef;
}

export function nodes(prefix: string): PageNodes {
  const id = ids(prefix);
  const bag: Record<string, Node> = {};
  const order: string[] = [];
  const put = (node: Node) => {
    if (bag[node.id] !== undefined) throw new Error(`Template node id "${node.id}" is used twice.`);
    bag[node.id] = node;
  };
  return {
    id,
    add(name, type, props, slots) {
      const node = makeNode(id(name), type, props, slots);
      put(node);
      return node.id;
    },
    section(name, type, props, slots) {
      const nodeId = this.add(name, type, props, slots);
      order.push(nodeId);
      return nodeId;
    },
    place(fragment) {
      for (const node of Object.values(fragment.nodes)) put(structuredClone(node));
      order.push(fragment.rootId);
      return fragment.rootId;
    },
    composition(meta) {
      const rootId = id('root');
      const root = makeNode(
        rootId,
        'stack',
        { direction: 'column', gap: 'none', width: 'full' },
        {
          default: order,
        },
      );
      const composition: CompositionDef = {
        id: meta.id,
        name: meta.name,
        version: 2,
        rootId,
        nodes: { [rootId]: root, ...structuredClone(bag) },
      };
      if (meta.surfaces !== undefined) composition.surfaces = [...meta.surfaces];
      return composition;
    },
  };
}

/**
 * Copy → prop value. Copy objects are typed per template; a prop is JSON.
 * The round trip drops `undefined` keys (an optional field a plan or product
 * does not use) and proves the value is JSON-pure before the kernel sees it.
 */
export function json(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/** A one-paragraph rich-text document, optionally bold. */
export function richLine(text: string, options: { readonly bold?: boolean } = {}): JsonValue {
  const inline: Props = { type: 'text', text };
  if (options.bold === true) inline['marks'] = [{ type: 'bold' }];
  return { type: 'doc', content: [{ type: 'paragraph', content: [inline] }] };
}

export interface NavLink {
  readonly label: string;
  readonly href: string;
}

export interface HeaderSpec {
  /** Node-id prefix, e.g. 'saas-en'. */
  readonly prefix: string;
  readonly brand: string;
  readonly nav: readonly NavLink[];
  readonly cta?: NavLink;
}

/**
 * PageHeader with the brand in `start`, a NavLinks row in `center` and one
 * primary CTA in `end`. Tokens only: the header follows the page surface.
 */
export function header(spec: HeaderSpec, lang: TemplateLang): Fragment {
  for (const link of spec.nav) assertLanguage(link.label, lang, 'header link');
  if (spec.cta !== undefined) assertLanguage(spec.cta.label, lang, 'header action');
  const id = ids(spec.prefix);
  const brandId = id('brand');
  const navId = id('nav');
  const ctaId = id('header-cta');
  const headerId = id('header');
  const out: Record<string, Node> = {};
  out[brandId] = makeNode(brandId, 'richText', {
    content: richLine(spec.brand, { bold: true }),
    fontSize: 'lg',
    fontWeight: 'bold',
  });
  out[navId] = makeNode(navId, 'navLinks', {
    links: spec.nav.map((link) => ({ label: link.label, href: link.href })),
    direction: 'row',
    style: 'plain',
    gap: 'md',
    wrap: 'wrap',
    fontSize: 'sm',
    fontWeight: 'medium',
  });
  const slots: Record<string, string[]> = { start: [brandId], center: [navId] };
  if (spec.cta !== undefined) {
    out[ctaId] = makeNode(ctaId, 'cta', {
      label: spec.cta.label,
      href: spec.cta.href,
      emphasis: 'primary',
      size: 'sm',
    });
    slots['end'] = [ctaId];
  }
  out[headerId] = makeNode(
    headerId,
    'pageHeader',
    {
      layout: 'split',
      density: 'regular',
      border: 'bottom',
      shadow: 'none',
      align: 'start',
      tone: 'transparent',
      spacing: 'sm',
      width: 'wide',
    },
    slots,
  );
  return { rootId: headerId, nodes: out };
}

export interface FooterColumn {
  readonly title: string;
  readonly links: readonly NavLink[];
}

export interface FooterSpec {
  readonly prefix: string;
  readonly brand: string;
  /** One sentence under the brand. */
  readonly tagline: string;
  readonly columns: readonly FooterColumn[];
  /** Overrides the default "© year brand" line. */
  readonly legal?: string;
  readonly year?: number;
}

/** The default bottom line in the content language. */
export function legalLine(brand: string, lang: TemplateLang, year = 2026): string {
  return lang === 'ar'
    ? `© ${String(year)} ${brand}. جميع الحقوق محفوظة.`
    : `© ${String(year)} ${brand}. All rights reserved.`;
}

/**
 * PageFooter: brand + tagline, then one column per link group (a stack of a
 * title and a vertical NavLinks), and the legal line in the ruled bottom bar.
 */
export function footer(spec: FooterSpec, lang: TemplateLang): Fragment {
  assertLanguage(spec.tagline, lang, 'footer tagline');
  for (const column of spec.columns) {
    assertLanguage(column.title, lang, 'footer column title');
    for (const link of column.links) assertLanguage(link.label, lang, 'footer link');
  }
  const id = ids(spec.prefix);
  const out: Record<string, Node> = {};
  const add = (node: Node) => {
    out[node.id] = node;
    return node.id;
  };
  const brandId = add(
    makeNode(id('footer-brand'), 'richText', {
      content: richLine(spec.brand, { bold: true }),
      fontSize: 'lg',
      fontWeight: 'bold',
    }),
  );
  const taglineId = add(
    makeNode(id('footer-tagline'), 'richText', {
      content: richLine(spec.tagline),
      fontSize: 'sm',
      textColor: 'textMuted',
    }),
  );
  const aboutId = add(
    makeNode(
      id('footer-about'),
      'stack',
      { direction: 'column', gap: 'sm', width: 'narrow' },
      { default: [brandId, taglineId] },
    ),
  );
  const columnIds = spec.columns.map((column, index) => {
    const n = String(index + 1);
    const titleId = add(
      makeNode(id(`footer-col-${n}-title`), 'richText', {
        content: richLine(column.title, { bold: true }),
        fontSize: 'sm',
      }),
    );
    const linksId = add(
      makeNode(id(`footer-col-${n}-links`), 'navLinks', {
        links: column.links.map((link) => ({ label: link.label, href: link.href })),
        direction: 'column',
        style: 'plain',
        gap: 'sm',
        wrap: 'nowrap',
        fontSize: 'sm',
      }),
    );
    return add(
      makeNode(
        id(`footer-col-${n}`),
        'stack',
        { direction: 'column', gap: 'sm', width: 'narrow' },
        { default: [titleId, linksId] },
      ),
    );
  });
  const legalId = add(
    makeNode(id('footer-legal'), 'richText', {
      content: richLine(spec.legal ?? legalLine(spec.brand, lang, spec.year)),
      fontSize: 'xs',
      textColor: 'textMuted',
    }),
  );
  const footerId = add(
    makeNode(
      id('footer'),
      'pageFooter',
      {
        layout: 'columns',
        border: 'top',
        align: 'start',
        tone: 'light',
        spacing: 'lg',
        width: 'wide',
        bottomBar: true,
      },
      { default: [aboutId, ...columnIds], bottom: [legalId] },
    ),
  );
  return { rootId: footerId, nodes: out };
}

/** One verified photo with its alt text in the content language. */
export function photo(
  topic: string,
  index: number,
  lang: TemplateLang,
): { readonly src: string; readonly alt: string } {
  const list = TEMPLATE_PHOTOS[topic];
  if (list === undefined) throw new Error(`Unknown template photo topic "${topic}".`);
  const entry = list[index];
  if (entry === undefined) {
    throw new Error(
      `Template photo "${topic}" #${String(index)} does not exist (${String(list.length)} photos).`,
    );
  }
  return { src: entry.src, alt: entry.alt[lang] };
}

/** The thumbnail size of a verified photo (same image, w=640). */
export function thumbnailSrc(src: string): string {
  return src.replace(/([?&])w=\d+/u, '$1w=640');
}

export type Currency = 'USD' | 'JOD' | 'SAR' | 'AED';

const ARABIC_CURRENCY: Record<Currency, string> = {
  USD: '$',
  JOD: 'د.أ',
  SAR: 'ر.س',
  AED: 'د.إ',
};

/**
 * Digits for a language. Latin digits are the default for both languages (the
 * owner's rule for prices); `arabicIndic` opts into ٠١٢٣٤٥٦٧٨٩ for Arabic.
 */
export function digits(
  lang: TemplateLang,
  options: { readonly arabicIndic?: boolean } = {},
): (value: number) => string {
  const indic = lang === 'ar' && options.arabicIndic === true;
  return (value) => {
    const [whole = '0', fraction] = String(value).split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
    const latin = fraction === undefined ? grouped : `${grouped}.${fraction}`;
    if (!indic) return latin;
    return latin
      .replace(/\d/gu, (digit) => String.fromCharCode(0x0660 + Number(digit)))
      .replace(/,/gu, '٬')
      .replace(/\./gu, '٫');
  };
}

/**
 * A price as people read it. Arabic: `8 د.أ`, `120 ر.س`, `$19`. English:
 * `JOD 8`, `SAR 120`, `$19`.
 */
export function money(amount: number, currency: Currency, lang: TemplateLang): string {
  const n = digits(lang)(amount);
  if (currency === 'USD') return `$${n}`;
  return lang === 'ar' ? `${n} ${ARABIC_CURRENCY[currency]}` : `${currency} ${n}`;
}

export interface TemplateSpec {
  readonly key: string;
  readonly category: TemplateCategory;
  /** The English id; the Arabic id appends `-ar`. */
  readonly baseId: string;
  readonly name: BilingualText;
  readonly description: BilingualText;
  /** The photo the Library card shows (the hero's). */
  readonly thumbnail: { readonly topic: string; readonly index: number };
  readonly surfaces?: readonly Surface[];
  /** Builds the page for one language; `prefix` is e.g. 'saas-en'. */
  readonly page: (lang: TemplateLang, nodes: PageNodes) => void;
}

/** Arabic ids append `-ar`; English keeps the historical id. */
export function compositionIdFor(baseId: string, lang: TemplateLang): string {
  return lang === 'en' ? baseId : `${baseId}-ar`;
}

/** Turns a template spec into its two compositions and two Library cards. */
export function defineTemplate(spec: TemplateSpec): TemplateDefinition {
  const build = (lang: TemplateLang): CompositionDef => {
    const page = nodes(`${spec.key}-${lang}`);
    spec.page(lang, page);
    const meta: { id: string; name: string; surfaces?: readonly Surface[] } = {
      id: compositionIdFor(spec.baseId, lang),
      name: spec.name[lang],
    };
    if (spec.surfaces !== undefined) meta.surfaces = spec.surfaces;
    return page.composition(meta);
  };
  const card = (lang: TemplateLang): MarketingTemplateCard => {
    const composition = build(lang);
    const root = composition.nodes[composition.rootId];
    const hero = photo(spec.thumbnail.topic, spec.thumbnail.index, lang);
    return {
      id: composition.id,
      templateKey: spec.key,
      lang,
      category: spec.category,
      name: { en: spec.name.en, ar: spec.name.ar },
      description: { en: spec.description.en, ar: spec.description.ar },
      sections: root?.slots?.['default']?.length ?? 0,
      thumbnail: { src: thumbnailSrc(hero.src), alt: hero.alt },
    };
  };
  return {
    key: spec.key,
    category: spec.category,
    compositionId: (lang) => compositionIdFor(spec.baseId, lang),
    build,
    card,
  };
}
