import { t } from '../../copy';
import type {
  AssistantMode,
  EffortLevel,
  EffortSelectionView,
  EnhancementView,
  FreeCodeView,
  Locale,
  ModelSelectionView,
  SendState,
} from '../../model/view-types';
import { EffortMenu } from '../EffortMenu';
import { EnhanceButton } from '../EnhanceButton';
import { IconButton } from '../IconButton';
import { ModeMenu } from '../ModeMenu';
import { ModelMenu } from '../ModelMenu';
import { SendButton } from '../SendButton';

import './ComposerToolbar.css';

export interface ComposerToolbarProps {
  readonly locale: Locale;
  readonly mode: AssistantMode;
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
 * provider takes a reasoning budget, Effort ▾ at the inline start, then ✨ Improve, `[@]` and the Send slot at the inline end. 36px tall with
 * 32px items and 4px between them; 52 and 44 with 8 between them on a coarse pointer.
 *
 * Read in the order a request is made: how it may touch the page, who writes it, then the
 * tools for the words, then Send, which is the last thing the hand reaches. The row wraps
 * rather than clipping when the panel is narrow and a wide state (Queued) joins it.
 */
export function ComposerToolbar({
  locale,
  mode,
  model,
  effort,
  freeCode,
  send,
  enhancement,
  running,
  onModeChange,
  onModelChange,
  onEffortChange,
  onFreeCodeChange,
  onMention,
  onEnhance,
  onSend,
  className,
}: ComposerToolbarProps) {
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
      </div>
      <div className="ck-agent-toolbar__actions">
        {freeCode == null || onFreeCodeChange === undefined ? null : (
          <IconButton
            icon="code"
            label={t(locale, 'freeCode.button')}
            hint={t(locale, freeCode.enabled ? 'freeCode.on' : 'freeCode.off')}
            pressed={freeCode.enabled}
            tooltipSide="top"
            onClick={() => {
              onFreeCodeChange(!freeCode.enabled);
            }}
          />
        )}
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
