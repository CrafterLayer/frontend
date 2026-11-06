import type { PagePlan, SectionContract } from './types';

/*
  The placeholder a writer replaces, drawn as a calm preview of the section
  that is coming (skeleton-polish, 2026-11-05). Before this a placeholder was
  a bare `<section>` with its title, and an empty page read as a white page
  until the writers landed.

  Every shape keeps the markup contract the rest of the agent reads a
  placeholder by:

  - the outer tag (`section`, or `footer` for the footer) and the anchor id —
    run-build's `placeholderShape` / `isFooter` read the role from them;
  - the hero's heading is the page's one h1, every other heading an h2 holding
    the plan's title — the lander reads the hero from the h1;
  - the tree is a placeholder by document-summary's `isPlaceholder`: at most
    PLACEHOLDER_NODES_MAX elements, all of them shell tags (`section`, `div`,
    `h1`, `h2`…), no link or image attribute, and ONE line of text — the
    heading. So a page an unfinished build left behind is still read as
    "placeholders only" and the next build replaces it.

  Hence the drawing lives in the region css: every block is a `div` (or a
  pseudo-element of one), every text line a gradient, and the "being written"
  label is css `content`, so it adds no second text to the tree. The label's
  element is `role="status"`: a polite live region, announced once.

  Colour comes only from the page's tokens (`var(--ck-*)`): blocks are the
  ink at a low alpha, so one sheet reads on a light and a dark page. Nothing
  in it is a colour literal or a font family, so a writer that sets only the
  tree and leaves this css behind still passes check-section.
*/

/** What a placeholder previews. */
export type PlaceholderShape =
  | 'hero'
  | 'features'
  | 'pricing'
  | 'gallery'
  | 'testimonials'
  | 'faq'
  | 'menu'
  | 'form'
  | 'cta'
  | 'footer'
  | 'bar'
  | 'generic';

/**
 * The class every placeholder's outer element carries — the code-readable
 * marker, beside the shape contract above. A written section never has it.
 */
export const PLACEHOLDER_CLASS = 'ck-ph';

/** document-summary's `PLACEHOLDER_MAX_NODES`: a placeholder is a handful of nodes. */
export const PLACEHOLDER_NODES_MAX = 12;

/** The "being written" label, by the page's language; English for any other. */
export const PLACEHOLDER_NOTE: Readonly<Record<string, string>> = {
  ar: 'جاري كتابة هذا القسم…',
  en: 'Writing this section…',
};

interface TreeElement {
  readonly kind: 'element';
  readonly tag: string;
  readonly className?: string;
  readonly text?: string;
  readonly attributes?: Readonly<Record<string, string>>;
  readonly children?: readonly TreeElement[];
}

export interface PlaceholderRegion {
  readonly shape: PlaceholderShape;
  /** The region's outer element (the tree's one root child). */
  readonly tree: TreeElement;
  /** The region css that draws it. */
  readonly css: string;
}

// ── Which shape ───────────────────────────────────────────────────────────────

/** A band's layout variant (`SECTION_VARIANTS` id) → the shape that previews it. */
const VARIANT_SHAPES: Readonly<Record<string, PlaceholderShape>> = {
  grid: 'features',
  list: 'features',
  bento: 'features',
  sticky: 'features',
  zigzag: 'features',
  steps: 'features',
  cards: 'features',
  stats: 'features',
  team: 'features',
  quote: 'testimonials',
  pricing: 'pricing',
  product: 'pricing',
  listing: 'pricing',
  menu: 'menu',
  gallery: 'gallery',
  rail: 'gallery',
  faq: 'faq',
  contact: 'form',
  band: 'cta',
  'cta-split': 'cta',
};

/** Read from the key, kit and title, English and Arabic, in this order: the first match wins. */
const KEYWORD_SHAPES: readonly (readonly [RegExp, PlaceholderShape])[] = [
  [/faq|question|أسئل|اسئل|سؤال/u, 'faq'],
  [/testimonial|review|quote|client|customer|آراء|اراء|شهاد|تقييم|عملاؤ|عملائ/u, 'testimonials'],
  [/pric|plan|package|tier|product|shop|أسعار|اسعار|سعر|باق|خطط|منتج/u, 'pricing'],
  [/menu|قائمة|منيو/u, 'menu'],
  [/galler|portfolio|work|project|photo|معرض|أعمال|اعمال|مشاريع|صور/u, 'gallery'],
  [/contact|form|book|reserv|تواصل|اتصل|راسل|حجز|احجز/u, 'form'],
  [/feature|service|benefit|why|how|step|process|team|stat|خدم|ميز|مزاي|لماذا|خطو|كيف|فريق/u, 'features'],
];

