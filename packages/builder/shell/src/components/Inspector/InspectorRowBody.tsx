import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import {
  blockPartsOf,
  isRichTextSchema,
  type BlockParts,
  type BlockSchema,
} from '@craftkit/builder-schema';

import { ColorRoleField } from '../../fields/ColorRoleField';
import { LinkField } from '../../fields/LinkField';
import { ObjectField, type ObjectFieldRowProps } from '../../fields/ObjectField';
import { PartStylesField } from '../../fields/PartStylesField';
import { RichTextFieldSkeleton } from '../../fields/RichTextFieldSkeleton';
import { ReadOnlyField, type FieldControlProps } from '../../fields/controls';
import type { FieldCommitResult } from '../../fields/field-commit';
import { useFieldLabels, useFieldServices } from '../../fields/field-services-context';
import { planPartStyleReset } from '../../fields/part-styles-reset';
import { partBindingFor } from '../../fields/resolve-field';
import { schemaName } from '../../i18n/schema-words';
import { blockDisplayName } from '../../naming/block-display-name';
import { FieldErrorBoundary } from './FieldErrorBoundary';
import { DEFAULT_CONTROLS, fallbackRendering, isCompositeControl } from './field-module-cache';
import { INSPECTOR_ICONS } from './Inspector.icons';
import { LabeledSlot } from './LabeledSlot';
import { OverrideMarker } from './OverrideMarker';
import { displayPropertyLabel, unitFor } from './property-label';
import { RepeaterField } from './RepeaterField';
import { declaredLinkKeys, placeholderOf, relativePropPath } from './row-body-helpers';
import { schemaFacts } from './schema-facts';
import { isSegmentOption } from './segment-icons';
import { SegmentedControl } from './SegmentedControl';
import type { InspectorRowBodyProps, Rendering } from './types';
import { useFieldRendering } from './use-field-rendering';
import { useFieldSiblings } from './use-field-siblings';
import { useRowCommit } from './use-row-commit';
import './InspectorRow.css';

const NO_PARTS: BlockParts = {};

