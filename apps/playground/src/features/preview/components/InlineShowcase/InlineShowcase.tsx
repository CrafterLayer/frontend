import { EditorCanvas, lightTheme, type BuilderKernel } from '@craftkit/builder';

export interface InlineShowcaseProps {
  kernel: BuilderKernel;
}

/**
 * The B3c inline-editing showcase: the `'inline'` fixture on a REAL editable
 * canvas — the exact product path. Double-click prose and the canvas lazily
 * loads the contributed rich editor in place; select a word and the floating
 * bubble formats exactly that word through the kernel's single door, one
 * transaction per action. The caption strip above the canvas tells a visitor
 * what to try; the story's play() proves the headline in a real browser.
 */
export function InlineShowcase({ kernel }: InlineShowcaseProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: '0.875rem', margin: 0, padding: '10px 16px' }}>
        Double-click text to edit it in place · select a word for the formatting bubble · use the
        block bar to duplicate or move
      </p>
      <div style={{ blockSize: '560px' }}>
        <EditorCanvas kernel={kernel} theme={lightTheme} editable />
      </div>
    </div>
  );
}
