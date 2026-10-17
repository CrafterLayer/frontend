import { useId, useState } from 'react';

import {
  DETACHED_SYMBOL_BLOCK_TYPE,
  SYMBOL_INSTANCE_BLOCK_TYPE,
  treeNodeAt,
  type Author,
  type NodeId,
} from '@craftkit/builder-schema';

import { ELEMENT_NAME_WORDS_EN, treeNodeDisplayName, type ElementNameWords } from '../../custom-code/element-target';
import { TokenDraftField } from '../DesignSystemPanel/TokenDraftField';
import { commitSiteSteps, useSiteSnapshot, type SiteDoor } from '../DesignSystemPanel/site-door';
import { SymbolInstanceCard } from './SymbolInstanceCard';
import { SymbolMasterEditor } from './SymbolMasterEditor';
import { SYMBOLS_PANEL_LABELS_EN, type SymbolsPanelLabels } from './SymbolsPanel.labels';
import {
  detachInstanceSteps,
  instanceOverrides,
  instanceSymbol,
  makeSymbolSteps,
  patchMasterSteps,
  pushOverridesSteps,
  resetOverrideSteps,
  symbolRows,
  type SymbolStepsResult,
} from './symbol-ops';
import '../../styles/visually-hidden.css';
import './SymbolsPanel.css';

export interface SymbolsPanelProps {
  /** The site kernel (or any `SiteDoor`). */
  readonly site: SiteDoor;
  /** The selected document node on the current page: a region or an instance. */
  readonly nodeId?: NodeId | undefined;
  /**
   * Optional host hook for "Edit master" (e.g. a focused canvas mode). The
   * built-in outline editor opens as well, so the action always works.
   */
  readonly onEditMaster?: ((symbolId: string) => void) | undefined;
  readonly author?: Author | undefined;
  readonly labels?: SymbolsPanelLabels | undefined;
  readonly words?: ElementNameWords | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
}

type Status = { readonly kind: 'done' | 'refused'; readonly text: string } | undefined;

/**
 * Symbols: reusable components with per-instance overrides (style-manager
 * DESIGN.md §G).
 *
 * - **Make into symbol** — a selected composed region becomes the master in
 *   the library and is replaced, in place, by an instance (one Undo).
 * - **Edit master** — every instance updates; an instance's overrides survive.
 * - **Instance** — its overrides with "Overridden" badges and Reset, "Push
 *   overrides to master", and "Detach" into a plain region.
 * - **Delete** — refused while instances exist unless they are detached in
 *   the same transaction.
 */
