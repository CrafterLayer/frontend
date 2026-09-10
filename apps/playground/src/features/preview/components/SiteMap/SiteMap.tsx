import type { ReactNode } from 'react';

import './SiteMap.css';

export interface SiteMapPage {
  readonly id: string;
  readonly index: number;
  readonly title: string;
  readonly address: string;
  readonly isHome: boolean;
  readonly thumbnail: {
    readonly kind: 'provided' | 'seo' | 'asset' | 'fallback';
    readonly src?: string | undefined;
    readonly alt: string;
  };
  readonly sharedReferences: readonly {
    readonly id: string;
    readonly label: string;
    readonly kind: 'region' | 'module';
  }[];
}

export interface SiteMapProps {
  readonly pages: readonly SiteMapPage[];
  readonly selectedPageId?: string | undefined;
  readonly onSelect: (pageId: string) => void;
  readonly onReorder: (pageId: string, toIndex: number) => void;
  readonly actionsByPageId?: Readonly<Record<string, ReactNode>> | undefined;
  readonly label?: string | undefined;
}

/** Visual page map driven by the same ordered projection as the page list. */
export function SiteMap({
  pages,
  selectedPageId,
  onSelect,
  onReorder,
  actionsByPageId,
  label = 'Site map',
}: SiteMapProps) {
  if (pages.length === 0) {
    return (
      <section className="pg-site-map pg-site-map--empty" aria-label={label}>
        <h2>Site map</h2>
        <p>Add a page to see its route and relationships here.</p>
      </section>
    );
  }

  return (
    <section className="pg-site-map" aria-label={label}>
      <header className="pg-site-map__header">
        <div>
          <h2>Site map</h2>
          <p>{pages.length} pages · routes and shared sources</p>
        </div>
      </header>
      <ol className="pg-site-map__grid" aria-label="Pages in route order">
        {pages.map((page, index) => {
          const selected = selectedPageId === page.id;
          return (
            <li
              className="pg-site-map__item"
              data-selected={selected ? '' : undefined}
              key={page.id}
            >
              <div className="pg-site-map__card">
                <button
                  type="button"
                  className="pg-site-map__open"
                  aria-current={selected ? 'page' : undefined}
                  aria-label={`Open ${page.title}, ${page.address}`}
                  onClick={() => {
                    onSelect(page.id);
                  }}
                >
                  <span className="pg-site-map__thumbnail">
                    {page.thumbnail.src === undefined ? (
                      <span aria-hidden="true">{initials(page.title)}</span>
                    ) : (
                      <img src={page.thumbnail.src} alt={page.thumbnail.alt} />
                    )}
                  </span>
                  <span className="pg-site-map__identity">
                    <span className="pg-site-map__title">
                      {page.title}
                      {page.isHome ? <span className="pg-site-map__home">Home</span> : null}
                    </span>
                    <span className="pg-site-map__route">{page.address}</span>
                  </span>
                </button>

                {page.sharedReferences.length > 0 ? (
                  <div className="pg-site-map__shared" aria-label={`${page.title} shared sources`}>
                    <span aria-hidden="true">↗</span>
                    <span>
                      {page.sharedReferences.length} shared source
                      {page.sharedReferences.length === 1 ? '' : 's'}
                    </span>
                    <ul>
                      {page.sharedReferences.map((reference) => (
                        <li key={`${reference.kind}:${reference.id}`} title={reference.id}>
                          {reference.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="pg-site-map__private">Page-private content</p>
                )}

                <div className="pg-site-map__controls">
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={`Move ${page.title} before`}
                    onClick={() => {
                      onReorder(page.id, index - 1);
                    }}
                  >
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button
                    type="button"
                    disabled={index === pages.length - 1}
                    aria-label={`Move ${page.title} after`}
                    onClick={() => {
                      onReorder(page.id, index + 1);
                    }}
                  >
                    <span aria-hidden="true">↓</span>
                  </button>
                  {actionsByPageId?.[page.id]}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function initials(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  return parts
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');
}
