import * as Tabs from '@radix-ui/react-tabs';
import { useCallback, useId, useMemo, useState, useSyncExternalStore } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { CustomCodeNode, CustomCodeRoot, SavedTemplate } from '@craftkit/builder-schema';

import { ELEMENT_ACTION_LABELS_EN, type ElementActionLabels } from '../../clipboard/element-actions.labels';
import { insertPayloads } from '../../clipboard/element-clipboard';
import { elementPayload, type ElementPayload } from '../../custom-code/element-drag-payload';
import type { ElementNameWords } from '../../custom-code/element-target';
import type { CanvasDragHandle } from '../EditorCanvas';
import { Palette } from '../Palette';
import '../../styles/visually-hidden.css';
import { insertCompositionAtSelection, insertLibraryTree, regionBlockType, type Placement } from './library-insert';
import { elementCategory, ELEMENT_CATEGORIES } from './library-categories';
import { LIBRARY_ELEMENT_PRESETS, type LibraryLanguage } from './library-presets';
import { previewMarkup, previewSrcdoc, treeClassNames } from './library-preview';
import { LIBRARY_PANEL_LABELS_EN, type LibraryPanelLabels } from './LibraryPanel.labels';
import { LibraryTile } from './LibraryTile';
// library-playground additions (2026-10-08): template cards, the Templates tab, the section page kit.
import {
  TEMPLATE_CARD_LABELS_AR,
  TEMPLATE_CARD_LABELS_EN,
  TemplateCard,
  orderTemplateCards,
  pageContentLanguage,
  templateCardSearchText,
  type TemplateCardInfo,
} from '../TemplateCard';
import type { LibraryPageKit } from './library-insert';
// end library-playground additions
import './LibraryPanel.css';

/** A ready-made section the host offers (P11 maps the section-kit catalogue to these). */
export interface LibrarySectionEntry {
  readonly id: string;
  readonly name: string;
  readonly nameAr?: string | undefined;
  /** Search words and a grouping hint ('hero', 'features', …). */
  readonly group?: string | undefined;
  readonly tree: CustomCodeRoot;
  readonly css?: string | undefined;
  // library-playground additions (2026-10-08)
  /**
   * The page-level stylesheet the section's `ck-*` classes need. Inserting the
   * section adds it to the page root's `pageCss` in the same transaction when
   * the page does not yet contain `marker`; its thumbnail is drawn with it.
   */
  readonly pageKit?: LibraryPageKit | undefined;
  // end library-playground additions
}

// library-playground additions (2026-10-08): 'templates' is a top-level tab.
export type LibraryTab = 'elements' | 'sections' | 'templates' | 'blocks' | 'saved';
// end library-playground additions

export interface LibraryPanelProps {
  /** BY PROP — the shell never reads React context. */
  kernel: BuilderKernel;
  /** The Blocks tab hands it to the composed Palette (block drags). */
  dragHandle?: CanvasDragHandle | undefined;
  /**
   * Starts a canvas drag of an element payload (P7 resolves the tree drop).
   * Absent ⇒ click-to-insert only.
   */
  beginElementDrag?:
    | ((payload: ElementPayload, hostX: number, hostY: number) => { didActivate: () => boolean })
    | undefined;
  /** Ready-made sections (section-kit catalogue, read-only). */
  sections?: readonly LibrarySectionEntry[] | undefined;
  /** `site.library.templates` — the Saved tab. */
  templates?: Readonly<Record<string, SavedTemplate>> | undefined;
  /** Removes a saved template (P5's `removeTemplate`); absent ⇒ no remove buttons. */
  onRemoveTemplate?: ((id: string) => void) | undefined;
  labels?: LibraryPanelLabels | undefined;
  actionLabels?: ElementActionLabels | undefined;
  words?: ElementNameWords | undefined;
  /** Stylesheet every thumbnail gets (the theme / token bridge CSS). */
  previewStylesheet?: string | undefined;
  /** Compiles exactly the classes a thumbnail uses (the live compiler's `compileFor`). */
  compilePreviewCss?: ((classNames: readonly string[]) => Promise<string>) | undefined;
  defaultTab?: LibraryTab | undefined;
  // library-playground additions (2026-10-08)
  /**
   * Template cards (photo, bilingual name and description, content language)
   * for registered compositions — `marketingTemplateCatalog` in the editor. A
   * composition with a card renders as a `TemplateCard` in the Templates tab;
   * one without keeps a plain tile. Absent ⇒ every composition is a plain tile.
   */
  templateCards?: readonly TemplateCardInfo[] | undefined;
  // end library-playground additions
}

