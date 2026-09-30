/** A CSS `view-transition-name` for a row: an identifier, whatever the section's key holds. */
export function planRowTransitionName(key: string): string {
  return `ck-plan-row-${key.replace(/[^A-Za-z0-9_-]/gu, '-')}`;
}
