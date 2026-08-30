import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import type { z } from 'zod';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { PaletteEntry } from '@craftkit/builder-renderer';
import type { BlockPropertyKind, FieldProps, FieldTypeDef, NodeId } from '@craftkit/builder-schema';

import type { EditingBucket } from '../../devices/buckets';
import { ColorRoleField } from '../../fields/ColorRoleField';
import type { FieldCommit, FieldCommitResult } from '../../fields/field-commit';
import {
  NumberField,
  ReadOnlyField,
  SelectField,
  SwitchField,
  TextField,
  type FieldControlProps,
} from '../../fields/controls';
import {
  defaultFieldFor,
  enumValuesOf,
  resolveField,
  type DefaultControl,
} from '../../fields/resolve-field';
import { MotionField } from '../../fields/MotionField';
import { FieldErrorBoundary } from './FieldErrorBoundary';
import { RepeaterField } from './RepeaterField';

type ScalarDefaultControl = Exclude<DefaultControl, 'color-role' | 'repeater'>;

const DEFAULT_CONTROLS: Record<ScalarDefaultControl, ComponentType<FieldControlProps>> = {
  text: TextField,
  select: SelectField,
  switch: SwitchField,
  number: NumberField,
  /*
    Motion joins the scalar map rather than needing its own branch the way
    `color-role` and `repeater` do: it takes plain FieldControlProps and renders
    one self-contained fieldset, so nothing about the row has to know it is
    composite.
  */
  motion: MotionField,
};

/**
 * Per-DEF load cache, module-level: keyed by the FieldTypeDef OBJECT identity —
 * a re-registered id is a DIFFERENT contribution and must load its own
 * component (an id is a registry slot name, not a version identity). Shared
 * across rows and selections so a loaded component never re-flashes; disposed
 * defs simply GC away with their entry.
 */
const fieldModuleCache = new WeakMap<FieldTypeDef, ComponentType<FieldProps> | 'failed'>();

/*
  Four lines, and the TWO SHORT ONES carry the alignment.

  The previous set was geometrically correct and visually useless: all three
  options shared an identical full-width top line and a near-identical bottom
  one, so only a single middle line moved by a couple of pixels. At the compact
  icon scale, start / center / end were indistinguishable — which is
  exactly what a person reports as "the icons are scattered, I can't tell them
  apart". Two short lines moving together is unmistakable at a glance.

  The arrows were worse than unclear, they were malformed: `m10 0-3-3` is a
  RELATIVE moveto with no absolute anchor, so after `M3 8h10` left the pen at
  (13,8) it jumped to (23,8) — outside a 16-unit viewBox entirely — and drew
  from there. Every arrowhead is now anchored absolutely at the line's own end.
*/
const SEGMENT_PATHS = {
  start: ['M3 3.5h10', 'M3 7h6', 'M3 10.5h10', 'M3 14h6'],
  left: ['M3 3.5h10', 'M3 7h6', 'M3 10.5h10', 'M3 14h6'],
  center: ['M3 3.5h10', 'M5 7h6', 'M3 10.5h10', 'M5 14h6'],
  end: ['M3 3.5h10', 'M7 7h6', 'M3 10.5h10', 'M7 14h6'],
  right: ['M3 3.5h10', 'M7 7h6', 'M3 10.5h10', 'M7 14h6'],
  justify: ['M3 3.5h10', 'M3 7h10', 'M3 10.5h10', 'M3 14h10'],
  top: ['M3 3h10', 'M4 6v7', 'M8 6v5', 'M12 6v6'],
  middle: ['M3 8h10', 'M4 3v10', 'M8 4v8', 'M12 3.5v9'],
  bottom: ['M3 13h10', 'M4 3v7', 'M8 5v5', 'M12 4v6'],
  row: ['M3 8h10', 'M9.5 4.5 13 8l-3.5 3.5'],
  'row-reverse': ['M13 8H3', 'M6.5 4.5 3 8l3.5 3.5'],
  column: ['M8 3v10', 'M4.5 9.5 8 13l3.5-3.5'],
  'column-reverse': ['M8 13V3', 'M4.5 6.5 8 3l3.5-3.5'],
} as const;

type SegmentOption = keyof typeof SEGMENT_PATHS;

const SEGMENT_LABELS: Readonly<Record<SegmentOption, string>> = {
  start: 'Start',
  left: 'Left',
  center: 'Center',
  end: 'End',
  right: 'Right',
  justify: 'Justify',
  top: 'Top',
  middle: 'Middle',
  bottom: 'Bottom',
  row: 'Row',
  'row-reverse': 'Reverse row',
  column: 'Column',
  'column-reverse': 'Reverse column',
};