const CONTACT_FORM = /contact|form|تواصل|اتصل|راسل/u;

function keywordShape(contract: SectionContract): PlaceholderShape | undefined {
  const haystack = [contract.key, contract.kit ?? '', contract.title].join(' ').toLowerCase();
  return KEYWORD_SHAPES.find(([pattern]) => pattern.test(haystack))?.[1];
}

/** The shape a section's placeholder takes: its role, then its variant, then its words. */
export function placeholderShapeOf(contract: SectionContract): PlaceholderShape {
  switch (contract.role) {
    case 'hero':
      return 'hero';
    case 'footer':
      return 'footer';
    case 'header':
      return 'bar';
    case 'cta':
      // A closing call is a band; only a contact form previews as fields (a "book" cta is a button).
      return contract.variant === 'contact' ||
        CONTACT_FORM.test(`${contract.key} ${contract.kit ?? ''} ${contract.title}`.toLowerCase())
        ? 'form'
        : 'cta';
    case 'band':
      return (
        (contract.variant === undefined ? undefined : VARIANT_SHAPES[contract.variant]) ??
        keywordShape(contract) ??
        'generic'
      );
  }
}

// ── The tree ──────────────────────────────────────────────────────────────────

function el(tag: string, className: string, children?: TreeElement[]): TreeElement {
  return {
    kind: 'element',
    tag,
    ...(className === '' ? {} : { className }),
    ...(children === undefined ? {} : { children }),
  };
}

/** `count` copies of a childless block. */
function blocks(count: number, className: string): TreeElement[] {
  return Array.from({ length: count }, () => el('div', className));
}

const CONTAINER = 'mx-auto max-w-6xl px-4 md:px-8';

/** The shape's body after the note and heading, or the whole container for a layout of its own. */
function body(shape: PlaceholderShape, note: TreeElement, heading: TreeElement): TreeElement[] {
  switch (shape) {
    case 'hero':
      return [
        el('div', 'ck-ph-split', [
          el('div', '', [note, heading, el('div', 'ck-ph-t'), el('div', 'ck-ph-btn')]),
          el('div', 'ck-ph-b ck-ph-img'),
        ]),
      ];
    case 'generic':
      return [
        el('div', 'ck-ph-split', [
          el('div', '', [note, heading, el('div', 'ck-ph-t'), el('div', 'ck-ph-btn')]),
          el('div', 'ck-ph-b ck-ph-img'),
        ]),
      ];
    case 'form':
      return [
        el('div', 'ck-ph-split', [
          el('div', '', [note, heading, el('div', 'ck-ph-t')]),
          el('div', 'ck-ph-c', [...blocks(3, 'ck-ph-in'), el('div', 'ck-ph-btn')]),
        ]),
      ];
    case 'cta':
      return [el('div', 'ck-ph-band', [note, heading, el('div', 'ck-ph-t'), el('div', 'ck-ph-btn')])];
    case 'features':
      return [note, heading, el('div', 'ck-ph-g', blocks(3, 'ck-ph-c ck-ph-f'))];
    case 'pricing':
      return [note, heading, el('div', 'ck-ph-g', blocks(3, 'ck-ph-c ck-ph-p'))];
    case 'testimonials':
      return [note, heading, el('div', 'ck-ph-g', blocks(3, 'ck-ph-c ck-ph-q'))];
    case 'gallery':
      return [note, heading, el('div', 'ck-ph-gal', blocks(5, 'ck-ph-b'))];
    case 'faq':
      return [note, heading, el('div', 'ck-ph-rows', blocks(4, 'ck-ph-r'))];
    case 'menu':
      return [note, heading, el('div', 'ck-ph-rows ck-ph-m', blocks(6, 'ck-ph-r'))];
    case 'footer':
      return [
        note,
        heading,
        el('div', 'ck-ph-cols', [el('div', 'ck-ph-t'), ...blocks(3, 'ck-ph-k')]),
      ];
    case 'bar':
      return [
        el('div', 'ck-ph-bar', [
          el('div', '', [note, heading]),
          el('div', 'ck-ph-nav'),
          el('div', 'ck-ph-btn'),
        ]),
      ];
  }
}

