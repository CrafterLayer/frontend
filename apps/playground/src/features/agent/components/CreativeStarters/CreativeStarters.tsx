import { useId } from 'react';

import { t } from '../../copy';
import type { FreeCodeView, Locale, SuggestionView } from '../../model/view-types';
import { AgentIcon, type AgentIconName } from '../AgentIcon';

import './CreativeStarters.css';
import { CREATIVE_STARTERS, type CreativeStarter } from './starters';

const ICON = {
  game: 'game',
  story: 'dialogue',
  bedtime: 'moon',
} as const satisfies Readonly<Record<CreativeStarter, AgentIconName>>;

export interface CreativeStartersProps {
  readonly locale: Locale;
  /** The free-code switch's state: the note under the cards says whether games can be written. */
  readonly freeCode: FreeCodeView;
  /**
   * A card was chosen: like a suggestion row, its request goes in the composer and is never
   * sent. `source` is `starter`, `key` is `creative:<starter>`.
   */
  readonly onChoose: (suggestion: SuggestionView) => void;
  /** Turn free code on from the note. Left out, the note only explains. */
  readonly onFreeCodeChange?: ((enabled: boolean) => void) | undefined;
  /** Appended to `ck-agent-creative`. */
  readonly className?: string | undefined;
}

/**
 * The empty thread's creative starters (creative agent, 2026-10-12): three cards, a
 * platformer game, a story with choices and a bedtime story, under a small heading with a
 * New badge. They sit under the page starters: the panel builds pages first, and games and
 * interactive stories are the newer thing it can make.
 *
 * Each card FILLS the composer with a strong, specific request (a hero, a goal, a setting,
 * so the creative planner has something to plan) and never sends; its description says so,
 * as a suggestion row's does. A game or story is written as free code, so the note under
 * the cards says whether free code is on and, when it is off, offers to turn it on.
 */
export function CreativeStarters({
  locale,
  freeCode,
  onChoose,
  onFreeCodeChange,
  className,
}: CreativeStartersProps) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <section
      className={className === undefined ? 'ck-agent-creative' : `ck-agent-creative ${className}`}
      aria-labelledby={titleId}
    >
      <div className="ck-agent-creative__head">
        <h3 id={titleId} className="ck-agent-creative__title">
          {t(locale, 'creative.title')}
        </h3>
        <span className="ck-agent-creative__badge">{t(locale, 'creative.badge')}</span>
      </div>
      {/* role="list": WebKit drops the list role from a list drawn without markers. */}
      <ul role="list" className="ck-agent-creative__grid">
        {CREATIVE_STARTERS.map((starter) => (
          <li key={starter} className="ck-agent-creative__item">
            <button
              type="button"
              className="ck-agent-creative__card"
              data-starter={starter}
              aria-describedby={descriptionId}
              onClick={() => {
                onChoose({
                  key: `creative:${starter}`,
                  text: t(locale, `creative.${starter}.prompt`),
                  source: 'starter',
                });
              }}
            >
              <span className="ck-agent-creative__icon" aria-hidden="true">
                <AgentIcon name={ICON[starter]} />
              </span>
              <span className="ck-agent-creative__name">{t(locale, `creative.${starter}`)}</span>
              <span className="ck-agent-creative__detail">
                {t(locale, `creative.${starter}.detail`)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {freeCode.enabled ? (
        <p className="ck-agent-creative__note" data-on="">
          <AgentIcon name="code" className="ck-agent-creative__note-glyph" />
          <span>{t(locale, 'creative.freeCodeOn')}</span>
        </p>
      ) : (
        <div className="ck-agent-creative__note">
          <AgentIcon name="code" className="ck-agent-creative__note-glyph" />
          <p className="ck-agent-creative__note-text">{t(locale, 'creative.needsFreeCode')}</p>
          {onFreeCodeChange === undefined ? null : (
            <button
              type="button"
              className="ck-agent-creative__enable"
              onClick={() => {
                onFreeCodeChange(true);
              }}
            >
              {t(locale, 'creative.enableFreeCode')}
            </button>
          )}
        </div>
      )}
      <span id={descriptionId} hidden>
        {t(locale, 'suggestions.description')}
      </span>
    </section>
  );
}