const ALIGNMENT_OPTIONS = new Set<SegmentOption>([
  'start',
  'left',
  'center',
  'end',
  'right',
  'justify',
  'top',
  'middle',
  'bottom',
]);
const DIRECTION_OPTIONS = new Set<SegmentOption>([
  'row',
  'row-reverse',
  'column',
  'column-reverse',
]);

function isSegmentOption(value: string): value is SegmentOption {
  return Object.hasOwn(SEGMENT_PATHS, value);
}

function segmentKind(options: readonly string[]): 'alignment' | 'direction' | undefined {
  if (options.length < 3 || !options.every(isSegmentOption)) {
    return undefined;
  }
  if (options.every((option) => ALIGNMENT_OPTIONS.has(option))) {
    return 'alignment';
  }
  return options.every((option) => DIRECTION_OPTIONS.has(option)) ? 'direction' : undefined;
}

function alignmentIconOption(option: SegmentOption, direction: 'ltr' | 'rtl'): SegmentOption {
  if (direction !== 'rtl') {
    return option;
  }
  if (option === 'start') {
    return 'end';
  }
  if (option === 'end') {
    return 'start';
  }
  return option;
}

function normalizedKey(propKey: string): string {
  return propKey.toLowerCase().replace(/[^a-z0-9]/gu, '');
}

function displayPropertyLabel(propKey: string): string {
  const words = propKey
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[_-]+/gu, ' ')
    .trim()
    .toLowerCase();
  return words === '' ? propKey : `${words[0]?.toUpperCase() ?? ''}${words.slice(1)}`;
}

function unitFor(propKey: string): string {
  const key = normalizedKey(propKey);
  if (key.includes('duration') || key.includes('delay')) {
    return 'ms';
  }
  if (key.includes('angle') || key.includes('rotation')) {
    return 'deg';
  }
  if (
    key.includes('width') ||
    key.includes('height') ||
    key.includes('size') ||
    key.includes('spacing') ||
    key.includes('padding') ||
    key.includes('margin') ||
    key.includes('inset') ||
    key.includes('gap')
  ) {
    return 'px';
  }
  return '—';
}

/** What this row actually mounts — the unit the R8 focus lock freezes. */
type Rendering =
  | { kind: 'contributed'; def: FieldTypeDef; component: ComponentType<FieldProps> }
  | { kind: 'default'; control: DefaultControl; loading: boolean }
  | { kind: 'readonly'; loading: boolean };

function fallbackRendering(schema: z.ZodType, loading: boolean): Rendering {
  const fallback = defaultFieldFor(schema);
  return fallback.kind === 'default'
    ? { kind: 'default', control: fallback.control, loading }
    : { kind: 'readonly', loading };
}

export interface InspectorRowProps {
  kernel: BuilderKernel;
  nodeId: NodeId;
  propKey: string;
  schema: z.ZodType;
  /** Explicit block-owned field semantics; never inferred from `propKey`. */
  propertyKind?: BlockPropertyKind | undefined;
  /** Active page palette; values paint swatches only and roles cross the write door. */
  palette: readonly PaletteEntry[];
  /** Re-points a role in the live theme. Absent ⇒ the free picker is not shown. */
  onRetheme?: ((role: PaletteEntry['role'], value: string) => void) | undefined;
  bucket: EditingBucket;
  /** The bucket-scoped value: `props[key]` for base, the override otherwise. */
  value: unknown;
  /** Always `props[key]` — the inherited placeholder under override buckets. */
  baseValue: unknown;
  hasOverride: boolean;
  /** Kernel-intrinsic extension-catalog generation — re-resolves field types live. */
  catalogVersion: number;
  announce: (text: string) => void;
  /** Full schema path for contributed controls and nested repeater descendants. */
  path?: (string | number)[] | undefined;
  /** Nested rows rebuild the root array and enter through this same one-write door. */
  commitValue?: FieldCommit | undefined;
  /** Repeater descendants never own or clear the top-level responsive marker. */
  nested?: boolean | undefined;
  /** A loading contributed-array fallback disables the whole recursive surface. */
  disabled?: boolean | undefined;
  /** Text and number descendants draft locally, then commit once on blur or Enter. */
  deferTextCommit?: boolean | undefined;
  /** Explicitly declared caption for this cell when its block groups it into a pair. */
  pairItemLabel?: string | undefined;
  /** Whether this root-level row may be written through the responsive door. */
  responsiveCapable?: boolean | undefined;
}

