import { z } from 'zod';

import type { JsonValue } from './json-value';

/** Zod mirror of `JsonValue` for validating command args that carry document data. */
export const jsonValueZod: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueZod),
    z.record(z.string(), jsonValueZod),
  ]),
);

export const jsonRecordZod = z.record(z.string(), jsonValueZod);
