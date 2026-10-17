import type { ReactNode } from 'react';

import type { z } from 'zod';

import type { FieldCommit } from '../../../fields/field-commit';

export interface RepeaterRowRenderProps {
  readonly key: string;
  readonly propKey: string;
  readonly schema: z.ZodType;
  readonly value: unknown;
  readonly path: (string | number)[];
  readonly commit: FieldCommit;
  readonly disabled: boolean;
}

export interface RepeaterFieldProps {
  readonly schema: z.ZodType;
  readonly value: unknown;
  readonly path: (string | number)[];
  readonly disabled?: boolean | undefined;
  readonly describedBy?: string | undefined;
  readonly commit: FieldCommit;
  readonly announce: (text: string) => void;
  readonly renderRow: (props: RepeaterRowRenderProps) => ReactNode;
}
