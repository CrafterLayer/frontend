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
