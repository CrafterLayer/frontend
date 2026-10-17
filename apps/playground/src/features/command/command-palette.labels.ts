import type { CommandGroup } from './command-model';

/** Every string the command palette itself shows; the commands bring their own labels. */
export interface CommandPaletteLabels {
  readonly dialog: string;
  readonly placeholder: string;
  readonly empty: string;
  readonly trigger: string;
  readonly groups: Readonly<Record<CommandGroup, string>>;
  readonly footerMove: string;
  readonly footerRun: string;
  readonly footerClose: string;
  readonly current: string;
}

export const COMMAND_PALETTE_LABELS_EN: CommandPaletteLabels = {
  dialog: 'Command palette',
  placeholder: 'Search for a place or an action…',
  empty: 'Nothing matches. Try a section, a page or an action.',
  trigger: 'Search and commands',
  groups: {
    actions: 'Actions',
    navigate: 'Go to',
    view: 'View',
    pages: 'Pages',
    language: 'Language',
    help: 'Help',
  },
  footerMove: 'to move',
  footerRun: 'to run',
  footerClose: 'to close',
  current: 'Current',
};

export const COMMAND_PALETTE_LABELS_AR: CommandPaletteLabels = {
  dialog: 'لوحة الأوامر',
  placeholder: 'ابحث عن قسم أو إجراء…',
  empty: 'لا نتائج. جرّب اسم قسم أو صفحة أو إجراء.',
  trigger: 'البحث والأوامر',
  groups: {
    actions: 'إجراءات',
    navigate: 'انتقال إلى',
    view: 'العرض',
    pages: 'الصفحات',
    language: 'اللغة',
    help: 'المساعدة',
  },
  footerMove: 'للتنقل',
  footerRun: 'للتنفيذ',
  footerClose: 'للإغلاق',
  current: 'الحالي',
};
