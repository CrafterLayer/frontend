import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { ColorRoleField } from '../../fields/ColorRoleField';
import { ReadOnlyField, type FieldControlProps } from '../../fields/controls';
import { FieldErrorBoundary } from './FieldErrorBoundary';
import { DEFAULT_CONTROLS, fallbackRendering } from './field-module-cache';
import { INSPECTOR_ICONS } from './Inspector.icons';
import { LabeledSlot } from './LabeledSlot';
import { OverrideMarker } from './OverrideMarker';
import { displayPropertyLabel, unitFor } from './property-label';
import { RepeaterField } from './RepeaterField';
import { schemaFacts } from './schema-facts';
import { isSegmentOption } from './segment-icons';
import { SegmentedControl } from './SegmentedControl';
import type { InspectorRowBodyProps, Rendering } from './types';
import { useFieldRendering } from './use-field-rendering';
import { useRowCommit } from './use-row-commit';
import './InspectorRow.css';

/**
 * One property row (007 contract §4): resolveField picks the renderer, every
 * commit is ONE dispatch through the door (i2), rejections are caught and shown
 * control-adjacent via aria-describedby, and a focused row keeps its resolved
 * component until blur even if a better field type registers meanwhile (i5).
 * The control slot is a STRUCTURALLY named group (aria-labelledby), so a
 * contributed component always renders inside a context carrying the property
 * key even when it ignores `controlId`.
 *
 * A PLAIN function on purpose: the memo boundary is `InspectorPropertyRow`,
 * which subscribes per property and renders this. Nested repeater rows render
 * it directly with fresh closures. Nothing in here reads the kernel outside a
 * commit — every value arrives by prop.
 */
