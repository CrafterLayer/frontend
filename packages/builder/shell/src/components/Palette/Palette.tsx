import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { insertedNodeId, type BuilderKernel } from '@craftkit/builder-core';
import type { NodeId } from '@craftkit/builder-schema';

import { seatOf, slotAccepts } from '../../overlay/drop-resolver';
import type { CanvasDragHandle } from '../EditorCanvas';
import '../../styles/visually-hidden.css';
import './Palette.css';
import { localBlockName } from '../../i18n/block-names';
import { diagramForBlockType } from './diagrams';
import { PALETTE_LABELS_EN, type PaletteCategory, type PaletteLabels } from './Palette.labels';
// library-playground additions (2026-10-08): photo template cards, ordered by the page language.
import {
  TEMPLATE_CARD_LABELS_AR,
  TEMPLATE_CARD_LABELS_EN,
  TemplateCard,
  orderTemplateCards,
  pageContentLanguage,
  templateCardSearchText,
  type TemplateCardInfo,
} from '../TemplateCard';
// end library-playground additions

const PALETTE_CATEGORIES = [
  'Layout',
  'Content',
  'Marketing',
  'Primary',
] as const satisfies readonly PaletteCategory[];

const KNOWN_BLOCK_NAMES: Readonly<Record<string, string>> = {
  action: 'Action',
  accordion: 'Accordion',
  accordionitem: 'Accordion Item',
  announcement: 'Announcement',
  aurorabackground: 'Aurora Background',
  banner: 'Banner',
  bentogrid: 'Bento Grid',
  badge: 'Badge',
  breadcrumbs: 'Breadcrumbs',
  bloggrid: 'Blog Grid',
  button: 'Button',
  card: 'Card',
  carousel: 'Carousel',
  columns: 'Columns',
  container: 'Container',
  contact: 'Contact',
  contentsection: 'Content Section',
  comparisontable: 'Comparison Table',
  cloudshader: 'Cloud Shader',
  cta: 'CTA',
  divider: 'Divider',
  dialog: 'Dialog',
  dotpatternsurface: 'Dot Pattern Surface',
  embed: 'Embed',
  faq: 'FAQ',
  feature: 'Feature',
  features: 'Features',
  footer: 'Footer',
  form: 'Form',
  formsection: 'Form Section',
  gallery: 'Gallery',
  grid: 'Grid',
  heading: 'Heading',
  hero: 'Hero',
  image: 'Image',
  logocloud: 'Logo Cloud',
  marquee: 'Marquee',
  media: 'Media',
  navbar: 'Navigation',
  navigation: 'Navigation',
  page: 'Page',
  pagefooter: 'Page Footer',
  pageheader: 'Page Header',
  paragraph: 'Paragraph',
  pagination: 'Pagination',
  processsteps: 'Process Steps',
  portfoliogrid: 'Portfolio Grid',
  productgrid: 'Product Grid',
  progress: 'Progress',
  promobanner: 'Promo Banner',
  plan: 'Plan',
  pricing: 'Pricing',
  quote: 'Quote',
  review: 'Review',
  richtext: 'Rich Text',
  row: 'Row',
  section: 'Section',
  separator: 'Separator',
  shadcnalert: 'Alert',
  shineborder: 'Shine Border',
  shimmerbutton: 'Shimmer Button',
  stats: 'Stats',
  spacer: 'Spacer',
  stack: 'Stack',
  spotlightsurface: 'Spotlight Surface',
  tabpanel: 'Tab Panel',
  tabs: 'Tabs',
  testimonial: 'Testimonial',
  testimonials: 'Testimonials',
  team: 'Team',
  text: 'Text',
  video: 'Video',
  videosection: 'Video Section',
  newsletter: 'Newsletter',
  avatargroup: 'Avatar Group',
};

interface PaletteEntry {
  readonly category: PaletteCategory;
  readonly name: string;
  readonly searchText: string;
  readonly type: string;
}

interface TemplateEntry {
  readonly id: string;
  readonly name: string;
  readonly previewKind: 'agency' | 'commerce' | 'saas' | 'services';
  readonly rootType: string;
  readonly sectionCount: number;
  readonly searchText: string;
  // library-playground additions (2026-10-08)
  readonly card?: TemplateCardInfo | undefined;
  // end library-playground additions
}

