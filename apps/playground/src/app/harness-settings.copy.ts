import type { ChromePickerLabels } from '../features/preview/components/ChromePicker';
import {
  FIXTURE_PICKER_LABELS_EN,
  type FixturePickerLabels,
} from '../features/preview/components/FixturePicker';
import type { ThemePickerLabels } from '../features/preview/components/ThemePicker';
import type { EditorLocale } from './editor-labels';

/** Every string the Settings destination shows (UX pass, 2026-10-13: it was English only). */
export interface HarnessSettingsCopy {
  /** The region's spoken name. The English one is pinned by the browser evals. */
  readonly region: string;
  readonly title: string;
  readonly intro: string;
  readonly editorGroup: string;
  readonly pageGroup: string;
  readonly testingGroup: string;
  readonly chrome: ChromePickerLabels;
  readonly theme: ThemePickerLabels;
  readonly fixture: FixturePickerLabels;
  readonly direction: string;
  readonly canvasWidth: string;
}

const HARNESS_SETTINGS_COPY_EN: HarnessSettingsCopy = {
  region: 'Scenario harness',
  title: 'Settings',
  intro: 'Editor preferences, and the scenario controls this playground is tested with.',
  editorGroup: 'Editor',
  pageGroup: 'Page',
  testingGroup: 'Testing',
  chrome: {
    legend: 'Appearance',
    choices: { system: 'system', light: 'light', dark: 'dark' },
    optionName: (choice) => `Editor ${choice}`,
  },
  theme: { legend: 'Page theme', choices: { light: 'light', dark: 'dark' } },
  fixture: FIXTURE_PICKER_LABELS_EN,
  direction: 'Direction',
  canvasWidth: 'Canvas width',
};

const HARNESS_SETTINGS_COPY_AR: HarnessSettingsCopy = {
  region: 'إعدادات التجربة',
  title: 'الإعدادات',
  intro: 'تفضيلات المحرر، وأدوات السيناريو التي تُختبر بها هذه البيئة.',
  editorGroup: 'المحرر',
  pageGroup: 'الصفحة',
  testingGroup: 'الاختبار',
  chrome: {
    legend: 'المظهر',
    choices: { system: 'النظام', light: 'فاتح', dark: 'داكن' },
    optionName: (choice) => `المحرر: ${choice}`,
  },
  theme: { legend: 'سمة الصفحة', choices: { light: 'فاتحة', dark: 'داكنة' } },
  fixture: {
    label: 'المستند التجريبي',
    fixtures: {
      landing: 'صفحة تسويقية',
      empty: 'صفحة فارغة',
      inline: 'تحرير مباشر',
      'code-view': 'عرض الشيفرة',
      'code-page': 'صفحة TSX مكتوبة',
    },
  },
  direction: 'الاتجاه',
  canvasWidth: 'عرض اللوحة',
};

export function harnessSettingsCopy(locale: EditorLocale): HarnessSettingsCopy {
  return locale === 'ar' ? HARNESS_SETTINGS_COPY_AR : HARNESS_SETTINGS_COPY_EN;
}
