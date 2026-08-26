/**
 * Responsive rich values are deferred (008 contract §3 e5): under an override
 * bucket the field says so instead of writing silently — and, critically, it
 * says so WITHOUT instantiating an editor.
 */
export function ResponsiveNotice({ bucket }: { bucket: string }) {
  return (
    <p className="bldr-richtext-field__notice">
      Rich text has no {bucket} override yet — switch to desktop to edit the base value.
    </p>
  );
}