interface InsertionPlacement {
  readonly parentId: NodeId;
  readonly slot: string;
  readonly index: number;
}

type PaletteView = 'blocks' | 'templates';

function normalizedBlockType(type: string): string {
  return type.replace(/[^a-zA-Z0-9]/g, '').toLocaleLowerCase();
}

function categoryForBlock(type: string): PaletteCategory {
  const key = normalizedBlockType(type);

  if (
    key.includes('hero') ||
    key.includes('feature') ||
    key.includes('pricing') ||
    key.includes('testimonial') ||
    key.includes('cta') ||
    key.includes('faq') ||
    key.includes('navigation') ||
    key.includes('navbar') ||
    key.includes('footer') ||
    key.includes('banner') ||
    key.includes('announcement') ||
    key.includes('logo') ||
    key.includes('stats') ||
    key.includes('bento') ||
    key.includes('contentsection') ||
    key.includes('process') ||
    key.includes('newsletter') ||
    key.includes('team') ||
    key.includes('blog') ||
    key.includes('contact') ||
    key.includes('comparison') ||
    key.includes('carousel') ||
    key.includes('gallery') ||
    key.includes('videosection') ||
    key.includes('formsection') ||
    key.includes('portfolio') ||
    key.includes('productgrid')
  ) {
    return 'Marketing';
  }
  if (
    key.includes('page') ||
    key.includes('section') ||
    key.includes('container') ||
    key.includes('column') ||
    key.includes('grid') ||
    key.includes('row') ||
    key.includes('stack') ||
    key.includes('spacer') ||
    key.includes('divider')
  ) {
    return 'Layout';
  }
  if (
    key.includes('richtext') ||
    key.includes('text') ||
    key.includes('heading') ||
    key.includes('paragraph') ||
    key.includes('image') ||
    key.includes('media') ||
    key.includes('video') ||
    key.includes('embed') ||
    key.includes('form') ||
    /*
      A row of links is CONTENT — it is words a person writes. The marketing
      group above claims `navbar` and `navigation` first, and it is checked
      first, so a site's masthead nav stays where it was.
    */
    key.includes('link') ||
    key.includes('nav')
  ) {
    return 'Content';
  }
  return 'Primary';
}

/**
 * The name on a palette tile.
 *
 * The fallback used to be the schema's `description`, which is a SENTENCE — an
 * unlisted block therefore rendered a paragraph inside a 78px tile, pushing
 * every neighbouring tile down the column. A description explains a block to
 * someone deciding whether to use it; it was never a name.
 *
 * So an unlisted type is titled from the type itself: `pageHeader` reads "Page
 * Header", which is what a person would have called it anyway. The map above
 * still wins, because some blocks are named nothing like their type (`richText`
 * → "Rich Text", `navbar` → "Navigation").
 */
function blockName(type: string, description: string): string {
  const leaf = type.split(/[:/]/).at(-1) ?? type;
  const known = KNOWN_BLOCK_NAMES[normalizedBlockType(leaf)];
  if (known !== undefined) return known;
  const titled = titleFromType(leaf);
  return titled === '' ? description : titled;
}

/** `pageHeader` → `Page Header`; `hero-banner` → `Hero Banner`. */
function titleFromType(type: string): string {
  return type
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .filter((word) => word !== '')
    .map((word) => word.charAt(0).toLocaleUpperCase() + word.slice(1))
    .join(' ');
}

function templatePreviewKind(id: string, name: string): TemplateEntry['previewKind'] {
  const key = `${id} ${name}`.toLocaleLowerCase();
  if (key.includes('agency') || key.includes('studio')) return 'agency';
  if (key.includes('commerce') || key.includes('store') || key.includes('shop')) return 'commerce';
  if (key.includes('service') || key.includes('consult')) return 'services';
  return 'saas';
}

