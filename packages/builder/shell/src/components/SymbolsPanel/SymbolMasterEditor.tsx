import { useId } from 'react';

import type { SiteSymbol, TreeNodePatch } from '@craftkit/builder-schema';

import { ELEMENT_NAME_WORDS_EN, treeNodeDisplayName, type ElementNameWords } from '../../custom-code/element-target';
import { TokenDraftField } from '../DesignSystemPanel/TokenDraftField';
import type { SymbolsPanelLabels } from './SymbolsPanel.labels';
import { masterOutline } from './symbol-ops';

export interface SymbolMasterEditorProps {
  readonly symbol: SiteSymbol;
  readonly labels: SymbolsPanelLabels;
  /** One master write: the panel turns it into ONE `setSymbol` transaction. */
  readonly onPatch: (path: readonly number[], patch: TreeNodePatch) => void;
  /** Paths ("0.1") the selected instance overrides: marked, since that instance keeps its own value. */
  readonly overridden?: ReadonlySet<string> | undefined;
  readonly words?: ElementNameWords | undefined;
}

/**
 * "Edit master": the symbol's tree as an outline, each element's text and
 * classes editable in place. A commit rewrites the MASTER, so every instance
 * updates — except where an instance overrides that value, which this
 * outline marks, because that instance will keep showing its own.
 */
export function SymbolMasterEditor({
  symbol,
  labels,
  onPatch,
  overridden,
  words = ELEMENT_NAME_WORDS_EN,
}: SymbolMasterEditorProps) {
  const base = useId();
  const rows = masterOutline(symbol.tree);
  return (
    <ol className="bldr-symbols__outline" aria-label={labels.masterOutline(symbol.name)}>
      {rows.map(({ path, node, depth }) => {
        const key = path.join('.');
        const name = treeNodeDisplayName(node, words);
        const textId = `${base}-t-${key}`;
        const classId = `${base}-c-${key}`;
        return (
          <li key={key} className="bldr-symbols__node" style={{ paddingInlineStart: `${String(depth)}rem` }}>
            <span className="bldr-symbols__node-name">
              {name}
              {overridden?.has(key) === true ? (
                <span className="bldr-symbols__badge">{labels.overridden}</span>
              ) : null}
            </span>
            {node.kind === 'element' ? (
              <>
                <label className="bldr-visually-hidden" htmlFor={textId}>
                  {labels.masterText(name)}
                </label>
                <TokenDraftField
                  id={textId}
                  className="bldr-symbols__field"
                  dir="auto"
                  value={node.text ?? ''}
                  onCommit={(text) => {
                    onPatch(path, { set: { text } });
                  }}
                />
              </>
            ) : null}
            {node.kind === 'component' ? null : (
              <>
                <label className="bldr-visually-hidden" htmlFor={classId}>
                  {labels.masterClasses(name)}
                </label>
                <TokenDraftField
                  id={classId}
                  className="bldr-symbols__field bldr-symbols__field--mono"
                  value={node.className ?? ''}
                  onCommit={(className) => {
                    onPatch(path, { set: { className } });
                  }}
                />
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}