// ── The css ───────────────────────────────────────────────────────────────────

const TINT = 'var(--ck-ph)';
const MD = '@media (min-width:48rem)';

/** A css string literal: the label is the page's own words, never markup or css. */
function cssString(text: string): string {
  return `"${text.replace(/["\\\n\r{}<>]/gu, '')}"`;
}

/**
 * Text lines as background layers, each `[width %, top rem, height rem, inset rem]`,
 * anchored to the reading side so an Arabic page's short lines end at the left.
 */
function lines(side: string, spec: readonly (readonly [number, number, number, number?])[]): string {
  return spec
    .map(([width, top, height, inset = 0]) => {
      const at =
        side === 'center'
          ? `center ${String(top)}rem`
          : `${side} ${String(inset)}rem top ${String(top)}rem`;
      return `linear-gradient(${TINT},${TINT}) ${at}/${String(width)}% ${String(height)}rem no-repeat`;
    })
    .join(',');
}

function shapeCss(shape: PlaceholderShape, side: string): string[] {
  const split = [
    '.ck-ph-split{display:grid;gap:3rem;align-items:center}',
    `${MD}{.ck-ph-split{grid-template-columns:1.1fr .9fr}}`,
  ];
  const card =
    '.ck-ph-c{background:var(--ck-surface);border:1px solid var(--ck-border);border-radius:var(--ck-radius);padding:1.75rem}';
  const grid = [
    '.ck-ph-g{display:grid;gap:1.5rem;margin-top:2.5rem}',
    `${MD}{.ck-ph-g{grid-template-columns:repeat(3,1fr)}}`,
    card,
  ];
  const btn =
    '.ck-ph-btn{width:10rem;height:3rem;margin-top:2rem;border-radius:var(--ck-radius-button);background:color-mix(in srgb,var(--ck-accent) 30%,transparent)}';
  const image = `.ck-ph-img{aspect-ratio:4/3;background:radial-gradient(circle at 70% 32%,${TINT} 0 2.25rem,transparent 2.3rem),linear-gradient(160deg,transparent 55%,${TINT} 55%),${TINT}}`;
  const rows = [
    '.ck-ph-rows{margin-top:2rem;max-width:48rem}',
    '.ck-ph-r{display:flex;align-items:center;justify-content:space-between;gap:2rem;padding:1.375rem 0;border-bottom:1px solid var(--ck-border)}',
    `.ck-ph-r::before{content:"";width:60%;height:.875rem;border-radius:1rem;background:${TINT}}`,
    '.ck-ph-r:nth-child(2n)::before{width:42%}',
  ];
  switch (shape) {
    case 'hero':
      return [
        ...split,
        `.ck-ph-t{height:2.5rem;margin-top:1.75rem;max-width:34rem;background:${lines(side, [
          [100, 0, 0.875],
          [70, 1.625, 0.875],
        ])}}`,
        btn,
        `.ck-ph-b{border-radius:var(--ck-radius);background:${TINT}}`,
        image,
      ];
    case 'generic':
      return [
        ...split,
        `.ck-ph-t{height:3.75rem;margin-top:1.5rem;max-width:32rem;background:${lines(side, [
          [100, 0, 0.75],
          [92, 1.375, 0.75],
          [64, 2.75, 0.75],
        ])}}`,
        btn,
        `.ck-ph-b{border-radius:var(--ck-radius);background:${TINT}}`,
        image,
      ];
    case 'form':
      return [
        ...split.map((rule) => rule.replace('align-items:center', 'align-items:start')),
        `.ck-ph-t{height:3.75rem;margin-top:1.5rem;max-width:26rem;background:${lines(side, [
          [100, 0, 0.75],
          [88, 1.375, 0.75],
          [56, 2.75, 0.75],
        ])}}`,
        card,
        `.ck-ph-in::before{content:"";display:block;width:30%;height:.625rem;margin-bottom:.625rem;border-radius:1rem;background:${TINT}}`,
        '.ck-ph-in::after{content:"";display:block;height:2.75rem;border:1px solid var(--ck-border);border-radius:min(var(--ck-radius),.75rem);background:var(--ck-bg)}',
        '.ck-ph-in+.ck-ph-in{margin-top:1.25rem}',
        '.ck-ph-in:nth-child(3)::after{height:6.5rem}',
        btn.replace('width:10rem', 'width:100%').replace('margin-top:2rem', 'margin-top:1.75rem'),
      ];
    case 'cta':
      return [
        '.ck-ph-band{display:flex;flex-direction:column;align-items:center;text-align:center;padding:3.5rem 1.5rem;border-radius:var(--ck-radius);border:1px solid var(--ck-border);background:color-mix(in srgb,var(--ck-accent) 9%,var(--ck-surface))}',
        `.ck-ph-t{width:min(100%,30rem);height:2.25rem;margin-top:1.25rem;background:${lines('center', [
          [100, 0, 0.75],
          [62, 1.375, 0.75],
        ])}}`,
        btn,
      ];
    case 'features':
      return [
        ...grid,
        '.ck-ph-f::before{content:"";display:block;width:3rem;height:3rem;margin-bottom:1.5rem;border-radius:.875rem;background:color-mix(in srgb,var(--ck-accent) 22%,transparent)}',
        `.ck-ph-f::after{content:"";display:block;height:4.75rem;background:${lines(side, [
          [55, 0, 1],
          [100, 2, 0.625],
          [78, 3.25, 0.625],
        ])}}`,
      ];
    case 'pricing':
      return [
        ...grid,
        `.ck-ph-p::before{content:"";display:block;height:8.25rem;background:${lines(side, [
          [36, 0, 0.75],
          [52, 1.5, 2.25],
          [90, 5, 0.625],
          [72, 6.25, 0.625],
          [82, 7.5, 0.625],
        ])}}`,
        `.ck-ph-p::after{content:"";display:block;height:2.75rem;margin-top:1.75rem;border-radius:var(--ck-radius-button);background:${TINT}}`,
        '.ck-ph-p:nth-child(2){border-color:var(--ck-accent);box-shadow:0 0 0 1px var(--ck-accent)}',
        '.ck-ph-p:nth-child(2)::after{background:color-mix(in srgb,var(--ck-accent) 30%,transparent)}',
      ];
    case 'testimonials': {
      const avatar = side === 'left' ? '1.375rem' : 'calc(100% - 1.375rem)';
      return [
        ...grid,
        `.ck-ph-q::before{content:"\\${side === 'left' ? '201C' : '201D'}";display:block;height:7rem;font-size:3.5rem;font-weight:700;line-height:1;color:var(--ck-accent-ink);background:${lines(side, [
          [100, 3, 0.625],
          [94, 4.25, 0.625],
          [66, 5.5, 0.625],
        ])}}`,
        `.ck-ph-q::after{content:"";display:block;height:2.75rem;margin-top:1.25rem;background:radial-gradient(circle at ${avatar} 50%,${TINT} 1.375rem,transparent 1.42rem),${lines(side, [
          [36, 0.5, 0.75, 3.75],
          [24, 1.75, 0.5, 3.75],
        ])}}`,
      ];
    }
    case 'gallery':
      return [
        '.ck-ph-gal{display:grid;gap:1rem;margin-top:2.5rem;grid-template-columns:repeat(2,1fr);grid-auto-rows:8rem}',
        `${MD}{.ck-ph-gal{grid-template-columns:repeat(4,1fr);grid-auto-rows:11rem}}`,
        '.ck-ph-gal>:first-child{grid-column:span 2;grid-row:span 2}',
        `.ck-ph-b{border-radius:var(--ck-radius);background:${TINT}}`,
      ];
    case 'faq':
      return [
        ...rows,
        '.ck-ph-r::after{content:"";flex:none;width:1.25rem;height:1.25rem;opacity:.55;background:linear-gradient(var(--ck-muted),var(--ck-muted)) center/100% 2px no-repeat,linear-gradient(var(--ck-muted),var(--ck-muted)) center/2px 100% no-repeat}',
      ];
    case 'menu':
      return [
        ...rows,
        `${MD}{.ck-ph-m{max-width:none;display:grid;grid-template-columns:1fr 1fr;column-gap:4rem}}`,
        '.ck-ph-r::after{content:"";flex:none;width:3.5rem;height:.875rem;border-radius:1rem;background:color-mix(in srgb,var(--ck-accent) 30%,transparent)}',
      ];
    case 'footer':
      return [
        '.ck-ph h2{font-size:.875rem;line-height:1.25rem;font-weight:600;color:var(--ck-muted)}',
        '.ck-ph-cols{display:grid;gap:2.5rem;margin-top:2rem;grid-template-columns:1fr 1fr}',
        `${MD}{.ck-ph-cols{grid-template-columns:2fr 1fr 1fr 1fr}}`,
        `.ck-ph-t{grid-column:1/-1;height:4.5rem;max-width:20rem;background:${lines(side, [
          [60, 0, 1.25],
          [100, 2.5, 0.625],
          [80, 3.75, 0.625],
        ])}}`,
        `${MD}{.ck-ph-t{grid-column:auto}}`,
        `.ck-ph-k{height:6.25rem;background:${lines(side, [
          [50, 0, 0.75],
          [80, 2, 0.625],
          [64, 3.5, 0.625],
          [72, 5, 0.625],
        ])}}`,
      ];
    case 'bar':
      return [
        '.ck-ph-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1.5rem}',
        '.ck-ph h2{font-size:1.25rem;line-height:1.75rem;font-weight:700}',
        `.ck-ph-nav{flex:1;max-width:24rem;height:.75rem;background:${lines(side, [
          [20, 0, 0.75],
          [20, 0, 0.75, 7],
          [20, 0, 0.75, 14],
        ])}}`,
        btn.replace('margin-top:2rem', 'margin-top:0').replace('height:3rem', 'height:2.5rem'),
      ];
  }
}

