import type { RailItem } from '@craftkit/builder';

import { RAIL_SECTIONS } from './rail-sections';

/*
  The rail's newest destination. It is composed HERE rather than added to
  `rail-sections.tsx` for the same reason the rail takes its items as data: what
  the sections ARE belongs to the host, and History only exists because this app
  opens its documents from a vault.
*/
const HISTORY_SECTION: RailItem = {
  id: 'history',
  label: 'History',
  icon: (
    <svg
      width="17"
      height="17"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 4.6V8l2.3 1.4" />
      <path d="M2.7 8a5.3 5.3 0 1 0 1.7-3.9" />
      <path d="M2.4 2.7v2.2h2.2" />
    </svg>
  ),
};

export const RAIL_DESTINATIONS: readonly RailItem[] = [...RAIL_SECTIONS, HISTORY_SECTION];
