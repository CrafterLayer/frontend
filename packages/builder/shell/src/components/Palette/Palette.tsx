import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { insertedNodeId, type BuilderKernel } from '@craftkit/builder-core';
import type { NodeId } from '@craftkit/builder-schema';

import { seatOf, slotAccepts } from '../../overlay/drop-resolver';
import type { CanvasDragHandle } from '../EditorCanvas';
import '../../styles/visually-hidden.css';
import './Palette.css';
import { diagramForBlockType } from './diagrams';

const PALETTE_CATEGORIES = ['Layout', 'Content', 'Marketing', 'Other'] as const;

type PaletteCategory = (typeof PALETTE_CATEGORIES)[number];

const KNOWN_BLOCK_NAMES: Readonly<Record<string, string>> = {
  action: 'Action',
  announcement: 'Announcement',
  banner: 'Banner',
  button: 'Button',
  columns: 'Columns',
  container: 'Container',
  cta: 'CTA',
  divider: 'Divider',
  embed: 'Embed',
  faq: 'FAQ',
  feature: 'Feature',
  features: 'Features',
  footer: 'Footer',
  form: 'Form',
  gallery: 'Gallery',
  grid: 'Grid',
  heading: 'Heading',
  hero: 'Hero',
  image: 'Image',
  media: 'Media',
  navbar: 'Navigation',
  navigation: 'Navigation',
  page: 'Page',
  pagefooter: 'Page Footer',
  pageheader: 'Page Header',
  paragraph: 'Paragraph',
  plan: 'Plan',
  pricing: 'Pricing',
  quote: 'Quote',
  review: 'Review',
  richtext: 'Rich Text',
  row: 'Row',
  section: 'Section',
  spacer: 'Spacer',
  stack: 'Stack',
  testimonial: 'Testimonial',
  testimonials: 'Testimonials',
  text: 'Text',
  video: 'Video',
};

interface PaletteEntry {
  readonly category: PaletteCategory;
  readonly name: string;
  readonly searchText: string;
  readonly type: string;
}

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
    key.includes('announcement')
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
  return 'Other';
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

export interface PaletteProps {
  /** BY PROP — the shell never reads React context. */
  kernel: BuilderKernel;
  /** Hands insert payloads to the canvas session; absent ⇒ keyboard-insert only. */
  dragHandle?: CanvasDragHandle | undefined;
}

/**
 * The registered block vocabulary (006 contract §4): live under runtime
 * registration/disposal (the kernel-intrinsic catalog version — the B1 race-
 * proof pattern), insertable by keyboard (walk-up placement rule p2) or by
 * dragging onto the canvas (payload handoff p3 — the canvas owns chrome and
 * resolution; the palette owns nothing but the payload).
 */
export function Palette({ kernel, dragHandle }: PaletteProps) {
  const paletteId = useId();
  const searchId = `${paletteId}-search`;
  const [query, setQuery] = useState('');
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
    return kernel.context.registry.blocks(surface).map((entry): PaletteEntry => {
      const type = entry.schema.type;
      const name = blockName(type, entry.schema.description);
      const category = categoryForBlock(type);
      return {
        category,
        name,
        searchText: `${name} ${type} ${entry.schema.description} ${category}`.toLocaleLowerCase(),
        type,
      };
    });
  }, [kernel, catalogVersion]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleEntries = entries.filter(
    (entry) => normalizedQuery === '' || entry.searchText.includes(normalizedQuery),
  );
  const groups = PALETTE_CATEGORIES.map((category) => ({
    category,
    entries: visibleEntries.filter((entry) => entry.category === category),
  })).filter((group) => group.entries.length > 0);

  const insertAtSelection = useCallback(
    (type: string) => {
      const doc = kernel.getDocument();
      const registry = kernel.context.registry;
      const payload = { kind: 'insert', type } as const;
      const selected = kernel.context.store.getState().selection[0];

      const commit = (parentId: NodeId, slot: string, index: number) => {
        const tx = kernel.dispatch('insertNode', { type, parentId, slot, index });
        const inserted = insertedNodeId(tx.patches);
        if (inserted !== undefined) {
          kernel.setSelection([inserted]);
        }
        setMessage(`Inserted ${type}`);
      };

      // p2: AFTER the selection in its parent slot when accepted…
      if (selected !== undefined) {
        const seat = seatOf(doc, selected);
        if (seat !== undefined && slotAccepts(doc, registry, seat.parentId, seat.slot, payload)) {
          commit(seat.parentId, seat.slot, seat.index + 1);
          return;
        }
      }
      // …else the first accepting slot walking selection → root (append).
      let candidate: NodeId | undefined = selected ?? doc.rootId;
      while (candidate !== undefined) {
        const candidateType = doc.nodes[candidate]?.type ?? '';
        for (const slot of Object.keys(registry.block(candidateType)?.schema.slots ?? {})) {
          if (slotAccepts(doc, registry, candidate, slot, payload)) {
            commit(candidate, slot, doc.nodes[candidate]?.slots?.[slot]?.length ?? 0);
            return;
          }
        }
        candidate = candidate === doc.rootId ? undefined : seatOf(doc, candidate)?.parentId;
      }
      setMessage(`No slot accepts ${type} here`);
    },
    [kernel, setMessage],
  );

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
    <nav className="bldr-palette" aria-label="Block palette">
      <div className="bldr-palette__search">
        <label className="bldr-visually-hidden" htmlFor={searchId}>
          Search blocks
        </label>
        <input
          id={searchId}
          className="bldr-palette__search-input"
          type="search"
          value={query}
          placeholder="Search blocks"
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

      {groups.length === 0 ? (
        <p className="bldr-palette__empty" role="status">
          No blocks found. Try another block name.
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
                    <span id={labelId}>{group.category}</span>
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
      <output className="bldr-visually-hidden" aria-live="polite" aria-label="Palette">
        {message.text}
        {message.nonce % 2 === 1 ? '​' : ''}
      </output>
    </nav>
  );
}
