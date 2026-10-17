/*
  Beside the component rather than inside it, for the reason the repo already
  applies to `GenerationProgress`' constants: a component file that also exports
  a function breaks fast refresh, and the tests want this without importing the
  component's module graph.
*/

/**
 * The estimate as a person reads it: two significant figures, and the word
 * "estimate" out loud.
 *
 * Same shape the plan card uses, deliberately — one vocabulary for cost across
 * the panel, so a number here and a number there mean the same thing.
 */
export function describeBuildCost(tokens: number, locale: 'ar' | 'en'): string {
  const rounded =
    tokens >= 1000 ? `${(Math.round(tokens / 100) / 10).toFixed(1)}k` : String(Math.round(tokens));
  return locale === 'ar' ? `تقدير: ~${rounded} توكن` : `Estimate: ~${rounded} tokens`;
}

/**
 * Why pressing Build is safe, in the panel's language: nothing is on the page
 * until it is pressed, and each section then lands as its own change.
 */
export function approvalNote(locale: 'ar' | 'en'): string {
  return locale === 'ar'
    ? 'لم يُكتب شيء على الصفحة بعد. عند البناء تُرسم هذه الأقسام ثم يُكتب كل قسم كتغيير مستقل، فيمكن التراجع عن أي قسم وحده.'
    : 'Nothing is on the page yet. Build lays out these sections, then writes each one as its own change, so any section can be undone on its own.';
}
