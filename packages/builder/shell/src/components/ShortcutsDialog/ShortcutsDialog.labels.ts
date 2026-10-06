import type { EditorShortcutDef } from '../../keyboard/editor-shortcuts';

/** Every user-facing string of the shortcuts dialog; the host picks one set by locale. */
export interface ShortcutsDialogLabels {
  /** Which language of each keymap row's own labels to show. */
  readonly language: 'en' | 'ar';
  readonly title: string;
  readonly close: string;
  readonly intro: string;
  readonly or: string;
  readonly groups: Readonly<Record<EditorShortcutDef['group'], string>>;
  /** Key names that differ by platform; anything else prints as written. */
  readonly keys: {
    readonly modMac: string;
    readonly modOther: string;
    readonly altMac: string;
    readonly altOther: string;
    readonly shift: string;
    readonly delete: string;
    readonly backspace: string;
    readonly enter: string;
  };
}

export const SHORTCUTS_DIALOG_LABELS_EN: ShortcutsDialogLabels = {
  language: 'en',
  title: 'Keyboard shortcuts',
  close: 'Close',
  intro: 'Shortcuts never fire while you type in a field.',
  or: 'or',
  groups: {
    history: 'History',
    clipboard: 'Copy and paste',
    structure: 'Arrange',
    selection: 'Select',
    view: 'View',
  },
  keys: {
    modMac: '⌘',
    modOther: 'Ctrl',
    altMac: '⌥',
    altOther: 'Alt',
    shift: 'Shift',
    delete: 'Delete',
    backspace: 'Backspace',
    enter: 'Enter',
  },
};

export const SHORTCUTS_DIALOG_LABELS_AR: ShortcutsDialogLabels = {
  language: 'ar',
  title: 'اختصارات لوحة المفاتيح',
  close: 'إغلاق',
  intro: 'لا تعمل الاختصارات أثناء الكتابة في حقل.',
  or: 'أو',
  groups: {
    history: 'السجل',
    clipboard: 'النسخ واللصق',
    structure: 'الترتيب',
    selection: 'التحديد',
    view: 'العرض',
  },
  keys: {
    modMac: '⌘',
    modOther: 'Ctrl',
    altMac: '⌥',
    altOther: 'Alt',
    shift: 'Shift',
    delete: 'Delete',
    backspace: 'Backspace',
    enter: 'Enter',
  },
};
