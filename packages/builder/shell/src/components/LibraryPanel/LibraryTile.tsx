import { useEffect, useRef, useState, type PointerEvent } from 'react';

export interface LibraryTileProps {
  readonly name: string;
  readonly description?: string | undefined;
  readonly caption?: string | undefined;
  /** A short tag shown when there is no thumbnail ('H2', '◇'). */
  readonly glyph: string;
  readonly badge?: string | undefined;
  readonly insertLabel: string;
  /** Builds the thumbnail document once the tile is on screen. Keep its identity stable. */
  readonly preview?: (() => Promise<string | undefined>) | undefined;
  readonly previewWidth?: number | undefined;
  readonly onInsert: () => void;
  /** Starts a canvas drag; returns whether the press became a real drag. */
  readonly onBeginDrag?: ((hostX: number, hostY: number) => { didActivate: () => boolean }) | undefined;
  readonly removeLabel?: string | undefined;
  readonly onRemove?: (() => void) | undefined;
}

/**
 * One Library entry: a button that inserts on click (or starts a canvas drag
 * on press), with a lazily built thumbnail — an inert, sandboxed `srcdoc`
 * iframe made only when the tile scrolls into view.
 */
export function LibraryTile({
  name,
  description,
  caption,
  glyph,
  badge,
  insertLabel,
  preview,
  previewWidth = 400,
  onInsert,
  onBeginDrag,
  removeLabel,
  onRemove,
}: LibraryTileProps) {
  const frameHost = useRef<HTMLSpanElement | null>(null);
  const probe = useRef<{ didActivate: () => boolean } | null>(null);
  const [srcdoc, setSrcdoc] = useState<string | undefined>(undefined);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const host = frameHost.current;
    if (host === null || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setWidth(entry.contentRect.width);
    });
    observer.observe(host);
    return () => { observer.disconnect(); };
  }, []);

  useEffect(() => {
    const host = frameHost.current;
    if (preview === undefined || host === null || typeof IntersectionObserver === 'undefined') return undefined;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void preview().then((document) => {
          if (!cancelled && document !== undefined) setSrcdoc(document);
        });
      },
      { rootMargin: '160px' },
    );
    observer.observe(host);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [preview]);

  return (
    <li className="bldr-library__tile">
      <button
        type="button"
        className="bldr-library__tile-button"
        aria-label={insertLabel}
        title={description}
        onDragStart={(event) => { event.preventDefault(); }}
        onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
          if (onBeginDrag === undefined || event.button !== 0) return;
          probe.current = onBeginDrag(event.clientX, event.clientY);
        }}
        onClick={() => {
          const gesture = probe.current;
          probe.current = null;
          if (gesture?.didActivate() === true) return;
          onInsert();
        }}
      >
        <span ref={frameHost} className="bldr-library__thumb" aria-hidden="true">
          {srcdoc === undefined ? (
            <span className="bldr-library__glyph">{glyph}</span>
          ) : (
            <iframe
              className="bldr-library__frame"
              title={name}
              srcDoc={srcdoc}
              sandbox=""
              tabIndex={-1}
              loading="lazy"
              style={{ width: previewWidth, height: previewWidth * 0.75, transform: `scale(${String(width / previewWidth)})` }}
            />
          )}
        </span>
        <span className="bldr-library__tile-name">{name}</span>
        {caption === undefined ? null : <span className="bldr-library__tile-caption">{caption}</span>}
        {badge === undefined ? null : <span className="bldr-library__badge">{badge}</span>}
      </button>
      {onRemove === undefined ? null : (
        <button type="button" className="bldr-library__remove" aria-label={removeLabel} onClick={onRemove}>
          ×
        </button>
      )}
    </li>
  );
}
