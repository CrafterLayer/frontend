import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import type { SelectionCapability, SelectionTarget } from '@craftkit/builder-schema';

import { ChromeButton } from '../ChromeButton';
import { intersectSelectionCapabilities } from '../../selection/selection-controller';
import './SelectionToolbar.css';

export type SelectionToolbarAction =
  'selectParent' | 'move' | 'duplicate' | 'delete' | 'editWithAgent' | 'openSource';

export interface SelectionToolbarProps {
  readonly targets: readonly SelectionTarget[];
  readonly label?: string | undefined;
  readonly hasParent?: boolean | undefined;
  readonly state?: 'ready' | 'stale' | undefined;
  readonly sharedScope?: { readonly instances: number; readonly pages: number } | undefined;
  readonly dir?: 'ltr' | 'rtl' | undefined;
  readonly onAction: (action: SelectionToolbarAction, targets: readonly SelectionTarget[]) => void;
  /** Starts structural movement from this explicit handle only. */
  readonly onMovePointerDown?:
    | ((event: PointerEvent<HTMLButtonElement>, targets: readonly SelectionTarget[]) => void)
    | undefined;
}

interface ToolbarAction {
  readonly id: SelectionToolbarAction;
  readonly label: string;
  readonly destructive?: boolean;
  readonly capability?: SelectionCapability;
}

const ACTIONS: readonly ToolbarAction[] = [
  { id: 'selectParent', label: 'Select parent' },
  { id: 'move', label: 'Move', capability: 'move' },
  { id: 'duplicate', label: 'Duplicate', capability: 'duplicate' },
  { id: 'delete', label: 'Delete', capability: 'delete', destructive: true },
  { id: 'editWithAgent', label: 'Edit with Agent', capability: 'inspect' },
  { id: 'openSource', label: 'Open source', capability: 'editSource' },
];

function selectionKind(targets: readonly SelectionTarget[]): string {
  if (targets.length > 1) return `${String(targets.length)} items`;
  const identity = targets[0]?.sourceOrNodeId;
  if (identity === undefined) return 'No selection';
  if (typeof identity === 'string') return 'Block';
  return identity.instanceKey === undefined ? 'Source element' : 'Component instance';
}

/** Capability-driven chrome for the exact target shown selected on the canvas. */
export function SelectionToolbar({
  targets,
  label = 'Selection actions',
  hasParent = false,
  state = 'ready',
  sharedScope,
  dir = 'ltr',
  onAction,
  onMovePointerDown,
}: SelectionToolbarProps) {
  const scopeId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const capabilities = intersectSelectionCapabilities(targets);
  const available = ACTIONS.filter((action) => {
    if (action.id === 'selectParent') return hasParent;
    return action.capability === undefined || capabilities.includes(action.capability);
  });
  if (targets.length === 0) return null;
  const disabled = state === 'stale';
  const tabStop = Math.min(active, Math.max(available.length - 1, 0));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (available.length === 0) return;
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let next: number | undefined;
    if (event.key === forward) next = (tabStop + 1) % available.length;
    if (event.key === backward) next = (tabStop - 1 + available.length) % available.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = available.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    setActive(next);
    buttons.current[next]?.focus();
  };

  return (
    <div
      className="bldr-selection-toolbar"
      role="toolbar"
      aria-label={label}
      aria-describedby={scopeId}
      dir={dir}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <span className="bldr-selection-toolbar__kind" id={scopeId}>
        {state === 'stale' ? 'Selection changed — select it again' : selectionKind(targets)}
        {sharedScope === undefined
          ? null
          : ` · Shared component · ${String(sharedScope.instances)} instances · ${String(sharedScope.pages)} pages`}
      </span>
      <span className="bldr-selection-toolbar__actions">
        {available.map((action, index) => (
          <ChromeButton
            key={action.id}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            className="bldr-selection-toolbar__action"
            data-action={action.id}
            data-destructive={action.destructive === true ? '' : undefined}
            data-bldr-drag-handle={action.id === 'move' ? '' : undefined}
            variant="quiet"
            size="lg"
            disabled={disabled}
            tabIndex={index === tabStop ? 0 : -1}
            onFocus={() => {
              setActive(index);
            }}
            onPointerDown={(event) => {
              if (action.id === 'move' && !disabled) onMovePointerDown?.(event, targets);
            }}
            onClick={() => {
              onAction(action.id, targets);
            }}
          >
            {action.label}
          </ChromeButton>
        ))}
      </span>
    </div>
  );
}