/**
 * One property row (007 contract §4): resolveField picks the renderer, every
 * commit is ONE dispatch through the door (i2), rejections are caught and shown
 * control-adjacent via aria-describedby, and a focused row keeps its resolved
 * component until blur even if a better field type registers meanwhile (i5).
 * The control slot is a STRUCTURALLY named group (aria-labelledby), so a
 * contributed component always renders inside a context carrying the property
 * key even when it ignores `controlId`.
 *
 * block-parts P3: every field kind has an editor — long text, objects,
 * records, links, images, the image asset prop and part styles — and nothing
 * here shows raw JSON. A rich-text row whose editor is loading, failed or
 * threw shows the editor skeleton (the document's words) with Retry.
 *
 * A PLAIN function on purpose: the memo boundary is `InspectorPropertyRow`,
 * which subscribes per property and renders this. Nested repeater rows render
 * it directly with fresh closures. Nothing in here reads the kernel's DOCUMENT
 * outside a commit except the node's TYPE (to find its block's declared parts),
 * which a node never changes — every value arrives by prop — and, for a field
 * type that declared `siblings: true`, its node's other props (useFieldSiblings).
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
  const fieldLabels = useFieldLabels();
  const services = useFieldServices();
  const locale = services.locale ?? 'en';

  // The block's declared parts (block-parts DESIGN §2.10 step 2). A node's
  // type never changes, so this is read once per node and catalog generation.
  const blockSchema = useMemo<BlockSchema | undefined>(() => {
    void catalogVersion; // the memo's real dependency: a re-registered block
    const type = kernel.getDocument().nodes[nodeId]?.type;
    return type === undefined ? undefined : kernel.context.registry.block(type)?.schema;
  }, [kernel, nodeId, catalogVersion]);
  const parts = useMemo(
    () => (blockSchema === undefined ? NO_PARTS : blockPartsOf(blockSchema)),
    [blockSchema],
  );

  const fieldPath =
    path ?? (bucket === 'base' ? ['props', propKey] : ['responsive', bucket, propKey]);
  const propPath = relativePropPath(fieldPath);

  const field = useFieldRendering(kernel, schema, propertyKind, catalogVersion, {
    parts,
    propPath,
  });
  const rendering = field.rendering;
  // A field type that asked for its sibling props gets them (one opt-in subscription, top level).
  const wantsSiblings = !nested && rendering.kind === 'contributed' && rendering.def.siblings === true;
  const siblings = useFieldSiblings(kernel, nodeId, propKey, blockSchema, wantsSiblings);
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
    (rendering.control === 'text' ||
      rendering.control === 'textarea' ||
      rendering.control === 'number');
  const inherited = !nested && bucket !== 'base' && !hasOverride;
  const effective = inherited ? (usesPlaceholder ? undefined : baseValue) : value;
  const shouldDefer = deferTextCommit && usesPlaceholder;
  const displayedValue = shouldDefer && pendingActive ? pending.value : effective;
  const placeholder = usesPlaceholder && inherited ? placeholderOf(baseValue) : undefined;
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
  const control = rendering.kind === 'default' ? rendering.control : undefined;
  // Mutation gate lives in Inspector.test: only the block declaration reaches
  // this branch; a colour-looking property name without `kind` stays ordinary.
  const showColorRole = control === 'color-role';
  const showNumeric = control === 'number';
  const showRepeater = control === 'repeater';
  const showObject = control === 'object';
  const showLink = control === 'link';
  const showPartStyles = control === 'part-styles';

  /*
    A rich-text row whose contributed editor is not mounted — still loading,
    failed to load, or threw — shows the editor SKELETON: a disabled frame
    holding the document's words, with the error and Retry on failure. This is
    the path that used to put `{"type":"doc",…}` in a one-line box.
  */
  const isRich = isRichTextSchema(schema);
  const richStandIn = isRich && rendering.kind !== 'contributed';

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
    locale,
    assetLibrary: services.assetLibrary,
    siblings,
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
      : rendering.kind === 'default' && !isCompositeControl(rendering.control)
        ? DEFAULT_CONTROLS[rendering.control]
        : ReadOnlyField;
  const fallback: Rendering =
    propertyKind === 'color-role'
      ? { kind: 'readonly', loading: false }
      : fallbackRendering(schema, false);
  const Fallback =
    fallback.kind === 'default' && !isCompositeControl(fallback.control)
      ? DEFAULT_CONTROLS[fallback.control]
      : ReadOnlyField;

  /** Sub-rows (repeater items, object keys, a link's other keys) recurse through this row. */
  const renderRow = (row: ObjectFieldRowProps): ReactNode => (
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
  );

  const resetPartStyle = (key: string, label: string): FieldCommitResult => {
    const node = kernel.getDocument().nodes[nodeId];
    if (node === undefined || blockSchema === undefined) {
      return { ok: false, message: 'This block is no longer on the page.' };
    }
    const plan = planPartStyleReset(
      node,
      blockSchema.props,
      key,
      blockDisplayName(kernel, nodeId),
      label,
    );
    if (!plan.ok) return { ok: false, message: plan.message };
    try {
      kernel.dispatchGroup(plan.steps, { author: 'user', label: plan.label });
      announce(fieldLabels.partReset(label));
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  };

  const linkKeys = (() => {
    if (!showLink) return undefined;
    const binding = partBindingFor(parts, propPath);
    if (binding?.kind === 'link') {
      return binding.textKey === undefined
        ? { hrefKey: binding.hrefKey ?? 'href' }
        : { textKey: binding.textKey, hrefKey: binding.hrefKey ?? 'href' };
    }
    return declaredLinkKeys(schema);
  })();

  const richSkeleton = (error?: string) => (
    <RichTextFieldSkeleton
      value={effective}
      controlId={controlId}
      labelledBy={labelId}
      describedBy={describedBy}
      state={error === undefined && field.failure === undefined ? 'loading' : 'failed'}
      error={error ?? field.failure?.message}
      onRetry={() => {
        field.retry();
      }}
    />
  );

  const controlNode = richStandIn ? (
    richSkeleton()
  ) : showRepeater ? (
    <RepeaterField
      schema={schema}
      value={displayedValue}
      path={fieldPath}
      disabled={controlDisabled}
      describedBy={describedBy}
      commit={door.writeValue}
      announce={announce}
      renderRow={renderRow}
    />
  ) : showObject ? (
    <ObjectField
      schema={schema}
      value={displayedValue}
      path={fieldPath}
      disabled={controlDisabled}
      describedBy={describedBy}
      commit={door.commit}
      renderRow={renderRow}
    />
  ) : showLink ? (
    <LinkField
      schema={schema}
      value={displayedValue}
      path={fieldPath}
      disabled={controlDisabled}
      controlId={controlId}
      describedBy={describedBy}
      commit={door.commit}
      textKey={linkKeys?.textKey}
      hrefKey={linkKeys?.hrefKey}
      renderRow={renderRow}
    />
  ) : showPartStyles ? (
    <PartStylesField
      {...fieldProps}
      // The row's slot is already the group its label names.
      labelledBy={undefined}
      parts={parts}
      onReset={nested ? undefined : resetPartStyle}
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
  ) : control === 'asset' || control === 'key-value' ? (
    // The row's slot is already the group its label names.
    <Control {...fieldProps} labelledBy={undefined} />
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

  const compositeControl =
    showColorRole ||
    showSegments ||
    showRepeater ||
    showObject ||
    showLink ||
    showPartStyles ||
    control === 'asset' ||
    control === 'key-value';
  const slotOwnsControlId = showSegments || showRepeater || showObject;
  // A contribution other than rich text that failed: its live default shows,
  // and the failure is said once, with Retry, instead of silently swapping.
  const otherFailure = !isRich && field.failure !== undefined;

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
          shouldDefer &&
          pendingActive &&
          // Enter commits a one-line input and a paragraph alike; in a
          // paragraph Shift+Enter is the line break (DESIGN §2.7).
          (event.target instanceof HTMLInputElement ||
            (event.target instanceof HTMLTextAreaElement && !event.shiftKey))
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
          {/* The code key names the row for assistive tech in the English
              chrome; the Arabic chrome names it by its Arabic label alone
              (it read "العنوان التمهيدي eyebrow"). */}
          {locale === 'ar' ? (
            <span>{pairItemLabel ?? schemaName(propKey, locale, displayPropertyLabel(propKey))}</span>
          ) : (
            <>
              <span aria-hidden="true">{pairItemLabel ?? displayPropertyLabel(propKey)}</span>
              <span className="bldr-visually-hidden">{propKey}</span>
            </>
          )}
        </label>
        {/* This capability is declared by the Inspector caller, rather than
            inferred from the active bucket. The glyph exists BEFORE an override
            does; the badge below still records only an owned value. */}
        {responsiveCapable ? (
          <span
            className="bldr-inspector__breakpoint-glyph"
            role="img"
            aria-label={fieldLabels.supportsDeviceOverrides}
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
          fallback={(error) => (
            <LabeledSlot
              id={slotOwnsControlId ? controlId : undefined}
              labelId={labelId}
              describedBy={describedBy}
            >
              {isRich ? (
                richSkeleton(error instanceof Error ? error.message : fieldLabels.richTextFailed)
              ) : (
                <Fallback {...fieldProps} />
              )}
            </LabeledSlot>
          )}
          onFieldError={(error) => {
            field.markFailed(error);
            field.unlock();
          }}
        >
          <LabeledSlot
            id={slotOwnsControlId ? controlId : undefined}
            labelId={labelId}
            describedBy={describedBy}
          >
            {controlNode}
          </LabeledSlot>
        </FieldErrorBoundary>
        {otherFailure ? (
          <p className="bldr-inspector__rejection" role="status">
            {field.failure.message}{' '}
            <button
              type="button"
              className="bldr-richtext-skeleton__retry"
              onClick={() => {
                field.retry();
              }}
            >
              {fieldLabels.retry}
            </button>
          </p>
        ) : null}
        {door.rejection !== null ? (
          <p id={errorId} className="bldr-inspector__rejection">
            {door.rejection}
          </p>
        ) : null}
      </div>
    </div>
  );
}