export function SymbolsPanel({
  site,
  nodeId,
  onEditMaster,
  author = 'user',
  labels = SYMBOLS_PANEL_LABELS_EN,
  words = ELEMENT_NAME_WORDS_EN,
  dir,
}: SymbolsPanelProps) {
  const snapshot = useSiteSnapshot(site);
  const [open, setOpen] = useState<string | undefined>(undefined);
  const [confirming, setConfirming] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Status>(undefined);
  const makeId = useId();
  const renameBase = useId();

  const pageId = site.currentPage();
  const document = site.page(pageId).getDocument();
  const node = nodeId === undefined ? undefined : document.nodes[nodeId];
  const instance = node?.type === SYMBOL_INSTANCE_BLOCK_TYPE ? node : undefined;
  const region = node?.type === DETACHED_SYMBOL_BLOCK_TYPE ? node : undefined;
  const instanceOf = instance === undefined ? undefined : instanceSymbol(snapshot, instance);
  const overrides = instance === undefined ? [] : instanceOverrides(instance);
  const rows = symbolRows(snapshot);

  const run = (result: SymbolStepsResult, label: string): boolean => {
    if (!result.ok) {
      setStatus({ kind: 'refused', text: result.message });
      return false;
    }
    const sent = commitSiteSteps(site, result.steps, label, author);
    setStatus(sent.ok ? { kind: 'done', text: label } : { kind: 'refused', text: sent.message });
    return sent.ok;
  };
  const toggleMaster = (symbolId: string): void => {
    const opening = open !== symbolId;
    setOpen(opening ? symbolId : undefined);
    if (opening) onEditMaster?.(symbolId);
  };

  return (
    <section className="bldr-symbols" aria-label={labels.title} dir={dir}>
      <h3 className="bldr-symbols__title">{labels.title}</h3>

      {region === undefined ? null : (
        <form
          className="bldr-symbols__make"
          aria-label={labels.makeTitle}
          onSubmit={(event) => {
            event.preventDefault();
            if (run(makeSymbolSteps(snapshot, document, region.id, name, pageId), labels.commit.make(name.trim()))) {
              setName('');
            }
          }}
        >
          <label className="bldr-symbols__label" htmlFor={makeId}>
            {labels.makeName}
          </label>
          <input
            id={makeId}
            className="bldr-symbols__input"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <button type="submit" className="bldr-symbols__button" disabled={name.trim() === ''}>
            {labels.make}
          </button>
        </form>
      )}

      {instance === undefined ? null : (
        <SymbolInstanceCard
          symbolName={instanceOf?.name}
          overrides={overrides}
          describePath={(path) => {
            const target = instanceOf === undefined ? undefined : treeNodeAt(instanceOf.tree, path);
            return target === undefined ? path.join('.') : treeNodeDisplayName(target, words);
          }}
          labels={labels}
          onReset={(at) => {
            run(resetOverrideSteps(instance, at, pageId), labels.commit.reset(instanceOf?.name ?? ''));
          }}
          onResetAll={() => {
            run(resetOverrideSteps(instance, 'all', pageId), labels.commit.reset(instanceOf?.name ?? ''));
          }}
          onPush={() => {
            run(pushOverridesSteps(snapshot, instance, pageId), labels.commit.push(instanceOf?.name ?? ''));
          }}
          onDetach={() => {
            run(detachInstanceSteps(snapshot, document, instance.id, pageId), labels.commit.detach(instanceOf?.name ?? ''));
          }}
          onEditMaster={() => {
            if (instanceOf !== undefined) toggleMaster(instanceOf.id);
          }}
          masterOpen={instanceOf !== undefined && open === instanceOf.id}
        />
      )}

      {rows.length === 0 ? (
        <p className="bldr-symbols__muted">{labels.empty}</p>
      ) : (
        <ul className="bldr-symbols__list" aria-label={labels.list}>
          {rows.map(({ symbol, instances }) => {
            const renameId = `${renameBase}-${symbol.id}`;
            return (
              <li key={symbol.id} className="bldr-symbols__row" data-open={open === symbol.id ? 'true' : undefined}>
                <div className="bldr-symbols__head">
                  <label className="bldr-visually-hidden" htmlFor={renameId}>
                    {labels.rename(symbol.name)}
                  </label>
                  <TokenDraftField
                    id={renameId}
                    className="bldr-symbols__input"
                    dir="auto"
                    value={symbol.name}
                    onCommit={(next) => {
                      run(
                        { ok: true, steps: [{ command: 'setSymbol', args: { symbol: { ...symbol, name: next.slice(0, 80) } } }] },
                        labels.commit.rename(next),
                      );
                    }}
                  />
                  <span className="bldr-symbols__count">{labels.instances(instances)}</span>
                </div>
                <div className="bldr-symbols__actions">
                  <button
                    type="button"
                    className="bldr-symbols__button"
                    aria-expanded={open === symbol.id}
                    onClick={() => {
                      toggleMaster(symbol.id);
                    }}
                  >
                    {open === symbol.id ? labels.closeMaster : labels.editMaster}
                  </button>
                  <button
                    type="button"
                    className="bldr-symbols__button bldr-symbols__button--danger"
                    onClick={() => {
                      if (instances > 0) {
                        setConfirming(symbol.id);
                        return;
                      }
                      run(
                        { ok: true, steps: [{ command: 'removeSymbol', args: { id: symbol.id } }] },
                        labels.commit.remove(symbol.name),
                      );
                    }}
                  >
                    {labels.remove}
                  </button>
                </div>
                {confirming === symbol.id ? (
                  <div className="bldr-symbols__confirm" role="alertdialog" aria-label={labels.remove}>
                    <p className="bldr-symbols__confirm-text">{labels.inUse(instances)}</p>
                    <button
                      type="button"
                      className="bldr-symbols__button bldr-symbols__button--danger"
                      onClick={() => {
                        setConfirming(undefined);
                        run(
                          { ok: true, steps: [{ command: 'removeSymbol', args: { id: symbol.id, detach: true } }] },
                          labels.commit.removeDetach(symbol.name),
                        );
                      }}
                    >
                      {labels.detachAll}
                    </button>
                    <button
                      type="button"
                      className="bldr-symbols__button"
                      onClick={() => {
                        setConfirming(undefined);
                      }}
                    >
                      {labels.cancel}
                    </button>
                  </div>
                ) : null}
                {open === symbol.id ? (
                  <SymbolMasterEditor
                    symbol={symbol}
                    labels={labels}
                    words={words}
                    overridden={
                      instanceOf?.id === symbol.id
                        ? new Set(overrides.map((override) => override.path.join('.')))
                        : undefined
                    }
                    onPatch={(path, patch) => {
                      run(patchMasterSteps(symbol, path, patch), labels.commit.master(symbol.name));
                    }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="bldr-symbols__status" role="status" data-kind={status?.kind}>
        {status?.text ?? ''}
      </p>
    </section>
  );
}
