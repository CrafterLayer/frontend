import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { commandArgsJsonSchema } from './json-schema';
import { isJsonValue } from './json/json-value';
import type { RegisteredCommand } from './commands';

describe('commandArgsJsonSchema', () => {
  it('turns a registered command argument schema into detached JSON data', () => {
    const argsSchema = z.object({
      id: z.string().min(1),
      value: z.union([z.string(), z.number()]),
    });

    const command: RegisteredCommand = {
      argsSchema,
      apply: () => () => undefined,
    };

    const schema = commandArgsJsonSchema(command);

    expect(isJsonValue(schema)).toBe(true);
    expect(schema).toMatchObject({
      type: 'object',
      properties: {
        id: expect.objectContaining({ type: 'string' }) as unknown,
      },
    });
    expect(schema).not.toHaveProperty('apply');
    expect(JSON.stringify(schema)).not.toContain('_zod');
  });
});