export function InspectorRowBody({
  kernel,
  nodeId,
  propKey,
  schema,
  propertyKind,
  palette,
  onRetheme,
  bucket,
  value,
  baseValue,
  hasOverride,
  catalogVersion,
  announce,
  dir,
  path,
  commitValue,
  nested = false,
  disabled = false,
  deferTextCommit = false,
  pairItemLabel,
  responsiveCapable = false,
}: InspectorRowBodyProps) {
  const uid = useId();
  const controlId = `${uid}-control`;
  const errorId = `${uid}-error`;
  const markerId = `${uid}-marker`;
  const labelId = `${uid}-label`;
  const rowRef = useRef<HTMLDivElement | null>(null);

  const field = useFieldRendering(kernel, schema, propertyKind, catalogVersion);
  const rendering = field.rendering;
  const door = useRowCommit({ kernel, nodeId, propKey, bucket, nested, commitValue, announce });

  // A deferred draft is keyed by the value it was typed OVER: the moment the
  // incoming value moves (a commit landed, undo, an external write) the draft
  // no longer applies, with no setState during render to get there.
  const [pending, setPending] = useState<
    | { readonly active: false }
    | { readonly active: true; readonly source: unknown; readonly value: unknown }
  >({ active: false });
  const pendingActive = pending.active && Object.is(pending.source, value);

  // Text/number defaults express inheritance as a PLACEHOLDER (i1); choice
  // controls and contributed/readonly renderers show the effective value.
  const usesPlaceholder =
    rendering.kind === 'default' &&
    (rendering.control === 'text' || rendering.control === 'number');
  const inherited = !nested && bucket !== 'base' && !hasOverride;
  const effective = inherited ? (usesPlaceholder ? undefined : baseValue) : value;
  const shouldDefer = deferTextCommit && usesPlaceholder;
  const displayedValue = shouldDefer && pendingActive ? pending.value : effective;
  const placeholder =
    usesPlaceholder && inherited && baseValue !== undefined
      ? typeof baseValue === 'string'
        ? baseValue
        : JSON.stringify(baseValue)
      : undefined;
  const showMarker = !nested && bucket !== 'base' && hasOverride;
  const describedByIds = [
    door.rejection === null ? null : errorId,
    showMarker ? markerId : null,
  ].filter((id): id is string => id !== null);
  const describedBy = describedByIds.length === 0 ? undefined : describedByIds.join(' ');
  const controlDisabled = disabled || field.loading;
  const facts = schemaFacts(schema);

  /*
    A colour picker offers only what the PROPERTY admits, not the whole theme.

    `background` is declared `z.enum(['surface', 'surfaceInverse', 'accent'])`,
    so offering "Text" as a background is offering a choice the validated door
    will refuse — the person clicks a swatch, the page does not change, and an
    error appears explaining that what the control just showed them was never
    allowed. The narrowing is derived from the same enum the door parses, so the
    two can never disagree.

    A colour property with no enum (a free role) keeps the full palette.
  */
  const rolePalette = useMemo(() => {
    const admitted = new Set(facts.enumOptions);
    if (admitted.size === 0) return palette;
    const narrowed = palette.filter((entry) => admitted.has(entry.role));
    // An enum naming no known role means the two vocabularies have drifted;
    // showing everything is better than showing an empty picker.
    return narrowed.length === 0 ? palette : narrowed;
  }, [facts, palette]);

  const segmentKind =
    rendering.kind === 'default' &&
    rendering.control === 'select' &&
    typeof displayedValue === 'string' &&
    isSegmentOption(displayedValue) &&
    facts.segmentOptions.length >= 3
      ? facts.segmentKind
      : undefined;
  const showSegments = segmentKind !== undefined;
  // Mutation gate lives in Inspector.test: only the block declaration reaches
  // this branch; a colour-looking property name without `kind` stays ordinary.
  const showColorRole = rendering.kind === 'default' && rendering.control === 'color-role';
  const showNumeric = rendering.kind === 'default' && rendering.control === 'number';
  const showRepeater = rendering.kind === 'default' && rendering.control === 'repeater';
  const fieldPath =
    path ?? (bucket === 'base' ? ['props', propKey] : ['responsive', bucket, propKey]);

  const fieldProps: FieldControlProps = {
    schema,
    value: displayedValue,
    path: fieldPath,
    onChange: shouldDefer
      ? (next) => {
          setPending({ active: true, source: value, value: next });
        }
      : door.commit,
    ...(controlDisabled ? { disabled: true } : {}),
    controlId,
    labelledBy: labelId,
    describedBy,
    placeholder,
  };

  const boundaryKey =
    rendering.kind === 'contributed'
      ? `c-${rendering.def.id}`
      : rendering.kind === 'default'
        ? `d-${rendering.control}`
        : 'd-readonly';
  // Property reads, not a call: a component picked by a function during render
  // reads to React's static-components rule as a component CREATED there.
  const Control =
    rendering.kind === 'contributed'
      ? rendering.component
      : rendering.kind === 'default' &&
          rendering.control !== 'color-role' &&
          rendering.control !== 'repeater'
        ? DEFAULT_CONTROLS[rendering.control]
        : ReadOnlyField;
  const fallback: Rendering =
    propertyKind === 'color-role'
      ? { kind: 'readonly', loading: false }
      : fallbackRendering(schema, false);
  const Fallback =
    fallback.kind === 'default' &&
    fallback.control !== 'color-role' &&
    fallback.control !== 'repeater'
      ? DEFAULT_CONTROLS[fallback.control]
      : ReadOnlyField;

  const control = showRepeater ? (
    <RepeaterField
      schema={schema}
      value={displayedValue}
      path={fieldPath}
      disabled={controlDisabled}
      describedBy={describedBy}
      commit={door.writeValue}
      announce={announce}
      renderRow={(row) => (
        <InspectorRowBody
          key={row.key}
          kernel={kernel}
          nodeId={nodeId}
          propKey={row.propKey}
          schema={row.schema}
          propertyKind={undefined}
          palette={palette}
          bucket={bucket}
          value={row.value}
          baseValue={row.value}
          hasOverride={false}
          catalogVersion={catalogVersion}
          announce={announce}
          dir={dir}
          path={row.path}
          commitValue={row.commit}
          nested={true}
          disabled={row.disabled}
          deferTextCommit
          responsiveCapable={false}
        />
      )}
    />
  ) : segmentKind !== undefined ? (
    <SegmentedControl
      kind={segmentKind}
      options={facts.segmentOptions}
      value={typeof displayedValue === 'string' ? displayedValue : undefined}
      dir={dir}
      disabled={controlDisabled}
      onSelect={(option) => {
        door.commit(option);
      }}
    />
  ) : showColorRole ? (
    <ColorRoleField {...fieldProps} palette={rolePalette} onRetheme={onRetheme} />
  ) : showNumeric ? (
    <div className="bldr-inspector__numeric-control">
      <Control {...fieldProps} />
      <span className="bldr-inspector__unit" aria-hidden="true">
        {unitFor(propKey)}
      </span>
    </div>
  ) : (
    <Control {...fieldProps} />
  );

  const commitPending = () => {
    if (!shouldDefer || !pendingActive) {
      return;
    }
    if (door.commit(pending.value).ok) {
      setPending({ active: false });
    }
  };

  const compositeControl = showColorRole || showSegments || showRepeater;
  const slotOwnsControlId = showSegments || showRepeater;

  return (
    <div
      ref={rowRef}
      className="bldr-inspector__row"
      onFocus={() => {
        field.lock();
      }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (
          event.key === 'Enter' &&
          !event.nativeEvent.isComposing &&
          event.target instanceof HTMLInputElement &&
          shouldDefer &&
          pendingActive
        ) {
          event.preventDefault();
          commitPending();
        }
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        const row = rowRef.current;
        if (next !== null) {
          if (!(row?.contains(next) ?? false)) {
            commitPending();
            field.unlock();
          }
        } else if (!(row?.contains(document.activeElement) ?? false)) {
          // relatedTarget is null on window blur too — the control still owns
          // document focus then, and the R8 lock must survive (i5).
          commitPending();
          field.unlock();
        }
      }}
    >
      <div className="bldr-inspector__row-head">
        <label
          id={labelId}
          className="bldr-inspector__label"
          htmlFor={compositeControl ? undefined : controlId}
        >
          <span aria-hidden="true">{pairItemLabel ?? displayPropertyLabel(propKey)}</span>
          <span className="bldr-visually-hidden">{propKey}</span>
        </label>
        {/* This capability is declared by the Inspector caller, rather than
            inferred from the active bucket. The glyph exists BEFORE an override
            does; the badge below still records only an owned value. */}
        {responsiveCapable ? (
          <span
            className="bldr-inspector__breakpoint-glyph"
            role="img"
            aria-label="Supports device overrides"
          >
            {INSPECTOR_ICONS['device-override']}
          </span>
        ) : null}
      </div>
      <div className="bldr-inspector__value">
        {showMarker ? (
          <OverrideMarker
            markerId={markerId}
            bucket={bucket}
            propKey={propKey}
            onClear={door.clearOverride}
          />
        ) : null}
        <FieldErrorBoundary
          key={boundaryKey}
          fallback={
            <LabeledSlot
              id={slotOwnsControlId ? controlId : undefined}
              labelId={labelId}
              describedBy={describedBy}
            >
              <Fallback {...fieldProps} />
            </LabeledSlot>
          }
          onFieldError={() => {
            field.markFailed();
            field.unlock();
          }}
        >
          <LabeledSlot
            id={slotOwnsControlId ? controlId : undefined}
            labelId={labelId}
            describedBy={describedBy}
          >
            {control}
          </LabeledSlot>
        </FieldErrorBoundary>
        {door.rejection !== null ? (
          <p id={errorId} className="bldr-inspector__rejection">
            {door.rejection}
          </p>
        ) : null}
      </div>
    </div>
  );
}
