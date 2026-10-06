import type { SymbolOverride } from '@craftkit/builder-schema';

import type { SymbolsPanelLabels } from './SymbolsPanel.labels';
import { overriddenFields } from './symbol-ops';

export interface SymbolInstanceCardProps {
  /** The symbol's name, or undefined when the library no longer holds it. */
  readonly symbolName?: string | undefined;
  readonly overrides: readonly SymbolOverride[];
  /** A short name for the element an override path points at ("Heading “Sale”"). */
  readonly describePath: (path: readonly number[]) => string;
  readonly labels: SymbolsPanelLabels;
  readonly onReset: (index: number) => void;
  readonly onResetAll: () => void;
  readonly onPush: () => void;
  readonly onDetach: () => void;
  readonly onEditMaster: () => void;
  readonly masterOpen: boolean;
}

/**
 * The selected instance: which symbol it shows, every value it overrides
 * (each with an "Overridden" badge and its own Reset), and the instance
 * actions — push its overrides into the master, detach it into a plain
 * region, or open the master.
 */
export function SymbolInstanceCard({
  symbolName,
  overrides,
  describePath,
  labels,
  onReset,
  onResetAll,
  onPush,
  onDetach,
  onEditMaster,
  masterOpen,
}: SymbolInstanceCardProps) {
  if (symbolName === undefined) {
    return (
      <section className="bldr-symbols__instance" aria-label={labels.missing}>
        <p className="bldr-symbols__muted">{labels.missing}</p>
      </section>
    );
  }
  return (
    <section className="bldr-symbols__instance" aria-label={labels.instanceTitle(symbolName)}>
      <h4 className="bldr-symbols__subtitle">{labels.instanceTitle(symbolName)}</h4>
      <p className="bldr-symbols__muted">{labels.overrides}</p>
      {overrides.length === 0 ? (
        <p className="bldr-symbols__muted">{labels.noOverrides}</p>
      ) : (
        <ul className="bldr-symbols__overrides">
          {overrides.map((override, at) => {
            const what = `${describePath(override.path)} · ${overriddenFields(override)
              .map((field) => labels.fields[field])
              .join(', ')}`;
            return (
              <li key={override.path.join('.')} className="bldr-symbols__override">
                <span className="bldr-symbols__badge">{labels.overridden}</span>
                <span className="bldr-symbols__override-what">{what}</span>
                <button
                  type="button"
                  className="bldr-symbols__button"
                  aria-label={labels.reset(what)}
                  onClick={() => {
                    onReset(at);
                  }}
                >
                  ↺
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="bldr-symbols__actions">
        {overrides.length === 0 ? null : (
          <>
            <button type="button" className="bldr-symbols__button" onClick={onResetAll}>
              {labels.resetAll}
            </button>
            <button type="button" className="bldr-symbols__button" onClick={onPush}>
              {labels.push}
            </button>
          </>
        )}
        <button type="button" className="bldr-symbols__button" aria-expanded={masterOpen} onClick={onEditMaster}>
          {masterOpen ? labels.closeMaster : labels.editMaster}
        </button>
        <button type="button" className="bldr-symbols__button" onClick={onDetach}>
          {labels.detach}
        </button>
      </div>
    </section>
  );
}