/** The rules every placeholder shares: its tint, the label, the sweep, and the reduced-motion rule. */
function baseCss(label: string, rtl: boolean): string[] {
  return [
    '.ck-ph{--ck-ph:color-mix(in srgb,var(--ck-ink) 8%,transparent);position:relative;isolation:isolate;overflow:hidden}',
    // A soft light band crossing the section in the reading direction.
    `.ck-ph::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(100deg,transparent 35%,color-mix(in srgb,var(--ck-bg) 50%,transparent) 50%,transparent 65%) 0 0/250% 100%;animation:ck-ph-sweep 2.4s ease-in-out infinite${rtl ? ' reverse' : ''}}`,
    '.ck-ph :is(h1,h2),.ck-ph-note{position:relative;z-index:2}',
    '.ck-ph-note{display:flex;align-items:center;gap:.5rem;margin-bottom:1rem;font-size:.8125rem;font-weight:500;color:var(--ck-muted)}',
    '.ck-ph-note::before{content:"";flex:none;width:.5rem;height:.5rem;border-radius:50%;background:var(--ck-accent);animation:ck-ph-dot 1.2s ease-in-out infinite alternate}',
    `.ck-ph-note::after{content:${cssString(label)}}`,
    '@keyframes ck-ph-sweep{from{background-position:100% 0}to{background-position:0 0}}',
    '@keyframes ck-ph-dot{to{opacity:.35}}',
    '@media (prefers-reduced-motion:reduce){.ck-ph::after{display:none}.ck-ph-note::before{animation:none}}',
  ];
}

