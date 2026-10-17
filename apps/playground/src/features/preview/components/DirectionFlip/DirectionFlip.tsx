import { useKernelSelector, type BuilderKernel, type BuilderSiteKernel } from '@craftkit/builder';

export interface DirectionFlipProps {
  kernel: BuilderKernel;
  /**
   * The site the page belongs to, when there is one.
   *
   * Direction is a property of the SITE, not of one page: a page that turned on
   * its own would leave every other page and the site's own `dir` pointing the
   * other way, and the site kernel refuses exactly that — `validateSite` would
   * otherwise report `page-direction-mismatch` on the next RELOAD, so the
   * editor would look fine all session and refuse to open afterwards.
   */
  siteKernel?: BuilderSiteKernel;
}

type KernelState = ReturnType<BuilderKernel['context']['store']['getState']>;
const selectDir = (state: KernelState) => state.doc.dir;

/**
 * Flips the content direction through the single door — an ordinary undoable
 * command, never a view-side hack (FR-009).
 *
 * `setSiteDirection` when a site is present, because it turns the site, every
 * page and every shared region in ONE production: doing it page by page would
 * mean an intermediate state that is invalid, and an undo that could land on
 * the broken half.
 */
export function DirectionFlip({ kernel, siteKernel }: DirectionFlipProps) {
  const dir = useKernelSelector(kernel, selectDir);
  const next = dir === 'ltr' ? 'rtl' : 'ltr';
  return (
    <button
      type="button"
      /*
        The spoken name still says the whole thing; only the drawn text is
        short. The harness shares a 56px bar with the product's own controls,
        and a button that spells out its full sentence pushed its neighbours
        past the edge of the bar — where they were still focusable and no
        longer clickable. WCAG 2.5.3 is satisfied because the visible text is
        contained in the accessible name.
      */
      aria-label={`Direction: ${dir} → ${next}`}
      onClick={() => {
        if (siteKernel === undefined) {
          kernel.dispatch('setDocMeta', { dir: next });
          return;
        }
        siteKernel.dispatch('setSiteDirection', { dir: next });
      }}
    >
      {next.toUpperCase()}
    </button>
  );
}