/** Resolve click/keyboard placement once so blocks and templates obey identical slot rules. */
function insertionPlacement(kernel: BuilderKernel, type: string): InsertionPlacement | undefined {
  const doc = kernel.getDocument();
  const registry = kernel.context.registry;
  const payload = { kind: 'insert', type } as const;
  const selected = kernel.context.store.getState().selection[0];

  // A selected container receives the new content before sibling placement is considered.
  if (selected !== undefined) {
    const selectedType = doc.nodes[selected]?.type ?? '';
    for (const slot of Object.keys(registry.block(selectedType)?.schema.slots ?? {})) {
      if (slotAccepts(doc, registry, selected, slot, payload)) {
        return { parentId: selected, slot, index: doc.nodes[selected]?.slots?.[slot]?.length ?? 0 };
      }
    }
  }

  // A selected leaf gets a sibling immediately after itself when that seat accepts the type.
  if (selected !== undefined) {
    const seat = seatOf(doc, selected);
    if (seat !== undefined && slotAccepts(doc, registry, seat.parentId, seat.slot, payload)) {
      return { parentId: seat.parentId, slot: seat.slot, index: seat.index + 1 };
    }
  }

  // Otherwise walk toward the root and append to the first compatible slot.
  let candidate: NodeId | undefined = selected ?? doc.rootId;
  while (candidate !== undefined) {
    const candidateType = doc.nodes[candidate]?.type ?? '';
    for (const slot of Object.keys(registry.block(candidateType)?.schema.slots ?? {})) {
      if (slotAccepts(doc, registry, candidate, slot, payload)) {
        return {
          parentId: candidate,
          slot,
          index: doc.nodes[candidate]?.slots?.[slot]?.length ?? 0,
        };
      }
    }
    candidate = candidate === doc.rootId ? undefined : seatOf(doc, candidate)?.parentId;
  }
  return undefined;
}

export interface PaletteProps {
  /** BY PROP — the shell never reads React context. */
  kernel: BuilderKernel;
  /** Hands insert payloads to the canvas session; absent ⇒ keyboard-insert only. */
  dragHandle?: CanvasDragHandle | undefined;
  /** Every string the palette shows or announces (arabic-editor); English by default. */
  labels?: PaletteLabels | undefined;
  // library-playground additions (2026-10-08)
  /**
   * Template cards for registered compositions (`marketingTemplateCatalog` in
   * the editor): a composition with a card renders as a `TemplateCard`, the
   * page's language first; one without keeps the abstract preview.
   */
  templateCards?: readonly TemplateCardInfo[] | undefined;
  // end library-playground additions
  /**
   * Draw the Blocks / Templates switch (default `true`). A host that already offers
   * templates beside the palette (LibraryPanel's own Templates tab) turns it off, so the
   * person never meets a row of tabs inside a row of tabs; the palette then shows blocks.
   */
  showViewTabs?: boolean | undefined;
}

/**
 * The registered block vocabulary (006 contract §4): live under runtime
 * registration/disposal (the kernel-intrinsic catalog version — the B1 race-
 * proof pattern), insertable by keyboard (walk-up placement rule p2) or by
 * dragging onto the canvas (payload handoff p3 — the canvas owns chrome and
 * resolution; the palette owns nothing but the payload).
 */
