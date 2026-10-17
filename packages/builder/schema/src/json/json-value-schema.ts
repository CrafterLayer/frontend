import { z } from 'zod';

import { findJsonViolation, type JsonValue } from './json-value';

/** Zod mirror of `JsonValue` for validating command args that carry document data. */
export const jsonValueZod: z.ZodType<JsonValue> = z
  .custom<JsonValue>()
  .superRefine((value, context) => {
    const violation = findJsonViolation(value);
    if (violation === undefined) {
      return;
    }
    context.addIssue({
      code: 'custom',
      message: `Expected a finite plain JSON value; found ${violation.kind}.`,
      path: violation.path,
    });
  });

export const jsonRecordZod = z.record(z.string(), jsonValueZod);
