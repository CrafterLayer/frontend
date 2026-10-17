import type { ReactNode } from 'react';

import { SITE_MAP_LABELS_EN, type SiteMapLabels } from './SiteMap.labels';
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
  /** Every string the map shows; English unless the host passes its locale's set. */
  readonly labels?: SiteMapLabels | undefined;
}

/** Visual page map driven by the same ordered projection as the page list. */
export function SiteMap({
  pages,
  selectedPageId,
  onSelect,
  onReorder,
  actionsByPageId,
  labels = SITE_MAP_LABELS_EN,
  label = labels.region,
}: SiteMapProps) {
  if (pages.length === 0) {
    return (
      <section className="pg-site-map pg-site-map--empty" aria-label={label}>
        <h2>{labels.title}</h2>
        <p>{labels.empty}</p>
      </section>
    );
  }

  return (
    <section className="pg-site-map" aria-label={label}>
      <header className="pg-site-map__header">
        <div>
          <h2>{labels.title}</h2>
          <p>{labels.summary(pages.length)}</p>
        </div>
      </header>
      <ol className="pg-site-map__grid" aria-label={labels.pageList}>
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
                  aria-label={labels.open(page.title, page.address)}
                  onClick={() => {
                    onSelect(page.id);
                  }}
                >
                  <span className="pg-site-map__thumbnail">
                    {page.thumbnail.src === undefined ? (
                      <span aria-hidden="true">{initials(page.title)}</span>
                    ) : (
                      <img
                        src={page.thumbnail.src}
                        alt={
                          page.thumbnail.kind === 'asset'
                            ? page.thumbnail.alt
                            : labels.preview(page.title)
                        }
                      />
                    )}
                  </span>
                  <span className="pg-site-map__identity">
                    <span className="pg-site-map__title">
                      {page.title}
                      {page.isHome ? (
                        <span className="pg-site-map__home">{labels.home}</span>
                      ) : null}
                    </span>
                    <span className="pg-site-map__route">{page.address}</span>
                  </span>
                </button>

                {page.sharedReferences.length > 0 ? (
                  <div
                    className="pg-site-map__shared"
                    aria-label={labels.sharedSources(page.title)}
                  >
                    <span aria-hidden="true">↗</span>
                    <span>{labels.sharedCount(page.sharedReferences.length)}</span>
                    <ul>
                      {page.sharedReferences.map((reference) => (
                        <li key={`${reference.kind}:${reference.id}`} title={reference.id}>
                          {referenceLabel(reference, labels)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="pg-site-map__private">{labels.privateContent}</p>
                )}

                <div className="pg-site-map__controls">
                  <button
                    type="button"
                    disabled={index === 0}
                    aria-label={labels.moveBefore(page.title)}
                    onClick={() => {
                      onReorder(page.id, index - 1);
                    }}
                  >
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button
                    type="button"
                    disabled={index === pages.length - 1}
                    aria-label={labels.moveAfter(page.title)}
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

/** A region's kind reads in the editor's language; a module keeps its own name. */
function referenceLabel(
  reference: SiteMapPage['sharedReferences'][number],
  labels: SiteMapLabels,
): string {
  return reference.kind === 'region' &&
    (reference.label === 'header' || reference.label === 'footer')
    ? labels.regionKinds[reference.label]
    : reference.label;
}

function initials(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  return parts
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');
}
