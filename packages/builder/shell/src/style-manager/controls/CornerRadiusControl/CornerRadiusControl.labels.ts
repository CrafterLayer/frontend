import type { StyleCorner } from '@craftkit/builder-schema';

export interface CornerRadiusControlLabels {
  readonly group: string;
  readonly all: string;
  readonly link: string;
  readonly corners: Readonly<Record<StyleCorner, string>>;
}

export const CORNER_RADIUS_CONTROL_LABELS_EN: CornerRadiusControlLabels = {
  group: 'Corner radius',
  all: 'All corners',
  link: 'Same radius on every corner',
  corners: {
    'start-start': 'Corner block-start inline-start',
    'start-end': 'Corner block-start inline-end',
    'end-start': 'Corner block-end inline-start',
    'end-end': 'Corner block-end inline-end',
  },
};

export const CORNER_RADIUS_CONTROL_LABELS_AR: CornerRadiusControlLabels = {
  group: 'استدارة الزوايا',
  all: 'كل الزوايا',
  link: 'الاستدارة نفسها لكل الزوايا',
  corners: {
    'start-start': 'الزاوية العليا عند البداية',
    'start-end': 'الزاوية العليا عند النهاية',
    'end-start': 'الزاوية السفلى عند البداية',
    'end-end': 'الزاوية السفلى عند النهاية',
  },
};
