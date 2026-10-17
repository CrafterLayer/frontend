import type { BuildRevertRefusal } from '../AssistantPanel/AssistantPanel.turns';

/*
  Beside the component rather than inside it, for the reason `BuildApprovalCard`
  keeps its cost line in `cost.ts`: a component file that also exports functions
  breaks fast refresh, and the tests want the words without the module graph.
*/

type Locale = 'ar' | 'en';

const REFUSED: Readonly<Record<BuildRevertRefusal, Readonly<Record<Locale, string>>>> = {
  'changed-since': {
    en: 'You changed this section after it was built, so it was left as you made it.',
    ar: 'عدّلت هذا القسم بعد بنائه، لذلك تُرك كما عدّلته.',
  },
  'region-missing': {
    en: 'This section is no longer on the page, so there is nothing to put back.',
    ar: 'هذا القسم لم يعد على الصفحة، فلا شيء لإرجاعه.',
  },
  'not-landed': {
    en: 'This section never landed, so there is nothing to put back.',
    ar: 'هذا القسم لم يُكتب أصلًا، فلا شيء لإرجاعه.',
  },
  refused: {
    en: 'The page refused the change, so nothing was put back.',
    ar: 'رفضت الصفحة التغيير، فلم يُرجَع شيء.',
  },
  'no-earlier-version': {
    en: 'Written with the page’s layout — it has no earlier version to put back.',
    ar: 'كُتب مع تخطيط الصفحة — لا توجد نسخة سابقة منه لإرجاعها.',
  },
};

/**
 * Why a section was NOT put back, in words — the engine's own message is
 * English prose written for logs (P2-22), and a refusal a person cannot read is
 * one they will simply press again.
 */
export function revertRefusedText(code: BuildRevertRefusal, locale: Locale): string {
  return REFUSED[code][locale];
}

/**
 * Whether pressing Undo again could ever succeed. A section the person changed
 * can be put back once their change is undone, and a door refusal may pass on
 * a page that has moved on; one that is gone, or never landed, cannot — and a
 * button that can only refuse again is a lie.
 */
export function revertMayRetry(code: BuildRevertRefusal): boolean {
  return code === 'changed-since' || code === 'refused';
}

/**
 * A section this card may offer to put back: one a WRITER filled.
 *
 * A PagePlan build writes some regions in full with its skeleton (a header
 * from the nav, a footer from the facts), and reports them applied with 0
 * attempts and no value from before (`AiBuildTaskReport.attempts`). There is
 * no earlier version of those to put back, so an Undo on them could only ever
 * refuse (wave-2 verifier, pageplan-revert.mjs, 2026-09-28).
 */
export function offersSectionUndo(task: {
  readonly status: string;
  readonly attempts: number;
}): boolean {
  return task.status === 'applied' && task.attempts > 0;
}

/** The offer, naming how many — "empty" is the word a person sees on the canvas. */
export function removeUnfilledLabel(count: number, locale: Locale): string {
  if (locale === 'ar') return `احذف الأقسام الفارغة (${String(count)})`;
  return count === 1 ? 'Remove the empty section' : `Remove the ${String(count)} empty sections`;
}

/** The door refused the removal whole: one transaction, so nothing was removed. */
export function unfilledRemovalRefusedText(locale: Locale): string {
  return locale === 'ar'
    ? 'رفضت الصفحة الحذف، فلم يُحذف شيء.'
    : 'The page refused the removal; nothing was removed.';
}

/** What the removal did: one transaction, so one Undo is the whole way back. */
export function unfilledRemovalText(
  removal: { readonly removed: number; readonly kept: number },
  locale: Locale,
): string {
  const { removed, kept } = removal;
  if (locale === 'ar') {
    const head =
      removed === 0
        ? 'لم يُحذف شيء — كل قسم فارغ كُتب فيه أو لم يعد موجودًا.'
        : `حُذف ${String(removed)} من الأقسام الفارغة في تغيير واحد — تراجع واحد يعيدها.`;
    return kept === 0 || removed === 0
      ? head
      : `${head} بقي ${String(kept)} لأنه كُتب فيه أو لم يعد موجودًا.`;
  }
  if (removed === 0) {
    return 'Nothing was removed — every empty section was written into or is gone.';
  }
  const head =
    removed === 1
      ? 'Removed 1 empty section in one change — one Undo brings it back.'
      : `Removed ${String(removed)} empty sections in one change — one Undo brings them back.`;
  if (kept === 0) return head;
  return `${head} Kept ${String(kept)} that ${kept === 1 ? 'was' : 'were'} written into or ${
    kept === 1 ? 'is' : 'are'
  } gone.`;
}
