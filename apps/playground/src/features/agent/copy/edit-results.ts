/** Settled page-wide edits and partial acceptance share one key contract in both locales. */
export const EDIT_RESULT_KEYS = [
  'edit.title.donePage',
  'edit.title.noChangePage',
  'proposal.appliedPage',
  'edit.title.partialPage',
  'edit.title.partial',
  'edit.partial',
] as const;

type ResultCopy = Readonly<Record<(typeof EDIT_RESULT_KEYS)[number], string>>;

export const EDIT_RESULT_EN = {
  'edit.title.donePage': 'Page updated',
  'edit.title.noChangePage': 'No change to the page',
  'proposal.appliedPage': 'Proposal applied',
  'edit.title.partialPage': 'Page partially updated',
  'edit.title.partial': '{target} partially updated',
  'edit.partial':
    'Applied {kept} of {total} planned steps. The remaining steps could not be applied.',
} as const satisfies ResultCopy;

export const EDIT_RESULT_AR = {
  'edit.title.donePage': 'عُدِّلت الصفحة',
  'edit.title.noChangePage': 'لا تغيير في الصفحة',
  'proposal.appliedPage': 'طُبِّق الاقتراح',
  'edit.title.partialPage': 'عُدِّلت الصفحة جزئيًا',
  'edit.title.partial': 'عُدِّل «{target}» جزئيًا',
  'edit.partial': 'طُبِّق {kept} من {total} خطوات مخططة. تعذّر تطبيق الخطوات المتبقية.',
} as const satisfies ResultCopy;
