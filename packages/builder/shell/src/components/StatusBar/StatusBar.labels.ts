import type { ChangeDoor } from './StatusBar';

type SaveState = 'saved' | 'saving' | 'error';

/** Every string the status bar shows or announces; the host picks EN or AR by locale. */
export interface StatusBarLabels {
  readonly region: string;
  readonly tools: string;
  readonly recentChanges: string;
  readonly details: string;
  /** The strip with no changes to list. */
  readonly empty: string;
  /** The zoom detail's accessible name, from its visible percentage ("Zoom 71%"). */
  readonly zoom: (percent: string) => string;
  readonly saveStatus: string;
  readonly save: Readonly<Record<SaveState, string>>;
  /** The door each change came through, prefixed to its label ("Canvas: …"). */
  readonly doors: Readonly<Record<ChangeDoor, string>>;
}

export const STATUS_BAR_LABELS_EN: StatusBarLabels = {
  region: 'Editor status',
  tools: 'Status bar tools',
  recentChanges: 'Recent changes',
  details: 'Editor details',
  empty: 'No recent changes',
  zoom: (percent) => `Zoom ${percent}`,
  saveStatus: 'Save status',
  save: { saved: 'Saved', saving: 'Saving', error: 'Save failed' },
  doors: { canvas: 'Canvas', code: 'Code', assistant: 'Assistant' },
};

export const STATUS_BAR_LABELS_AR: StatusBarLabels = {
  region: 'حالة المحرر',
  tools: 'أدوات شريط الحالة',
  recentChanges: 'آخر التغييرات',
  details: 'تفاصيل المحرر',
  empty: 'لا تغييرات حديثة',
  zoom: (percent) => `التكبير ${percent}`,
  saveStatus: 'حالة الحفظ',
  save: { saved: 'محفوظ', saving: 'جارٍ الحفظ', error: 'تعذّر الحفظ' },
  doors: { canvas: 'اللوحة', code: 'الشيفرة', assistant: 'المساعد' },
};