interface Entry {
  readonly key: string;
  readonly kind: 'element' | 'section' | 'composition';
  readonly name: string;
  readonly search: string;
  readonly glyph: string;
  readonly description?: string | undefined;
  readonly badge?: string | undefined;
  readonly tree?: CustomCodeRoot | undefined;
  readonly css?: string | undefined;
  readonly compositionId?: string | undefined;
  readonly rootType?: string | undefined;
  readonly templateId?: string | undefined;
  // library-playground additions (2026-10-08)
  readonly pageKit?: LibraryPageKit | undefined;
  // end library-playground additions
}

// library-playground additions (2026-10-08)
/** One registered composition in the Templates tab: with its card when the host gave one. */
interface TemplateTabEntry {
  readonly key: string;
  readonly compositionId: string;
  readonly rootType: string;
  readonly name: string;
  readonly search: string;
  readonly card?: TemplateCardInfo | undefined;
}
// end library-playground additions

function glyphOf(node: CustomCodeNode | undefined): string {
  if (node === undefined) return '▭';
  if (node.kind === 'icon') return '◇';
  if (node.kind === 'component') return '⧉';
  return node.tag.slice(0, 3).toUpperCase();
}

/**
 * The Library (style-manager DESIGN.md §E): Elements (42 editable presets),
 * Sections (the host's ready-made sections), Templates (registered page templates),
 * Blocks (the Palette, composed), and Saved (the site's templates). One
 * search filters the open tab; a click inserts at the selection as one
 * labelled transaction; a press-and-drag hands the element to the canvas.
 */
