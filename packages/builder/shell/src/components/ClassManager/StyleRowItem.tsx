import { useId, type ReactNode } from 'react';

import { TokenDraftField } from '../DesignSystemPanel/TokenDraftField';
import type { ClassManagerLabels } from './ClassManager.labels';
import type { StyleRow } from './class-manager-ops';

export interface StyleRowItemProps {
  readonly row: StyleRow;
  readonly labels: ClassManagerLabels;
  /** Absent ⇒ nothing is selected, so "apply" is not offered. */
  readonly onApply?: (() => void) | undefined;
  /** Absent ⇒ there are no similar siblings beyond the selection. */
  readonly onApplySimilar?: (() => void) | undefined;
  readonly similarCount?: number | undefined;
  readonly onRename: (name: string) => void;
  readonly onClasses: (className: string) => void;
  readonly editing: boolean;
  readonly onToggleEdit: () => void;
  /** The StylePanel bound to this style, when the host provides one. */
  readonly editor?: ReactNode;
  readonly confirming: boolean;
  readonly onDelete: () => void;
  readonly onDetach: () => void;
  readonly onCancel: () => void;
}

/**
 * One named style in the class manager: its name (renamed in place), its
 * usage count, apply / apply-to-similar, edit and delete. Deleting a style in
 * use asks first, and the only way through is "detach": every user gets the
 * style's utilities inlined, in the same transaction, so nothing changes look.
 */
export function StyleRowItem({
  row,
  labels,
  onApply,
  onApplySimilar,
  similarCount = 0,
  onRename,
  onClasses,
  editing,
  onToggleEdit,
  editor,
  confirming,
  onDelete,
  onDetach,
  onCancel,
}: StyleRowItemProps) {
  const nameId = useId();
  const classesId = useId();
  const { style, uses } = row;
  return (
    <li className="bldr-class-manager__row" data-editing={editing ? 'true' : undefined}>
      <div className="bldr-class-manager__head">
        <label className="bldr-visually-hidden" htmlFor={nameId}>
          {labels.rename(style.name)}
        </label>
        <TokenDraftField
          id={nameId}
          className="bldr-class-manager__name"
          value={style.name}
          dir="auto"
          onCommit={onRename}
        />
        <code className="bldr-class-manager__marker" dir="ltr">
          ck-s-{style.id}
        </code>
        <span className="bldr-class-manager__uses">{labels.uses(uses)}</span>
      </div>
      <div className="bldr-class-manager__actions">
        {onApply === undefined ? null : (
          <button type="button" className="bldr-class-manager__button" onClick={onApply}>
            {labels.apply}
          </button>
        )}
        {onApplySimilar === undefined ? null : (
          <button type="button" className="bldr-class-manager__button" onClick={onApplySimilar}>
            {labels.applySimilar(similarCount)}
          </button>
        )}
        <button
          type="button"
          className="bldr-class-manager__button"
          aria-expanded={editing}
          onClick={onToggleEdit}
        >
          {editing ? labels.closeEdit : labels.edit}
        </button>
        <button
          type="button"
          className="bldr-class-manager__button bldr-class-manager__button--danger"
          onClick={onDelete}
        >
          {labels.remove}
        </button>
      </div>
      {confirming ? (
        <div className="bldr-class-manager__confirm" role="alertdialog" aria-label={labels.remove}>
          <p className="bldr-class-manager__confirm-text">{labels.inUse(uses)}</p>
          <button type="button" className="bldr-class-manager__button bldr-class-manager__button--danger" onClick={onDetach}>
            {labels.detach}
          </button>
          <button type="button" className="bldr-class-manager__button" onClick={onCancel}>
            {labels.cancel}
          </button>
        </div>
      ) : null}
      {editing ? (
        <div className="bldr-class-manager__editor">
          {editor ?? (
            <>
              <label className="bldr-class-manager__classes-label" htmlFor={classesId}>
                {labels.classes(style.name)}
              </label>
              <TokenDraftField
                id={classesId}
                className="bldr-class-manager__classes"
                value={style.className}
                onCommit={onClasses}
              />
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
