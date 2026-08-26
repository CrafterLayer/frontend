import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';

import type { z } from 'zod';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { FieldProps, FieldTypeDef, NodeId } from '@craftkit/builder-schema';

import type { EditingBucket } from '../../devices/buckets';
import {
  NumberField,
  ReadOnlyField,
  SelectField,
  SwitchField,
  TextField,
  type FieldControlProps,
} from '../../fields/controls';
import { defaultFieldFor, resolveField, type DefaultControl } from '../../fields/resolve-field';
import { FieldErrorBoundary } from './FieldErrorBoundary';

const DEFAULT_CONTROLS: Record<DefaultControl, ComponentType<FieldControlProps>> = {
  text: TextField,
  select: SelectField,
  switch: SwitchField,
  number: NumberField,
};

/**
 * Per-DEF load cache, module-level: keyed by the FieldTypeDef OBJECT identity —
 * a re-registered id is a DIFFERENT contribution and must load its own
 * component (an id is a registry slot name, not a version identity). Shared
 * across rows and selections so a loaded component never re-flashes; disposed
 * defs simply GC away with their entry.
 */
const fieldModuleCache = new WeakMap<FieldTypeDef, ComponentType<FieldProps> | 'failed'>();

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
  bucket: EditingBucket;
  /** The bucket-scoped value: `props[key]` for base, the override otherwise. */
  value: unknown;
  /** Always `props[key]` — the inherited placeholder under override buckets. */
  baseValue: unknown;
  hasOverride: boolean;
  /** Kernel-intrinsic extension-catalog generation — re-resolves field types live. */
  catalogVersion: number;
  announce: (text: string) => void;
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
  bucket,
  value,
  baseValue,
  hasOverride,
  catalogVersion,
  announce,
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

  const resolved = useMemo(() => {
    void catalogVersion; // the memo's real dependency: the catalog generation
    return resolveField(kernel.context.registry, schema);
  }, [kernel, schema, catalogVersion]);

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

  // ONE guarded door for all three commit paths (i2): base setProp, override
  // setResponsive, and clear — rejections are always caught, shown, announced.
  const guardedDispatch = (command: string, args: unknown, successText: string) => {
    try {
      kernel.dispatch(command, args, 'user');
      setRejection(null);
      announce(successText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRejection(message);
      announce(`${propKey} rejected`);
    }
  };

  const commit = (next: unknown) => {
    if (bucket === 'base') {
      guardedDispatch('setProp', { id: nodeId, key: propKey, value: next }, `${propKey} updated`);
    } else {
      guardedDispatch(
        'setResponsive',
        { id: nodeId, breakpoint: bucket, key: propKey, value: next },
        `${propKey} updated`,
      );
    }
  };

  const clearOverride = () => {
    if (bucket === 'base') {
      return;
    }
    guardedDispatch(
      'setResponsive',
      { id: nodeId, breakpoint: bucket, key: propKey, value: null },
      `${propKey} override cleared`,
    );
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
  const inherited = bucket !== 'base' && !hasOverride;
  const effectiveValue = inherited ? (usesPlaceholder ? undefined : baseValue) : value;
  const placeholder =
    usesPlaceholder && inherited && baseValue !== undefined
      ? typeof baseValue === 'string'
        ? baseValue
        : JSON.stringify(baseValue)
      : undefined;
  const showMarker = bucket !== 'base' && hasOverride;
  const describedByIds = [rejection === null ? null : errorId, showMarker ? markerId : null].filter(
    (id): id is string => id !== null,
  );
  const loading = rendering.kind !== 'contributed' && rendering.loading;

  const fieldProps: FieldControlProps = {
    schema,
    value: effectiveValue,
    path: bucket === 'base' ? ['props', propKey] : ['responsive', bucket, propKey],
    onChange: commit,
    ...(loading ? { disabled: true } : {}),
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
      : rendering.kind === 'default'
        ? DEFAULT_CONTROLS[rendering.control]
        : ReadOnlyField;
  const fallback = fallbackRendering(schema, false);
  const Fallback = fallback.kind === 'default' ? DEFAULT_CONTROLS[fallback.control] : ReadOnlyField;

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
      className="bldr-inspector__row"
      onFocus={() => {
        if (locked === null) {
          setLocked(liveRendering);
        }
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        const row = rowRef.current;
        if (next !== null) {
          if (!(row?.contains(next) ?? false)) {
            setLocked(null);
          }
        } else if (!(row?.contains(document.activeElement) ?? false)) {
          // relatedTarget is null on window blur too — the control still owns
          // document focus then, and the R8 lock must survive (i5).
          setLocked(null);
        }
      }}
    >
      <div className="bldr-inspector__row-head">
        <label id={labelId} className="bldr-inspector__label" htmlFor={controlId}>
          {propKey}
        </label>
        {showMarker ? (
          <>
            <span id={markerId} className="bldr-inspector__override">
              {bucket} override
            </span>
            <button
              type="button"
              className="bldr-inspector__clear"
              aria-label={`Clear ${propKey} override`}
              onClick={clearOverride}
            >
              ✕
            </button>
          </>
        ) : null}
      </div>
      <FieldErrorBoundary
        key={boundaryKey}
        fallback={labeledSlot(<Fallback {...fieldProps} />)}
        onFieldError={handleRenderError}
      >
        {labeledSlot(<Control {...fieldProps} />)}
      </FieldErrorBoundary>
      {rejection !== null ? (
        <p id={errorId} className="bldr-inspector__rejection">
          {rejection}
        </p>
      ) : null}
    </div>
  );
}
