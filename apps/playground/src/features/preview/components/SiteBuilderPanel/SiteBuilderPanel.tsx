import { GenerationProgress } from '@craftkit/builder';

import type { AgentLocale } from '../AgentFace';
import type { SiteRunHost } from '../AssistantPanel/AssistantPanel.siteRun';
import { useSiteRun, type SiteRunSeam } from '../AssistantPanel/use-site-run';
import { SiteBriefForm } from '../SiteBriefForm';

export interface SiteBuilderPanelProps {
  /** The site to build into. Absent ⇒ this build has no site path at all. */
  readonly site?: SiteRunHost | undefined;
  /** The panel's one lease, shared with the assistant so two runs cannot collide. */
  readonly seam: SiteRunSeam;
  /** Aborts whichever run owns the lease. */
  readonly onStop: () => void;
  readonly locale?: AgentLocale | undefined;
}

const LABELS = {
  ar: {
    heading: 'ابنِ موقعاً',
    building: 'يبني الموقع',
    none: 'لا يوجد موقع لهذا البناء، فلا شيء هنا ليُبنى فيه.',
  },
  en: {
    heading: 'Build a site',
    building: 'Building the site',
    none: 'This build has no site, so there is nothing here to build into.',
  },
} as const;

/**
 * The site builder, in its own destination on the rail.
 *
 * ## Why it is not a card in the assistant panel
 *
 * It was, for one afternoon, and the first person to use it said the
 * conversation and their own typing had become hard to tell apart. They were
 * right: a three-line form, a hint, a status line and an outcome sat
 * permanently between the header and the messages, and the messages got
 * whatever was left of the panel.
 *
 * The deeper reason is that a site build is not a message. A conversation is a
 * sequence of turns a person reads back; a build is a JOB with five stages, its
 * own progress and its own Stop, and it stays interesting for minutes after the
 * sentence that started it. Putting a job in a message list makes the job hard
 * to watch and the list hard to read.
 *
 * It shares ONE thing with the assistant, and that sharing is deliberate: the
 * panel's run lease. Two destinations, one lease, so a site build and a page
 * request can never both believe they own the editor.
 */
export function SiteBuilderPanel({ site, seam, onStop, locale = 'ar' }: SiteBuilderPanelProps) {
  const copy = LABELS[locale];
  const run = useSiteRun(site, seam);

  return (
    <section className="pg-site-builder" aria-label={copy.heading}>
      <h2 className="pg-site-builder__title">{copy.heading}</h2>

      {site === undefined ? (
        <p className="pg-site-builder__empty">{copy.none}</p>
      ) : (
        <>
          {run.running ? (
            <GenerationProgress stages={run.stages} onCancel={onStop} heading={copy.building} />
          ) : null}
          <SiteBriefForm onSubmit={run.start} busy={seam.busy} locale={locale} />
          {run.outcome === undefined ? null : (
            <p
              className="pg-site-builder__outcome"
              data-ok={run.outcome.ok}
              role="status"
              dir="auto"
            >
              {run.outcome.message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
