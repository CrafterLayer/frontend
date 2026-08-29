import { useKernelSelector, type BuilderKernel } from '@craftkit/builder';

export interface DirectionFlipProps {
  kernel: BuilderKernel;
}

type KernelState = ReturnType<BuilderKernel['context']['store']['getState']>;
const selectDir = (state: KernelState) => state.doc.dir;

/**
 * Flips the DOCUMENT's content direction through the kernel's single door —
 * an ordinary undoable command, never a view-side hack (FR-009).
 */
export function DirectionFlip({ kernel }: DirectionFlipProps) {
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
        kernel.dispatch('setDocMeta', { dir: next });
      }}
    >
      {next.toUpperCase()}
    </button>
  );
}