/**
 * One property row (007 contract §4): resolveField picks the renderer, every
 * commit is ONE dispatch through the door (i2), rejections are caught and shown
 * control-adjacent via aria-describedby, and a focused row keeps its resolved
 * component until blur even if a better field type registers meanwhile (i5).
 * The control slot is a STRUCTURALLY named group (aria-labelledby), so a
 * contributed component always renders inside a context carrying the property
 * key even when it ignores `controlId`.
 */
export function InspectorRow({
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
  path,
  commitValue,
  nested = false,
  disabled = false,
  deferTextCommit = false,
  pairItemLabel,
  responsiveCapable = false,
}: InspectorRowProps) {
  const uid = useId();
  const controlId = `${uid}-control`;
  const errorId = `${uid}-error`;
  const markerId = `${uid}-marker`;
  const labelId = `${uid}-label`;
  const rowRef = useRef<HTMLDivElement | null>(null);

  const [rejection, setRejection] = useState<string | null>(null);
  /** Bumped when the module cache gains an entry this row is waiting on. */
  const [loadEpoch, setLoadEpoch] = useState(0);
  const [pending, setPending] = useState<
    { readonly active: false } | { readonly active: true; readonly value: unknown }
  >({ active: false });
  const [pendingSource, setPendingSource] = useState(value);
  if (!Object.is(value, pendingSource)) {
    setPendingSource(value);
    if (pending.active) {
      setPending({ active: false });
    }
  }

  const resolved = useMemo(() => {
    void catalogVersion; // the memo's real dependency: the catalog generation
    return resolveField(kernel.context.registry, schema, propertyKind);
  }, [kernel, schema, propertyKind, catalogVersion]);

  // Lazy load (FR-005): a rejected loader is containment, not an error state —
  // the row keeps rendering the default resolution for this schema.
  useEffect(() => {
    if (resolved.kind !== 'contributed') {
      return undefined;
    }
    const def = resolved.def;
    if (fieldModuleCache.has(def)) {
      return undefined;
    }
    let cancelled = false;
    def.load().then(
      (mod) => {
        fieldModuleCache.set(def, mod.default);
        if (!cancelled) {
          setLoadEpoch((epoch) => epoch + 1);
        }
      },
      () => {
        fieldModuleCache.set(def, 'failed');
        if (!cancelled) {
          setLoadEpoch((epoch) => epoch + 1);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [resolved]);

  const liveRendering = useMemo<Rendering>(() => {
    void loadEpoch; // the memo's real dependency: the module cache generation
    if (resolved.kind === 'contributed') {
      const entry = fieldModuleCache.get(resolved.def);
      if (entry !== undefined && entry !== 'failed') {
        return { kind: 'contributed', def: resolved.def, component: entry };
      }
      // Still loading ⇒ a DISABLED default placeholder (f3 reserves the live
      // default for FAILURE — an interim must not accept commits a contributed
      // control was registered to constrain). 'failed' ⇒ the live default.
      return fallbackRendering(schema, entry === undefined);
    }
    return resolved.kind === 'default'
      ? { kind: 'default', control: resolved.control, loading: false }
      : { kind: 'readonly', loading: false };
  }, [resolved, loadEpoch, schema]);

  // R8 focus lock: while any element inside the row owns focus, the mounted
  // renderer is frozen so a runtime registration can never steal the caret.
  const [locked, setLocked] = useState<Rendering | null>(null);
  const rendering = locked ?? liveRendering;

  // ONE guarded door for all three root commit paths (i2): base setProp,
  // responsive setResponsive, and clear. Nested rows receive a closure that
  // rebuilds the root array and returns this same result to the row that acted.
  const guardedDispatch = (command: string, args: unknown): FieldCommitResult => {
    try {
      kernel.dispatch(command, args, 'user');
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  };

  const doorCommit: FieldCommit = (next) => {
    if (bucket === 'base') {
      return guardedDispatch('setProp', { id: nodeId, key: propKey, value: next });
    }
    return guardedDispatch('setResponsive', {
      id: nodeId,
      breakpoint: bucket,
      key: propKey,
      value: next,
    });
  };

  const writeValue = commitValue ?? doorCommit;

  const commit = (next: unknown): FieldCommitResult => {
    const result = writeValue(next);
    if (result.ok) {
      setRejection(null);
      announce(`${propKey} updated`);
    } else {
      setRejection(result.message);
      announce(`${propKey} rejected`);
    }
    return result;
  };

  const clearOverride = () => {
    if (bucket === 'base' || nested) {
      return;
    }
    const result = guardedDispatch('setResponsive', {
      id: nodeId,
      breakpoint: bucket,
      key: propKey,
      value: null,
    });
    if (result.ok) {
      setRejection(null);
      announce(`${propKey} override cleared`);
    } else {
      setRejection(result.message);
      announce(`${propKey} rejected`);
    }
  };

  const handleRenderError = () => {
    if (rendering.kind === 'contributed') {
      fieldModuleCache.set(rendering.def, 'failed');
      setLoadEpoch((epoch) => epoch + 1);
    }
    setLocked(null);
  };

  // Text/number defaults express inheritance as a PLACEHOLDER (i1); choice
  // controls and contributed/readonly renderers show the effective value.
  const usesPlaceholder =
    rendering.kind === 'default' &&
    (rendering.control === 'text' || rendering.control === 'number');
  const inherited = !nested && bucket !== 'base' && !hasOverride;
  const effectiveValue = inherited ? (usesPlaceholder ? undefined : baseValue) : value;
  const shouldDefer = deferTextCommit && usesPlaceholder;
  const displayedValue = shouldDefer && pending.active ? pending.value : effectiveValue;
  const placeholder =
    usesPlaceholder && inherited && baseValue !== undefined
      ? typeof baseValue === 'string'
        ? baseValue
        : JSON.stringify(baseValue)
      : undefined;
  const showMarker = !nested && bucket !== 'base' && hasOverride;
  // This capability is declared by the Inspector caller, rather than inferred
  // from the active bucket. The glyph exists BEFORE an override does; the
  // badge below still records only an owned value.
  const supportsDeviceOverride = responsiveCapable;
  const describedByIds = [rejection === null ? null : errorId, showMarker ? markerId : null].filter(
    (id): id is string => id !== null,
  );
  const loading = rendering.kind !== 'contributed' && rendering.loading;
  const controlDisabled = disabled || loading;
  const enumOptions = enumValuesOf(schema);

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
    const admitted = new Set(enumValuesOf(schema));
    if (admitted.size === 0) return palette;
    const narrowed = palette.filter((entry) => admitted.has(entry.role));
    // An enum naming no known role means the two vocabularies have drifted;
    // showing everything is better than showing an empty picker.
    return narrowed.length === 0 ? palette : narrowed;
  }, [schema, palette]);
  const segmentedKind = segmentKind(enumOptions);
  const segmentedOptions =
    rendering.kind === 'default' &&
    rendering.control === 'select' &&
    segmentedKind !== undefined &&
    typeof displayedValue === 'string' &&
    isSegmentOption(displayedValue)
      ? enumOptions.filter(isSegmentOption)
      : [];
  const showSegments = segmentedOptions.length >= 3;
  // Mutation gate lives in Inspector.test: only the block declaration reaches
  // this branch; a colour-looking property name without `kind` stays ordinary.
  const showColorRole = rendering.kind === 'default' && rendering.control === 'color-role';
  const showNumeric = rendering.kind === 'default' && rendering.control === 'number';
  const showRepeater = rendering.kind === 'default' && rendering.control === 'repeater';
  const unit = unitFor(propKey);
  const documentDirection = kernel.getDocument().dir;
  const fieldPath =
    path ?? (bucket === 'base' ? ['props', propKey] : ['responsive', bucket, propKey]);

  const fieldProps: FieldControlProps = {
    schema,
    value: displayedValue,
    path: fieldPath,
    onChange: shouldDefer
      ? (next) => {
          setPending({ active: true, value: next });
        }
      : commit,
    ...(controlDisabled ? { disabled: true } : {}),
    controlId,
    labelledBy: labelId,
    describedBy: describedByIds.length === 0 ? undefined : describedByIds.join(' '),
    placeholder,
  };

  const boundaryKey =
    rendering.kind === 'contributed'
      ? `c-${rendering.def.id}`
      : rendering.kind === 'default'
        ? `d-${rendering.control}`
        : 'd-readonly';
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
      describedBy={describedByIds.length === 0 ? undefined : describedByIds.join(' ')}
      commit={writeValue}
      announce={announce}
      renderRow={(row) => (
        <InspectorRow
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
          path={row.path}
          commitValue={row.commit}
          nested={true}
          disabled={row.disabled}
          deferTextCommit
          responsiveCapable={false}
        />
      )}
    />
  ) : showSegments ? (
    <div className="bldr-inspector__alignment-control">
      <div className="bldr-inspector__segments">
        {segmentedOptions.map((option) => (
          <button
            key={option}
            type="button"
            className="bldr-inspector__segment"
            aria-label={`${SEGMENT_LABELS[option]} ${segmentedKind ?? 'alignment'}`}
            aria-pressed={displayedValue === option}
            disabled={controlDisabled}
            onClick={() => {
              if (displayedValue !== option) {
                commit(option);
              }
            }}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              {SEGMENT_PATHS[alignmentIconOption(option, documentDirection)].map((path) => (
                <path key={path} d={path} />
              ))}
            </svg>
          </button>
        ))}
      </div>
    </div>
  ) : showColorRole ? (
    <ColorRoleField {...fieldProps} palette={rolePalette} onRetheme={onRetheme} />
  ) : showNumeric ? (
    <div className="bldr-inspector__numeric-control">
      <Control {...fieldProps} />
      <span className="bldr-inspector__unit" aria-hidden="true">
        {unit}
      </span>
    </div>
  ) : (
    <Control {...fieldProps} />
  );

  const commitPending = () => {
    if (!shouldDefer || !pending.active) {
      return;
    }
    if (commit(pending.value).ok) {
      setPending({ active: false });
    }
  };

  const compositeControl = showColorRole || showSegments || showRepeater;
  const slotOwnsControlId = showSegments || showRepeater;

  // Structural labeling (H2): the slot is a NAMED GROUP, so a contributed
  // component always renders inside a context that carries the property key —
  // whatever it mounts. (A wrapping <label> would be wrong here: label text
  // names EVERY labelable descendant, so a contributed multi-button control
  // would have all its buttons named after the property instead of themselves.)
  // Input-like renderers take their own name from `controlId` + the visible
  // label; the group also carries the description chain for renderers that
  // ignore `describedBy`.
  const labeledSlot = (control: ReactNode) => (
    <div
      id={slotOwnsControlId ? controlId : undefined}
      role="group"
      aria-labelledby={labelId}
      aria-describedby={describedByIds.length === 0 ? undefined : describedByIds.join(' ')}
      className="bldr-inspector__control-slot"
    >
      {control}
    </div>
  );

  return (
    <div
      ref={rowRef}
      className={[
        'bldr-inspector__row',
        showSegments ? 'bldr-inspector__row--alignment' : '',
        showRepeater ? 'bldr-inspector__row--repeater' : '',
        showColorRole ? 'bldr-inspector__row--color-role' : '',
        showNumeric ? 'bldr-inspector__row--numeric' : '',
      ]
        .filter((className) => className !== '')
        .join(' ')}
      onFocus={() => {
        if (locked === null) {
          setLocked(liveRendering);
        }
      }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (
          event.key === 'Enter' &&
          !event.nativeEvent.isComposing &&
          event.target instanceof HTMLInputElement &&
          shouldDefer &&
          pending.active
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
            setLocked(null);
          }
        } else if (!(row?.contains(document.activeElement) ?? false)) {
          // relatedTarget is null on window blur too — the control still owns
          // document focus then, and the R8 lock must survive (i5).
          commitPending();
          setLocked(null);
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
        {supportsDeviceOverride ? (
          <span
            className="bldr-inspector__breakpoint-glyph"
            role="img"
            aria-label="Supports device overrides"
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
              <rect x="2.5" y="3" width="11" height="8" rx="1.25" />
              <path d="M6.5 13h3M8 11v2" />
            </svg>
          </span>
        ) : null}
      </div>
      <div className="bldr-inspector__value">
        {showMarker ? (
          <div className="bldr-inspector__override-row">
            <span id={markerId} className="bldr-inspector__override">
              {bucket} override
            </span>
            <button
              type="button"
              className="bldr-inspector__clear"
              aria-label={`Clear ${propKey} override`}
              onClick={clearOverride}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="m4 4 8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        ) : null}
        <FieldErrorBoundary
          key={boundaryKey}
          fallback={labeledSlot(<Fallback {...fieldProps} />)}
          onFieldError={handleRenderError}
        >
          {labeledSlot(control)}
        </FieldErrorBoundary>
        {rejection !== null ? (
          <p id={errorId} className="bldr-inspector__rejection">
            {rejection}
          </p>
        ) : null}
      </div>
    </div>
  );
}