export function LibraryPanel({
  kernel,
  dragHandle,
  beginElementDrag,
  sections = [],
  templates,
  onRemoveTemplate,
  labels = LIBRARY_PANEL_LABELS_EN,
  actionLabels = ELEMENT_ACTION_LABELS_EN,
  words,
  previewStylesheet = '',
  compilePreviewCss,
  defaultTab = 'elements',
  templateCards, // library-playground additions (2026-10-08)
}: LibraryPanelProps) {
  const searchId = useId();
  const [tab, setTab] = useState<LibraryTab>(defaultTab);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [message, setMessageState] = useState({ text: '', nonce: 0 });
  const announce = useCallback((text: string) => {
    setMessageState((current) => ({ text, nonce: current.nonce + 1 }));
  }, []);
  const language: LibraryLanguage = labels.language;

  // Registered templates follow runtime registration like the Palette does.
  const subscribe = useCallback(
    (onChange: () => void) => {
      const offRegistered = kernel.context.events.on('extension.registered', onChange);
      const offDisposed = kernel.context.events.on('extension.disposed', onChange);
      return () => {
        offRegistered();
        offDisposed();
      };
    },
    [kernel],
  );
  const getVersion = useCallback(() => kernel.extensions.version(), [kernel]);
  const catalogVersion = useSyncExternalStore(subscribe, getVersion, getVersion);

  const pageCss = useSyncExternalStore(
    useCallback((onChange: () => void) => kernel.context.store.subscribe(onChange), [kernel]),
    useCallback(() => {
      const document = kernel.getDocument();
      const css = document.nodes[document.rootId]?.props['pageCss'];
      return typeof css === 'string' ? css : '';
    }, [kernel]),
  );
  const pagePalette = pageCss.includes('.ck-page-plan{');

  const elements = useMemo<Entry[]>(
    () =>
      LIBRARY_ELEMENT_PRESETS.map((preset) => {
        const node = preset.node(language, pagePalette ? 'page' : 'site');
        return {
          key: `element:${preset.id}`,
          kind: 'element',
          name: preset.labels[language],
          search: `${preset.labels.en} ${preset.labels.ar} ${preset.keywords}`.toLocaleLowerCase(),
          glyph: glyphOf(node),
          description: preset.description?.[language],
          tree: { kind: 'root', children: [node] },
          css: preset.css?.(language), // media-motion (2026-10-06): a media preset's region hooks
        };
      }),
    [language, pagePalette],
  );

  // library-playground additions (2026-10-08): the Templates tab (agent-script DESIGN §B.5).
  const carded = useMemo(
    () => new Map((templateCards ?? []).map((card) => [card.id, card] as const)),
    [templateCards],
  );
  // The page's CONTENT language orders the cards: the root lang, else the direction.
  const pageLanguage = useSyncExternalStore(
    useCallback((onChange: () => void) => kernel.context.store.subscribe(onChange), [kernel]),
    useCallback(() => pageContentLanguage(kernel.getDocument()), [kernel]),
  );
  const templateEntries = useMemo<TemplateTabEntry[]>(() => {
    void catalogVersion;
    const surface = kernel.getDocument().surface;
    return kernel.context.registry.compositions(surface).flatMap((composition): TemplateTabEntry[] => {
      const root = composition.nodes[composition.rootId];
      if (root === undefined) return [];
      const card = carded.get(composition.id);
      return [
        {
          key: `template:${composition.id}`,
          compositionId: composition.id,
          rootType: root.type,
          name: card === undefined ? composition.name : card.name[language],
          search:
            `${composition.name} ${composition.id} ${root.type} ${card === undefined ? '' : templateCardSearchText(card)}`.toLocaleLowerCase(),
          card,
        },
      ];
    });
  }, [kernel, catalogVersion, carded, language]);
  const templateCardLabels = language === 'ar' ? TEMPLATE_CARD_LABELS_AR : TEMPLATE_CARD_LABELS_EN;
  // end library-playground additions

  const sectionEntries = useMemo<Entry[]>(() => {
    void catalogVersion;
    const surface = kernel.getDocument().surface;
    const compositions = kernel.context.registry.compositions(surface).flatMap((composition): Entry[] => {
      const root = composition.nodes[composition.rootId];
      if (root === undefined) return [];
      // library-playground additions (2026-10-08): a carded template lives in the Templates tab.
      if (carded.has(composition.id)) return [];
      // end library-playground additions
      return [
        {
          key: `composition:${composition.id}`,
          kind: 'composition',
          name: composition.name,
          search: `${composition.name} ${composition.id} ${root.type}`.toLocaleLowerCase(),
          glyph: '▤',
          compositionId: composition.id,
          rootType: root.type,
        },
      ];
    });
    const offered = sections.map(
      (section): Entry => ({
        key: `section:${section.id}`,
        kind: 'section',
        name: language === 'ar' && section.nameAr !== undefined ? section.nameAr : section.name,
        search: `${section.name} ${section.nameAr ?? ''} ${section.group ?? ''} ${section.id}`.toLocaleLowerCase(),
        glyph: glyphOf(section.tree.children[0]),
        badge: section.group,
        tree: section.tree,
        css: section.css,
        pageKit: section.pageKit, // library-playground additions (2026-10-08)
      }),
    );
    return [...offered, ...compositions];
  }, [kernel, catalogVersion, sections, language, carded]); // library-playground additions: + carded

  const savedEntries = useMemo<Entry[]>(
    () =>
      Object.values(templates ?? {})
        .slice()
        .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
        .map(
          (template): Entry => ({
            key: `saved:${template.id}`,
            kind: template.kind === 'section' ? 'section' : 'element',
            name: template.name,
            search: `${template.name} ${template.id}`.toLocaleLowerCase(),
            glyph: glyphOf(template.tree.children[0]),
            badge: labels.savedKinds[template.kind],
            tree: template.tree,
            css: template.css,
            templateId: template.id,
          }),
        ),
    [templates, labels],
  );

  const dir = kernel.getDocument().dir;
  // One stable preview builder per entry, so a tile's observer is not re-armed per render.
  const previews = useMemo(() => {
    const map = new Map<string, () => Promise<string | undefined>>();
    for (const entry of [...elements, ...sectionEntries, ...savedEntries]) {
      const tree = entry.tree;
      if (tree === undefined) continue;
      map.set(entry.key, async () => {
        // library-playground additions (2026-10-08): a kit section's thumbnail is drawn with its page
        // kit, scoped like the page would scope it, so the tile looks like the inserted result.
        const regionCss = entry.pageKit === undefined ? entry.css : `${entry.css ?? ''}\n${entry.pageKit.css}`;
        const markup = previewMarkup(kernel, tree, regionCss, dir, pagePalette && entry.kind === 'element' ? pageCss : undefined);
        // end library-playground additions
        if (markup === undefined) return undefined;
        const compiled = compilePreviewCss === undefined ? '' : await compilePreviewCss(treeClassNames(tree)).catch(() => '');
        return previewSrcdoc({
          markup,
          css: `${previewStylesheet}\n${compiled}\n${entry.css ?? ''}`,
          dir,
          lang: language,
        });
      });
    }
    return map;
  }, [elements, sectionEntries, savedEntries, kernel, dir, compilePreviewCss, previewStylesheet, language, pagePalette, pageCss]);

  const insert = useCallback(
    (entry: Entry, placement?: Placement) => {
      if (entry.kind === 'composition') {
        const ok =
          entry.compositionId !== undefined &&
          entry.rootType !== undefined &&
          insertCompositionAtSelection(kernel, entry.compositionId, entry.rootType);
        announce(ok ? labels.inserted(entry.name) : labels.cannotInsert(entry.name));
        return;
      }
      if (entry.tree === undefined) return;
      const outcome = insertLibraryTree({
        kernel,
        kind: entry.kind,
        name: entry.name,
        tree: entry.tree,
        css: entry.css,
        actionLabels,
        words,
        noRegionType: labels.noRegionType,
        pageKit: entry.pageKit, // library-playground additions (2026-10-08)
        placement,
      });
      announce(outcome.ok ? labels.inserted(entry.name) : outcome.message);
    },
    [kernel, actionLabels, words, labels, announce],
  );

  // library-playground additions (2026-10-08): a template inserts like the Palette's, one transaction.
  const insertTemplate = useCallback(
    (entry: TemplateTabEntry, placement?: Placement) => {
      const ok = insertCompositionAtSelection(kernel, entry.compositionId, entry.rootType, placement);
      announce(ok ? labels.inserted(entry.name) : labels.cannotInsert(entry.name));
    },
    [kernel, labels, announce],
  );
  // end library-playground additions

  /**
   * The element drag: the host's `beginElementDrag`, else the canvas handle's
   * own tree insert (P7) when it offers one.
   */
  const elementDragStarter = (
    entry: Entry,
  ): ((payload: ElementPayload, hostX: number, hostY: number) => { didActivate: () => boolean }) | undefined => {
    if (entry.kind === 'element' && entry.tree?.children.length === 1 && beginElementDrag !== undefined) return beginElementDrag;
    const type = regionBlockType(kernel);
    if (dragHandle === undefined || type === undefined) return undefined;
    const onDrop = (placement: Placement) => { insert(entry, placement); };
    return (payload, hostX, hostY) => {
      if (entry.kind !== 'element' || dragHandle.beginTreeInsert === undefined) {
        return dragHandle.beginInsert(type, hostX, hostY, onDrop);
      }
      return dragHandle.beginTreeInsert(payload.node, entry.name, hostX, hostY, {
        fallback: { kind: 'insert', type, onDrop },
        onDrop: (target) => {
          const payloads = entry.tree?.children.map((node) => elementPayload(node, entry.css)) ?? [payload];
          const result = insertPayloads({ kernel, targets: [], labels: actionLabels, words }, payloads, target, actionLabels.insert);
          announce(result.ok ? labels.inserted(entry.name) : result.message);
        },
      });
    };
  };

  const normalized = query.trim().toLocaleLowerCase();
  const filter = (list: readonly Entry[]) =>
    normalized === '' ? list : list.filter((entry) => entry.search.includes(normalized) || entry.name.toLocaleLowerCase().includes(normalized));

  const renderGrid = (list: readonly Entry[], empty: string) => {
    const visible = filter(list).filter((entry) => tab !== 'elements' || category === 'all' || elementCategory(entry.key.slice('element:'.length)) === category);
    if (visible.length === 0) {
      return (
        <p className="bldr-library__empty" role="status">
          {list.length === 0 ? empty : labels.noResults}
        </p>
      );
    }
    return (
      <ul className="bldr-library__grid">
        {visible.map((entry) => {
          const first = entry.tree?.children[0];
          const startDrag = elementDragStarter(entry);
          const draggable = startDrag !== undefined && first !== undefined && entry.tree !== undefined;
          const templateId = entry.templateId;
          return (
            <LibraryTile
              key={entry.key}
              name={entry.name}
              glyph={entry.glyph}
              badge={entry.badge}
              insertLabel={labels.insert(entry.name)}
              description={labels.insertHint}
              caption={entry.description}
              preview={previews.get(entry.key)}
              previewWidth={entry.kind === 'element' ? 400 : 1040}
              onInsert={() => {
                insert(entry);
              }}
              onBeginDrag={
                draggable
                  ? (hostX, hostY) => startDrag(elementPayload(first, entry.css), hostX, hostY)
                  : undefined
              }
              removeLabel={labels.removeTemplate(entry.name)}
              onRemove={
                templateId !== undefined && onRemoveTemplate !== undefined
                  ? () => {
                      onRemoveTemplate(templateId);
                    }
                  : undefined
              }
            />
          );
        })}
      </ul>
    );
  };

  // library-playground additions (2026-10-08): the Templates tab — the page's language first,
  // then "Other language"; a composition without a card keeps a plain tile. Nothing is hidden.
  const otherLanguageId = `${searchId}-other-language`;
  const renderTemplateItems = (list: readonly TemplateTabEntry[]) =>
    list.map((entry) =>
      entry.card === undefined ? (
        <LibraryTile
          key={entry.key}
          name={entry.name}
          glyph="▤"
          insertLabel={labels.insert(entry.name)}
          description={labels.insertHint}
          onBeginDrag={dragHandle === undefined ? undefined : (x, y) => dragHandle.beginInsert(entry.rootType, x, y, (target) => { insertTemplate(entry, target); })}
          onInsert={() => {
            insertTemplate(entry);
          }}
        />
      ) : (
        <li key={entry.key} className="bldr-library__template">
          <TemplateCard
            card={entry.card}
            labels={templateCardLabels}
            onBeginDrag={dragHandle === undefined ? undefined : (x, y) => dragHandle.beginInsert(entry.rootType, x, y, (target) => { insertTemplate(entry, target); })}
            onInsert={() => {
              insertTemplate(entry);
            }}
          />
        </li>
      ),
    );
  const renderTemplates = () => {
    const visible =
      normalized === ''
        ? templateEntries
        : templateEntries.filter((entry) => entry.search.includes(normalized) || entry.name.toLocaleLowerCase().includes(normalized));
    if (visible.length === 0) {
      return (
        <p className="bldr-library__empty" role="status">
          {templateEntries.length === 0
            ? (labels.noTemplates ?? labels.palette.noTemplates)
            : labels.noResults}
        </p>
      );
    }
    const withCards = visible.filter((entry): entry is TemplateTabEntry & { card: TemplateCardInfo } => entry.card !== undefined);
    const { matching, other } = orderTemplateCards(withCards, pageLanguage);
    const plain = visible.filter((entry) => entry.card === undefined);
    return (
      <>
        {matching.length + plain.length === 0 ? null : (
          <ul className="bldr-library__template-grid" data-group="page-language">
            {renderTemplateItems([...matching, ...plain])}
          </ul>
        )}
        {other.length === 0 ? null : (
          <section className="bldr-library__template-group" aria-labelledby={otherLanguageId}>
            <h3 id={otherLanguageId} className="bldr-library__group-heading">
              {labels.otherLanguage ?? (language === 'ar' ? 'لغة أخرى' : 'Other language')}
            </h3>
            <ul className="bldr-library__template-grid" data-group="other-language">
              {renderTemplateItems(other)}
            </ul>
          </section>
        )}
      </>
    );
  };
  const tabLabel = (value: LibraryTab): string =>
    value === 'templates'
      ? (labels.tabs.templates ?? (language === 'ar' ? 'القوالب' : 'Templates'))
      : labels.tabs[value];
  // end library-playground additions

  return (
    <nav className="bldr-library" aria-label={labels.title} lang={labels.language}>
      <Tabs.Root
        className="bldr-library__tabs"
        // Arrow keys follow the reading direction: Arabic tabs run right to left.
        dir={labels.language === 'ar' ? 'rtl' : undefined}
        value={tab}
        onValueChange={(value) => {
          setTab(value as LibraryTab);
        }}
      >
        <Tabs.List className="bldr-library__tablist" aria-label={labels.title}>
          {/* library-playground additions (2026-10-08): Templates sits at the top level. */}
          {(['elements', 'sections', 'templates', 'blocks', 'saved'] as const).map((value) => (
            <Tabs.Trigger key={value} value={value} className="bldr-library__tab">
              {tabLabel(value)}
              {value === 'saved' && savedEntries.length > 0 ? (
                <span className="bldr-library__count">{savedEntries.length}</span>
              ) : null}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {tab === 'blocks' ? null : (
          <div className="bldr-library__search">
            <label className="bldr-visually-hidden" htmlFor={searchId}>
              {labels.search}
            </label>
            <input
              id={searchId}
              className="bldr-library__search-input"
              type="search"
              value={query}
              placeholder={labels.search}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
              }}
            />
            {tab === 'elements' ? (
              <div className="bldr-library__filters">
                <label className="bldr-visually-hidden" htmlFor={`${searchId}-category`}>
                  {language === 'ar' ? 'فئة العناصر' : 'Element category'}
                </label>
                <select id={`${searchId}-category`} value={category} onChange={(event) => { setCategory(event.currentTarget.value); }}>
                  {Object.entries(ELEMENT_CATEGORIES).map(([key, names]) => (
                    <option key={key} value={key}>{names[language]} · {key === 'all' ? elements.length : elements.filter((entry) => elementCategory(entry.key.slice('element:'.length)) === key).length}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <p className="bldr-library__hint">{labels.insertHint}</p>
          </div>
        )}
        <Tabs.Content value="elements" className="bldr-library__panel">
          {renderGrid(elements, labels.noResults)}
        </Tabs.Content>
        <Tabs.Content value="sections" className="bldr-library__panel">
          {renderGrid(sectionEntries, labels.noSections)}
        </Tabs.Content>
        {/* library-playground additions (2026-10-08) */}
        <Tabs.Content value="templates" className="bldr-library__panel">
          {renderTemplates()}
        </Tabs.Content>
        {/* end library-playground additions */}
        <Tabs.Content value="blocks" className="bldr-library__panel bldr-library__panel--blocks">
          <Palette
            kernel={kernel}
            dragHandle={dragHandle}
            labels={labels.palette}
            templateCards={templateCards} /* library-playground additions (2026-10-08) */
          />
        </Tabs.Content>
        <Tabs.Content value="saved" className="bldr-library__panel">
          {renderGrid(savedEntries, labels.noSaved)}
        </Tabs.Content>
      </Tabs.Root>
      <p className="bldr-visually-hidden" role="status" aria-live="polite">
        {message.nonce % 2 === 1 ? `${message.text}​` : message.text}
      </p>
    </nav>
  );
}
