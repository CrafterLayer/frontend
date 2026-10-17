import type { blockPartProps } from '@craftkit/builder-schema';

import { SLAB_CLASSES } from '../section-tone';

import type { TableProps } from './schema';

/** The block's part-attribute function, passed to the pieces it draws. */
export type TablePart = ReturnType<typeof blockPartProps>;

/*
  The box the scroll region draws. `current` rather than a text token for the
  hairlines, so a minimal table on a dark section draws light rules instead of
  dark-on-dark ones.
*/
export const FRAME_CLASSES: Readonly<Record<TableProps['variant'], string>> = {
  boxed: 'rounded-xl border border-current/10 bg-surface text-text shadow-soft',
  minimal: '',
};

export const HEADER_CLASSES: Readonly<Record<TableProps['variant'], string>> = {
  boxed: 'bg-current/5',
  minimal: 'border-b-2 border-current/25',
};

export const CELL_PADDING: Readonly<Record<TableProps['density'], string>> = {
  comfortable: 'px-4 py-3',
  compact: 'px-3 py-1.5',
};

/*
  A sticky header row scrolls inside the region, which then scrolls both ways
  and stops at 70% of the viewport. Its cells need a ground of their own, or
  the rows would show through: the surface pair, or the slab pair on a dark
  section's minimal table.
*/
export const STICKY_REGION_CLASSES = 'max-h-[70vh] overflow-y-auto';

export function stickyHeaderClasses(props: Pick<TableProps, 'variant' | 'tone'>): string {
  const ground =
    props.variant === 'minimal' && props.tone === 'dark' ? SLAB_CLASSES : 'bg-surface text-text';
  return `sticky top-0 z-10 ${ground}`;
}

/** A sortable column's header button: the label and the sort arrows, nothing else. */
export const SORT_BUTTON_CLASSES =
  'inline-flex min-h-6 cursor-pointer items-center gap-1.5 rounded-sm text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export const SEARCH_INPUT_CLASSES =
  'min-h-11 w-full min-w-0 rounded-lg border border-current/20 bg-surface ps-9 pe-3 text-base text-text shadow-soft placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Previous and next: real buttons, dimmed (never disabled, so focus stays) at either end. */
export const PAGER_BUTTON_CLASSES =
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-current/20 bg-surface px-control-inline-sm text-sm font-semibold text-text shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-40';

/** The muted ink for the count, the page status and the caption. */
export function mutedInk(props: Pick<TableProps, 'tone'>): string {
  return props.tone === 'dark' ? 'text-inherit opacity-80' : 'text-text-muted';
}
