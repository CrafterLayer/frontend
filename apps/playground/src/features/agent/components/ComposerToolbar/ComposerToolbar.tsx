import { useId } from 'react';

import { t } from '../../copy';
import type {
  AssistantMode,
  BuildWorkerCount,
  EffortLevel,
  EffortSelectionView,
  EnhancementView,
  FreeCodeView,
  Locale,
  ModelSelectionView,
  SendState,
} from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';
import { EffortMenu } from '../EffortMenu';
import { EnhanceButton } from '../EnhanceButton';
import { IconButton } from '../IconButton';
import { ModeMenu } from '../ModeMenu';
import { ModelMenu } from '../ModelMenu';
import { SendButton } from '../SendButton';
import { WorkerMenu } from '../WorkerMenu';
import { ComposerTooltip } from './ComposerTooltip';

import './ComposerToolbar.css';

export interface ComposerToolbarProps {
  readonly locale: Locale;
  readonly mode: AssistantMode;
  readonly workers?: BuildWorkerCount | undefined;
  readonly onWorkersChange?: ((workers: BuildWorkerCount) => void) | undefined;
  /** The model picker; `null` when the provider offers no choice, and then none is drawn. */
  readonly model: ModelSelectionView | null;
  /** The effort picker; absent or `null` when the provider takes no budget, and none is drawn. */
  readonly effort?: EffortSelectionView | null | undefined;
  /** The free-code switch; absent or `null` when the host keeps none, and then none is drawn. */
  readonly freeCode?: FreeCodeView | null | undefined;
  readonly send: SendState;
  readonly enhancement: EnhancementView;
  /** A run is live: Mode says its change applies next time, Improve waits. */
  readonly running: boolean;
  readonly onModeChange: (mode: AssistantMode) => void;
  readonly onModelChange: (id: string) => void;
  readonly onEffortChange?: ((level: EffortLevel) => void) | undefined;
  readonly onFreeCodeChange?: ((enabled: boolean) => void) | undefined;
  /** `[@]`: start a mention in the draft (the Composer types the `@` and opens the list). */
  readonly onMention: () => void;
  readonly onEnhance: () => void;
  readonly onSend: () => void;
  /** Appended to `ck-agent-toolbar`. */
  readonly className?: string | undefined;
}

/**
 * The composer's bottom row (SPEC §4.17 ComposerToolbar): Mode ▾, Model ▾ and, when the
 * provider takes a reasoning budget, Effort ▾ and the independent build-worker choice at
 * the inline start, then the free-code switch when the host keeps one, then ✨ Improve,
 * `[@]` and Send.
 *
 * Free code is a switch (Studio Indigo redesign, 2026-10-12): it changes what the next request
 * may write (JavaScript, whole Pixi scenes), so its state is read at a glance: `</>` and a track
 * whose knob sits at the inline end when on. It is a toggle button (`aria-pressed`) described by
 * what on and off mean.
 *
 * Compact composer (2026-10-12): every choice is one chip on ONE row with the actions, a glyph
 * and a short value at 28px (44 on a coarse pointer). As the panel narrows the words go first,
 * widest first (Free code, then Model and Effort, then Mode), the glyphs stay, and each chip's
 * accessible name and tooltip keep the whole ("Effort: High"). Only a panel too narrow even for
 * the glyphs lets the actions wrap under them.
 *
 * Read in the order a request is made: how it may touch the page, who writes it, then the
 * tools for the words, then Send, which is the last thing the hand reaches. The row wraps
 * rather than clipping when the panel is narrow and a wide state (Queued) joins it.
 */
export function ComposerToolbar({
  locale,
  mode,
  workers,
  model,
  effort,
  freeCode,
  send,
  enhancement,
  running,
  onModeChange,
  onWorkersChange,
  onModelChange,
  onEffortChange,
  onFreeCodeChange,
  onMention,
  onEnhance,
  onSend,
  className,
}: ComposerToolbarProps) {
  const freeCodeHintId = useId();
  return (
    <div className={className === undefined ? 'ck-agent-toolbar' : `ck-agent-toolbar ${className}`}>
      <div className="ck-agent-toolbar__choices">
        <ModeMenu locale={locale} mode={mode} running={running} onModeChange={onModeChange} />
        {model === null ? null : (
          <ModelMenu locale={locale} model={model} onModelChange={onModelChange} />
        )}
        {effort == null || onEffortChange === undefined ? null : (
          <EffortMenu locale={locale} effort={effort} onEffortChange={onEffortChange} />
        )}
        {workers === undefined || onWorkersChange === undefined ? null : (
          <WorkerMenu
            locale={locale}
            value={workers}
            running={running || enhancement.status === 'enhancing'}
            onChange={onWorkersChange}
          />
        )}
        {freeCode == null || onFreeCodeChange === undefined ? null : (
          <>
            <ComposerTooltip label={t(locale, 'freeCode.button')} align="start">
              <button
                type="button"
                className="ck-agent-freecode"
                aria-pressed={freeCode.enabled}
                aria-describedby={freeCodeHintId}
                onClick={() => {
                  onFreeCodeChange(!freeCode.enabled);
                }}
              >
                <AgentIcon name="code" className="ck-agent-freecode__glyph" />
                <span className="ck-agent-freecode__label">{t(locale, 'freeCode.button')}</span>
                <span className="ck-agent-freecode__track" aria-hidden="true">
                  <span className="ck-agent-freecode__knob" />
                </span>
              </button>
            </ComposerTooltip>
            <span id={freeCodeHintId} hidden>
              {t(locale, freeCode.enabled ? 'freeCode.on' : 'freeCode.off')}
            </span>
          </>
        )}
      </div>
      <div className="ck-agent-toolbar__actions">
        <EnhanceButton
          locale={locale}
          enhancement={enhancement}
          empty={send === 'idle-empty' || send === 'running-empty'}
          running={running}
          onEnhance={onEnhance}
        />
        <IconButton
          icon="mention"
          label={t(locale, 'mention.button')}
          tooltipSide="top"
          onClick={onMention}
        />
        <SendButton locale={locale} state={send} onSend={onSend} />
      </div>
    </div>
  );
}
