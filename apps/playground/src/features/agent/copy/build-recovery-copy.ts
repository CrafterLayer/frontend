/**
 * Copy for an interrupted build met again after a reload (2026-11-06): the offer to
 * continue where it stopped or keep what was built, and the name the kept partial page
 * is saved under in the page's history. Its own module, like `followup-copy.ts`: the
 * catalog files are at their size limit.
 *
 * The count is the build's own: `done` sections landed out of `n` in its plan, the noun
 * counted by `n` («7 أقسام», "7 sections"). A plan always holds at least two sections
 * (SPEC §4.11); the forms for one and none exist so no count reads wrong.
 */
import type { ArPlural, EnPlural } from './keys';

export const BUILD_RECOVERY_KEYS = [
  'recovery.title',
  'recovery.body',
  'recovery.continue',
  'recovery.keep',
  'recovery.version',
] as const;

const TITLE_EN: EnPlural = {
  zero: 'The build stopped before any section was written',
  one: 'The build stopped after {done} of {sections}',
  other: 'The build stopped after {done} of {sections}',
};

export const BUILD_RECOVERY_EN = {
  'recovery.title': TITLE_EN,
  'recovery.body': 'What landed is on the page. Continuing writes only the rest.',
  'recovery.continue': 'Continue where it stopped',
  'recovery.keep': 'Keep what was built',
  'recovery.version': 'Build (interrupted): {prompt}',
} as const;

const TITLE_AR: ArPlural = {
  zero: 'انقطع البناء قبل أن يُكتب أي قسم',
  one: 'انقطع البناء قبل أن يكتمل قسمه الوحيد',
  two: 'انقطع البناء بعد {done} من قسمين',
  few: 'انقطع البناء بعد {done} من {sections}',
  many: 'انقطع البناء بعد {done} من {sections}',
  other: 'انقطع البناء بعد {done} من {sections}',
};

export const BUILD_RECOVERY_AR = {
  'recovery.title': TITLE_AR,
  'recovery.body': 'ما وصل موجود على الصفحة، والمتابعة تكتب الباقي فقط.',
  'recovery.continue': 'كمّل من وين وقفت',
  'recovery.keep': 'احتفظ بما بُني',
  'recovery.version': 'بناء (منقطع): {prompt}',
} as const;
