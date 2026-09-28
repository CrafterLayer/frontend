import { useId } from 'react';

import { t } from '../../copy';
import type { ContextChipView, Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { IconButton } from '../IconButton';

import './ContextChip.css';

export interface ContextChipProps {
  readonly locale: Locale;
  readonly chip: ContextChipView;
  /**
   * Removes a block chip by its node id (`AgentController.removeChip`). Leave it out for a
   * chip that only shows what a request is about (a paused request's scope). The "Whole
   * page" chip never has one: it is the request's visible scope, not a choice (FR-024).
   */
  readonly onRemove?: ((id: string) => void) | undefined;
  /** Appended to `ck-agent-chip`. */
  readonly className?: string | undefined;
}

/**
 * What a request is about (SPEC §4.17 ContextChip, §3.2): the canvas selection, an `@`
 * mention, or, with neither, the whole page.
 *
 * A 28px Tint chip with a block glyph and the block's name in Graphite, cut with an
 * ellipsis at 16 characters. A block chip carries a `×` whose 32px hit area (44 on a coarse
 * pointer) overhangs the chip, so the visible mark can stay small and the target still
 * meets SPEC §6.4. A chip whose block is gone is struck through and says so under itself
 * («لم يعد على الصفحة»); its remove button is described by that line.
 *
 * The chip itself is not interactive: it is a label, and only its `×` is a control.
 */
export function ContextChip({ locale, chip, onRemove, className }: ContextChipProps) {
  const captionId = useId();
  const isPage = chip.kind === 'page';
  const label = chip.kind === 'page' ? t(locale, 'scope.page') : chip.label;
  const stale = chip.kind !== 'page' && chip.stale;
  const removable = chip.kind !== 'page' && onRemove !== undefined;

  return (
    <span
      className={className === undefined ? 'ck-agent-chip' : `ck-agent-chip ${className}`}
      data-kind={chip.kind}
      data-stale={stale ? '' : undefined}
      data-removable={removable ? '' : undefined}
    >
      <span className="ck-agent-chip__body">
        <AgentIcon name={isPage ? 'page' : 'block'} className="ck-agent-chip__glyph" />
        {/* The page's own words sit in <bdi>; the full name stays reachable by pointer. */}
        <span className="ck-agent-chip__label" title={label}>
          {isPage ? label : <bdi>{label}</bdi>}
        </span>
        {chip.kind !== 'page' && onRemove !== undefined ? (
          <IconButton
            icon="close"
            label={t(locale, 'chip.remove', { label })}
            describedBy={stale ? captionId : undefined}
            className="ck-agent-chip__remove"
            tooltipSide="top"
            onClick={() => {
              onRemove(chip.id);
            }}
          />
        ) : null}
      </span>
      {stale ? (
        <span id={captionId} className="ck-agent-chip__caption">
          {t(locale, 'chip.stale')}
        </span>
      ) : null}
    </span>
  );
}
