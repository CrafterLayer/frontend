import type {
  ChangeLineView,
  EditOrigin,
  EditPhase,
  EditStageKey,
  RecordMenuItem,
  UndoView,
} from './view-types';

/** One edit record; partial acceptance stays visible beside its actual changes and Undo. */
export interface EditRecordView {
  readonly turnId: string;
  readonly phase: EditPhase;
  readonly origin: EditOrigin;
  readonly target?: string | undefined;
  readonly stage?: EditStageKey | undefined;
  readonly changes: readonly ChangeLineView[];
  readonly partial?: { readonly kept: number; readonly total: number } | undefined;
  /** A real transaction landed without a describable change line; keep Undo and say so. */
  readonly unlisted?: true | undefined;
  readonly elapsedMs?: number | undefined;
  readonly revealNodeId?: string | undefined;
  readonly undo?: UndoView | undefined;
  readonly menu: readonly RecordMenuItem[];
}
