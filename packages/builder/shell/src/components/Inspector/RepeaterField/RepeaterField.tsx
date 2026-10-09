import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useFieldLabels, useFieldServices } from '../../../fields/field-services-context';
import { propsShapeOf, unwrapSchema } from '../../../fields/resolve-field';
import {
  initialValueForSchema,
  repeaterItemLabel,
  repeaterSchemaInfo,
} from '../../../fields/repeater-schema';
import type { FieldCommitResult } from '../../../fields/field-commit';
import { schemaName } from '../../../i18n/schema-words';
import type { RepeaterFieldProps } from './types';
import '../InspectorRow.css';
import './RepeaterField.css';

function replaceAt(values: readonly unknown[], index: number, value: unknown): unknown[] {
  return values.map((current, currentIndex) => (currentIndex === index ? value : current));
}

function move<T>(values: readonly T[], from: number, to: number): T[] {
  const next = [...values];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

interface ItemIdentity {
  readonly key: string;
  readonly value: unknown;
}

interface ItemIdentityState {
  readonly source: readonly unknown[];
  readonly items: readonly ItemIdentity[];
  readonly nextKey: number;
}

type RepeaterActionTarget =
  | { readonly kind: 'add' }
  | {
      readonly kind: 'item';
      readonly itemKey: string;
      readonly action: 'up' | 'down' | 'remove';
    };

type RepeaterActionError = RepeaterActionTarget & { readonly message: string };

function reconcileItemIdentities(
  previous: ItemIdentityState,
  values: readonly unknown[],
): ItemIdentityState {
  const available = new Set(previous.items.map((_, index) => index));
  let nextKey = previous.nextKey;
  const items = values.map((value, index) => {
    let match = [...available].find((candidate) =>
      Object.is(previous.items[candidate]?.value, value),
    );
    if (match === undefined && available.has(index)) {
      match = index;
    }
    if (match === undefined) {
      const key = `item-${String(nextKey)}`;
      nextKey += 1;
      return { key, value };
    }
    available.delete(match);
    return { key: previous.items[match]?.key ?? `item-${String(index)}`, value };
  });
  return { source: values, items, nextKey };
}

function reasonIds(...ids: (string | undefined)[]): string | undefined {
  const present = ids.filter((id): id is string => id !== undefined);
  return present.length === 0 ? undefined : present.join(' ');
}

export function RepeaterField({
  schema,
  value,
  path,
  disabled = false,
  describedBy,
  commit,
  announce,
  renderRow,
}: RepeaterFieldProps) {
  const uid = useId();
  const words = useFieldLabels().repeater;
  const locale = useFieldServices().locale ?? 'en';
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pendingFocus = useRef<{ readonly index: number; readonly action: 'up' | 'down' } | null>(
    null,
  );
  const info = repeaterSchemaInfo(schema);
  const values = useMemo<readonly unknown[]>(() => (Array.isArray(value) ? value : []), [value]);
  const [identityState, setIdentityState] = useState<ItemIdentityState>(() => ({
    source: values,
    items: values.map((item, index) => ({ key: `item-${String(index)}`, value: item })),
    nextKey: values.length,
  }));
  let activeIdentityState = identityState;
  if (!Object.is(identityState.source, values)) {
    activeIdentityState = reconcileItemIdentities(identityState, values);
    setIdentityState(activeIdentityState);
  }
  const identities = activeIdentityState.items;
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [actionError, setActionError] = useState<RepeaterActionError | null>(null);

  useLayoutEffect(() => {
    const request = pendingFocus.current;
    if (request === null) {
      return;
    }
    pendingFocus.current = null;
    rootRef.current
      ?.querySelector<HTMLButtonElement>(
        `[data-repeater-index="${String(request.index)}"][data-repeater-action="${request.action}"]`,
      )
      ?.focus();
  }, [values]);

  if (info === undefined) {
    return <p className="bldr-inspector__rejection">{words.unsupported}</p>;
  }

  const seed = initialValueForSchema(info.element);
  const atMin = values.length <= info.min;
  const atMax = info.max !== undefined && values.length >= info.max;
  const minReasonId = `${uid}-minimum`;
  const addReasonId = `${uid}-add-reason`;
  const addErrorId = `${uid}-add-error`;
  const listKey = String(path.at(-1) ?? 'array');
  const addReason = atMax
    ? words.maximum(info.max)
    : seed.ok
      ? undefined
      : seed.reason;

  const finish = (
    result: FieldCommitResult,
    target: RepeaterActionTarget,
    successMessage: string,
    rejectionMessage: string,
    onAccepted?: () => void,
  ): boolean => {
    if (result.ok) {
      onAccepted?.();
      setActionError(null);
      announce(successMessage);
      return true;
    }
    setActionError({ ...target, message: result.message });
    announce(rejectionMessage);
    return false;
  };

  const updateItem = (index: number, nextItem: unknown): FieldCommitResult => {
    const nextValues = replaceAt(values, index, nextItem);
    const result = commit(nextValues);
    if (result.ok) {
      setIdentityState({
        source: nextValues,
        items: identities.map((identity, currentIndex) =>
          currentIndex === index ? { ...identity, value: nextItem } : identity,
        ),
        nextKey: activeIdentityState.nextKey,
      });
    }
    return result;
  };

  return (
    <div ref={rootRef} className="bldr-repeater">
      {values.length === 0 ? <p className="bldr-repeater__empty">{words.empty}</p> : null}
      {values.length > 0 ? (
        <ol className="bldr-repeater__list">
          {values.map((item, index) => {
            const identity = identities[index] ?? {
              key: `untracked-${String(index)}`,
              value: item,
            };
            const label = repeaterItemLabel(info.element, item, index, words.item);
            const disclosureId = `${uid}-${identity.key}-disclosure`;
            const panelId = `${uid}-${identity.key}-fields`;
            const expanded = !collapsed.has(identity.key);
            const itemError =
              actionError?.kind === 'item' && actionError.itemKey === identity.key
                ? actionError
                : undefined;
            const itemErrorId =
              itemError === undefined
                ? undefined
                : `${uid}-${identity.key}-${itemError.action}-error`;
            const actionDescription = (action: 'up' | 'down' | 'remove') =>
              reasonIds(describedBy, itemError?.action === action ? itemErrorId : undefined);
            const objectShape = propsShapeOf(unwrapSchema(info.element));
            const objectValue =
              typeof item === 'object' && item !== null && !Array.isArray(item)
                ? (item as Readonly<Record<string, unknown>>)
                : undefined;
            return (
              <li key={identity.key} className="bldr-repeater__item" data-repeater-item="">
                <div className="bldr-repeater__item-header">
                  <button
                    type="button"
                    id={disclosureId}
                    className="bldr-repeater__disclosure"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    aria-describedby={describedBy}
                    onClick={() => {
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (next.has(identity.key)) {
                          next.delete(identity.key);
                        } else {
                          next.add(identity.key);
                        }
                        return next;
                      });
                    }}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d={expanded ? 'm4 10 4-4 4 4' : 'm4 6 4 4 4-4'} />
                    </svg>
                    {/* Isolated, so "1. name" keeps its order in the Arabic
                        chrome instead of reading "name .1". */}
                    <span className="bldr-repeater__item-label">
                      <bdi>
                        {String(index + 1)}. {label}
                      </bdi>
                    </span>
                  </button>
                  <div className="bldr-repeater__actions">
                    <button
                      type="button"
                      className="bldr-repeater__action"
                      data-repeater-index={index}
                      data-repeater-action="up"
                      aria-label={words.moveUp(label)}
                      aria-describedby={actionDescription('up')}
                      disabled={disabled || index === 0}
                      onClick={() => {
                        pendingFocus.current = { index: index - 1, action: 'down' };
                        const nextValues = move(values, index, index - 1);
                        const accepted = finish(
                          commit(nextValues),
                          { kind: 'item', itemKey: identity.key, action: 'up' },
                          words.movedUp(label),
                          words.moveRejected(label),
                          () => {
                            setIdentityState({
                              source: nextValues,
                              items: move(identities, index, index - 1),
                              nextKey: activeIdentityState.nextKey,
                            });
                          },
                        );
                        if (!accepted) {
                          pendingFocus.current = null;
                        }
                      }}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d="m4 10 4-4 4 4" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="bldr-repeater__action"
                      data-repeater-index={index}
                      data-repeater-action="down"
                      aria-label={words.moveDown(label)}
                      aria-describedby={actionDescription('down')}
                      disabled={disabled || index === values.length - 1}
                      onClick={() => {
                        pendingFocus.current = { index: index + 1, action: 'up' };
                        const nextValues = move(values, index, index + 1);
                        const accepted = finish(
                          commit(nextValues),
                          { kind: 'item', itemKey: identity.key, action: 'down' },
                          words.movedDown(label),
                          words.moveRejected(label),
                          () => {
                            setIdentityState({
                              source: nextValues,
                              items: move(identities, index, index + 1),
                              nextKey: activeIdentityState.nextKey,
                            });
                          },
                        );
                        if (!accepted) {
                          pendingFocus.current = null;
                        }
                      }}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d="m4 6 4 4 4-4" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="bldr-repeater__action bldr-repeater__action--remove"
                      aria-label={words.remove(label)}
                      aria-describedby={reasonIds(
                        actionDescription('remove'),
                        atMin && info.min > 0 ? minReasonId : undefined,
                      )}
                      disabled={disabled || atMin}
                      onClick={() => {
                        const nextValues = values.filter(
                          (_, currentIndex) => currentIndex !== index,
                        );
                        finish(
                          commit(nextValues),
                          { kind: 'item', itemKey: identity.key, action: 'remove' },
                          words.removed(label),
                          words.removalRejected(label),
                          () => {
                            setIdentityState({
                              source: nextValues,
                              items: identities.filter((_, currentIndex) => currentIndex !== index),
                              nextKey: activeIdentityState.nextKey,
                            });
                            setCollapsed((current) => {
                              const next = new Set(current);
                              next.delete(identity.key);
                              return next;
                            });
                          },
                        );
                      }}
                    >
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path d="m4 4 8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div
                  id={panelId}
                  className="bldr-repeater__fields"
                  role="group"
                  aria-labelledby={disclosureId}
                  hidden={!expanded}
                >
                  {objectValue !== undefined && Object.keys(objectShape).length > 0
                    ? Object.entries(objectShape).map(([propKey, propertySchema]) =>
                        renderRow({
                          key: `${identity.key}:${propKey}`,
                          propKey,
                          schema: propertySchema,
                          value: objectValue[propKey],
                          path: [...path, index, propKey],
                          commit: (next) => updateItem(index, { ...objectValue, [propKey]: next }),
                          disabled,
                        }),
                      )
                    : renderRow({
                        key: `${identity.key}:value`,
                        propKey: words.item(index + 1),
                        schema: info.element,
                        value: item,
                        path: [...path, index],
                        commit: (next) => updateItem(index, next),
                        disabled,
                      })}
                </div>
                {itemError !== undefined ? (
                  <p id={itemErrorId} className="bldr-inspector__rejection">
                    {itemError.message}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      <button
        type="button"
        className="bldr-repeater__add"
        aria-label={words.addTo(locale === 'ar' ? schemaName(listKey, locale) : listKey)}
        aria-describedby={reasonIds(
          describedBy,
          addReason === undefined ? undefined : addReasonId,
          actionError?.kind === 'add' ? addErrorId : undefined,
        )}
        disabled={disabled || addReason !== undefined}
        onClick={() => {
          if (!seed.ok) {
            return;
          }
          const nextValues = [...values, seed.value];
          finish(
            commit(nextValues),
            { kind: 'add' },
            words.added(values.length + 1),
            words.addRejected,
            () => {
              setIdentityState({
                source: nextValues,
                items: [
                  ...identities,
                  {
                    key: `item-${String(activeIdentityState.nextKey)}`,
                    value: seed.value,
                  },
                ],
                nextKey: activeIdentityState.nextKey + 1,
              });
            },
          );
        }}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M8 3v10M3 8h10" />
        </svg>
        <span>{words.add}</span>
      </button>

      {atMin && info.min > 0 ? (
        <p id={minReasonId} className="bldr-repeater__reason">
          {words.minimum(info.min)}
        </p>
      ) : null}
      {addReason !== undefined ? (
        <p id={addReasonId} className="bldr-repeater__reason">
          {addReason}
        </p>
      ) : null}
      {actionError?.kind === 'add' ? (
        <p id={addErrorId} className="bldr-inspector__rejection">
          {actionError.message}
        </p>
      ) : null}
    </div>
  );
}
