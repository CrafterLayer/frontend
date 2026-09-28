import { useId } from 'react';

import { t } from '../../copy';
import { resolveDir, resolveLang } from '../../model/resolve-dir';
import type { Locale, SuggestionView } from '../../model/view-types';

import './SuggestionList.css';

export interface SuggestionListProps {
  readonly locale: Locale;
  /**
   * The rows, in the order to show them. `panelSuggestions` / `starterSuggestions` pick
   * them and apply the limits (4 in the empty state, 3 after a run); the list draws what it
   * is given. Empty draws nothing.
   */
  readonly suggestions: readonly SuggestionView[];
  /**
   * A row was chosen. The owner puts `suggestion.text` in the composer and focuses it with
   * the caret at the end (SPEC §4.16, §6.3). Choosing a row never sends.
   */
  readonly onChoose: (suggestion: SuggestionView) => void;
}

/**
 * What the person might ask next (SPEC §4.16): rows that FILL the composer and never send.
 *
 * It lives in the thread (after the greeting in the empty state, after the newest settled
 * record otherwise), so the dock's height never changes with it. Each row is a
 * `type="button"`: even inside a form it submits nothing. Its accessible description
 * says what choosing it does ("Puts the text in the box without sending it"), because a
 * row that reads like a request could otherwise be taken for one that runs.
 *
 * A row wraps to a second line rather than truncating: its words are the request that
 * will be put in the box, and a cut request is a different request. Its text takes its
 * direction and language from its own letters (`resolveDir`, `resolveLang`), so a
 * model's English follow-up keeps its punctuation in place inside the Arabic panel.
 */
export function SuggestionList({ locale, suggestions, onChoose }: SuggestionListProps) {
  const descriptionId = useId();
  if (suggestions.length === 0) return null;
  const uiDir = locale === 'ar' ? 'rtl' : 'ltr';
  return (
    <div className="ck-agent-suggestions">
      {/* role="list": WebKit drops the list role from a list drawn without markers. */}
      <ul
        role="list"
        className="ck-agent-suggestions__list"
        aria-label={t(locale, 'suggestions.label')}
      >
        {suggestions.map((suggestion) => {
          const dir = resolveDir(suggestion.text, uiDir);
          const lang = resolveLang(suggestion.text, locale);
          return (
            <li key={suggestion.key} className="ck-agent-suggestions__item">
              <button
                type="button"
                className="ck-agent-suggestion"
                aria-describedby={descriptionId}
                data-source={suggestion.source}
                onClick={() => {
                  onChoose(suggestion);
                }}
              >
                <span className="ck-agent-suggestion__glyph" aria-hidden="true" />
                <span
                  className="ck-agent-suggestion__text"
                  dir={dir === uiDir ? undefined : dir}
                  lang={lang === locale ? undefined : lang}
                >
                  {suggestion.text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <span id={descriptionId} hidden>
        {t(locale, 'suggestions.description')}
      </span>
    </div>
  );
}
