import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { IMAGE_CROPPER_LABELS_EN, type ImageCropperLabels } from './ImageCropper.labels';
import {
  ASPECT_PRESETS,
  clampPercent,
  DEFAULT_CROP,
  focalAfterKey,
  type AspectPreset,
  type CropValue,
} from './crop-math';
import './ImageCropper.css';

export interface ImageCropperProps {
  readonly src: string;
  readonly alt?: string | undefined;
  readonly defaultValue?: CropValue | undefined;
  readonly aspects?: readonly AspectPreset[] | undefined;
  /** Called with the final crop; the host writes classes or crops the pixels. */
  readonly onApply: (crop: CropValue) => void;
  /** Absent ⇒ no Cancel button. */
  readonly onCancel?: (() => void) | undefined;
  /** Every change while choosing (a canvas preview), never a document write. */
  readonly onPreview?: ((crop: CropValue) => void) | undefined;
  readonly labels?: ImageCropperLabels | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
}

/**
 * Aspect presets plus a focal point, by pointer AND keyboard (style-manager
 * DESIGN.md §G). Our own code: `react-easy-crop` was rejected for its
 * BSD-3 `normalize-wheel` dependency (LIBRARIES.md §C).
 *
 * The focal handle follows react-colorful's precedent for a 2-D control: one
 * `role="slider"` with a spoken `aria-valuetext` ("30% across, 60% down"),
 * arrows moving it 1% (Shift 10%), Home centring it. Its coordinates are the
 * IMAGE's, so the arrows move it the way the picture is drawn in either UI
 * direction. Nothing is written until "Apply crop".
 */
export function ImageCropper({
  src,
  alt = '',
  defaultValue = DEFAULT_CROP,
  aspects = ASPECT_PRESETS,
  onApply,
  onCancel,
  onPreview,
  labels = IMAGE_CROPPER_LABELS_EN,
  dir,
}: ImageCropperProps) {
  const [crop, setCrop] = useState<CropValue>(defaultValue);
  const stage = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const groupName = useId();
  const hintId = useId();

  const update = (next: CropValue): void => {
    setCrop(next);
    onPreview?.(next);
  };
  const fromPointer = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const box = stage.current?.getBoundingClientRect();
    if (box === undefined || box.width === 0 || box.height === 0) return;
    update({
      ...crop,
      x: clampPercent(((event.clientX - box.left) / box.width) * 100),
      y: clampPercent(((event.clientY - box.top) / box.height) * 100),
    });
  };
  const preset = aspects.find((each) => each.id === crop.aspect);

  return (
    <section className="bldr-cropper" aria-label={labels.title} dir={dir}>
      <fieldset className="bldr-cropper__aspects">
        <legend className="bldr-cropper__legend">{labels.aspect}</legend>
        {aspects.map((each) => (
          <label key={each.id} className="bldr-cropper__aspect">
            <input
              type="radio"
              name={groupName}
              value={each.id}
              checked={crop.aspect === each.id}
              onChange={() => {
                update({ ...crop, aspect: each.id });
              }}
            />
            {labels.aspects[each.id] ?? each.id}
          </label>
        ))}
      </fieldset>

      <div
        ref={stage}
        className="bldr-cropper__stage"
        dir="ltr"
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          fromPointer(event);
        }}
        onPointerMove={(event) => {
          if (dragging.current) fromPointer(event);
        }}
        onPointerUp={(event) => {
          dragging.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      >
        <img className="bldr-cropper__image" src={src} alt={alt} draggable={false} />
        <div
          className="bldr-cropper__handle"
          role="slider"
          tabIndex={0}
          aria-label={labels.focal}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={crop.x}
          aria-valuetext={labels.focalValue(crop.x, crop.y)}
          aria-describedby={hintId}
          style={{ insetInlineStart: `${String(crop.x)}%`, insetBlockStart: `${String(crop.y)}%` }}
          onKeyDown={(event) => {
            const next = focalAfterKey(crop, event.key, event.shiftKey);
            if (next === undefined) return;
            event.preventDefault();
            update(next);
          }}
        />
      </div>
      <p id={hintId} className="bldr-cropper__hint">
        {labels.hint}
      </p>

      <figure className="bldr-cropper__preview">
        <figcaption className="bldr-cropper__legend">{labels.preview}</figcaption>
        <img
          className="bldr-cropper__preview-image"
          src={src}
          alt=""
          style={{
            aspectRatio: preset?.ratio === undefined ? 'auto' : String(preset.ratio),
            objectFit: preset?.ratio === undefined ? 'contain' : 'cover',
            objectPosition: `${String(crop.x)}% ${String(crop.y)}%`,
          }}
        />
      </figure>

      <div className="bldr-cropper__actions">
        <button
          type="button"
          className="bldr-cropper__button bldr-cropper__button--primary"
          onClick={() => {
            onApply(crop);
          }}
        >
          {labels.apply}
        </button>
        {onCancel === undefined ? null : (
          <button type="button" className="bldr-cropper__button" onClick={onCancel}>
            {labels.cancel}
          </button>
        )}
      </div>
    </section>
  );
}
