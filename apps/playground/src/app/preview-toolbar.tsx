import './preview-toolbar.css';

/** The toolbar's own name, in the editor's language. */
const TOOLBAR_LABEL = { en: 'Preview tools', ar: 'أدوات المعاينة' } as const;

export interface PreviewToolbarProps {
  /** The editor's language (the chip's words come from the editor labels). */
  readonly language: 'en' | 'ar';
  readonly dir: 'ltr' | 'rtl';
  /** "Flip direction (preview)" / «قلب الاتجاه (معاينة)». */
  readonly flipLabel: string;
  /** Whether the preview is showing the flipped direction. */
  readonly flipped: boolean;
  readonly onFlip: () => void;
  /** What is being previewed ("Desktop · 1280 px"), said beside the tools. */
  readonly note?: string | undefined;
}

/**
 * The bar above Preview (agent-script audit §B.3.8): the direction flip used to
 * be a raw `<button>` absolutely positioned over the preview frame, covering
 * the top of every page. It is now a tokenized toggle chip in its own toolbar
 * row, so the page underneath is never overlaid. The flip stays VIEW state.
 */
export function PreviewToolbar({
  language,
  dir,
  flipLabel,
  flipped,
  onFlip,
  note,
}: PreviewToolbarProps) {
  return (
    <div
      className="pg-preview-toolbar"
      role="toolbar"
      aria-label={TOOLBAR_LABEL[language]}
      dir={dir}
      lang={language}
    >
      <button type="button" className="pg-preview-chip" aria-pressed={flipped} onClick={onFlip}>
        <svg
          className="pg-preview-chip__icon"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M3 7h12m0 0-3-3m3 3-3 3M17 13H5m0 0 3-3m-3 3 3 3" />
        </svg>
        <span>{flipLabel}</span>
      </button>
      {note === undefined ? null : <span className="pg-preview-toolbar__note">{note}</span>}
    </div>
  );
}