// library-playground additions (2026-10-08): the signature is split over lines to take `templateCards`.
export function Palette({
  kernel,
  dragHandle,
  labels = PALETTE_LABELS_EN,
  templateCards,
  showViewTabs = true,
}: PaletteProps) {
  // end library-playground additions
  const blockNames = labels.blockNames;
  const paletteId = useId();
  const searchId = `${paletteId}-search`;
  const [query, setQuery] = useState('');
  const [view, setView] = useState<PaletteView>('blocks');
  const [collapsedCategories, setCollapsedCategories] = useState<ReadonlySet<PaletteCategory>>(
    () => new Set(),
  );
  // {text, nonce}: a REPEATED outcome (clicking a no-acceptor entry twice) must
  // still mutate the live region's text node or AT hears nothing the second
  // time — a zero-width space toggles on odd nonces, invisible but announced.
  const [message, setMessageState] = useState({ text: '', nonce: 0 });
  const setMessage = useCallback((text: string) => {
    setMessageState((current) => ({ text, nonce: current.nonce + 1 }));
  }, []);

  // The probe for the most recent pointer press: if that press turned into a
  // REAL drag (crossed the threshold), the button's own click must not insert —
  // an aborted drag would otherwise announce a cancel AND commit a transaction.
  const gestureProbeRef = useRef<{ didActivate: () => boolean } | null>(null);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const offRegistered = kernel.context.events.on('extension.registered', onStoreChange);
      const offDisposed = kernel.context.events.on('extension.disposed', onStoreChange);
      return () => {
        offRegistered();
        offDisposed();
      };
    },
    [kernel],
  );
  const getVersion = useCallback(() => kernel.extensions.version(), [kernel]);
  const catalogVersion = useSyncExternalStore(subscribe, getVersion, getVersion);

  const entries = useMemo(() => {
    void catalogVersion; // the memo's real dependency: the catalog generation
    const surface = kernel.getDocument().surface;
    return kernel.context.registry
      .blocks(surface)
      // ── block-parts (2026-10-06) ──
      // A card inserts with NO props, so a block whose schema cannot default
      // (a symbol instance needs a symbol id; the Symbols panel places those)
      // has no card: clicking it threw "failed its schema" and inserted nothing.
      .filter((entry) => entry.schema.props.safeParse({}).success)
      // ── /block-parts ──
      .map((entry): PaletteEntry => {
        const type = entry.schema.type;
        const english = blockName(type, entry.schema.description);
        const name = localBlockName(type, blockNames) ?? english;
        const category = categoryForBlock(type);
        return {
          category,
          name,
          // Either language finds a block: the shown name, the English name and the type.
          searchText:
            `${name} ${english} ${type} ${entry.schema.description} ${category} ${labels.categories[category]}`.toLocaleLowerCase(),
          type,
        };
      });
  }, [kernel, catalogVersion, blockNames, labels]);

  // library-playground additions (2026-10-08)
  const cardsById = useMemo(
    () => new Map((templateCards ?? []).map((card) => [card.id, card] as const)),
    [templateCards],
  );
  // end library-playground additions
  const templates = useMemo(() => {
    void catalogVersion;
    const surface = kernel.getDocument().surface;
    return kernel.context.registry.compositions(surface).flatMap((composition): TemplateEntry[] => {
      const root = composition.nodes[composition.rootId];
      if (root === undefined) return [];
      const sectionCount = Object.values(root.slots ?? {}).reduce(
        (total, children) => total + children.length,
        0,
      );
      // library-playground additions (2026-10-08): a card names the template in the editor's
      // language, and its search matches both languages.
      const card = cardsById.get(composition.id);
      const shown = card === undefined ? composition.name : card.name[labels.language];
      // end library-playground additions
      return [
        {
          id: composition.id,
          name: shown, // library-playground additions (2026-10-08)
          previewKind: templatePreviewKind(composition.id, composition.name),
          rootType: root.type,
          sectionCount: Math.max(1, sectionCount),
          // library-playground additions (2026-10-08): both languages' names and descriptions.
          searchText:
            `${composition.name} ${composition.id} ${root.type} ${card === undefined ? '' : templateCardSearchText(card)}`.toLocaleLowerCase(),
          card,
          // end library-playground additions
        },
      ];
    });
  }, [kernel, catalogVersion, cardsById, labels.language]); // library-playground additions: + cards, language
  // library-playground additions (2026-10-08): the page's content language orders the cards.
  const pageLanguage = useSyncExternalStore(
    useCallback((onChange: () => void) => kernel.context.store.subscribe(onChange), [kernel]),
    useCallback(() => pageContentLanguage(kernel.getDocument()), [kernel]),
  );
  const templateCardLabels = labels.language === 'ar' ? TEMPLATE_CARD_LABELS_AR : TEMPLATE_CARD_LABELS_EN;
  // end library-playground additions

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleEntries = entries.filter(
    (entry) => normalizedQuery === '' || entry.searchText.includes(normalizedQuery),
  );
  const groups = PALETTE_CATEGORIES.map((category) => ({
    category,
    entries: visibleEntries.filter((entry) => entry.category === category),
  })).filter((group) => group.entries.length > 0);
  const visibleTemplates = templates.filter(
    (entry) => normalizedQuery === '' || entry.searchText.includes(normalizedQuery),
  );

  const insertAtSelection = useCallback(
    (type: string) => {
      // English announces the type (its long-standing wording); a localised palette says the name.
      const spoken = blockNames === undefined ? type : (localBlockName(type, blockNames) ?? type);
      const placement = insertionPlacement(kernel, type);
      if (placement === undefined) {
        setMessage(labels.noSlot(spoken));
        return;
      }
      const tx = kernel.dispatch('insertNode', { type, ...placement });
      const inserted = insertedNodeId(tx.patches);
      if (inserted !== undefined) kernel.setSelection([inserted]);
      setMessage(labels.inserted(spoken));
    },
    [kernel, setMessage, blockNames, labels],
  );

  const insertTemplateAtSelection = useCallback(
    (compositionId: string, rootType: string, name: string) => {
      const spoken = labels.language === 'en' ? compositionId : name;
      const placement = insertionPlacement(kernel, rootType);
      if (placement === undefined) {
        setMessage(labels.noTemplateSlot(spoken));
        return;
      }
      const tx = kernel.dispatch('insertComposition', { compositionId, ...placement });
      const inserted = insertedNodeId(tx.patches);
      if (inserted !== undefined) kernel.setSelection([inserted]);
      setMessage(labels.insertedTemplate(spoken));
    },
    [kernel, setMessage, labels],
  );

  // library-playground additions (2026-10-08): one template entry — a photo card when the host
  // gave one, else today's abstract preview.
  const otherLanguageId = `${paletteId}-other-language`;
  const cardedTemplates = visibleTemplates.filter(
    (template): template is TemplateEntry & { card: TemplateCardInfo } => template.card !== undefined,
  );
  const orderedCards = orderTemplateCards(cardedTemplates, pageLanguage);
  const pageLanguageTemplates: readonly TemplateEntry[] = [
    ...orderedCards.matching,
    ...visibleTemplates.filter((template) => template.card === undefined),
  ];
  const otherLanguageTemplates: readonly TemplateEntry[] = orderedCards.other;
  const renderTemplate = (template: TemplateEntry) => (
    <li key={template.id} className={template.card === undefined ? undefined : 'bldr-palette__template-card'}>
      {template.card === undefined ? (
        <button
          type="button"
          className="bldr-palette__template"
          onClick={() => {
            insertTemplateAtSelection(template.id, template.rootType, template.name);
          }}
        >
          <span
            className="bldr-palette__template-preview"
            data-preview-kind={template.previewKind}
            aria-hidden="true"
          >
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className="bldr-palette__template-copy">
            <strong>{template.name}</strong>
            <small>{labels.sections(template.sectionCount)}</small>
          </span>
        </button>
      ) : (
        <TemplateCard
          card={template.card}
          labels={templateCardLabels}
          onInsert={() => {
            insertTemplateAtSelection(template.id, template.rootType, template.name);
          }}
        />
      )}
    </li>
  );
  // end library-playground additions

  const toggleCategory = (category: PaletteCategory) => {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <nav className="bldr-palette" aria-label={labels.palette}>
      {showViewTabs ? (
        <div className="bldr-palette__tabs" role="tablist" aria-label={labels.tabs}>
          {(['blocks', 'templates'] as const).map((candidate) => (
            <button
              key={candidate}
              type="button"
              role="tab"
              className="bldr-palette__tab"
              aria-selected={view === candidate}
              onClick={() => {
                setView(candidate);
                setQuery('');
              }}
            >
              {candidate === 'blocks' ? labels.blocksTab : labels.templatesTab(templates.length)}
            </button>
          ))}
        </div>
      ) : null}
      <div className="bldr-palette__search">
        <label className="bldr-visually-hidden" htmlFor={searchId}>
          {view === 'blocks' ? labels.searchBlocks : labels.searchTemplates}
        </label>
        <input
          id={searchId}
          className="bldr-palette__search-input"
          type="search"
          value={query}
          placeholder={view === 'blocks' ? labels.searchBlocks : labels.searchTemplates}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
          }}
        />
        <svg
          className="bldr-palette__search-icon bldr-palette__search-icon--start"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fillRule="evenodd"
            d="M8.25 3.25a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm-6.5 5a6.5 6.5 0 1 1 11.62 4.02l4.16 4.16-1.06 1.06-4.16-4.16A6.5 6.5 0 0 1 1.75 8.25Z"
            clipRule="evenodd"
          />
        </svg>
        <svg
          className="bldr-palette__search-icon bldr-palette__search-icon--end"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M4.25 3h1.5v3h-1.5V3Zm0 7h1.5v7h-1.5v-7Zm5-7h1.5v8h-1.5V3Zm0 12h1.5v2h-1.5v-2Zm5-12h1.5v5h-1.5V3Zm0 9h1.5v5h-1.5v-5ZM2 7h6v2H2V7Zm5 5h6v2H7v-2Zm5-3h6v2h-6V9Z" />
        </svg>
      </div>

      {view === 'templates' ? (
        visibleTemplates.length === 0 ? (
          <p className="bldr-palette__empty" role="status">
            {templates.length === 0 ? labels.noTemplates : labels.noTemplateMatch}
          </p>
        ) : (
          // library-playground additions (2026-10-08): cards in the page's language, the plain
          // previews, then "Other language". Nothing is hidden.
          <>
            {pageLanguageTemplates.length === 0 ? null : (
              <ul className="bldr-palette__template-grid" data-group="page-language">
                {pageLanguageTemplates.map(renderTemplate)}
              </ul>
            )}
            {otherLanguageTemplates.length === 0 ? null : (
              <section className="bldr-palette__template-group" aria-labelledby={otherLanguageId}>
                <h3 id={otherLanguageId} className="bldr-palette__template-group-heading">
                  {labels.otherLanguage ?? (labels.language === 'ar' ? 'لغة أخرى' : 'Other language')}
                </h3>
                <ul className="bldr-palette__template-grid" data-group="other-language">
                  {otherLanguageTemplates.map(renderTemplate)}
                </ul>
              </section>
            )}
          </>
          // end library-playground additions
        )
      ) : groups.length === 0 ? (
        <p className="bldr-palette__empty" role="status">
          {labels.noBlockMatch}
        </p>
      ) : (
        <div className="bldr-palette__groups">
          {groups.map((group) => {
            const categorySlug = group.category.toLocaleLowerCase();
            const labelId = `${paletteId}-${categorySlug}-label`;
            const regionId = `${paletteId}-${categorySlug}-region`;
            const isCollapsed = collapsedCategories.has(group.category);

            return (
              <section className="bldr-palette__group" key={group.category}>
                <h2 className="bldr-palette__group-heading">
                  <button
                    type="button"
                    className="bldr-palette__group-toggle"
                    aria-expanded={!isCollapsed}
                    aria-controls={regionId}
                    onClick={() => {
                      toggleCategory(group.category);
                    }}
                  >
                    <svg
                      className="bldr-palette__chevron"
                      data-collapsed={isCollapsed}
                      viewBox="0 0 12 12"
                      fill="currentColor"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M1.75 4.25 6 8.1l4.25-3.85-1-1.1L6 6.1l-3.25-2.95-1 1.1Z" />
                    </svg>
                    <span id={labelId}>{labels.categories[group.category]}</span>
                  </button>
                </h2>
                <div
                  id={regionId}
                  className="bldr-palette__group-region"
                  role="region"
                  aria-labelledby={labelId}
                  hidden={isCollapsed}
                >
                  <ul className="bldr-palette__grid">
                    {group.entries.map((entry) => {
                      const diagram = diagramForBlockType(entry.type);
                      return (
                        <li className="bldr-palette__item" key={entry.type}>
                          <button
                            type="button"
                            className="bldr-palette__entry"
                            onClick={() => {
                              const dragged = gestureProbeRef.current?.didActivate() ?? false;
                              gestureProbeRef.current = null;
                              if (dragged) {
                                return; // the drag session owned this gesture, committed or cancelled
                              }
                              insertAtSelection(entry.type);
                            }}
                            onPointerDown={(event) => {
                              // p3: the drag path — the canvas takes over from here.
                              gestureProbeRef.current =
                                dragHandle?.beginInsert(entry.type, event.clientX, event.clientY) ??
                                null;
                            }}
                          >
                            <span className="bldr-palette__tile">
                              <svg
                                className="bldr-palette__diagram"
                                data-diagram={diagram.kind}
                                viewBox="0 0 34 24"
                                fill="currentColor"
                                aria-hidden="true"
                                focusable="false"
                              >
                                {diagram.parts.map((part) => (
                                  <rect
                                    key={part.key}
                                    x={part.x}
                                    y={part.y}
                                    width={part.width}
                                    height={part.height}
                                    opacity={part.opacity}
                                  />
                                ))}
                              </svg>
                            </span>
                            <span className="bldr-palette__entry-name">{entry.name}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      )}
      <output className="bldr-visually-hidden" aria-live="polite" aria-label={labels.status}>
        {message.text}
        {message.nonce % 2 === 1 ? '​' : ''}
      </output>
    </nav>
  );
}
