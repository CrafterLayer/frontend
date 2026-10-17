import { useId } from 'react';

import { jobsLabels } from '../../copy/jobs-labels';
import type { BatchPageOption } from '../../model/background-jobs';
import type { Locale } from '../../model/view-types';

import '../knowledge-form.css';
import './PagePicker.css';

export interface PagePickerProps {
  readonly locale: Locale;
  /** The site's pages, in site order; the open one is marked. */
  readonly pages: readonly BatchPageOption[];
  /** The checked pages' ids. */
  readonly selected: readonly string[];
  /** The new selection, always in site order. */
  readonly onChange: (selected: readonly string[]) => void;
  /** The group's name ("Pages"). */
  readonly label: string;
  /** Ids of what else describes the group (the form's "Choose at least one page."). */
  readonly describedBy?: string | undefined;
  readonly invalid?: boolean | undefined;
}

/**
 * The pages a background job runs on (2026-10-12): a checklist of the site's pages, each
 * with its title, its address and, for the page open on the canvas, "Open now". A bar above
 * says how many are checked and offers Select all and Clear. The list scrolls on its own past
 * eight pages, so a large site never pushes the form's actions off the window.
 */
export function PagePicker({
  locale,
  pages,
  selected,
  onChange,
  label,
  describedBy,
  invalid = false,
}: PagePickerProps) {
  const id = useId();
  const labels = jobsLabels(locale).form;
  const chosen = new Set(selected);
  const count = pages.filter((page) => chosen.has(page.id)).length;
  const change = (pageId: string, checked: boolean): void => {
    const next = new Set(chosen);
    if (checked) next.add(pageId);
    else next.delete(pageId);
    onChange(pages.filter((page) => next.has(page.id)).map((page) => page.id));
  };

  return (
    <fieldset
      className="ck-agent-page-picker"
      aria-describedby={describedBy}
      aria-invalid={invalid ? true : undefined}
    >
      <legend className="bldr-visually-hidden">{label}</legend>
      <div className="ck-agent-page-picker__bar">
        <span id={`${id}-count`} className="ck-agent-page-picker__count">
          {labels.selected(count, pages.length)}
        </span>
        <button
          type="button"
          className="ck-agent-kn-button"
          data-variant="quiet"
          onClick={() => {
            onChange(pages.map((page) => page.id));
          }}
        >
          {labels.selectAll}
        </button>
        <button
          type="button"
          className="ck-agent-kn-button"
          data-variant="quiet"
          onClick={() => {
            onChange([]);
          }}
        >
          {labels.selectNone}
        </button>
      </div>
      <ul className="ck-agent-page-picker__list" role="list">
        {pages.map((page) => (
          <li key={page.id}>
            <label
              className="ck-agent-page-picker__page"
              data-current={page.current ? '' : undefined}
            >
              <input
                type="checkbox"
                className="ck-agent-page-picker__check"
                checked={chosen.has(page.id)}
                aria-describedby={`${id}-count`}
                onChange={(event) => {
                  change(page.id, event.currentTarget.checked);
                }}
              />
              <span className="ck-agent-page-picker__title" dir="auto">
                {page.title}
              </span>
              <bdi className="ck-agent-page-picker__address" dir="ltr">
                {page.address}
              </bdi>
              {page.current ? (
                <span className="ck-agent-page-picker__current">{labels.current}</span>
              ) : null}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
