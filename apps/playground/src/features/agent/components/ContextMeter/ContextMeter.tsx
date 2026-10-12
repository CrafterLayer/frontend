import { compactTokens, contextLabels, meterValueText } from '../../copy/context-labels';
import type { ContextMeterView } from '../../model/context-meter';
import type { Locale } from '../../model/view-types';

import './ContextMeter.css';

export interface ContextMeterProps {
  readonly locale: Locale;
  readonly meter: ContextMeterView;
  /** Appended to `ck-agent-meter`. */
  readonly className?: string | undefined;
}

/**
 * How big the latest request was against its budget (2026-10-12): a quiet "12k / 64k" in
 * Meta type with a thin bar under it, beside the composer's context chip. Past 80% of the
 * budget the figure and the bar take the warning token. The numbers keep Latin digits in
 * both languages.
 *
 * A `meter`, not a control: its name is "Context" and its value is spoken in whole tokens
 * («نحو 12,345 من 64,000 توكن»), followed by what the figure means for the next request
 * when it is near the limit or the conversation already gave way. The visible figure and
 * the bar are drawn for the eye only.
 */
export function ContextMeter({ locale, meter, className }: ContextMeterProps) {
  const words = contextLabels(locale);
  const share = meter.max > 0 ? Math.min(1, meter.used / meter.max) : 0;
  const notes = [
    meterValueText(locale, meter.used, meter.max),
    ...(meter.level === 'warning' ? [words.meterNear] : []),
    ...(meter.trimmed ? [words.trimmed] : []),
  ];

  return (
    <span
      role="meter"
      className={className === undefined ? 'ck-agent-meter' : `ck-agent-meter ${className}`}
      aria-label={words.meter}
      aria-valuemin={0}
      aria-valuemax={meter.max}
      aria-valuenow={Math.min(meter.used, meter.max)}
      aria-valuetext={notes.join('. ')}
      title={[words.meterHint, ...notes].join('\n')}
      data-level={meter.level}
      data-trimmed={meter.trimmed ? '' : undefined}
    >
      <span className="ck-agent-meter__figure" aria-hidden="true">
        {`${compactTokens(meter.used)} / ${compactTokens(meter.max)}`}
      </span>
      <span className="ck-agent-meter__track" aria-hidden="true">
        <span
          className="ck-agent-meter__fill"
          style={{ inlineSize: `${(share * 100).toFixed(1)}%` }}
        />
      </span>
    </span>
  );
}
