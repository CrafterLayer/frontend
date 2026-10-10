import { useId, useRef, useState } from 'react';

import '../../styles/visually-hidden.css';
import { TEMPLATE_CARD_LABELS_EN, type TemplateCardLabels } from './TemplateCard.labels';
import type { TemplateCardInfo } from './template-order';
import './TemplateCard.css';

export interface TemplateCardProps {
  /** The catalog entry (a host passes its `MarketingTemplateCard` as is). */
  readonly card: TemplateCardInfo;
  /** The editor language's strings: they pick the name and description shown. */
  readonly labels?: TemplateCardLabels | undefined;
  /** Inserts the card's composition; called on click, Enter and Space. */
  readonly onInsert: (card: TemplateCardInfo) => void;
  readonly onBeginDrag?: ((x: number, y: number) => { didActivate: () => boolean }) | undefined;
}

/**
 * One page template in the Library (agent-script DESIGN §B.5): a real photo
 * thumbnail (16:10, lazy, with its alt in the content language), an accent
 * skeleton strip that hints at a page of sections, the name and description in
 * the EDITOR's language, and a badge for the CONTENT language (`EN` / `ع`)
 * beside the section count. It is one native button: Enter and Space insert.
 */
export function TemplateCard({ card, labels = TEMPLATE_CARD_LABELS_EN, onInsert, onBeginDrag }: TemplateCardProps) {
  const id = useId();
  const gesture = useRef<{ didActivate: () => boolean } | null>(null);
  const descriptionId = `${id}-description`;
  const metaId = `${id}-meta`;
  // A photo that fails to load leaves the skeleton ground, never a broken-image glyph.
  const [photo, setPhoto] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const name = card.name[labels.language];
  const description = card.description[labels.language];

  return (
    <button
      type="button"
      className="bldr-template-card"
      aria-label={labels.insert(name)}
      aria-describedby={`${descriptionId} ${metaId}`}
      data-content-lang={card.lang}
      onDragStart={(event) => { event.preventDefault(); }}
      onPointerDown={(event) => {
        if (event.button === 0) gesture.current = onBeginDrag?.(event.clientX, event.clientY) ?? null;
      }}
      onClick={() => {
        const dragged = gesture.current?.didActivate() === true;
        gesture.current = null;
        if (dragged) return;
        onInsert(card);
      }}
    >
      <span className="bldr-template-card__thumb" data-photo={photo}>
        {photo === 'failed' ? null : (
          <img
            className="bldr-template-card__photo"
            src={card.thumbnail.src}
            alt={card.thumbnail.alt}
            lang={card.lang}
            loading="lazy"
            decoding="async"
            width={640}
            height={400}
            onLoad={() => {
              setPhoto('loaded');
            }}
            onError={() => {
              setPhoto('failed');
            }}
          />
        )}
        <span className="bldr-template-card__strip" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </span>
      <span className="bldr-template-card__body">
        <span className="bldr-template-card__name">{name}</span>
        <span id={descriptionId} className="bldr-template-card__description">
          {description}
        </span>
        <span id={metaId} className="bldr-template-card__meta">
          <span
            className="bldr-template-card__badge"
            title={labels.contentLanguage[card.lang]}
            data-lang={card.lang}
          >
            {/* The glyph is in the content language; the spoken meaning is in the editor's. */}
            <span aria-hidden="true" lang={card.lang}>
              {labels.badge[card.lang]}
            </span>
            <span className="bldr-visually-hidden">{labels.contentLanguage[card.lang]}</span>
          </span>
          <span className="bldr-template-card__count">{labels.sections(card.sections)}</span>
        </span>
      </span>
    </button>
  );
}
