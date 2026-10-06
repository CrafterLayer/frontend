import * as Tabs from '@radix-ui/react-tabs';
import { useCallback, useId, useMemo, useState, useSyncExternalStore } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { CustomCodeNode, CustomCodeRoot, SavedTemplate } from '@craftkit/builder-schema';

import { ELEMENT_ACTION_LABELS_EN, type ElementActionLabels } from '../../clipboard/element-actions.labels';
import { elementPayload, type ElementPayload } from '../../custom-code/element-drag-payload';
import type { ElementNameWords } from '../../custom-code/element-target';
import type { CanvasDragHandle } from '../EditorCanvas';
import { Palette } from '../Palette';
import '../../styles/visually-hidden.css';
import { insertCompositionAtSelection, insertLibraryTree } from './library-insert';
import { LIBRARY_ELEMENT_PRESETS, type LibraryLanguage } from './library-presets';
import { previewMarkup, previewSrcdoc, treeClassNames } from './library-preview';
import { LIBRARY_PANEL_LABELS_EN, type LibraryPanelLabels } from './LibraryPanel.labels';
import { LibraryTile } from './LibraryTile';
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
}

export type LibraryTab = 'elements' | 'sections' | 'blocks' | 'saved';

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
}

interface Entry {
  readonly key: string;
  readonly kind: 'element' | 'section' | 'composition';
  readonly name: string;
  readonly search: string;
  readonly glyph: string;
  readonly badge?: string | undefined;
  readonly tree?: CustomCodeRoot | undefined;
  readonly css?: string | undefined;
  readonly compositionId?: string | undefined;
  readonly rootType?: string | undefined;
  readonly templateId?: string | undefined;
}

function glyphOf(node: CustomCodeNode | undefined): string {
  if (node === undefined) return '▭';
  if (node.kind === 'icon') return '◇';
  if (node.kind === 'component') return '⧉';
  return node.tag.slice(0, 3).toUpperCase();
}

/**
 * The Library (style-manager DESIGN.md §E): Elements (twenty widget presets),
 * Sections (registered page templates + the host's ready-made sections),
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
}: LibraryPanelProps) {
  const searchId = useId();
  const [tab, setTab] = useState<LibraryTab>(defaultTab);
  const [query, setQuery] = useState('');
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

  const elements = useMemo<Entry[]>(
    () =>
      LIBRARY_ELEMENT_PRESETS.map((preset) => {
        const node = preset.node(language);
        return {
          key: `element:${preset.id}`,
          kind: 'element',
          name: preset.labels[language],
          search: `${preset.labels.en} ${preset.labels.ar} ${preset.keywords}`.toLocaleLowerCase(),
          glyph: glyphOf(node),
          tree: { kind: 'root', children: [node] },
          css: preset.css?.(language), // media-motion (2026-10-06): a media preset's region hooks
        };
      }),
    [language],
  );

  const sectionEntries = useMemo<Entry[]>(() => {
    void catalogVersion;
    const surface = kernel.getDocument().surface;
    const compositions = kernel.context.registry.compositions(surface).flatMap((composition): Entry[] => {
      const root = composition.nodes[composition.rootId];
      if (root === undefined) return [];
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
      }),
    );
    return [...offered, ...compositions];
  }, [kernel, catalogVersion, sections, language]);

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
        const markup = previewMarkup(kernel, tree, entry.css, dir);
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
  }, [elements, sectionEntries, savedEntries, kernel, dir, compilePreviewCss, previewStylesheet, language]);

  const insert = useCallback(
    (entry: Entry) => {
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
      });
      announce(outcome.ok ? labels.inserted(entry.name) : outcome.message);
    },
    [kernel, actionLabels, words, labels, announce],
  );

  /**
   * The element drag: the host's `beginElementDrag`, else the canvas handle's
   * own tree insert (P7) when it offers one.
   */
  const elementDragStarter = (
    name: string,
  ): ((payload: ElementPayload, hostX: number, hostY: number) => { didActivate: () => boolean }) | undefined => {
    if (beginElementDrag !== undefined) return beginElementDrag;
    const handle = dragHandle as
      | (CanvasDragHandle & {
          beginTreeInsert?: (
            node: CustomCodeNode,
            label: string,
            hostX: number,
            hostY: number,
          ) => { didActivate: () => boolean };
        })
      | undefined;
    if (handle?.beginTreeInsert === undefined) return undefined;
    return (payload, hostX, hostY) =>
      handle.beginTreeInsert?.(payload.node, name, hostX, hostY) ?? { didActivate: () => false };
  };

  const normalized = query.trim().toLocaleLowerCase();
  const filter = (list: readonly Entry[]) =>
    normalized === '' ? list : list.filter((entry) => entry.search.includes(normalized) || entry.name.toLocaleLowerCase().includes(normalized));

  const renderGrid = (list: readonly Entry[], empty: string) => {
    const visible = filter(list);
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
          const startDrag = elementDragStarter(entry.name);
          const draggable = startDrag !== undefined && entry.kind === 'element' && first !== undefined && entry.tree?.children.length === 1;
          const templateId = entry.templateId;
          return (
            <LibraryTile
              key={entry.key}
              name={entry.name}
              glyph={entry.glyph}
              badge={entry.badge}
              insertLabel={labels.insert(entry.name)}
              description={labels.insertHint}
              preview={previews.get(entry.key)}
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
          {(['elements', 'sections', 'blocks', 'saved'] as const).map((value) => (
            <Tabs.Trigger key={value} value={value} className="bldr-library__tab">
              {labels.tabs[value]}
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
          </div>
        )}
        <Tabs.Content value="elements" className="bldr-library__panel">
          {renderGrid(elements, labels.noResults)}
        </Tabs.Content>
        <Tabs.Content value="sections" className="bldr-library__panel">
          {renderGrid(sectionEntries, labels.noSections)}
        </Tabs.Content>
        <Tabs.Content value="blocks" className="bldr-library__panel bldr-library__panel--blocks">
          <Palette kernel={kernel} dragHandle={dragHandle} labels={labels.palette} />
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
