/**
 * What a rail section says before it has a panel.
 *
 * The rail advertises five destinations. Only `blocks` has one today, and the
 * honest thing for the other four is to say where their content actually is or
 * when it arrives — not to draw an empty panel, and certainly not to leave the
 * rail inert, which is what it did before: it painted a selected state and
 * ignored every click.
 *
 * Each line names a real fact about this repository, so the panel is a status
 * report rather than a placeholder.
 */
const NOTICE: Readonly<Record<string, { title: string; body: string }>> = {
  assets: {
    title: 'Assets',
    body: 'No asset library yet. Blocks carry their own content until one exists.',
  },
  help: {
    title: 'Help',
    body: 'Component documentation lives in Storybook, next to the stories that prove each behaviour.',
  },
};

export function RailSectionNotice({ section }: { section: string }) {
  const notice = NOTICE[section];
  if (notice === undefined) {
    return null;
  }
  return (
    <section className="pg-notice" aria-label={notice.title}>
      <h2>{notice.title}</h2>
      <p>{notice.body}</p>
    </section>
  );
}
