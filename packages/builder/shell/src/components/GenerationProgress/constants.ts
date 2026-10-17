/* The pipeline's stage vocabulary, in run order.

   It lives beside the component rather than inside it for the same reason
   `ChromeButton` keeps its own: a component file that also exports constants
   breaks fast refresh, and the stories need this list without importing the
   component's module graph. */
export const GENERATION_STAGE_IDS = [
  'sitemap',
  'structure',
  'content',
  'design',
  'assembly',
] as const;

/* What a person reads for each id. Exported so a host can name a stage in its
   own copy ("failed at Structure") without re-declaring the words; the rows in
   the card read from this same map, so the two can never drift apart. The key
   type is spelled from the ids here rather than imported from the component,
   which keeps this file free of the component's module graph. */
export const GENERATION_STAGE_LABELS: Readonly<
  Record<(typeof GENERATION_STAGE_IDS)[number], string>
> = {
  sitemap: 'Plan',
  structure: 'Structure',
  content: 'Content',
  design: 'Design',
  assembly: 'Apply',
};