// ── The region ────────────────────────────────────────────────────────────────

function noteFor(plan: PagePlan): string {
  const primary = plan.locale.lang.split('-')[0] ?? plan.locale.lang;
  return PLACEHOLDER_NOTE[primary] ?? PLACEHOLDER_NOTE['en'] ?? '';
}

/**
 * The placeholder region for one section: the tree (its outer tag, anchor and
 * classes as given) and the css that draws its shape.
 *
 * @param outer The outer element's tag and shell classes — the caller's contract.
 * @param heading The section's heading, holding the plan's title.
 */
export function placeholderRegion(
  plan: PagePlan,
  contract: SectionContract,
  outer: { readonly tag: string; readonly className: string },
  heading: TreeElement,
): PlaceholderRegion {
  const shape = placeholderShapeOf(contract);
  const rtl = plan.locale.dir === 'rtl';
  const note = el('div', 'ck-ph-note');
  const status: TreeElement = { ...note, attributes: { role: 'status' } };
  const tree: TreeElement = {
    kind: 'element',
    tag: outer.tag,
    className: `${outer.className} ${PLACEHOLDER_CLASS} ${PLACEHOLDER_CLASS}--${shape}`,
    attributes: { id: contract.anchorId },
    children: [el('div', CONTAINER, body(shape, status, heading))],
  };
  const css = [...baseCss(noteFor(plan), rtl), ...shapeCss(shape, rtl ? 'right' : 'left')].join('');
  return { shape, tree, css };
}
