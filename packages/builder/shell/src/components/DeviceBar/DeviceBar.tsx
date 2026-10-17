import { useState } from 'react';

import { bucketForWidth, type EditingBucket } from '../../devices/buckets';
import '../../styles/visually-hidden.css';
import './DeviceBar.css';

/** Preset widths (007 contract §3): desktop 1280 · tablet 834 · mobile 390. */
const PRESETS = [
  { id: 'desktop', label: 'Desktop', width: 1280 },
  { id: 'tablet', label: 'Tablet', width: 834 },
  { id: 'mobile', label: 'Mobile', width: 390 },
] as const;

export interface DeviceState {
  width: number;
  bucket: EditingBucket;
}

export interface DeviceBarProps {
  /** VIEW state owned by the composing surface — never document, never kernel. */
  value: DeviceState;
  onChange: (next: DeviceState) => void;
}

/**
 * Device switching (007 contract §3): presets and a custom width both map to
 * the editing bucket through `bucketForWidth` — ONE threshold authority for
 * the whole surface. A partially typed width is a DRAFT, never device state:
 * it commits on blur or Enter only, so the frame width and — critically — the
 * bucket the inspector WRITES TO never flap through transient values (review
 * M2: a keystroke-committed "1" would have relaid out the frame at 1px and
 * routed the next inspector edit into the mobile bucket). Every settled switch
 * announces once through the bar's own polite region.
 */
export function DeviceBar({ value, onChange }: DeviceBarProps) {
  const [message, setMessageState] = useState({ text: '', nonce: 0 });
  const [draft, setDraft] = useState<{ text: string; base: number } | null>(null);
  const draftLive = draft !== null && draft.base === value.width;

  const apply = (width: number) => {
    const bucket = bucketForWidth(width);
    onChange({ width, bucket });
    setMessageState((current) => ({
      text: `${String(width)}px — editing ${bucket === 'base' ? 'base values' : `${bucket} overrides`}`,
      nonce: current.nonce + 1,
    }));
  };

  const commitDraft = () => {
    if (!draftLive) {
      setDraft(null);
      return;
    }
    const text = draft.text;
    setDraft(null);
    const parsed = Number(text);
    if (text !== '' && Number.isFinite(parsed) && parsed >= 1) {
      apply(Math.floor(parsed));
    }
  };

  return (
    <div className="bldr-devicebar" role="group" aria-label="Device">
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="bldr-devicebar__preset"
          aria-pressed={value.width === preset.width}
          onClick={() => {
            apply(preset.width);
          }}
        >
          {preset.label}
        </button>
      ))}
      <label className="bldr-devicebar__width">
        Width
        <input
          className="bldr-devicebar__width-input"
          type="number"
          min={1}
          value={draftLive ? draft.text : String(value.width)}
          onChange={(event) => {
            setDraft({ text: event.target.value, base: value.width });
          }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commitDraft();
            }
          }}
        />
      </label>
      <output className="bldr-visually-hidden" aria-live="polite" aria-label="Device messages">
        {message.text}
        {message.nonce % 2 === 1 ? '​' : ''}
      </output>
    </div>
  );
}
