import type { ComponentType } from 'react';

import type { z } from 'zod';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { ColorRole, PaletteEntry } from '@craftkit/builder-renderer';
import type {
  BlockPropertyGroup,
  BlockPropertyKind,
  BlockPropertyTab,
  BuilderDocument,
  FieldProps,
  FieldTypeDef,
  NodeId,
} from '@craftkit/builder-schema';

import type { EditingBucket } from '../../devices/buckets';
import type { FieldCommit } from '../../fields/field-commit';
import type { DefaultControl } from '../../fields/resolve-field';
import type { SegmentOption } from './segment-icons';

export type { SegmentOption } from './segment-icons';

export type KernelState = ReturnType<BuilderKernel['context']['store']['getState']>;

export type DocumentDirection = BuilderDocument['dir'];

export type InspectorProperty = readonly [propKey: string, schema: z.ZodType];

/**
 * The shell's temporary view of the optional schema-owned pair contract.
 *
 * `BlockPropertyGroup` will expose this shape after the schema-owning change.
 * Keeping the runtime reader narrow lets existing blocks remain compatible while
 * making the Inspector ready to consume an explicitly declared pair immediately.
 */
export interface InspectorPairDeclaration {
  /** Stable local identity shared by exactly two properties in one section. */
  readonly id: string;
  /** One visible heading for the two values, for example "Margin". */
  readonly label: string;
  /** The declared caption for this individual cell, for example "Top". */
  readonly cellLabel: string;
}

export type InspectorPropertyGroup = BlockPropertyGroup & {
  readonly pair?: InspectorPairDeclaration | undefined;
};

export type ErasedPropertyGroups = Readonly<Record<string, InspectorPropertyGroup | undefined>>;

export type InspectorSectionEntry =
  | { readonly kind: 'property'; readonly property: InspectorProperty }
  | {
      readonly kind: 'pair';
      readonly id: string;
      readonly label: string;
      readonly properties: readonly {
        readonly property: InspectorProperty;
        readonly pair: InspectorPairDeclaration;
      }[];
    };

export interface InspectorSectionModel {
  readonly name: string;
  readonly entries: readonly InspectorSectionEntry[];
}

export interface InspectorTabModel {
  readonly id: BlockPropertyTab;
  readonly label: string;
  readonly sections: readonly InspectorSectionModel[];
}

/**
 * Everything a row needs that is NOT its own property: one object, memoised by
 * the Inspector, so a row's memo boundary compares a single reference. A new
 * scope identity (registry epoch, palette, direction, bucket, selection) is
 * exactly the set of events that must re-render every mounted row once.
 */
export interface InspectorRowScope {
  readonly kernel: BuilderKernel;
  readonly nodeId: NodeId;
  readonly bucket: EditingBucket;
  readonly catalogVersion: number;
  readonly palette: readonly PaletteEntry[];
  readonly onRetheme: ((role: ColorRole, value: string) => void) | undefined;
  readonly announce: (text: string) => void;
  readonly dir: DocumentDirection;
  readonly declarations: ErasedPropertyGroups | undefined;
}

export interface InspectorRowBodyProps {
  readonly kernel: BuilderKernel;
  readonly nodeId: NodeId;
  readonly propKey: string;
  readonly schema: z.ZodType;
  /** Explicit block-owned field semantics; never inferred from `propKey`. */
  readonly propertyKind?: BlockPropertyKind | undefined;
  /** Active page palette; values paint swatches only and roles cross the write door. */
  readonly palette: readonly PaletteEntry[];
  /** Re-points a role in the live theme. Absent ⇒ the free picker is not shown. */
  readonly onRetheme?: ((role: PaletteEntry['role'], value: string) => void) | undefined;
  readonly bucket: EditingBucket;
  /** The bucket-scoped value: `props[key]` for base, the override otherwise. */
  readonly value: unknown;
  /** Always `props[key]` — the inherited placeholder under override buckets. */
  readonly baseValue: unknown;
  readonly hasOverride: boolean;
  /** Kernel-intrinsic extension-catalog generation — re-resolves field types live. */
  readonly catalogVersion: number;
  readonly announce: (text: string) => void;
  /** Document direction, read once at the shell and handed down (never re-read in a row). */
  readonly dir: DocumentDirection;
  /** Full schema path for contributed controls and nested repeater descendants. */
  readonly path?: (string | number)[] | undefined;
  /** Nested rows rebuild the root array and enter through this same one-write door. */
  readonly commitValue?: FieldCommit | undefined;
  /** Repeater descendants never own or clear the top-level responsive marker. */
  readonly nested?: boolean | undefined;
  /** A loading contributed-array fallback disables the whole recursive surface. */
  readonly disabled?: boolean | undefined;
  /** Text and number descendants draft locally, then commit once on blur or Enter. */
  readonly deferTextCommit?: boolean | undefined;
  /** Explicitly declared caption for this cell when its block groups it into a pair. */
  readonly pairItemLabel?: string | undefined;
  /** Whether this root-level row may be written through the responsive door. */
  readonly responsiveCapable?: boolean | undefined;
}

/** The three primitive/immer-stable reads one row subscribes to. */
export interface PropertyValueSnapshot {
  readonly stored: unknown;
  readonly override: unknown;
  readonly hasOverride: boolean;
}

/** What this row actually mounts — the unit the R8 focus lock freezes. */
export type Rendering =
  | { kind: 'contributed'; def: FieldTypeDef; component: ComponentType<FieldProps> }
  | { kind: 'default'; control: DefaultControl; loading: boolean }
  | { kind: 'readonly'; loading: boolean };

export type SegmentKind = 'alignment' | 'direction';

export interface SchemaFacts {
  readonly enumOptions: readonly string[];
  readonly segmentKind: SegmentKind | undefined;
  readonly segmentOptions: readonly SegmentOption[];
}

export interface AnnouncerState {
  readonly text: string;
  readonly nonce: number;
}

export interface Announcer {
  readonly announce: (text: string) => void;
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => AnnouncerState;
}
