import { t } from '../../copy';
import { resolveDir, resolveLang } from '../../model/resolve-dir';
import type { BlockChipView, Locale, UserMessageView } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';

import './UserMessage.css';

export interface UserMessageProps {
  readonly locale: Locale;
  readonly view: UserMessageView;
  /** Appended to `ck-agent-message`. */
  readonly className?: string | undefined;
}

/**
 * The person's own request (SPEC §4.5): a Tint bubble at the inline end, radius 12 with its
 * "tail" corner (block-end, inline-end) at 4, Read type in Ink, at most 85% of the thread's
 * width (80% from 400px).
 *
 * Its words keep their own direction: `dir` from the majority of the message's letters, never
 * `dir="auto"` (a leading Latin word would fool it), and again per line, so «Hero قسم الخدمات»
 * lays out right to left and a line in the other script orders itself. `lang` follows the
 * script, so a screen reader switches voice.
 *
 * The blocks it was sent with (the canvas selection, `@` mentions) form its first line, in
 * Meta, Graphite, not interactive; the "Whole page" scope is the default and is not repeated.
 * No actions on the bubble: retry, reuse and restore live on the record, where the outcome is.
 * A request stopped before any output is dimmed and captioned "Not run".
 */
export function UserMessage({ locale, view, className }: UserMessageProps) {
  const uiDir = locale === 'ar' ? 'rtl' : 'ltr';
  const dir = resolveDir(view.text, uiDir);
  const lang = resolveLang(view.text, locale);
  const blocks = view.chips.filter((chip): chip is BlockChipView => chip.kind !== 'page');
  const lines = view.text.split('\n');

  return (
    <article
      className={className === undefined ? 'ck-agent-message' : `ck-agent-message ${className}`}
      aria-label={t(locale, 'message.aria')}
      data-not-run={view.notRun ? '' : undefined}
    >
      {/*
        The bubble keeps the panel's direction, so its tail corner is always the one toward
        the edge it hangs from; the words inside take their own.
      */}
      <div className="ck-agent-message__bubble">
        <div className="ck-agent-message__content" dir={dir} lang={lang}>
          {blocks.length === 0 ? null : (
            <p className="ck-agent-message__context">
              {blocks.map((chip) => (
                <span
                  key={chip.id}
                  className="ck-agent-message__chip"
                  data-stale={chip.stale ? '' : undefined}
                >
                  <AgentIcon name="block" className="ck-agent-message__chip-glyph" />
                  <bdi className="ck-agent-message__chip-label" lang={resolveLang(chip.label, locale)}>
                    {chip.label}
                  </bdi>
                  {chip.stale ? (
                    <span className="bldr-visually-hidden" lang={locale}>
                      {` ${t(locale, 'chip.stale')}`}
                    </span>
                  ) : null}
                </span>
              ))}
            </p>
          )}
          <p className="ck-agent-message__text">
            {lines.map((line, index) => (
              <span key={index} className="ck-agent-message__line" dir={resolveDir(line, dir)}>
                {line === '' ? ' ' : line}
              </span>
            ))}
          </p>
        </div>
      </div>
      {view.notRun ? (
        <p className="ck-agent-message__caption">{t(locale, 'message.notRun')}</p>
      ) : null}
    </article>
  );
}
