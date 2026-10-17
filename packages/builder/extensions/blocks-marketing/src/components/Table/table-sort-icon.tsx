/**
 * The sort arrows beside a sortable column's label: both faint while the
 * column is unsorted, one solid once it is. The state is read from the
 * header (a `group`): beside `aria-sort`, the sorted header carries
 * `data-sort-up` or `data-sort-down`, which the live render and the published
 * page's behaviour pack both set.
 */
export function TableSortIcon() {
  return (
    <svg className="size-3 shrink-0" viewBox="0 0 12 16" aria-hidden="true" focusable="false">
      <path
        className="fill-current opacity-35 group-data-sort-up:opacity-100 group-data-sort-down:opacity-0"
        d="M6 2 10 7H2z"
      />
      <path
        className="fill-current opacity-35 group-data-sort-up:opacity-0 group-data-sort-down:opacity-100"
        d="M6 14 2 9h8z"
      />
    </svg>
  );
}
