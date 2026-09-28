import { useId, useState } from 'react';

import { t } from '../../copy';
import { resolveLang } from '../../model/resolve-dir';
import type { FactView, Locale } from '../../model/view-types';
import { AgentIcon } from '../AgentIcon';

import './FactsDisclosure.css';

/* The locale's quotation marks around a page word (SPEC §4.0): «» in Arabic, “” in English. */
const QUOTES: Readonly<Record<Locale, readonly [open: string, close: string]>> = {
  ar: ['«', '»'],
  en: ['“', '”'],
};

export interface FactsDisclosureProps {
  readonly locale: Locale;
  /** The sample details, in page order (`BuildRecordView.facts`). Nothing renders when empty. */
  readonly facts: readonly FactView[];
  /** Selects the section a sample sits in (SPEC §3.5: "each row is a button: selects that section"). */
  readonly onReveal: (nodeId: string) => void;
  /** Appended to `ck-agent-facts`. */
  readonly className?: string | undefined;
}

/**
 * Sample details to replace (SPEC §4.8 FactsDisclosure, §3.5): what the writers made up as
 * examples (a price, a doctor's name, a rating), which the person must replace before
 * publishing.
 *
 * A disclosure in Amber, the one colour that means "needs your attention" without meaning
 * "failed", with a mirrored chevron. Open, it says what the list is, then one row per sample:
 * the sample, quoted in the locale's marks, and the section it sits in at the inline end.
 * Each row is a button that selects that section on the canvas, named by the catalog's
 * sentence: "“25 JD” in Services".
 */
export function FactsDisclosure({ locale, facts, onReveal, className }: FactsDisclosureProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  // Motion answers the person's click (SPEC §5 moment 8): only after they have used it.
  const [used, setUsed] = useState(false);

  if (facts.length === 0) return null;

  const [before, after] = QUOTES[locale];
  return (
    <div
      className={className === undefined ? 'ck-agent-facts' : `ck-agent-facts ${className}`}
      data-open={open ? '' : undefined}
      data-animate={used ? '' : undefined}
    >
      <button
        type="button"
        className="ck-agent-facts__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current);
          setUsed(true);
        }}
      >
        <AgentIcon name="disclosure" className="ck-agent-facts__chevron" />
        {t(locale, 'facts.toggle', { n: facts.length })}
      </button>
      <div id={panelId} className="ck-agent-facts__panel" inert={!open}>
        <div className="ck-agent-facts__inner">
          <p className="ck-agent-facts__intro">{t(locale, 'facts.intro')}</p>
          <ul role="list" className="ck-agent-facts__list">
            {facts.map((fact, index) => {
              const sampleLang = resolveLang(fact.sample, locale);
              const sectionLang = resolveLang(fact.section, locale);
              return (
                <li key={`${fact.nodeId}:${String(index)}`}>
                  <button
                    type="button"
                    className="ck-agent-facts__item"
                    aria-label={t(locale, 'facts.item', {
                      sample: fact.sample,
                      section: fact.section,
                    })}
                    onClick={() => {
                      onReveal(fact.nodeId);
                    }}
                  >
                    <span className="ck-agent-facts__sample">
                      {before}
                      <bdi lang={sampleLang === locale ? undefined : sampleLang}>
                        {fact.sample}
                      </bdi>
                      {after}
                    </span>
                    <bdi
                      className="ck-agent-facts__section"
                      lang={sectionLang === locale ? undefined : sectionLang}
                    >
                      {fact.section}
                    </bdi>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
