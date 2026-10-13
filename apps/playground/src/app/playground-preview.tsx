import type { Dispatch, SetStateAction } from 'react';

import { PreviewMode, type BuilderKernel, type Theme } from '@craftkit/builder';

import type { EditorLabels, EditorLocale } from './editor-labels';
// library-playground additions (2026-10-08): the direction flip is a toolbar chip, not an overlay.
import { PREVIEW_MODE_LABELS_AR } from './preview.copy';
import { PreviewToolbar } from './preview-toolbar';
// end library-playground additions

export interface PlaygroundPreviewProps {
  readonly kernel: BuilderKernel;
  readonly theme: Theme;
  readonly editorLocale: EditorLocale;
  readonly labels: EditorLabels;
  /** The live document direction. */
  readonly docDir: string;
  readonly breakpoint: 'desktop' | 'tablet' | 'mobile';
  readonly frameWidth: number;
  readonly previewFlipped: boolean;
  readonly setPreviewFlipped: Dispatch<SetStateAction<boolean>>;
  readonly setPreview: (preview: boolean) => void;
  readonly setModeMessage: Dispatch<SetStateAction<{ text: string; nonce: number }>>;
}

/** Preview: the page alone, with the direction-flip toolbar above it. */
export function PlaygroundPreview({
  kernel,
  theme,
  editorLocale,
  labels,
  docDir,
  breakpoint,
  frameWidth,
  previewFlipped,
  setPreviewFlipped,
  setPreview,
  setModeMessage,
}: PlaygroundPreviewProps) {
  // US4: EVERY piece of editing chrome disappears — the preview surface plus
  // two floating controls (exit lives inside PreviewMode). The direction
  // flip here is VIEW state: the document-mutating flip stays in the header.
  const dirOverride = previewFlipped ? (docDir === 'ltr' ? 'rtl' : 'ltr') : null;
  return (
    /* The flip and the device ride in Preview's own bar ABOVE the page, with Exit preview at
       its end (audit §B.3.8, UX pass 2026-10-13): nothing sits over the page being checked. */
    <div style={{ blockSize: '100vh', display: 'flex', flexDirection: 'column' }} dir={labels.dir}>
      <div style={{ flex: '1 1 auto', minBlockSize: 0, position: 'relative' }}>
        <PreviewMode
          toolbar={
            <PreviewToolbar
              language={editorLocale}
              dir={labels.dir}
              flipLabel={labels.chrome.flipPreview}
              flipped={previewFlipped}
              onFlip={() => {
                setPreviewFlipped((flipped) => !flipped);
              }}
              note={labels.chrome.deviceLine(
                labels.chrome.device[breakpoint === 'desktop' ? 'base' : breakpoint],
                frameWidth,
              )}
            />
          }
          {...(editorLocale === 'ar' ? { labels: PREVIEW_MODE_LABELS_AR } : {})}
          kernel={kernel}
          theme={theme}
          dirOverride={dirOverride}
          breakpoint={breakpoint}
          frameWidth={frameWidth}
          onExit={() => {
            setPreview(false);
            setPreviewFlipped(false);
            requestAnimationFrame(() => {
              setModeMessage((current) => ({
                text: labels.chrome.previewClosed,
                nonce: current.nonce + 1,
              }));
            });
          }}
        />
      </div>
    </div>
    /* end library-playground additions */
  );
}
