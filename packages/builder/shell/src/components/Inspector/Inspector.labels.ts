import type { BlockPropertyTab } from '@craftkit/builder-schema';

import { EMPTY_STATE_COPY, NO_SELECTION_NAME, SELECTION_CLEARED } from './constants';
import {
  INSPECTOR_ELEMENT_LABELS_AR,
  INSPECTOR_ELEMENT_LABELS_EN,
  type InspectorElementLabels,
} from './element-panel.labels';
import {
  INSPECTOR_HEADER_LABELS_AR,
  INSPECTOR_HEADER_LABELS_EN,
  type InspectorHeaderLabels,
} from './InspectorHeader.labels';

export type InspectorEmptyCopy = Readonly<Record<keyof typeof EMPTY_STATE_COPY, string>>;

/** The panel's own chrome: its region, tabs, empty states and selection announcements. */
export interface InspectorChromeLabels {
  readonly region: string;
  readonly messages: string;
  readonly tablist: string;
  /** A block's property tabs; a tab a schema names otherwise keeps its own label. */
  readonly tabs: Readonly<Partial<Record<BlockPropertyTab, string>>>;
  readonly noSelection: string;
  readonly selectionCleared: string;
  readonly selected: (name: string) => string;
  readonly empty: InspectorEmptyCopy;
}

/** Every string the Inspector shows or announces; it picks EN or AR by its `locale`. */
export interface InspectorLabels {
  readonly chrome: InspectorChromeLabels;
  readonly header: InspectorHeaderLabels;
  readonly element: InspectorElementLabels;
}

export const INSPECTOR_LABELS_EN: InspectorLabels = {
  chrome: {
    region: 'Inspector',
    messages: 'Inspector messages',
    tablist: 'Inspector tabs',
    tabs: { content: 'Content', design: 'Design', advanced: 'Advanced' },
    noSelection: NO_SELECTION_NAME,
    selectionCleared: SELECTION_CLEARED,
    selected: (name) => `${name} selected`,
    empty: EMPTY_STATE_COPY,
  },
  header: INSPECTOR_HEADER_LABELS_EN,
  element: INSPECTOR_ELEMENT_LABELS_EN,
};

export const INSPECTOR_LABELS_AR: InspectorLabels = {
  chrome: {
    region: 'الخصائص',
    messages: 'رسائل لوحة الخصائص',
    tablist: 'تبويبات الخصائص',
    tabs: { content: 'المحتوى', design: 'التصميم', advanced: 'متقدم' },
    noSelection: 'لم تُحدَّد أي كتلة',
    selectionCleared: 'أُلغي التحديد',
    selected: (name) => `حُدِّد ${name}`,
    empty: {
      invitation: 'حدّد كتلة لتعديل خصائصها.',
      'unknown-type': 'نوع كتلة غير معروف، ولا مخطط مسجّل له.',
      'no-properties': 'لا خصائص قابلة للتعديل في هذه الكتلة.',
      'element-gone': 'لم يعد هذا العنصر في القسم. عُد إلى القسم للمتابعة.',
    },
  },
  header: INSPECTOR_HEADER_LABELS_AR,
  element: INSPECTOR_ELEMENT_LABELS_AR,
};

export function inspectorLabelsFor(locale: 'en' | 'ar'): InspectorLabels {
  return locale === 'ar' ? INSPECTOR_LABELS_AR : INSPECTOR_LABELS_EN;
}
