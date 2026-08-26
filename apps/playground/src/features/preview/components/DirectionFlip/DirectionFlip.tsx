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
      onClick={() => {
        kernel.dispatch('setDocMeta', { dir: next });
      }}
    >
      Direction: {dir} → {next}
    </button>
  );
}
