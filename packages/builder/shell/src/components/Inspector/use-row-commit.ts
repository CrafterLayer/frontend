import { useState } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import type { NodeId } from '@craftkit/builder-schema';

import type { EditingBucket } from '../../devices/buckets';
import type { FieldCommit, FieldCommitResult } from '../../fields/field-commit';

export interface RowCommitOptions {
  readonly kernel: BuilderKernel;
  readonly nodeId: NodeId;
  readonly propKey: string;
  readonly bucket: EditingBucket;
  readonly nested: boolean;
  /** Nested rows rebuild the root array and enter through this same one-write door. */
  readonly commitValue: FieldCommit | undefined;
  readonly announce: (text: string) => void;
}

export interface RowCommit {
  readonly rejection: string | null;
  /** The raw door — what a repeater hands its descendants. */
  readonly writeValue: FieldCommit;
  /** The door plus the row's own bookkeeping: rejection text and announcement. */
  readonly commit: (next: unknown) => FieldCommitResult;
  readonly clearOverride: () => void;
}

/**
 * ONE guarded door for all three root commit paths (i2): base setProp,
 * responsive setResponsive, and clear. Nested rows receive a closure that
 * rebuilds the root array and returns this same result to the row that acted.
 */
export function useRowCommit({
  kernel,
  nodeId,
  propKey,
  bucket,
  nested,
  commitValue,
  announce,
}: RowCommitOptions): RowCommit {
  const [rejection, setRejection] = useState<string | null>(null);

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

  return { rejection, writeValue, commit, clearOverride };
}
