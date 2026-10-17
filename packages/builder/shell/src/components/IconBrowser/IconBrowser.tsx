import { useId, useMemo, useState } from 'react';

import { CustomCode } from '@craftkit/builder-renderer';

import { ICON_BROWSER_LABELS_EN, type IconBrowserLabels } from './IconBrowser.labels';
import { searchIcons, type IconSet } from './icon-search';
import './IconBrowser.css';

export interface IconBrowserProps {
  /** An icon was chosen (`mail`, `tabler:mail`, `tabler-filled:heart`). */
  readonly onPick: (name: string) => void;
  /** The current icon's name, marked pressed. */
  readonly value?: string | undefined;
  readonly defaultSet?: IconSet | undefined;
  /** How many results to draw at once. */
  readonly limit?: number | undefined;
  readonly disabled?: boolean | undefined;
  readonly labels?: IconBrowserLabels | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
}

const SETS: readonly IconSet[] = ['all', 'lucide', 'tabler', 'tabler-filled'];

/**
 * Lucide plus Tabler outline and filled, searchable (style-manager DESIGN.md
 * §C.3, §G). Each result is drawn by the page's own icon renderer, so what a
 * person picks here is exactly what the page shows; Tabler's data loads on
 * first use. The browser never writes: `onPick` hands the name to the host,
 * which inserts or replaces the icon node in one transaction (`iconSteps`).
 */
export function IconBrowser({
  onPick,
  value,
  defaultSet = 'all',
  limit = 120,
  disabled = false,
  labels = ICON_BROWSER_LABELS_EN,
  dir,
}: IconBrowserProps) {
  const [query, setQuery] = useState('');
  const [set, setSet] = useState<IconSet>(defaultSet);
  const searchId = useId();
  const setId = useId();
  const results = useMemo(() => searchIcons(query, set, limit + 1), [query, set, limit]);
  const shown = results.slice(0, limit);

  return (
    <section className="bldr-icons" aria-label={labels.title} dir={dir}>
      <div className="bldr-icons__filters">
        <label className="bldr-icons__field" htmlFor={searchId}>
          <span className="bldr-icons__label">{labels.search}</span>
          <input
            id={searchId}
            className="bldr-icons__input"
            type="search"
            dir="ltr"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </label>
        <label className="bldr-icons__field" htmlFor={setId}>
          <span className="bldr-icons__label">{labels.set}</span>
          <select
            id={setId}
            className="bldr-icons__input"
            value={set}
            onChange={(event) => {
              setSet(event.target.value as IconSet);
            }}
          >
            {SETS.map((id) => (
              <option key={id} value={id}>
                {labels.sets[id]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="bldr-icons__message" role="status">
          {labels.none(query.trim())}
        </p>
      ) : (
        <ul className="bldr-icons__grid" aria-label={labels.results}>
          {shown.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="bldr-icons__pick"
                aria-label={labels.icon(name)}
                title={name}
                aria-pressed={name === value}
                disabled={disabled}
                onClick={() => {
                  onPick(name);
                }}
              >
                <CustomCode
                  className="bldr-icons__glyph"
                  hostId={`icon-${name}`}
                  tree={{ kind: 'root', children: [{ kind: 'icon', name, size: 20 }] }}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {results.length > limit ? <p className="bldr-icons__message">{labels.more(limit)}</p> : null}
    </section>
  );
}
